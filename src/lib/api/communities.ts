// src/lib/api/communities.ts
import { supabase } from '../supabaseClient';
import type { CommunityRecord } from './types';

export interface CommunitiesListResult {
  data: CommunityRecord[];
  error: string | null;
  isPendingMigration?: boolean;
}

export interface SingleCommunityResult {
  data: CommunityRecord | null;
  error: string | null;
  isPendingMigration?: boolean;
}

export async function getCommunities(limit?: number): Promise<CommunitiesListResult> {
  try {
    let query = supabase.from('communities').select('*,community_memberships(count)').order('created_at', { ascending: false });
    if (limit) query = query.limit(limit);

    const { data, error } = await query;
    if (error) {
      const isPending = error.code === '42P01' || error.message.includes('relation');
      return { data: [], error: error.message, isPendingMigration: isPending };
    }
    return { data: (data as CommunityRecord[]) || [], error: null };
  } catch (err: any) {
    return { data: [], error: err.message || 'Failed to fetch communities' };
  }
}

export async function getCommunityBySlug(slug: string): Promise<SingleCommunityResult> {
  try {
    const { data, error } = await supabase
      .from('communities')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (error) {
      const isPending = error.code === '42P01' || error.message.includes('relation');
      return { data: null, error: error.message, isPendingMigration: isPending };
    }
    return { data: (data as CommunityRecord) || null, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || 'Failed to fetch community' };
  }
}

export async function joinCommunity(
  userId: string,
  communityId: string
): Promise<{ success: boolean; error: string | null; isPendingMigration?: boolean }> {
  try {
    const { error } = await supabase
      .from('community_memberships')
      .insert({ member_id: userId, community_id: communityId, role: 'member' });

    if (error) {
      const isPending = error.code === '42P01' || error.message.includes('relation');
      return { success: false, error: error.message, isPendingMigration: isPending };
    }
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to join community' };
  }
}

export async function leaveCommunity(
  userId: string,
  communityId: string
): Promise<{ success: boolean; error: string | null; isPendingMigration?: boolean }> {
  try {
    const { error } = await supabase
      .from('community_memberships')
      .delete()
      .eq('member_id', userId)
      .eq('community_id', communityId);

    if (error) {
      const isPending = error.code === '42P01' || error.message.includes('relation');
      return { success: false, error: error.message, isPendingMigration: isPending };
    }
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to leave community' };
  }
}

export async function isCommunityMember(userId: string, communityId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('community_memberships')
      .select('member_id')
      .eq('member_id', userId)
      .eq('community_id', communityId)
      .maybeSingle();

    if (error || !data) return false;
    return true;
  } catch {
    return false;
  }
}
