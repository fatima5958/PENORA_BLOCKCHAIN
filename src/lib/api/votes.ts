// src/lib/api/votes.ts
import { supabase } from '../supabaseClient';
import type { VoteRecord } from './types';

export interface VoteResult {
  data: VoteRecord | null;
  error: string | null;
  isPendingMigration?: boolean;
  stats?: PostVoteStats;
}

export interface PostVoteStats {
  upvotes: number;
  downvotes: number;
  score: number;
  userVote: -1 | 1 | null;
}

const LOCAL_VOTES_STORAGE_KEY = 'penora_votes_ledger_v1';
let memoryVotes: LocalVoteEntry[] = [];

interface LocalVoteEntry {
  id: string;
  voter_id: string;
  post_id: string | null;
  comment_id: string | null;
  value: -1 | 1;
  created_at: string;
}

function readLocalVotes(): LocalVoteEntry[] {
  if (typeof window === 'undefined' || !window.localStorage) return memoryVotes;
  try {
    const raw = window.localStorage.getItem(LOCAL_VOTES_STORAGE_KEY);
    if (!raw) return memoryVotes;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : memoryVotes;
  } catch {
    return memoryVotes;
  }
}

function writeLocalVotes(entries: LocalVoteEntry[]): void {
  memoryVotes = entries;
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(LOCAL_VOTES_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // ignore storage quota errors
  }
}

function computeLocalPostStats(postId: string, currentUserId?: string): PostVoteStats {
  const entries = readLocalVotes().filter(v => v.post_id === postId);
  let upvotes = 0;
  let downvotes = 0;
  let userVote: -1 | 1 | null = null;

  for (const v of entries) {
    if (v.value === 1) upvotes++;
    else if (v.value === -1) downvotes++;
    if (currentUserId && v.voter_id === currentUserId) {
      userVote = v.value;
    }
  }

  return {
    upvotes,
    downvotes,
    score: upvotes - downvotes,
    userVote,
  };
}

function applyLocalVoteMutation(vote: {
  voter_id: string;
  post_id?: string;
  comment_id?: string;
  value: -1 | 1;
}): VoteRecord | null {
  const entries = readLocalVotes();
  const idx = entries.findIndex(
    e =>
      e.voter_id === vote.voter_id &&
      (vote.post_id ? e.post_id === vote.post_id : e.comment_id === vote.comment_id)
  );

  if (idx !== -1) {
    const existing = entries[idx];
    if (existing.value === vote.value) {
      // Toggle off if clicking the same active vote
      entries.splice(idx, 1);
      writeLocalVotes(entries);
      return null;
    } else {
      // Switch vote direction (1 <-> -1)
      const updated: LocalVoteEntry = {
        ...existing,
        value: vote.value,
        created_at: new Date().toISOString(),
      };
      entries[idx] = updated;
      writeLocalVotes(entries);
      return updated;
    }
  }

  const created: LocalVoteEntry = {
    id: `vote_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    voter_id: vote.voter_id,
    post_id: vote.post_id || null,
    comment_id: vote.comment_id || null,
    value: vote.value,
    created_at: new Date().toISOString(),
  };
  entries.push(created);
  writeLocalVotes(entries);
  return created;
}

export async function castVote(vote: {
  voter_id: string;
  post_id?: string;
  comment_id?: string;
  value: -1 | 1;
}): Promise<VoteResult> {
  try {
    if (!vote.post_id && !vote.comment_id) {
      return { data: null, error: 'Vote must target either a post or a comment' };
    }
    if (vote.post_id && vote.comment_id) {
      return { data: null, error: 'Vote cannot target both a post and a comment' };
    }

    // Always update the local persisted vote ledger so UI state is durable across reloads
    const localRecord = applyLocalVoteMutation(vote);
    const localStats = vote.post_id
      ? computeLocalPostStats(vote.post_id, vote.voter_id)
      : undefined;

    // Only query Supabase if voter_id is a valid UUID
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      vote.voter_id
    );
    const isPostUuid =
      !vote.post_id ||
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vote.post_id);

    if (!isUuid || !isPostUuid) {
      return { data: localRecord, error: null, stats: localStats };
    }

    // Check if existing vote in Supabase
    let query = supabase.from('votes').select('*').eq('voter_id', vote.voter_id);
    if (vote.post_id) query = query.eq('post_id', vote.post_id);
    if (vote.comment_id) query = query.eq('comment_id', vote.comment_id);

    const { data: existing, error: findErr } = await query.maybeSingle();

    if (findErr && (findErr.code === '42P01' || findErr.message.includes('relation'))) {
      return {
        data: localRecord,
        error: null,
        isPendingMigration: true,
        stats: localStats,
      };
    }

    if (existing) {
      if (existing.value === vote.value) {
        // Toggle off if same vote
        await supabase.from('votes').delete().eq('id', existing.id);
        return { data: null, error: null, stats: localStats };
      } else {
        // Update vote
        const { data, error } = await supabase
          .from('votes')
          .update({ value: vote.value })
          .eq('id', existing.id)
          .select()
          .maybeSingle();
        if (error) {
          const isPending = error.code === '42P01' || error.message.includes('relation');
          return {
            data: localRecord,
            error: isPending ? null : error.message,
            isPendingMigration: isPending,
            stats: localStats,
          };
        }
        return { data: (data as VoteRecord) || localRecord, error: null, stats: localStats };
      }
    }

    // New vote in Supabase
    const { data, error } = await supabase
      .from('votes')
      .insert({
        voter_id: vote.voter_id,
        post_id: vote.post_id || null,
        comment_id: vote.comment_id || null,
        value: vote.value,
      })
      .select()
      .maybeSingle();

    if (error) {
      const isPending = error.code === '42P01' || error.message.includes('relation');
      const isRls = error.message.includes('row-level security') || error.message.includes('permission denied') || error.code === '42501';
      return {
        data: localRecord,
        error: (isPending || isRls) ? null : error.message,
        isPendingMigration: isPending,
        stats: localStats,
      };
    }
    return { data: (data as VoteRecord) || localRecord, error: null, stats: localStats };
  } catch (err: any) {
    return { data: null, error: err.message || 'Failed to cast vote' };
  }
}

export async function removeVote(
  voter_id: string,
  target: { post_id?: string; comment_id?: string }
): Promise<{ success: boolean; error: string | null; isPendingMigration?: boolean }> {
  try {
    const entries = readLocalVotes().filter(
      e =>
        !(
          e.voter_id === voter_id &&
          (target.post_id ? e.post_id === target.post_id : e.comment_id === target.comment_id)
        )
    );
    writeLocalVotes(entries);

    let query = supabase.from('votes').delete().eq('voter_id', voter_id);
    if (target.post_id) query = query.eq('post_id', target.post_id);
    if (target.comment_id) query = query.eq('comment_id', target.comment_id);

    const { error } = await query;
    if (error) {
      const isPending = error.code === '42P01' || error.message.includes('relation');
      return { success: isPending, error: isPending ? null : error.message, isPendingMigration: isPending };
    }
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to remove vote' };
  }
}

export async function getVotesForPost(
  postId: string,
  currentUserId?: string
): Promise<PostVoteStats> {
  const localStats = computeLocalPostStats(postId, currentUserId);

  const isPostUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    postId
  );
  if (!isPostUuid) {
    return localStats;
  }

  try {
    const { data, error } = await supabase
      .from('votes')
      .select('voter_id, value')
      .eq('post_id', postId);

    if (error || !data) {
      return localStats;
    }

    let up = 0;
    let down = 0;
    let userVote: -1 | 1 | null = null;

    for (const v of data) {
      if (v.value === 1) up++;
      else if (v.value === -1) down++;
      if (currentUserId && v.voter_id === currentUserId) {
        userVote = v.value as -1 | 1;
      }
    }

    if (up === 0 && down === 0 && (localStats.upvotes > 0 || localStats.downvotes > 0)) {
      return localStats;
    }

    return {
      upvotes: up,
      downvotes: down,
      score: up - down,
      userVote: userVote ?? localStats.userVote,
    };
  } catch {
    return localStats;
  }
}
