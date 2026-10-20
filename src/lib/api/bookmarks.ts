// src/lib/api/bookmarks.ts
import { supabase } from '../supabaseClient';
import type { BookmarkRecord, PostRecord } from './types';

export interface BookmarksListResult {
  data: BookmarkRecord[];
  error: string | null;
  isPendingMigration?: boolean;
}

export async function getUserBookmarks(userId: string): Promise<BookmarksListResult> {
  try {
    const { data, error } = await supabase
      .from('bookmarks')
      .select('*, post:posts(*, author:profiles!author_id(*))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      const isPending = error.code === '42P01' || error.message.includes('relation');
      return { data: [], error: error.message, isPendingMigration: isPending };
    }
    return { data: (data as BookmarkRecord[]) || [], error: null };
  } catch (err: any) {
    return { data: [], error: err.message || 'Failed to fetch bookmarks' };
  }
}

export async function isPostBookmarked(userId: string, postId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('bookmarks')
      .select('post_id')
      .eq('user_id', userId)
      .eq('post_id', postId)
      .maybeSingle();

    if (error || !data) return false;
    return true;
  } catch {
    return false;
  }
}

export async function toggleBookmark(
  userId: string,
  postId: string
): Promise<{ isBookmarked: boolean; error: string | null; isPendingMigration?: boolean }> {
  try {
    const { data: existing, error: checkErr } = await supabase
      .from('bookmarks')
      .select('user_id, post_id')
      .eq('user_id', userId)
      .eq('post_id', postId)
      .maybeSingle();

    if (checkErr && (checkErr.code === '42P01' || checkErr.message.includes('relation'))) {
      return { isBookmarked: false, error: checkErr.message, isPendingMigration: true };
    }

    if (existing) {
      const { error } = await supabase
        .from('bookmarks')
        .delete()
        .eq('user_id', userId)
        .eq('post_id', postId);

      if (error) return { isBookmarked: true, error: error.message };
      return { isBookmarked: false, error: null };
    } else {
      const { error } = await supabase
        .from('bookmarks')
        .insert({ user_id: userId, post_id: postId });

      if (error) {
        const isPending = error.code === '42P01' || error.message.includes('relation');
        return { isBookmarked: false, error: error.message, isPendingMigration: isPending };
      }
      return { isBookmarked: true, error: null };
    }
  } catch (err: any) {
    return { isBookmarked: false, error: err.message || 'Failed to toggle bookmark' };
  }
}
