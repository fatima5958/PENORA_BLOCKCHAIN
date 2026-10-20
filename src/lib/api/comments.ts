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

export async function getCommentsForPost(postId: string): Promise<CommentsListResult> {
  try {
    const { data, error } = await supabase
      .from('comments')
      .select('*, author:profiles!author_id(*)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) {
      const isPending = error.code === '42P01' || error.message.includes('relation');
      return { data: [], error: error.message, isPendingMigration: isPending };
    }
    return { data: (data as CommentRecord[]) || [], error: null };
  } catch (err: any) {
    return { data: [], error: err.message || 'Failed to fetch comments' };
  }
}

export async function addComment(comment: {
  post_id: string;
  author_id: string;
  body: string;
}): Promise<SingleCommentResult> {
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
      return { data: null, error: error.message, isPendingMigration: isPending };
    }
    return { data: (data as CommentRecord) || null, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || 'Failed to post comment' };
  }
}

export async function deleteComment(id: string): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase.from('comments').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete comment' };
  }
}
