// src/lib/api/follows.ts
import { supabase } from '../supabaseClient';
import type { FollowRecord } from './types';

export interface FollowResult {
  isFollowing: boolean;
  error: string | null;
  isPendingMigration?: boolean;
}

const LOCAL_FOLLOWS_KEY = 'penora_follows_ledger_v1';
let memoryFollows: Record<string, string[]> = {};

function isUuid(id?: string | null): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function readLocalFollows(): Record<string, string[]> {
  // follower -> followee[]
  if (typeof window === 'undefined' || !window.localStorage) return memoryFollows;
  try {
    const raw = window.localStorage.getItem(LOCAL_FOLLOWS_KEY);
    return raw ? JSON.parse(raw) : memoryFollows;
  } catch {
    return memoryFollows;
  }
}

function writeLocalFollows(data: Record<string, string[]>): void {
  memoryFollows = data;
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(LOCAL_FOLLOWS_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export async function isFollowing(followerId: string, followeeId: string): Promise<boolean> {
  if (!followerId || !followeeId || followerId === followeeId) return false;

  const localMap = readLocalFollows();
  const list = localMap[followerId] || [];
  if (list.includes(followeeId)) return true;

  if (!isUuid(followerId) || !isUuid(followeeId)) {
    return false;
  }

  try {
    const { data, error } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('follower_id', followerId)
      .eq('followee_id', followeeId)
      .maybeSingle();

    if (error || !data) return false;
    return true;
  } catch {
    return false;
  }
}

export async function followUser(followerId: string, followeeId: string): Promise<FollowResult> {
  if (!followerId || !followeeId || followerId === followeeId) {
    return { isFollowing: false, error: 'Cannot follow yourself' };
  }

  const localMap = readLocalFollows();
  const list = localMap[followerId] || [];
  if (!list.includes(followeeId)) {
    list.push(followeeId);
    localMap[followerId] = list;
    writeLocalFollows(localMap);
  }

  if (!isUuid(followerId) || !isUuid(followeeId)) {
    return { isFollowing: true, error: null };
  }

  try {
    const { error } = await supabase.from('follows').insert({
      follower_id: followerId,
      followee_id: followeeId,
    });

    if (error) {
      const isPending = error.code === '42P01' || error.message.includes('relation');
      return { isFollowing: true, error: isPending ? null : error.message, isPendingMigration: isPending };
    }
    return { isFollowing: true, error: null };
  } catch (err: any) {
    return { isFollowing: true, error: err.message || 'Failed to follow user' };
  }
}

export async function unfollowUser(followerId: string, followeeId: string): Promise<FollowResult> {
  const localMap = readLocalFollows();
  const list = (localMap[followerId] || []).filter(id => id !== followeeId);
  localMap[followerId] = list;
  writeLocalFollows(localMap);

  if (!isUuid(followerId) || !isUuid(followeeId)) {
    return { isFollowing: false, error: null };
  }

  try {
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('followee_id', followeeId);

    if (error) {
      const isPending = error.code === '42P01' || error.message.includes('relation');
      return { isFollowing: false, error: isPending ? null : error.message, isPendingMigration: isPending };
    }
    return { isFollowing: false, error: null };
  } catch (err: any) {
    return { isFollowing: false, error: err.message || 'Failed to unfollow user' };
  }
}

export async function getFollowCounts(userId: string): Promise<{ followers: number; following: number }> {
  const localMap = readLocalFollows();
  const followingCount = (localMap[userId] || []).length;
  let followerCount = 0;
  for (const list of Object.values(localMap)) {
    if (list.includes(userId)) followerCount++;
  }

  if (!isUuid(userId)) {
    return { followers: followerCount, following: followingCount };
  }

  try {
    const [followersRes, followingRes] = await Promise.all([
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('followee_id', userId),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
    ]);

    const remoteFollowers = followersRes.count ?? followerCount;
    const remoteFollowing = followingRes.count ?? followingCount;

    return {
      followers: Math.max(followerCount, remoteFollowers),
      following: Math.max(followingCount, remoteFollowing),
    };
  } catch {
    return { followers: followerCount, following: followingCount };
  }
}
