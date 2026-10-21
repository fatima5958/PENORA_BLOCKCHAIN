// src/lib/api/profiles.ts
import { supabase } from '../supabaseClient';
import { penoraKeyAuth } from '../auth/penoraKeyAuth';
import type { ProfileRecord } from './types';

export interface ProfileResult {
  data: ProfileRecord | null;
  error: string | null;
  isPendingMigration?: boolean;
}

export async function getProfileById(id: string): Promise<ProfileResult> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      const isPending = error.code === '42P01' || error.message.includes('relation');
      return { data: null, error: error.message, isPendingMigration: isPending };
    }
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || 'Failed to fetch profile' };
  }
}

export async function getProfileByUsername(username: string): Promise<ProfileResult> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', username)
      .maybeSingle();

    if (error) {
      const isPending = error.code === '42P01' || error.message.includes('relation');
      return { data: null, error: error.message, isPendingMigration: isPending };
    }
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || 'Failed to fetch profile' };
  }
}

export async function updateProfile(
  id: string,
  updates: Partial<Pick<ProfileRecord, 'username' | 'display_name' | 'bio' | 'avatar_url' | 'cover_url' | 'location' | 'website' | 'interests'>>
): Promise<ProfileResult> {
  try {
    // 1. Length & format validation guards
    if (updates.display_name !== undefined && updates.display_name.trim().length > 50) {
      return { data: null, error: 'Display name cannot exceed 50 characters.' };
    }
    if (updates.bio !== undefined && updates.bio.trim().length > 300) {
      return { data: null, error: 'Bio cannot exceed 300 characters.' };
    }
    if (updates.location !== undefined && updates.location.trim().length > 50) {
      return { data: null, error: 'Location cannot exceed 50 characters.' };
    }
    if (updates.website !== undefined && updates.website.trim().length > 0) {
      const trimmedUrl = updates.website.trim();
      try {
        const parsed = new URL(trimmedUrl);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          return { data: null, error: 'Website must be a valid http or https URL.' };
        }
      } catch {
        return { data: null, error: 'Please enter a valid website URL (e.g. https://yourdomain.com).' };
      }
    }
    if (updates.interests !== undefined) {
      if (!Array.isArray(updates.interests)) {
        return { data: null, error: 'Interests must be an array of tags.' };
      }
      if (updates.interests.length > 10) {
        return { data: null, error: 'Maximum 10 interest tags allowed.' };
      }
      for (const tag of updates.interests) {
        if (typeof tag !== 'string' || tag.length > 25) {
          return { data: null, error: 'Each interest tag cannot exceed 25 characters.' };
        }
      }
    }

    // 2. Identity enforcement: verify real authenticated account identity
    const { data: sessionData } = await supabase.auth.getSession();
    const sessionUser = sessionData?.session?.user;
    const keyUser = penoraKeyAuth.getCurrentUser();
    const activeUserId = sessionUser?.id || keyUser?.id;

    if (!activeUserId) {
      return { data: null, error: 'Authentication required: You must be signed in to edit your profile.' };
    }

    // Never trust client-supplied ID if it doesn't match authenticated identity
    if (id && id !== activeUserId && (!sessionUser || id !== sessionUser.id) && (!keyUser || id !== keyUser.id)) {
      return { data: null, error: 'Unauthorized: You can only update your own profile.' };
    }

    if (keyUser && !penoraKeyAuth.hasPermission('edit_profile')) {
      return { data: null, error: 'Your current key authority does not permit updating profile metadata.' };
    }

    const targetId = activeUserId;

    // 3. Prepare sanitized payload (direct reputation update is rejected)
    const payload: Record<string, any> = {};
    if (updates.display_name !== undefined) payload.display_name = updates.display_name.trim();
    if (updates.bio !== undefined) payload.bio = updates.bio.trim();
    if (updates.avatar_url !== undefined) payload.avatar_url = updates.avatar_url;
    if (updates.cover_url !== undefined) payload.cover_url = updates.cover_url;
    if (updates.location !== undefined) payload.location = updates.location.trim();
    if (updates.website !== undefined) payload.website = updates.website.trim();
    if (updates.interests !== undefined) payload.interests = updates.interests.map(t => t.trim().replace(/^#/, ''));

    let { data, error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', targetId)
      .select()
      .maybeSingle();

    // If new V5 columns do not yet exist on the remote database, fall back gracefully to saving base columns
    if (error && (error.message.includes('column') || error.code === '42703')) {
      const basePayload: Record<string, any> = {};
      if (payload.display_name !== undefined) basePayload.display_name = payload.display_name;
      if (payload.bio !== undefined) basePayload.bio = payload.bio;
      if (payload.avatar_url !== undefined) basePayload.avatar_url = payload.avatar_url;
      if (payload.cover_url !== undefined) basePayload.cover_url = payload.cover_url;

      const fallback = await supabase
        .from('profiles')
        .update(basePayload)
        .eq('id', targetId)
        .select()
        .maybeSingle();

      if (!fallback.error) {
        return {
          data: {
            ...fallback.data,
            location: payload.location ?? null,
            website: payload.website ?? null,
            interests: payload.interests ?? [],
          },
          error: null,
          isPendingMigration: true,
        };
      }
      error = fallback.error;
    }

    if (error) {
      const isPending = error.code === '42P01' || error.message.includes('relation');
      return { data: null, error: error.message, isPendingMigration: isPending };
    }
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || 'Failed to update profile' };
  }
}
