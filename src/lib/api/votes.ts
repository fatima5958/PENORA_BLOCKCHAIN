// Votes are persisted by Supabase under authenticated RLS. Local previews never count as saved votes.
import { supabase } from '../supabaseClient';
import type { VoteRecord } from './types';

export interface PostVoteStats {
  upvotes: number;
  downvotes: number;
  score: number;
  userVote: -1 | 1 | null;
}

export interface VoteResult {
  data: VoteRecord | null;
  error: string | null;
  isPendingMigration?: boolean;
  stats?: PostVoteStats;
}

type VoteTarget = { post_id?: string; comment_id?: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const pendingVotes = new Set<string>();
const emptyStats = (): PostVoteStats => ({ upvotes: 0, downvotes: 0, score: 0, userVote: null });

function targetError(target: VoteTarget): string | null {
  if (!target.post_id && !target.comment_id) return 'Vote must target either a post or a comment';
  if (target.post_id && target.comment_id) return 'Vote cannot target both a post and a comment';
  if (!UUID.test(target.post_id || target.comment_id || '')) return 'Voting is available on published content with a saved ID.';
  return null;
}

function databaseError(error: { message: string; code?: string }): Pick<VoteResult, 'error' | 'isPendingMigration'> {
  const isPendingMigration = ['42P01', 'PGRST205'].includes(error.code || '');
  return {
    error: isPendingMigration ? 'Voting setup is not ready. Your vote was not saved.' : error.message,
    isPendingMigration,
  };
}

async function authenticatedVoter(voterId: string): Promise<string | null> {
  if (!UUID.test(voterId)) return 'Sign in to vote. Guest votes are not saved.';
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return 'Sign in with an active session to save your vote.';
  if (data.user.id !== voterId) return 'Your account changed. Sign in again before voting.';
  return null;
}

export async function castVote(vote: VoteTarget & { voter_id: string; value: -1 | 1 }): Promise<VoteResult> {
  const invalid = targetError(vote);
  if (invalid) return { data: null, error: invalid };
  if (vote.value !== 1 && vote.value !== -1) return { data: null, error: 'Vote direction must be up or down.' };
  const key = `${vote.voter_id}:${vote.post_id || vote.comment_id}`;
  if (pendingVotes.has(key)) return { data: null, error: 'Your previous vote is still being saved.' };
  pendingVotes.add(key);
  try {
    const authError = await authenticatedVoter(vote.voter_id);
    if (authError) return { data: null, error: authError };

    let query = supabase.from('votes').select('*').eq('voter_id', vote.voter_id);
    query = vote.post_id ? query.eq('post_id', vote.post_id) : query.eq('comment_id', vote.comment_id!);
    const { data: existing, error: readError } = await query.maybeSingle();
    if (readError) return { data: null, ...databaseError(readError) };

    let data: VoteRecord | null = null;
    if (existing?.value === vote.value) {
      // Request the deleted row to distinguish a real deletion from a silent RLS no-op.
      const result = await supabase.from('votes').delete().eq('id', existing.id)
        .eq('voter_id', vote.voter_id).select('id').maybeSingle();
      if (result.error) return { data: null, ...databaseError(result.error) };
      if (!result.data) return { data: null, error: 'Your vote could not be removed. Refresh and retry.' };
    } else if (existing) {
      const result = await supabase.from('votes').update({ value: vote.value }).eq('id', existing.id)
        .eq('voter_id', vote.voter_id).select().maybeSingle();
      if (result.error) return { data: null, ...databaseError(result.error) };
      if (!result.data) return { data: null, error: 'Your vote could not be updated. Refresh and retry.' };
      data = result.data as VoteRecord;
    } else {
      const result = await supabase.from('votes').insert({ voter_id: vote.voter_id,
        post_id: vote.post_id || null, comment_id: vote.comment_id || null, value: vote.value,
      }).select().maybeSingle();
      if (result.error) return { data: null, ...databaseError(result.error) };
      if (!result.data) return { data: null, error: 'Your vote was not saved. Refresh and retry.' };
      data = result.data as VoteRecord;
    }

    // Read shared counts only after the database confirms the mutation.
    let stats: PostVoteStats | undefined;
    if (vote.post_id) {
      const result = await readPostStats(vote.post_id, vote.voter_id);
      stats = result.stats;
    }
    return { data, error: null, stats };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'Vote could not be saved. Please retry.' };
  } finally {
    pendingVotes.delete(key);
  }
}

export async function removeVote(voter_id: string, target: VoteTarget): Promise<{
  success: boolean; error: string | null; isPendingMigration?: boolean;
}> {
  const invalid = targetError(target);
  if (invalid) return { success: false, error: invalid };
  try {
    const authError = await authenticatedVoter(voter_id);
    if (authError) return { success: false, error: authError };
    let query = supabase.from('votes').delete().eq('voter_id', voter_id);
    query = target.post_id ? query.eq('post_id', target.post_id) : query.eq('comment_id', target.comment_id!);
    const { error } = await query;
    return error ? { success: false, ...databaseError(error) } : { success: true, error: null };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Vote could not be removed.' };
  }
}

async function readPostStats(postId: string, currentUserId?: string): Promise<{ stats?: PostVoteStats }> {
  const { data, error } = await supabase.from('votes').select('voter_id, value').eq('post_id', postId);
  if (error || !data) return {};
  const stats = emptyStats();
  for (const vote of data) {
    if (vote.value === 1) stats.upvotes++;
    else if (vote.value === -1) stats.downvotes++;
    if (vote.voter_id === currentUserId && (vote.value === 1 || vote.value === -1)) stats.userVote = vote.value;
  }
  stats.score = stats.upvotes - stats.downvotes;
  return { stats };
}

export async function getVotesForPost(postId: string, currentUserId?: string): Promise<PostVoteStats> {
  if (!UUID.test(postId)) return emptyStats();
  try { return (await readPostStats(postId, currentUserId)).stats ?? emptyStats(); }
  catch { return emptyStats(); }
}
export const getPostVoteStats = getVotesForPost;
