// src/lib/api/communities.ts
// PENORA Communities V2 Service: Roles, Governance, Moderation, Pinned Posts, Audit Logs, and Feed

import { supabase } from '../supabaseClient';
import type {
  CommunityRecord,
  CommunityRole,
  CommunityMemberRecord,
  CommunityAuditLogRecord,
  PostRecord,
} from './types';

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

const LOCAL_MEMBERS_KEY = 'penora_community_members_v2';
const LOCAL_PINNED_KEY = 'penora_community_pinned_v2';
const LOCAL_HIDDEN_KEY = 'penora_community_hidden_v2';
const LOCAL_AUDIT_KEY = 'penora_community_audit_v2';

function isUuid(id?: string | null): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

// -------------------------------------------------------------
// 1. Core Community Queries
// -------------------------------------------------------------

export async function getCommunities(limit?: number): Promise<CommunitiesListResult> {
  try {
    let query = supabase
      .from('communities')
      .select('*, community_memberships(count)')
      .order('created_at', { ascending: false });

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
      .select('*, community_memberships(count)')
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

// -------------------------------------------------------------
// 2. Roles & Governance
// -------------------------------------------------------------

export async function getUserCommunityRole(
  communityId: string,
  userId?: string | null
): Promise<CommunityRole> {
  if (!communityId || !userId) return 'guest';

  // Check if owner via communities.created_by
  if (isUuid(communityId) && isUuid(userId)) {
    try {
      const { data: comm } = await supabase
        .from('communities')
        .select('created_by')
        .eq('id', communityId)
        .maybeSingle();

      if (comm && comm.created_by === userId) {
        return 'owner';
      }

      const { data: membership } = await supabase
        .from('community_memberships')
        .select('role')
        .eq('community_id', communityId)
        .eq('member_id', userId)
        .maybeSingle();

      if (membership) {
        return membership.role as CommunityRole;
      }
    } catch {
      // ignore
    }
  }

  // Local fallback
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(LOCAL_MEMBERS_KEY) : null;
    if (raw) {
      const map = JSON.parse(raw);
      const role = map[`${communityId}:${userId}`];
      if (role) return role;
    }
  } catch {}

  return 'guest';
}

export async function getCommunityMembers(
  communityId: string,
  search?: string
): Promise<{ data: CommunityMemberRecord[]; error: string | null }> {
  if (!isUuid(communityId)) return { data: [], error: null };

  try {
    let query = supabase
      .from('community_memberships')
      .select('community_id, member_id, role, created_at, profile:profiles!member_id(*)')
      .eq('community_id', communityId)
      .order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) {
      return { data: [], error: error.message };
    }

    let list = (data || []) as unknown as CommunityMemberRecord[];
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(m => {
        const username = m.profile?.username?.toLowerCase() || '';
        const name = m.profile?.display_name?.toLowerCase() || '';
        return username.includes(q) || name.includes(q);
      });
    }

    return { data: list, error: null };
  } catch (err: any) {
    return { data: [], error: err.message || 'Failed to fetch members' };
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
      if (error.code === '23505') return { success: true, error: null };
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
  if (!isUuid(userId) || !isUuid(communityId)) return false;
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

export async function updateMemberRole(
  communityId: string,
  memberId: string,
  newRole: 'member' | 'moderator' | 'admin',
  actorId: string
): Promise<{ success: boolean; error: string | null }> {
  const actorRole = await getUserCommunityRole(communityId, actorId);
  if (actorRole !== 'owner' && actorRole !== 'admin') {
    return { success: false, error: 'Only community Owners and Admins can update roles.' };
  }

  try {
    const { error } = await supabase
      .from('community_memberships')
      .update({ role: newRole })
      .eq('community_id', communityId)
      .eq('member_id', memberId);

    if (error) return { success: false, error: error.message };

    await logCommunityAction(
      communityId,
      actorId,
      'update_role',
      memberId,
      `Changed role to ${newRole}`
    );

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update member role' };
  }
}

export async function removeMember(
  communityId: string,
  memberId: string,
  actorId: string
): Promise<{ success: boolean; error: string | null }> {
  const actorRole = await getUserCommunityRole(communityId, actorId);
  if (actorRole !== 'owner' && actorRole !== 'admin') {
    return { success: false, error: 'Permission denied: Insufficient privileges.' };
  }

  try {
    const { error } = await supabase
      .from('community_memberships')
      .delete()
      .eq('community_id', communityId)
      .eq('member_id', memberId);

    if (error) return { success: false, error: error.message };

    await logCommunityAction(
      communityId,
      actorId,
      'remove_member',
      memberId,
      'Removed member from community'
    );

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to remove member' };
  }
}

// -------------------------------------------------------------
// 3. Community Management (Details, Cover, Avatar, Rules)
// -------------------------------------------------------------

export async function updateCommunityDetails(
  communityId: string,
  updates: {
    name?: string;
    description?: string;
    rules?: string;
    avatar_url?: string;
    cover_url?: string;
  },
  actorId: string
): Promise<{ success: boolean; error: string | null }> {
  const actorRole = await getUserCommunityRole(communityId, actorId);
  if (actorRole !== 'owner' && actorRole !== 'admin') {
    return { success: false, error: 'Permission denied: Only Owners and Admins can edit community details.' };
  }

  try {
    const payload: Record<string, any> = {};
    if (updates.name !== undefined) payload.name = updates.name.trim();
    if (updates.description !== undefined) payload.description = updates.description.trim();
    if (updates.rules !== undefined) payload.rules = updates.rules.trim();
    if (updates.avatar_url !== undefined) payload.avatar_url = updates.avatar_url;
    if (updates.cover_url !== undefined) payload.cover_url = updates.cover_url;

    const { error } = await supabase
      .from('communities')
      .update(payload)
      .eq('id', communityId);

    if (error) return { success: false, error: error.message };

    await logCommunityAction(
      communityId,
      actorId,
      'update_details',
      communityId,
      'Updated community configuration and guidelines'
    );

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update community' };
  }
}

// -------------------------------------------------------------
// 4. Pinned Posts
// -------------------------------------------------------------

export async function pinPostInCommunity(
  communityId: string,
  postId: string,
  actorId: string
): Promise<{ success: boolean; error: string | null }> {
  const actorRole = await getUserCommunityRole(communityId, actorId);
  if (actorRole !== 'owner' && actorRole !== 'admin' && actorRole !== 'moderator') {
    return { success: false, error: 'Only community moderators can pin announcements.' };
  }

  // Local fallback ledger
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(LOCAL_PINNED_KEY) : null;
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (!list.includes(`${communityId}:${postId}`)) {
      list.push(`${communityId}:${postId}`);
      if (typeof window !== 'undefined') localStorage.setItem(LOCAL_PINNED_KEY, JSON.stringify(list));
    }
  } catch {}

  if (!isUuid(communityId) || !isUuid(postId) || !isUuid(actorId)) {
    return { success: true, error: null };
  }

  try {
    const { error } = await supabase.from('community_pinned_posts').insert({
      community_id: communityId,
      post_id: postId,
      pinned_by: actorId,
    });

    if (error && error.code !== '23505' && error.code !== '42P01') {
      return { success: false, error: error.message };
    }

    await logCommunityAction(communityId, actorId, 'pin_post', postId, 'Pinned announcement to top of feed');
    return { success: true, error: null };
  } catch (err: any) {
    return { success: true, error: null };
  }
}

export async function unpinPostInCommunity(
  communityId: string,
  postId: string,
  actorId: string
): Promise<{ success: boolean; error: string | null }> {
  const actorRole = await getUserCommunityRole(communityId, actorId);
  if (actorRole !== 'owner' && actorRole !== 'admin' && actorRole !== 'moderator') {
    return { success: false, error: 'Only community moderators can unpin posts.' };
  }

  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(LOCAL_PINNED_KEY) : null;
    if (raw) {
      let list: string[] = JSON.parse(raw);
      list = list.filter(k => k !== `${communityId}:${postId}`);
      if (typeof window !== 'undefined') localStorage.setItem(LOCAL_PINNED_KEY, JSON.stringify(list));
    }
  } catch {}

  if (!isUuid(communityId) || !isUuid(postId)) {
    return { success: true, error: null };
  }

  try {
    const { error } = await supabase
      .from('community_pinned_posts')
      .delete()
      .eq('community_id', communityId)
      .eq('post_id', postId);

    if (error && error.code !== '42P01') {
      return { success: false, error: error.message };
    }

    await logCommunityAction(communityId, actorId, 'unpin_post', postId, 'Unpinned post from top');
    return { success: true, error: null };
  } catch (err: any) {
    return { success: true, error: null };
  }
}

export async function getPinnedPostIds(communityId: string): Promise<string[]> {
  const set = new Set<string>();

  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(LOCAL_PINNED_KEY) : null;
    if (raw) {
      const list: string[] = JSON.parse(raw);
      list.forEach(k => {
        const [cId, pId] = k.split(':');
        if (cId === communityId && pId) set.add(pId);
      });
    }
  } catch {}

  if (!isUuid(communityId)) return Array.from(set);

  try {
    const { data } = await supabase
      .from('community_pinned_posts')
      .select('post_id')
      .eq('community_id', communityId);

    if (data) {
      data.forEach((r: any) => set.add(r.post_id));
    }
  } catch {}

  return Array.from(set);
}

// -------------------------------------------------------------
// 5. Moderation (Hide/Remove content from community feed)
// -------------------------------------------------------------

export async function hidePostInCommunity(
  communityId: string,
  postId: string,
  reason: string,
  actorId: string
): Promise<{ success: boolean; error: string | null }> {
  const actorRole = await getUserCommunityRole(communityId, actorId);
  if (actorRole !== 'owner' && actorRole !== 'admin' && actorRole !== 'moderator') {
    return { success: false, error: 'Only community moderators can remove content.' };
  }

  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(LOCAL_HIDDEN_KEY) : null;
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (!list.includes(`${communityId}:${postId}`)) {
      list.push(`${communityId}:${postId}`);
      if (typeof window !== 'undefined') localStorage.setItem(LOCAL_HIDDEN_KEY, JSON.stringify(list));
    }
  } catch {}

  if (!isUuid(communityId) || !isUuid(postId) || !isUuid(actorId)) {
    return { success: true, error: null };
  }

  try {
    const { error } = await supabase.from('community_hidden_posts').insert({
      community_id: communityId,
      post_id: postId,
      hidden_by: actorId,
      reason: reason.trim(),
    });

    if (error && error.code !== '23505' && error.code !== '42P01') {
      return { success: false, error: error.message };
    }

    await logCommunityAction(communityId, actorId, 'hide_post', postId, `Removed post: ${reason}`);
    return { success: true, error: null };
  } catch (err: any) {
    return { success: true, error: null };
  }
}

export async function getHiddenPostIds(communityId: string): Promise<string[]> {
  const set = new Set<string>();

  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(LOCAL_HIDDEN_KEY) : null;
    if (raw) {
      const list: string[] = JSON.parse(raw);
      list.forEach(k => {
        const [cId, pId] = k.split(':');
        if (cId === communityId && pId) set.add(pId);
      });
    }
  } catch {}

  if (!isUuid(communityId)) return Array.from(set);

  try {
    const { data } = await supabase
      .from('community_hidden_posts')
      .select('post_id')
      .eq('community_id', communityId);

    if (data) {
      data.forEach((r: any) => set.add(r.post_id));
    }
  } catch {}

  return Array.from(set);
}

// -------------------------------------------------------------
// 6. Community Audit Logs & Reports
// -------------------------------------------------------------

export async function logCommunityAction(
  communityId: string,
  actorId: string,
  action: string,
  targetId?: string,
  details?: string
): Promise<void> {
  const logItem = {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    community_id: communityId,
    actor_id: actorId,
    action,
    target_id: targetId || null,
    details: details || null,
    created_at: new Date().toISOString(),
  };

  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(LOCAL_AUDIT_KEY) : null;
    const list = raw ? JSON.parse(raw) : [];
    list.unshift(logItem);
    if (typeof window !== 'undefined') localStorage.setItem(LOCAL_AUDIT_KEY, JSON.stringify(list.slice(0, 100)));
  } catch {}

  if (isUuid(communityId) && isUuid(actorId)) {
    try {
      await supabase.from('community_audit_logs').insert({
        community_id: communityId,
        actor_id: actorId,
        action,
        target_id: targetId || null,
        details: details || null,
      });
    } catch {}
  }
}

export async function getCommunityAuditLogs(
  communityId: string
): Promise<{ data: CommunityAuditLogRecord[]; error: string | null }> {
  if (!isUuid(communityId)) {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(LOCAL_AUDIT_KEY) : null;
      const list: CommunityAuditLogRecord[] = raw ? JSON.parse(raw) : [];
      return { data: list.filter(l => l.community_id === communityId), error: null };
    } catch {
      return { data: [], error: null };
    }
  }

  try {
    const { data, error } = await supabase
      .from('community_audit_logs')
      .select('*, actor:profiles!actor_id(*)')
      .eq('community_id', communityId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(LOCAL_AUDIT_KEY) : null;
      const list: CommunityAuditLogRecord[] = raw ? JSON.parse(raw) : [];
      return { data: list.filter(l => l.community_id === communityId), error: null };
    }
    return { data: (data as CommunityAuditLogRecord[]) || [], error: null };
  } catch (err: any) {
    return { data: [], error: err.message || 'Failed to fetch audit logs' };
  }
}

// -------------------------------------------------------------
// 7. Community Feed (Trending, Latest, Pinned)
// -------------------------------------------------------------

export async function getCommunityFeed(
  communityId: string,
  communitySlug: string,
  filter: 'trending' | 'latest' | 'pinned' = 'trending'
): Promise<{ data: (PostRecord & { isPinned?: boolean })[]; error: string | null }> {
  try {
    const [pinnedIds, hiddenIds] = await Promise.all([
      getPinnedPostIds(communityId),
      getHiddenPostIds(communityId),
    ]);

    // Fetch published posts
    let query = supabase
      .from('posts')
      .select('*, author:profiles!author_id(*)')
      .eq('published', true);

    if (filter === 'latest') {
      query = query.order('created_at', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    const { data, error } = await query;
    if (error) return { data: [], error: error.message };

    const hiddenSet = new Set(hiddenIds);
    const pinnedSet = new Set(pinnedIds);

    // Filter posts that belong to this community (either via tag, slug, or pinned)
    const slugLower = communitySlug.toLowerCase();
    let communityPosts = (data as PostRecord[] || []).filter(post => {
      if (hiddenSet.has(post.id)) return false;
      if (pinnedSet.has(post.id)) return true;
      if (post.tags && post.tags.some(t => t.toLowerCase() === slugLower || slugLower.includes(t.toLowerCase()))) {
        return true;
      }
      return false;
    });

    // If tag matches are scarce in dev, show published posts with pinned prioritized
    if (communityPosts.length === 0 && (data as PostRecord[])?.length > 0) {
      communityPosts = (data as PostRecord[]).filter(p => !hiddenSet.has(p.id));
    }

    const enriched = communityPosts.map(p => ({
      ...p,
      isPinned: pinnedSet.has(p.id),
    }));

    if (filter === 'pinned') {
      return { data: enriched.filter(p => p.isPinned), error: null };
    }

    // Always sort pinned to the very top in 'trending' and 'latest'
    enriched.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return { data: enriched, error: null };
  } catch (err: any) {
    return { data: [], error: err.message || 'Failed to load community feed' };
  }
}
