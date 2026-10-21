import { describe, expect, it } from 'vitest';
import {
  ARTICLE_DRAFT_KEY,
  hasDraftContent,
  readArticleDraft,
  saveArticleDraft,
  removeArticleDraft,
  type ArticleDraft,
} from '../lib/articleDrafts';

const draft: ArticleDraft = {
  title: 'An essay in progress',
  tags: 'writing, design',
  coverImageUrl: 'https://example.com/cover.png',
  excerpt: 'A summary edited after the body.',
  content: 'The article body.',
  updatedAt: '2026-10-21T11:00:00.000Z',
  postId: '11111111-1111-4111-8111-111111111111',
  slug: 'an-essay-in-progress',
};

function storageWith(value?: string) {
  const values = new Map<string, string>();
  if (value !== undefined) values.set(ARTICLE_DRAFT_KEY, value);
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, next: string) => { values.set(key, next); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

describe('Article draft recovery', () => {
  it('preserves every field and the cloud editing target across save and recovery', () => {
    const storage = storageWith();
    expect(saveArticleDraft(draft, storage)).toBeNull();
    expect(readArticleDraft(storage)).toEqual(draft);
    const edited = { ...draft, title: 'A title-only change', tags: 'new-tag', coverImageUrl: '' };
    expect(saveArticleDraft(edited, storage)).toBeNull();
    expect(readArticleDraft(storage)).toEqual(edited);
  });

  it('recovers legacy drafts without inventing an editing target', () => {
    expect(readArticleDraft(storageWith(JSON.stringify({ title: 'Legacy', content: 'Old text' }))))
      .toMatchObject({ title: 'Legacy', content: 'Old text', tags: '', postId: null, slug: null });
  });

  it.each(['{', 'null', '[]', '{"title":123}', '{"content":{}}'])('ignores damaged storage without crashing: %s', value => {
    expect(readArticleDraft(storageWith(value))).toBeNull();
  });

  it('recognizes metadata-only drafts and treats whitespace as empty', () => {
    const empty = { title: '', content: '', excerpt: '', tags: '', coverImageUrl: '' };
    expect(hasDraftContent({ ...empty, title: '  ', content: '\n' })).toBe(false);
    for (const field of ['title', 'excerpt', 'tags', 'coverImageUrl', 'content'] as const) {
      expect(readArticleDraft(storageWith(JSON.stringify({ ...empty, [field]: 'Only this changed' })))).not.toBeNull();
    }
  });

  it('reports blocked or full storage rather than claiming a successful save', () => {
    const storage = storageWith(JSON.stringify(draft));
    storage.setItem = () => { throw new Error('QuotaExceededError'); };
    expect(saveArticleDraft({ ...draft, title: 'New' }, storage)).toContain('could not be saved');
    expect(readArticleDraft(storage)?.title).toBe(draft.title);
    expect(saveArticleDraft(draft, null)).toContain('could not be saved');
  });

  it('clears the persisted editing target as well as the draft text', () => {
    const storage = storageWith(JSON.stringify(draft));
    expect(removeArticleDraft(storage)).toBeNull();
    expect(storage.getItem(ARTICLE_DRAFT_KEY)).toBeNull();
    expect(readArticleDraft(storage)).toBeNull();
  });

  it('handles denied storage reads and deletes without throwing', () => {
    const storage = storageWith();
    storage.getItem = () => { throw new Error('SecurityError'); };
    storage.removeItem = () => { throw new Error('SecurityError'); };
    expect(readArticleDraft(storage)).toBeNull();
    expect(removeArticleDraft(storage)).toContain('could not be cleared');
  });
});
