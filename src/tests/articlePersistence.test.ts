import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../lib/supabaseClient', () => ({ supabase: { from: mocks.from } }));
import { createPost, updatePost, deletePost } from '../lib/api/articles';

function query(results: Array<{ data: any; error: any }>) {
  const q: any = {};
  for (const method of ['insert', 'update', 'eq', 'delete', 'select']) q[method] = vi.fn(() => q);
  q.maybeSingle = vi.fn();
  for (const result of results) q.maybeSingle.mockResolvedValueOnce(result);
  mocks.from.mockReturnValue(q);
  return q;
}
const payload = { author_id: '11111111-1111-4111-8111-111111111111', title: 'Same title', slug: 'same-title', content: 'Article body', published: true };

describe('Article persistence confirms actual database results', () => {
  beforeEach(() => { vi.resetAllMocks(); });
  it('retries only a slug collision and returns the actual stored slug', async () => {
    const q = query([{data:null,error:{code:'23505',message:'posts_slug_key duplicate slug'}},{data:{...payload,id:'post',slug:'same-title-unique'},error:null}]);
    const r = await createPost(payload);
    expect(q.insert).toHaveBeenCalledTimes(2);
    expect(q.insert.mock.calls[1][0].slug).toMatch(/^same-title-[a-f0-9]{8}$/);
    expect(r.data?.slug).toBe('same-title-unique');
  });
  it('never converts an RLS denial into publication success', async () => {
    query([{data:null,error:{code:'42501',message:'row-level security denied'}}]);
    const r = await createPost(payload);
    expect(r.data).toBeNull();
    expect(r.error).toContain('row-level security');
  });
  it('reports a missing confirmation on insert', async () => {
    query([{data:null,error:null}]);
    expect((await createPost(payload)).error).toContain('did not confirm');
  });
  it('reports an update that affected no permitted row', async () => {
    query([{data:null,error:null}]);
    expect((await updatePost('post',{title:'Edited'})).error).toContain('could not be updated');
  });
  it('sends an explicit null when removing an existing cover', async () => {
    const q = query([{data:{id:'post',cover_image_url:null},error:null}]);
    await updatePost('post',{cover_image_url:null});
    expect(q.update.mock.calls[0][0].cover_image_url).toBeNull();
  });
  it('does not report deletion when no row was returned', async () => {
    const q = query([]);
    q.select.mockResolvedValue({data:[],error:null});
    expect((await deletePost('post')).success).toBe(false);
  });
  it('confirms deletion only after a deleted ID is returned', async () => {
    const q = query([]);
    q.select.mockResolvedValue({data:[{id:'post'}],error:null});
    expect((await deletePost('post')).success).toBe(true);
  });
});
