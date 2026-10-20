// src/lib/api/follows.ts
import { supabase } from '../supabaseClient';
import type { FollowRecord } from './types';

export interface FollowResult {
  isFollowing: boolean;
  error: string | null;
  isPendingMigration?: boolean;
}

export async function isFollowing(followerId: string, followeeId: string): Promise<boolean> {
  try {
    if (followerId === followeeId) return false;
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
  try {
    if (followerId === followeeId) {
      return { isFollowing: false, error: 'Cannot follow yourself' };
    }

    const { error } = await supabase.from('follows').insert({
      follower_id: followerId,
      followee_id: followeeId,
    });

    if (error) {
      const isPending = error.code === '42P01' || error.message.includes('relation');
      return { isFollowing: false, error: error.message, isPendingMigration: isPending };
    }
    return { isFollowing: true, error: null };
  } catch (err: any) {
    return { isFollowing: false, error: err.message || 'Failed to follow user' };
  }
}

export async function unfollowUser(followerId: string, followeeId: string): Promise<FollowResult> {
  try {
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('followee_id', followeeId);

    if (error) {
      const isPending = error.code === '42P01' || error.message.includes('relation');
      return { isFollowing: true, error: error.message, isPendingMigration: isPending };
    }
    return { isFollowing: false, error: null };
  } catch (err: any) {
    return { isFollowing: true, error: err.message || 'Failed to unfollow user' };
  }
}

export async function getFollowCounts(userId: string): Promise<{ followers: number; following: number }> {
  try {
    const [followersRes, followingRes] = await Promise.all([
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('followee_id', userId),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
    ]);

    return {
      followers: followersRes.count || 0,
      following: followingRes.count || 0,
    };
  } catch {
    return { followers: 0, following: 0 };
  }
}
