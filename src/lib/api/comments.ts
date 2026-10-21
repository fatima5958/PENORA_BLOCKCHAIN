// src/lib/api/comments.ts
import { supabase } from '../supabaseClient';
import type { CommentRecord } from './types';

export interface CommentsListResult {
  data: CommentRecord[];
  error: string | null;
  isPendingMigration?: boolean;
}

export interface SingleCommentResult {
  data: CommentRecord | null;
  error: string | null;
  isPendingMigration?: boolean;
}

const LOCAL_COMMENTS_KEY = 'penora_comments_ledger_v1';
let memoryComments: CommentRecord[] = [];

function isUuid(id?: string | null): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function readLocalComments(): CommentRecord[] {
  if (typeof window === 'undefined' || !window.localStorage) return memoryComments;
  try {
    const raw = window.localStorage.getItem(LOCAL_COMMENTS_KEY);
    return raw ? JSON.parse(raw) : memoryComments;
  } catch {
    return memoryComments;
  }
}

function writeLocalComments(records: CommentRecord[]): void {
  memoryComments = records;
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(LOCAL_COMMENTS_KEY, JSON.stringify(records));
  } catch {
    // ignore
  }
}

export async function getCommentsForPost(postId: string): Promise<CommentsListResult> {
  const localList = readLocalComments().filter(c => c.post_id === postId);

  if (!isUuid(postId)) {
    return { data: localList, error: null };
  }

  try {
    const { data, error } = await supabase
      .from('comments')
      .select('*, author:profiles!author_id(*)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) {
      const isPending = error.code === '42P01' || error.message.includes('relation');
      return { data: localList, error: error.message, isPendingMigration: isPending };
    }
    const combined = [...(data as CommentRecord[] || []), ...localList];
    // deduplicate by id
    const seen = new Set<string>();
    const deduped = combined.filter(c => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
    return { data: deduped, error: null };
  } catch (err: any) {
    return { data: localList, error: err.message || 'Failed to fetch comments' };
  }
}

export async function getUserComments(authorId: string): Promise<CommentsListResult> {
  const localList = readLocalComments().filter(c => c.author_id === authorId);

  if (!isUuid(authorId)) {
    return { data: localList, error: null };
  }

  try {
    const { data, error } = await supabase
      .from('comments')
      .select('*, author:profiles!author_id(*)')
      .eq('author_id', authorId)
      .order('created_at', { ascending: false });

    if (error) {
      const isPending = error.code === '42P01' || error.message.includes('relation');
      return { data: localList, error: error.message, isPendingMigration: isPending };
    }
    const combined = [...(data as CommentRecord[] || []), ...localList];
    const seen = new Set<string>();
    const deduped = combined.filter(c => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
    return { data: deduped, error: null };
  } catch (err: any) {
    return { data: localList, error: err.message || 'Failed to fetch creator comments' };
  }
}

export async function addComment(comment: {
  post_id: string;
  author_id: string;
  body: string;
  author_name?: string;
}): Promise<SingleCommentResult> {
  const localRecord: CommentRecord = {
    id: `cmt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    post_id: comment.post_id,
    author_id: comment.author_id,
    body: comment.body.trim(),
    created_at: new Date().toISOString(),
    author: {
      id: comment.author_id,
      username: comment.author_name || 'you',
      display_name: comment.author_name || 'You',
      avatar_url: null,
      cover_url: null,
      bio: null,
      reputation: 25,
      created_at: new Date().toISOString(),
    },
  };

  const currentLocal = readLocalComments();
  currentLocal.push(localRecord);
  writeLocalComments(currentLocal);

  if (!isUuid(comment.post_id) || !isUuid(comment.author_id)) {
    return { data: localRecord, error: null };
  }

  try {
    const { data, error } = await supabase
      .from('comments')
      .insert({
        post_id: comment.post_id,
        author_id: comment.author_id,
        body: comment.body.trim(),
      })
      .select('*, author:profiles!author_id(*)')
      .maybeSingle();

    if (error) {
      const isPending = error.code === '42P01' || error.message.includes('relation');
      return { data: localRecord, error: isPending ? null : error.message, isPendingMigration: isPending };
    }
    return { data: (data as CommentRecord) || localRecord, error: null };
  } catch (err: any) {
    return { data: localRecord, error: err.message || 'Failed to post comment' };
  }
}

export async function deleteComment(id: string): Promise<{ success: boolean; error: string | null }> {
  const currentLocal = readLocalComments().filter(c => c.id !== id);
  writeLocalComments(currentLocal);

  if (!isUuid(id)) {
    return { success: true, error: null };
  }

  try {
    const { error } = await supabase.from('comments').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete comment' };
  }
}
