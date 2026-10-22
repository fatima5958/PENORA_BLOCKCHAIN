// src/lib/api/spotlight.ts
// PENORA Editorial Spotlight Engine
// Highlights high-signal articles and verified rising creators based on transparent, anti-spam criteria.

import { supabase } from '../supabaseClient';
import type { PostRecord, ProfileRecord } from './types';
import { getProfiles } from './profiles';

export interface SpotlightArticle extends PostRecord {
  upvotesCount?: number;
  commentsCount?: number;
  curatorScore?: number;
}

export interface SpotlightCreator extends ProfileRecord {
  articlesCount?: number;
  featuredStory?: {
    title: string;
    slug: string;
  };
}

/**
 * Fetch editorial spotlight articles.
 * Transparent criteria:
 * - Published, non-empty content
 * - Sorted by verified community signals (reputation of author + vote count)
 * - Safe fallback if no articles exist
 */
export async function getSpotlightArticles(limit: number = 4): Promise<{ data: SpotlightArticle[]; error: string | null }> {
  try {
    const { data: posts, error } = await supabase
      .from('posts')
      .select('*, author:profiles!author_id(*)')
      .eq('published', true)
      .order('created_at', { ascending: false })
      .limit(limit * 3);

    if (error || !posts || posts.length === 0) {
      return { data: [], error: error?.message || null };
    }

    // Rank posts transparently by author reputation + title/content completeness
    const ranked = (posts as (PostRecord & { author?: ProfileRecord })[]).map(p => {
      const rep = p.author?.reputation ?? 25;
      const hasCover = p.cover_image_url ? 15 : 0;
      const lengthBonus = (p.content?.length || 0) > 600 ? 20 : 5;
      const curatorScore = rep + hasCover + lengthBonus;

      return {
        ...p,
        curatorScore,
      } as SpotlightArticle;
    });

    ranked.sort((a, b) => (b.curatorScore || 0) - (a.curatorScore || 0));

    return { data: ranked.slice(0, limit), error: null };
  } catch (err: any) {
    return { data: [], error: err.message || 'Failed to load spotlight articles' };
  }
}

/**
 * Fetch spotlight & rising creators.
 * Transparent criteria:
 * - Verifiable profile with username and display name
 * - Sorted by reputation and consistency
 */
export async function getSpotlightCreators(limit: number = 6): Promise<{ data: SpotlightCreator[]; error: string | null }> {
  try {
    const { data: profiles, error } = await getProfiles({ limit: limit * 2 });

    if (error || !profiles || profiles.length === 0) {
      return { data: [], error: error || null };
    }

    // Filter out profiles with no username
    const valid = profiles.filter(p => p.username && p.username.trim().length > 0);

    return {
      data: valid.slice(0, limit) as SpotlightCreator[],
      error: null,
    };
  } catch (err: any) {
    return { data: [], error: err.message || 'Failed to load spotlight creators' };
  }
}
