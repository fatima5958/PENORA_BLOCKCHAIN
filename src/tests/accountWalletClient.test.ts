import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateKeyPair } from '../lib/crypto/penoraKeys';
import { accountRequest, AccountWalletRequestError, validateAccountSnapshot } from '../lib/wallet/accountClient';
import type { AccountRequest } from '../lib/wallet/accountProtocol';

const key = generateKeyPair('active').privateKeyWif;
const body: AccountRequest = { username: 'alice', action: 'transfer', recipient: 'bob', asset: 'USDT', amount: '1.000001', nonce: '12345678-1234-4234-8234-123456789abc', expires: 1 };
afterEach(() => { vi.unstubAllGlobals(); });
describe('Account wallet verified responses and retry safety', () => {
  it('renews an expired signature while preserving the transfer identity, and never sends the private key', async () => {
    vi.stubGlobal('window', { location: { origin: 'https://penora.test' } });
    const fetch = vi.fn().mockResolvedValue(Response.json({ receipt: { id: 'receipt', status: 'confirmed', recipient: 'bob', asset: 'USDT', units: '1000001' }, fee: '0', settlement: 'internal' }));
    vi.stubGlobal('fetch', fetch);
    await accountRequest(body, key);
    const sent = JSON.parse(fetch.mock.calls[0][1].body);
    expect(sent).toMatchObject({ nonce: body.nonce, amount: body.amount, recipient: body.recipient });
    expect(sent.expires).toBeGreaterThan(Date.now());
    expect(sent.signature).toMatch(/^[0-9a-f]{128}$/);
    expect(fetch.mock.calls[0][1].body).not.toContain(key);
  });
  it('does not treat a mismatched successful response as a confirmed transfer', async () => {
    vi.stubGlobal('window', { location: { origin: 'https://penora.test' } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ receipt: { id: 'receipt', status: 'confirmed', recipient: 'mallory', asset: 'USDT', units: '1000001' }, fee: '0', settlement: 'internal' })));
    await expect(accountRequest(body, key)).rejects.toMatchObject({ status: 503, rejected: false });
  });
  it('separates rejected requests from uncertain server failures', () => {
    expect(new AccountWalletRequestError('Insufficient account balance', 409).rejected).toBe(true);
    expect(new AccountWalletRequestError('Unavailable', 503).rejected).toBe(false);
  });
  it('preserves large integer balances and rejects rounded JSON numbers', () => {
    const balances = { PNR: '123456789012345678901234567890', USDT: '1000001' };
    expect(validateAccountSnapshot({ balances, transfers: [] }).balances).toEqual(balances);
    expect(() => validateAccountSnapshot({ balances: { PNR: 123456789012345678901234567890, USDT: '1000001' }, transfers: [] })).toThrow('could not be verified');
  });
  it('rejects malformed history before it reaches the activity screen', () => {
    expect(() => validateAccountSnapshot({ balances: { PNR: '0', USDT: '0' }, transfers: [{ id: 'x', asset: 'ETH', units: '-1', created_at: 'invalid', direction: 'sent', counterparty: 'bob' }] })).toThrow();
  });
});
