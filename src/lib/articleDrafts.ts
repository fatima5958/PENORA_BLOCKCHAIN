export const ARTICLE_DRAFT_KEY = 'penora_article_draft';

export interface ArticleDraftFields {
  title: string;
  tags: string;
  coverImageUrl: string;
  excerpt: string;
  content: string;
}

export interface ArticleDraft extends ArticleDraftFields {
  updatedAt: string;
  postId: string | null;
  slug: string | null;
}

type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function browserStorage(): DraftStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function hasDraftContent(draft: ArticleDraftFields): boolean {
  return [draft.title, draft.tags, draft.coverImageUrl, draft.excerpt, draft.content]
    .some(value => value.trim().length > 0);
}

export function readArticleDraft(storage = browserStorage()): ArticleDraft | null {
  try {
    const raw = storage?.getItem(ARTICLE_DRAFT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const values = parsed as Record<string, unknown>;
    const fields = ['title', 'tags', 'coverImageUrl', 'excerpt', 'content'] as const;
    if (fields.some(field => values[field] !== undefined && typeof values[field] !== 'string')) {
      return null;
    }
    const draft: ArticleDraft = {
      title: (values.title as string) || '',
      tags: (values.tags as string) || '',
      coverImageUrl: (values.coverImageUrl as string) || '',
      excerpt: (values.excerpt as string) || '',
      content: (values.content as string) || '',
      updatedAt: typeof values.updatedAt === 'string' ? values.updatedAt : '',
      postId: typeof values.postId === 'string' ? values.postId : null,
      slug: typeof values.slug === 'string' ? values.slug : null,
    };
    return hasDraftContent(draft) ? draft : null;
  } catch {
    return null;
  }
}

export function saveArticleDraft(draft: ArticleDraft, storage = browserStorage()): string | null {
  try {
    if (!storage) throw new Error('Storage unavailable');
    storage.setItem(ARTICLE_DRAFT_KEY, JSON.stringify(draft));
    return null;
  } catch {
    return 'Your draft could not be saved in this browser. Storage may be full or blocked. Keep this page open and copy your writing before leaving.';
  }
}

export function removeArticleDraft(storage = browserStorage()): string | null {
  try {
    if (!storage) throw new Error('Storage unavailable');
    storage.removeItem(ARTICLE_DRAFT_KEY);
    return null;
  } catch {
    return 'The saved browser draft could not be cleared. Browser storage may be blocked.';
  }
}
