import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: { getUser: mocks.getUser }, from: mocks.from }) }));
import { POST } from '../../api/wallet/recipient';
const address = '0x1111111111111111111111111111111111111111';
const profile = { id: 'recipient-id', username: 'writer', display_name: 'Writer' };
function chain(result: unknown) {
  const query: any = {};
  query.select = vi.fn(() => query); query.eq = vi.fn(() => query); query.maybeSingle = vi.fn(async () => result);
  return query;
}
function request(body: unknown = { username: '@Writer' }, token = 'valid') {
  return new Request('https://penora.example/api/wallet/recipient', { method: 'POST', headers: token ? { Authorization: 'Bearer ' + token } : {}, body: JSON.stringify(body) });
}
describe('Verified creator recipient lookup', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('SUPABASE_URL', 'https://test.supabase.co'); vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-server-key');
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'sender-id' } }, error: null });
    mocks.from.mockImplementation(table => chain(table === 'profiles' ? { data: profile, error: null } : { data: { wallet_address: address, verified_at: '2026-10-22', verification_reference: 'signed-wallet-challenge:test' }, error: null }));
  });
  it('requires authentication without touching the database', async () => {
    expect((await POST(request({}, ''))).status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('rejects invalid sessions', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: new Error('invalid') });
    expect((await POST(request())).status).toBe(401); expect(mocks.from).not.toHaveBeenCalled();
  });
  it('normalizes the exact username and returns only recipient routing data', async () => {
    const query = chain({ data: profile, error: null });
    mocks.from.mockImplementation(table => table === 'profiles' ? query : chain({ data: { wallet_address: address, verified_at: '2026-10-22', verification_reference: 'signed-wallet-challenge:test', secret: 'hidden' }, error: null }));
    const res = await POST(request());
    expect(res.status).toBe(200);
    expect(query.eq).toHaveBeenCalledWith('username', 'writer');
    expect(await res.json()).toEqual({ recipient: { id: 'recipient-id', username: 'writer', displayName: 'Writer', address, chainId: 80002 } });
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });
  it('blocks sending to the signed-in account', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: profile.id } }, error: null });
    expect((await POST(request())).status).toBe(400);
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });
  it('does not invent a wallet for a missing creator', async () => {
    mocks.from.mockReturnValue(chain({ data: null, error: null }));
    expect((await POST(request())).status).toBe(404);
  });
  it.each([null, { wallet_address: address, verified_at: '2026-10-22', verification_reference: 'manual-unverified' }, { wallet_address: '0x0000000000000000000000000000000000000000', verified_at: '2026-10-22', verification_reference: 'signed-wallet-challenge:test' }])('rejects unverified or zero-address bindings', async binding => {
    mocks.from.mockImplementation(table => chain({ data: table === 'profiles' ? profile : binding, error: null }));
    expect((await POST(request())).status).toBe(409);
  });
  it('fails closed on database errors', async () => {
    mocks.from.mockReturnValue(chain({ data: null, error: new Error('private-database-detail') }));
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('private-database-detail');
  });
});
