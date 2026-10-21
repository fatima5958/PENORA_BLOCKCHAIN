import { beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => ({
  user: '11111111-1111-4111-8111-111111111111',
  rows: [] as any[], error: null as any, deleteDenied: false, queries: 0,
}));

vi.mock('../lib/supabaseClient', () => ({ supabase: {
  auth: { getUser: vi.fn(async () => ({ data: { user: fake.user ? { id: fake.user } : null }, error: null })) },
  from: vi.fn(() => {
    fake.queries++;
    let action = 'select';
    let payload: any;
    const filters: Record<string, unknown> = {};
    const execute = () => {
      if (fake.error) return { data: null, error: fake.error };
      const matches = fake.rows.filter(row => Object.entries(filters).every(([k, v]) => row[k] === v));
      if (action === 'insert') {
        const row = { ...payload, id: 'saved-vote', created_at: new Date().toISOString() };
        fake.rows.push(row);
        return { data: [row], error: null };
      }
      if (action === 'update') matches.forEach(row => Object.assign(row, payload));
      if (action === 'delete') {
        if (fake.deleteDenied) return { data: [], error: null };
        fake.rows = fake.rows.filter(row => !matches.includes(row));
      }
      return { data: matches, error: null };
    };
    const query: any = {
      select: () => query,
      eq: (key: string, value: unknown) => { filters[key] = value; return query; },
      insert: (value: unknown) => { action = 'insert'; payload = value; return query; },
      update: (value: unknown) => { action = 'update'; payload = value; return query; },
      delete: () => { action = 'delete'; return query; },
      maybeSingle: async () => { const r = execute(); return { ...r, data: r.data?.[0] ?? null }; },
      then: (resolve: any, reject: any) => Promise.resolve(execute()).then(resolve, reject),
    };
    return query;
  }),
} }));

import { castVote, getVotesForPost, removeVote } from '../lib/api/votes';
const voter = '11111111-1111-4111-8111-111111111111';
const post = '22222222-2222-4222-8222-222222222222';

beforeEach(() => { fake.user = voter; fake.rows = []; fake.error = null; fake.deleteDenied = false; fake.queries = 0; });

describe('Authenticated upvote and downvote persistence', () => {
  it('saves, switches and toggles one vote while returning shared counts', async () => {
    expect((await castVote({ voter_id: voter, post_id: post, value: 1 })).stats).toEqual({ upvotes: 1, downvotes: 0, score: 1, userVote: 1 });
    expect((await castVote({ voter_id: voter, post_id: post, value: -1 })).stats).toEqual({ upvotes: 0, downvotes: 1, score: -1, userVote: -1 });
    expect(fake.rows).toHaveLength(1);
    expect((await castVote({ voter_id: voter, post_id: post, value: -1 })).stats?.userVote).toBeNull();
    expect(fake.rows).toHaveLength(0);
  });
  it('never masks a database permission rejection with local success', async () => {
    fake.error = { code: '42501', message: 'permission denied' };
    const result = await castVote({ voter_id: voter, post_id: post, value: -1 });
    expect(result.error).toBe('permission denied');
    expect(result.data).toBeNull();
    expect(result.stats).toBeUndefined();
  });
  it('reports missing tables as an unsaved vote', async () => {
    fake.error = { code: 'PGRST205', message: 'Table not found' };
    const result = await castVote({ voter_id: voter, post_id: post, value: -1 });
    expect(result.isPendingMigration).toBe(true);
    expect(result.error).toContain('not saved');
  });
  it('rejects a forged voter identity before database mutation', async () => {
    fake.user = '33333333-3333-4333-8333-333333333333';
    const result = await castVote({ voter_id: voter, post_id: post, value: -1 });
    expect(result.error).toContain('account changed');
    expect(fake.queries).toBe(0);
  });
  it('requires an authenticated session and never records guest votes', async () => {
    fake.user = '';
    expect((await castVote({ voter_id: voter, post_id: post, value: -1 })).error).toContain('Sign in');
    expect((await castVote({ voter_id: 'guest', post_id: post, value: -1 })).error).toContain('Sign in');
    expect(fake.rows).toHaveLength(0);
  });
  it('does not call a silent RLS deletion a successful toggle', async () => {
    await castVote({ voter_id: voter, post_id: post, value: -1 });
    fake.deleteDenied = true;
    expect((await castVote({ voter_id: voter, post_id: post, value: -1 })).error).toContain('could not be removed');
    expect((await getVotesForPost(post, voter)).downvotes).toBe(1);
  });
  it('rejects duplicate clicks while a vote is being saved', async () => {
    const first = castVote({ voter_id: voter, post_id: post, value: -1 });
    const duplicate = await castVote({ voter_id: voter, post_id: post, value: -1 });
    expect(duplicate.error).toContain('still being saved');
    await first;
    expect(fake.rows).toHaveLength(1);
  });
  it('validates removal target instead of deleting all of a user\'s votes', async () => {
    expect((await removeVote(voter, {})).success).toBe(false);
    expect(fake.queries).toBe(0);
  });
});
