import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateAccountKeySuite, signChallenge } from '../lib/crypto/penoraKeys';
import { accountMessage, accountUnits, displayAccountUnits, validateAccountRequest, type AccountRequest } from '../lib/wallet/accountProtocol';
import { lockAccountWallet, unlockAccountWallet } from '../lib/wallet/accountVault';

const mock = vi.hoisted(() => ({ rpc: vi.fn(), send: vi.fn(), publicKey: '', from: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: mock.from, rpc: mock.rpc }) }));
vi.mock('viem', async original => ({ ...await original<any>(),
  createWalletClient: () => ({ sendTransaction: mock.send }),
  createPublicClient: () => ({ request: vi.fn() }),
}));
import { makeEmbeddedProvider } from '../lib/wallet/embeddedProvider';
import { POST } from '../../api/wallet/account';
const suite = generateAccountKeySuite();
const origin = 'https://penora.test';
const request = (): AccountRequest => ({ action: 'transfer', username: 'alice', recipient: 'bob', asset: 'USDT', amount: '1.000001', nonce: '12345678-1234-4234-8234-123456789abc', expires: Date.now() + 60_000 });
function signed(body: AccountRequest, key = suite.active.privateKeyWif, signedOrigin = origin) {
  return new Request(`${origin}/api/wallet/account`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ ...body, signature: signChallenge(accountMessage(body, signedOrigin), key) }) });
}
beforeEach(() => {
  vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'server-only-test');
  mock.publicKey = suite.active.publicKeyPen;
  mock.from.mockImplementation((name: string) => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: name === 'profiles' ? { id: 'alice-id' } : { active_public_key: mock.publicKey }, error: null }) }) }) }));
  mock.rpc.mockResolvedValue({ data: { id: 'receipt', status: 'confirmed' }, error: null });
  mock.send.mockResolvedValue('0xabc');
});
afterEach(() => { lockAccountWallet(); vi.clearAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe('PENORA internal wallet security and precision', () => {
  it('preserves the smallest USDT and PNR units without floats', () => {
    expect(accountUnits('1.000001', 'USDT')).toBe(1000001n);
    expect(accountUnits('0.000000000000000001', 'PNR')).toBe(1n);
    expect(displayAccountUnits('123456789012345678901234567890', 'PNR')).toBe('123456789012.34567890123456789');
  });
  it.each(['0', '-1', '1e2', '1.0000001', 'NaN', 'Infinity', '01'])('rejects invalid USDT amount %s', amount => {
    expect(() => accountUnits(amount, 'USDT')).toThrow();
  });
  it('rejects malformed UUIDs before calling the database', () => {
    expect(() => validateAccountRequest({ ...request(), nonce: '-'.repeat(36) })).toThrow('identifier');
  });
  it('rejects expired requests and self transfers', () => {
    expect(() => validateAccountRequest({ ...request(), expires: Date.now() - 1 })).toThrow('expired');
    expect(() => validateAccountRequest({ ...request(), recipient: 'alice' })).toThrow('another');
  });
  it('verifies the Active Key and sends exact units and idempotency key to the atomic RPC', async () => {
    const body = request();
    const response = await POST(signed(body));
    expect(response.status).toBe(200);
    expect(mock.rpc).toHaveBeenCalledWith('penora_account_transfer', expect.objectContaining({ p_sender: 'alice-id', p_units: '1000001', p_nonce: body.nonce, p_active_key: suite.active.publicKeyPen }));
    expect(await response.json()).toMatchObject({ fee: '0', settlement: 'internal' });
  });
  it('rejects a Posting Key as spending authority', async () => {
    expect((await POST(signed(request(), suite.posting.privateKeyWif))).status).toBe(403);
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it('rejects signatures reused on another origin', async () => {
    expect((await POST(signed(request(), suite.active.privateKeyWif, 'https://attacker.test'))).status).toBe(403);
  });
  it('rejects amount tampering after signing', async () => {
    const original = signed(request()); const body = await original.json(); body.amount = '5';
    const tampered = new Request(original.url, { method: 'POST', headers: original.headers, body: JSON.stringify(body) });
    expect((await POST(tampered)).status).toBe(403);
  });
  it('does not report success after an insufficient balance error', async () => {
    mock.rpc.mockResolvedValue({ data: null, error: { message: 'Insufficient account balance' } });
    const response = await POST(signed(request()));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'Insufficient account balance' });
  });
  it('fails closed without the server configuration', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    expect((await POST(signed(request()))).status).toBe(503);
  });
});
describe('Built-in external wallet', () => {
  it('does not broadcast when the user declines confirmation', async () => {
    vi.stubGlobal('window', { confirm: () => false });
    unlockAccountWallet('alice', suite.active.privateKeyWif);
    const provider = makeEmbeddedProvider('alice', suite.active.privateKeyWif);
    const [address] = await provider.request({ method: 'eth_accounts' });
    await expect(provider.request({ method: 'eth_sendTransaction', params: [{ from: address, to: address }] })).rejects.toThrow('cancelled');
    expect(mock.send).not.toHaveBeenCalled();
  });
  it('derives a stable EVM identity without an injected wallet', async () => {
    unlockAccountWallet('alice', suite.active.privateKeyWif);
    const first = makeEmbeddedProvider('alice', suite.active.privateKeyWif);
    const second = makeEmbeddedProvider('alice', suite.active.privateKeyWif);
    expect(await first.request({ method: 'eth_accounts' })).toEqual(await second.request({ method: 'eth_requestAccounts' }));
    expect(await first.request({ method: 'eth_chainId' })).toBe('0x13882');
  });
  it('blocks access after lock and blocks unsupported networks', async () => {
    unlockAccountWallet('alice', suite.active.privateKeyWif);
    const provider = makeEmbeddedProvider('alice', suite.active.privateKeyWif);
    await expect(provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x89' }] })).rejects.toThrow('Amoy');
    lockAccountWallet();
    await expect(provider.request({ method: 'eth_accounts' })).rejects.toThrow('Unlock');
  });
  it('sends through the built-in signer and rejects mismatched transaction accounts', async () => {
    vi.stubGlobal('window', { confirm: () => true });
    unlockAccountWallet('alice', suite.active.privateKeyWif);
    const provider = makeEmbeddedProvider('alice', suite.active.privateKeyWif);
    const [address] = await provider.request({ method: 'eth_accounts' });
    await expect(provider.request({ method: 'eth_sendTransaction', params: [{ from: address, to: address, data: '0xa9059cbb', value: '0x0' }] })).resolves.toBe('0xabc');
    expect(mock.send).toHaveBeenCalledWith(expect.objectContaining({ value: 0n, data: '0xa9059cbb' }));
    await expect(provider.request({ method: 'eth_sendTransaction', params: [{ from: '0x0000000000000000000000000000000000000001' }] })).rejects.toThrow('mismatch');
    expect(mock.send).toHaveBeenCalledTimes(1);
  });
});
