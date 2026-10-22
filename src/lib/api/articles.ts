// src/lib/api/articles.ts
import { supabase } from '../supabaseClient';
import type { PostRecord } from './types';
import { articleSlug } from '../articleEditor';

export interface ArticlesListResult {
  data: PostRecord[];
  error: string | null;
  isPendingMigration?: boolean;
}

export interface SingleArticleResult {
  data: PostRecord | null;
  error: string | null;
  isPendingMigration?: boolean;
}

function checkIsPendingMigration(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    (error.message ? error.message.includes('relation') || error.message.includes('schema cache') : false)
  );
}

function isUuid(id?: string | null): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export async function getPublishedArticles(options?: {
  limit?: number;
  tag?: string;
  search?: string;
}): Promise<ArticlesListResult> {
  try {
    let query = supabase
      .from('posts')
      .select('*, author:profiles!author_id(*)')
      .eq('published', true)
      .order('created_at', { ascending: false });

    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.tag) {
      query = query.contains('tags', [options.tag]);
    }
    if (options?.search) {
      query = query.ilike('title', `%${options.search}%`);
    }

    const { data, error } = await query;
    if (error) {
      return { data: [], error: error.message, isPendingMigration: checkIsPendingMigration(error) };
    }
    return { data: (data as PostRecord[]) || [], error: null };
  } catch (err: any) {
    return { data: [], error: err.message || 'Failed to fetch articles' };
  }
}

export async function getArticleBySlug(slug: string): Promise<SingleArticleResult> {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('*, author:profiles!author_id(*)')
      .eq('slug', slug)
      .maybeSingle();

    if (error) {
      return { data: null, error: error.message, isPendingMigration: checkIsPendingMigration(error) };
    }
    return { data: (data as PostRecord) || null, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || 'Failed to fetch article' };
  }
}

export async function getUserArticles(authorId: string): Promise<ArticlesListResult> {
  if (!isUuid(authorId)) {
    return { data: [], error: null };
  }
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('author_id', authorId)
      .order('created_at', { ascending: false });

    if (error) {
      return { data: [], error: error.message, isPendingMigration: checkIsPendingMigration(error) };
    }
    return { data: (data as PostRecord[]) || [], error: null };
  } catch (err: any) {
    return { data: [], error: err.message || 'Failed to fetch user articles' };
  }
}

export async function createPost(post: {
  author_id: string;
  author_username?: string;
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  cover_image_url?: string | null;
  tags?: string[];
  published?: boolean;
}): Promise<SingleArticleResult> {
  if (!isUuid(post.author_id)) {
    return { data: null, error: 'Invalid author ID format: author_id must be a valid account UUID.' };
  }
  const baseSlug = post.slug || articleSlug(post.title);
  let slug = baseSlug;
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await supabase.from('posts').insert({
        author_id: post.author_id,
        title: post.title,
        slug,
        excerpt: post.excerpt || null,
        content: post.content,
        cover_image_url: post.cover_image_url || null,
        tags: post.tags || [],
        published: post.published ?? false,
      }).select().maybeSingle();
      if (error?.code === '23505' && error.message.toLowerCase().includes('slug')) {
        slug = `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`;
        continue;
      }
      if (error) return { data: null, error: error.message, isPendingMigration: checkIsPendingMigration(error) };
      if (!data) return { data: null, error: 'The database did not confirm this blog was saved. Your browser draft is still available.' };
      return { data: data as PostRecord, error: null };
    }
    return { data: null, error: 'Could not create a unique blog link. Please try publishing again.' };
  } catch (err: any) {
    return { data: null, error: err.message || 'Failed to create post' };
  }
}

export async function updatePost(
  id: string,
  updates: Partial<Pick<PostRecord, 'title' | 'slug' | 'excerpt' | 'content' | 'cover_image_url' | 'tags' | 'published'>>
): Promise<SingleArticleResult> {
  try {
    const { data, error } = await supabase
      .from('posts')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      return { data: null, error: error.message, isPendingMigration: checkIsPendingMigration(error) };
    }
    if (!data) return { data: null, error: 'This blog could not be updated. It may have been removed or you may not have permission.' };
    return { data: data as PostRecord, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || 'Failed to update post' };
  }
}

export async function deletePost(id: string): Promise<{ success: boolean; error: string | null; isPendingMigration?: boolean }> {
  try {
    const { data, error } = await supabase.from('posts').delete().eq('id', id).select('id');
    if (error) return { success: false, error: error.message, isPendingMigration: checkIsPendingMigration(error) };
    if (!data?.length) return { success: false, error: 'This blog could not be deleted. It may have been removed or you may not have permission.' };
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete post' };
  }
}


export async function getFollowingArticles(
  followerId: string,
  options?: { limit?: number; offset?: number }
): Promise<ArticlesListResult> {
  if (!followerId) return { data: [], error: null };

  const followedIds: string[] = [];

  // Local follows ledger
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem('penora_follows_ledger_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed[followerId])) {
          followedIds.push(...parsed[followerId]);
        }
      }
    } catch {
      // ignore
    }
  }

  // Remote follows from Supabase
  if (isUuid(followerId)) {
    try {
      const { data } = await supabase
        .from('follows')
        .select('followee_id')
        .eq('follower_id', followerId);
      if (data) {
        data.forEach((row: any) => {
          if (row.followee_id && !followedIds.includes(row.followee_id)) {
            followedIds.push(row.followee_id);
          }
        });
      }
    } catch {
      // ignore
    }
  }

  if (followedIds.length === 0) {
    return { data: [], error: null };
  }

  const validUuidFollowees = followedIds.filter(isUuid);
  if (validUuidFollowees.length === 0) {
    return { data: [], error: null };
  }

  try {
    let query = supabase
      .from('posts')
      .select('*, author:profiles!author_id(*)')
      .eq('published', true)
      .in('author_id', validUuidFollowees)
      .order('created_at', { ascending: false });

    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
    }

    const { data, error } = await query;
    if (error) {
      return { data: [], error: error.message, isPendingMigration: checkIsPendingMigration(error) };
    }
    return { data: (data as PostRecord[]) || [], error: null };
  } catch (err: any) {
    return { data: [], error: err.message || 'Failed to fetch following feed' };
  }
}
