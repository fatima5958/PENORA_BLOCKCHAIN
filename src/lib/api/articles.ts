// src/lib/api/articles.ts
import { supabase } from '../supabaseClient';
import type { PostRecord } from './types';

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
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  cover_image_url?: string;
  tags?: string[];
  published?: boolean;
}): Promise<SingleArticleResult> {
  if (!isUuid(post.author_id)) {
    return {
      data: null,
      error: 'Invalid author ID format: author_id must be a valid account UUID.',
    };
  }
  try {
    const { data, error } = await supabase
      .from('posts')
      .insert({
        author_id: post.author_id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt || null,
        content: post.content,
        cover_image_url: post.cover_image_url || null,
        tags: post.tags || [],
        published: post.published ?? false,
      })
      .select()
      .maybeSingle();

    if (error) {
      return { data: null, error: error.message, isPendingMigration: checkIsPendingMigration(error) };
    }
    return { data: (data as PostRecord) || null, error: null };
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
    return { data: (data as PostRecord) || null, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || 'Failed to update post' };
  }
}

export async function deletePost(id: string): Promise<{ success: boolean; error: string | null; isPendingMigration?: boolean }> {
  try {
    const { error } = await supabase.from('posts').delete().eq('id', id);
    if (error) return { success: false, error: error.message, isPendingMigration: checkIsPendingMigration(error) };
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete post' };
  }
}
