// src/lib/api/reblogs.ts
// PENORA Reblogs & Reposts API
// Implements real reblogs to creator profiles with attribution, deduplication, and undo support.

import { supabase } from '../supabaseClient';
import type { PostRecord, ReblogRecord } from './types';

export interface ReblogStatusResult {
  isReblogged: boolean;
  reblogCount: number;
  error: string | null;
  isPendingMigration?: boolean;
}

export interface UserReblogsResult {
  data: Array<{
    id: string;
    post: PostRecord;
    created_at: string;
    reblogger_id: string;
  }>;
  error: string | null;
}

const LOCAL_REBLOGS_KEY = 'penora_reblogs_ledger_v1';
let memoryReblogs: Array<{ id: string; user_id: string; post_id: string; created_at: string }> = [];

function isUuid(id?: string | null): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function readLocalReblogs(): Array<{ id: string; user_id: string; post_id: string; created_at: string }> {
  if (typeof window === 'undefined' || !window.localStorage) return memoryReblogs;
  try {
    const raw = window.localStorage.getItem(LOCAL_REBLOGS_KEY);
    return raw ? JSON.parse(raw) : memoryReblogs;
  } catch {
    return memoryReblogs;
  }
}

function writeLocalReblogs(data: Array<{ id: string; user_id: string; post_id: string; created_at: string }>): void {
  memoryReblogs = data;
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(LOCAL_REBLOGS_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

/**
 * Check if a specific user has reblogged a post and get the current total reblogs count.
 */
export async function getReblogState(postId: string, userId?: string | null): Promise<ReblogStatusResult> {
  const localList = readLocalReblogs();
  const localCount = localList.filter(r => r.post_id === postId).length;
  const localHasReblogged = userId ? localList.some(r => r.post_id === postId && r.user_id === userId) : false;

  if (!isUuid(postId)) {
    return {
      isReblogged: localHasReblogged,
      reblogCount: localCount,
      error: null,
    };
  }

  try {
    const { data, error, count } = await supabase
      .from('reblogs')
      .select('id, user_id', { count: 'exact' })
      .eq('post_id', postId);

    if (error) {
      const isPending = error.code === '42P01' || error.message.includes('relation');
      return {
        isReblogged: localHasReblogged,
        reblogCount: localCount,
        error: error.message,
        isPendingMigration: isPending,
      };
    }

    const totalCount = count ?? (data ? data.length : 0);
    const dbHasReblogged = userId && data ? data.some((r: any) => r.user_id === userId) : false;

    return {
      isReblogged: dbHasReblogged || localHasReblogged,
      reblogCount: Math.max(totalCount, localCount),
      error: null,
    };
  } catch (err: any) {
    return {
      isReblogged: localHasReblogged,
      reblogCount: localCount,
      error: err.message || 'Failed to fetch reblog state',
    };
  }
}

/**
 * Toggle reblog: reblog if not reblogged yet, or undo reblog if already reblogged.
 */
export async function toggleReblog(
  userId: string,
  postId: string
): Promise<{ success: boolean; isReblogged: boolean; reblogCount: number; error: string | null }> {
  if (!userId || !postId) {
    return { success: false, isReblogged: false, reblogCount: 0, error: 'User and post are required' };
  }

  const localList = readLocalReblogs();
  const existingIdx = localList.findIndex(r => r.user_id === userId && r.post_id === postId);
  const alreadyReblogged = existingIdx >= 0;

  if (alreadyReblogged) {
    // Undo local reblog
    localList.splice(existingIdx, 1);
    writeLocalReblogs(localList);
  } else {
    // Add local reblog
    localList.push({
      id: `reblog_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      user_id: userId,
      post_id: postId,
      created_at: new Date().toISOString(),
    });
    writeLocalReblogs(localList);
  }

  const newLocalCount = localList.filter(r => r.post_id === postId).length;

  if (!isUuid(userId) || !isUuid(postId)) {
    return {
      success: true,
      isReblogged: !alreadyReblogged,
      reblogCount: newLocalCount,
      error: null,
    };
  }

  try {
    if (alreadyReblogged) {
      // Remove from database
      const { error } = await supabase
        .from('reblogs')
        .delete()
        .eq('user_id', userId)
        .eq('post_id', postId);

      if (error && error.code !== '42P01') {
        return { success: false, isReblogged: true, reblogCount: newLocalCount + 1, error: error.message };
      }
      return { success: true, isReblogged: false, reblogCount: newLocalCount, error: null };
    } else {
      // Insert into database with duplicate prevention
      const { error } = await supabase
        .from('reblogs')
        .insert({
          user_id: userId,
          post_id: postId,
        });

      if (error) {
        // Unique violation means already reblogged
        if (error.code === '23505') {
          return { success: true, isReblogged: true, reblogCount: newLocalCount, error: null };
        }
        const isPending = error.code === '42P01' || error.message.includes('relation');
        return {
          success: true,
          isReblogged: true,
          reblogCount: newLocalCount,
          error: isPending ? null : error.message,
        };
      }
      return { success: true, isReblogged: true, reblogCount: newLocalCount, error: null };
    }
  } catch (err: any) {
    return {
      success: true,
      isReblogged: !alreadyReblogged,
      reblogCount: newLocalCount,
      error: err.message || null,
    };
  }
}

/**
 * Fetch all posts reblogged by a specific user with author attribution.
 */
export async function getUserReblogs(userId: string): Promise<UserReblogsResult> {
  if (!isUuid(userId)) {
    return { data: [], error: null };
  }

  try {
    const { data, error } = await supabase
      .from('reblogs')
      .select('id, created_at, user_id, post:posts!post_id(*, author:profiles!author_id(*))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return { data: [], error: error.message };
    }

    const items = (data || [])
      .filter((r: any) => r.post && r.post.published)
      .map((r: any) => ({
        id: r.id,
        post: r.post as PostRecord,
        created_at: r.created_at,
        reblogger_id: r.user_id,
      }));

    return { data: items, error: null };
  } catch (err: any) {
    return { data: [], error: err.message || 'Failed to fetch reblogs' };
  }
}
