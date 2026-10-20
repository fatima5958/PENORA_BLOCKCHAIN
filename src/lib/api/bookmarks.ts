// src/lib/api/bookmarks.ts
import { supabase } from '../supabaseClient';
import type { BookmarkRecord } from './types';

export interface BookmarksListResult {
  data: BookmarkRecord[];
  error: string | null;
  isPendingMigration?: boolean;
}

const LOCAL_BOOKMARKS_KEY = 'penora_bookmarks_ledger_v1';
let memoryBookmarks: Record<string, string[]> = {};

function isUuid(id?: string | null): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function readLocalBookmarks(): Record<string, string[]> {
  // userId -> postId[]
  if (typeof window === 'undefined' || !window.localStorage) return memoryBookmarks;
  try {
    const raw = window.localStorage.getItem(LOCAL_BOOKMARKS_KEY);
    return raw ? JSON.parse(raw) : memoryBookmarks;
  } catch {
    return memoryBookmarks;
  }
}

function writeLocalBookmarks(data: Record<string, string[]>): void {
  memoryBookmarks = data;
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(LOCAL_BOOKMARKS_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export async function getUserBookmarks(userId: string): Promise<BookmarksListResult> {
  const localMap = readLocalBookmarks();
  const localPostIds = localMap[userId] || [];

  if (!isUuid(userId)) {
    const localRecords: BookmarkRecord[] = localPostIds.map(pid => ({
      id: `bm_${pid}`,
      user_id: userId,
      post_id: pid,
      created_at: new Date().toISOString(),
    }));
    return { data: localRecords, error: null };
  }

  try {
    const { data, error } = await supabase
      .from('bookmarks')
      .select('*, post:posts(*, author:profiles!author_id(*))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    const localRecords: BookmarkRecord[] = localPostIds.map(pid => ({
      id: `bm_${pid}`,
      user_id: userId,
      post_id: pid,
      created_at: new Date().toISOString(),
    }));

    if (error) {
      const isPending = error.code === '42P01' || error.message.includes('relation');
      return { data: localRecords, error: isPending ? null : error.message, isPendingMigration: isPending };
    }
    const combined = [...((data as BookmarkRecord[]) || []), ...localRecords];
    const seen = new Set<string>();
    const deduped = combined.filter(b => {
      if (seen.has(b.post_id)) return false;
      seen.add(b.post_id);
      return true;
    });
    return { data: deduped, error: null };
  } catch (err: any) {
    const localRecords: BookmarkRecord[] = localPostIds.map(pid => ({
      id: `bm_${pid}`,
      user_id: userId,
      post_id: pid,
      created_at: new Date().toISOString(),
    }));
    return { data: localRecords, error: err.message || 'Failed to fetch bookmarks' };
  }
}

export async function isPostBookmarked(userId: string, postId: string): Promise<boolean> {
  const localMap = readLocalBookmarks();
  const userList = localMap[userId] || [];
  if (userList.includes(postId)) return true;

  if (!isUuid(userId) || !isUuid(postId)) {
    return false;
  }

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
  // Update local ledger first for immediate reactive UI update
  const localMap = readLocalBookmarks();
  const userList = localMap[userId] || [];
  const exists = userList.includes(postId);
  let nowBookmarked: boolean;

  if (exists) {
    localMap[userId] = userList.filter(id => id !== postId);
    nowBookmarked = false;
  } else {
    userList.push(postId);
    localMap[userId] = userList;
    nowBookmarked = true;
  }
  writeLocalBookmarks(localMap);

  if (!isUuid(userId) || !isUuid(postId)) {
    return { isBookmarked: nowBookmarked, error: null };
  }

  try {
    const { data: existing, error: checkErr } = await supabase
      .from('bookmarks')
      .select('id')
      .eq('user_id', userId)
      .eq('post_id', postId)
      .maybeSingle();

    if (checkErr && (checkErr.code === '42P01' || checkErr.message.includes('relation'))) {
      return { isBookmarked: nowBookmarked, error: null, isPendingMigration: true };
    }

    if (existing) {
      const { error } = await supabase
        .from('bookmarks')
        .delete()
        .eq('id', existing.id);
      if (error) return { isBookmarked: false, error: error.message };
      return { isBookmarked: false, error: null };
    } else {
      const { error } = await supabase
        .from('bookmarks')
        .insert({ user_id: userId, post_id: postId });
      if (error) {
        const isPending = error.code === '42P01' || error.message.includes('relation');
        return { isBookmarked: nowBookmarked, error: isPending ? null : error.message, isPendingMigration: isPending };
      }
      return { isBookmarked: true, error: null };
    }
  } catch (err: any) {
    return { isBookmarked: nowBookmarked, error: err.message || 'Failed to toggle bookmark' };
  }
}
