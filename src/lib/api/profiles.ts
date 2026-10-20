// src/lib/api/profiles.ts
import { supabase } from '../supabaseClient';
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
  updates: Partial<Pick<ProfileRecord, 'username' | 'display_name' | 'bio' | 'avatar_url' | 'cover_url'>>
): Promise<ProfileResult> {
  try {
    // Direct reputation update is rejected by database trigger & RLS
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      const isPending = error.code === '42P01' || error.message.includes('relation');
      return { data: null, error: error.message, isPendingMigration: isPending };
    }
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || 'Failed to update profile' };
  }
}
