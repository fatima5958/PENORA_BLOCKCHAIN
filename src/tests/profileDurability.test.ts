import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ session: vi.fn(), query: vi.fn(), metadata: vi.fn(), current: vi.fn() }));
vi.mock('../lib/supabaseClient', () => ({ supabase: { auth: { getSession: mocks.session, updateUser: mocks.metadata }, from: mocks.query } }));
vi.mock('../lib/auth/penoraKeyAuth', () => ({ penoraKeyAuth: { getCurrentUser: mocks.current, hasPermission: () => true } }));
import { updateProfile, getProfileById } from '../lib/api/profiles';
const saved = { id: 'owner', username: 'writer', display_name: 'My name', bio: 'My bio', avatar_url: 'https://example.com/my-upload.jpg', location: 'Karachi', interests: ['Writing'] };
function response(result: unknown) {
 const chain: any = {};
 for (const method of ['update', 'eq', 'select', 'upsert']) chain[method] = vi.fn(() => chain);
 chain.maybeSingle = vi.fn(async () => result);
 return chain;
}
describe('Durable profile updates', () => {
 beforeEach(() => { vi.resetAllMocks(); mocks.session.mockResolvedValue({ data: { session: { user: { id: 'owner', email: 'writer@example.com' } } } }); mocks.current.mockReturnValue(null); });
 it('reads saved metadata and uploaded photo from the database on a fresh load', async () => {
  mocks.query.mockImplementation(() => response({ data: saved, error: null }));
  const result = await updateProfile('owner', { display_name: saved.display_name, bio: saved.bio, avatar_url: saved.avatar_url, location: saved.location, interests: saved.interests });
  expect(result.error).toBeNull();
  const reloaded = await getProfileById('owner');
  expect(reloaded.data).toEqual(saved);
 });
 it('rejects a save whose fresh database read returns older content', async () => {
  mocks.query.mockReturnValueOnce(response({ data: saved, error: null })).mockReturnValueOnce(response({ data: { ...saved, bio: 'Old bio'}, error: null }));
  const result = await updateProfile('owner', { bio: saved.bio });
  expect(result.error).toMatch(/verify saved/i);
 });
 it('does not report success when no row was written', async () => {
  mocks.query.mockImplementation(() => response({ data: null, error: null }));
  const result = await updateProfile('owner', { bio: 'New bio' });
  expect(result.data).toBeNull(); expect(result.error).toMatch(/not saved/i);
 });
 it('does not hide unsupported fields behind a partial cache-only save', async () => {
  mocks.query.mockImplementation(() => response({ data: null, error: { code: '42703', message: 'column location does not exist' } }));
  const result = await updateProfile('owner', { location: 'Karachi' });
  expect(result.data).toBeNull(); expect(result.error).toContain('column'); expect(mocks.query).toHaveBeenCalledTimes(1);
 });
});
