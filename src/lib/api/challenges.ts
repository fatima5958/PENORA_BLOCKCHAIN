// src/lib/api/challenges.ts
// PENORA Writing Challenges & Submissions API
// Community-wide writing prompts, submission verification, and progress tracking.

import { supabase } from '../supabaseClient';
import type { WritingChallengeRecord, ChallengeSubmissionRecord, PostRecord } from './types';

const LOCAL_SUBMISSIONS_KEY = 'penora_challenge_submissions_v2';

function isUuid(id?: string | null): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

// Initial active challenges matching PENORA's editorial direction
const SEED_CHALLENGES: WritingChallengeRecord[] = [
  {
    id: 'ch-spatial-future',
    title: 'The Architecture of Spatial Interfaces',
    slug: 'the-architecture-of-spatial-interfaces',
    prompt: 'How will spatial computing, depth typography, and liquid glass change human focus and reading on the web?',
    guidelines: 'Submit an essay or technical perspective between 800 and 2,500 words. Include real examples, design philosophies, or spatial computing paradigms.',
    starts_at: '2026-10-15T00:00:00Z',
    ends_at: '2026-11-01T23:59:59Z',
    status: 'active',
    cover_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
    created_at: '2026-10-15T00:00:00Z',
    submissions_count: 8,
  },
  {
    id: 'ch-creator-sovereignty',
    title: 'Toward a Sovereign Creator Commons',
    slug: 'toward-a-sovereign-creator-commons',
    prompt: 'How do decentralized publishing protocols and verifiable reputation build a sustainable future without surveillance advertising?',
    guidelines: 'Reflect on community-driven curation, fair monetization, and sovereign creator publishing on PENORA.',
    starts_at: '2026-10-18T00:00:00Z',
    ends_at: '2026-11-08T23:59:59Z',
    status: 'active',
    cover_url: 'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&w=1200&q=80',
    created_at: '2026-10-18T00:00:00Z',
    submissions_count: 5,
  },
  {
    id: 'ch-typographic-craft',
    title: 'The Lost Art of Typographic Rhythm',
    slug: 'the-lost-art-of-typographic-rhythm',
    prompt: 'Explore the balance between editorial serif design, line height, reading cadence, and distraction-free mobile layouts.',
    guidelines: 'Deep dive into typography, cognitive load, and premium reading experiences on digital screens.',
    starts_at: '2026-10-22T00:00:00Z',
    ends_at: '2026-11-15T23:59:59Z',
    status: 'active',
    cover_url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=1200&q=80',
    created_at: '2026-10-22T00:00:00Z',
    submissions_count: 3,
  },
];

export async function getActiveChallenges(): Promise<{ data: WritingChallengeRecord[]; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('writing_challenges')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
      return { data: SEED_CHALLENGES, error: null };
    }
    return { data: (data as WritingChallengeRecord[]) || SEED_CHALLENGES, error: null };
  } catch {
    return { data: SEED_CHALLENGES, error: null };
  }
}

export async function getChallengeBySlug(
  slug: string
): Promise<{ data: WritingChallengeRecord | null; error: string | null }> {
  const seed = SEED_CHALLENGES.find(c => c.slug === slug);

  try {
    const { data, error } = await supabase
      .from('writing_challenges')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (error || !data) {
      return { data: seed || null, error: null };
    }
    return { data: (data as WritingChallengeRecord) || seed, error: null };
  } catch {
    return { data: seed || null, error: null };
  }
}

export async function submitStoryToChallenge(
  challengeId: string,
  postId: string,
  authorId: string
): Promise<{ success: boolean; error: string | null }> {
  if (!challengeId || !postId || !authorId) {
    return { success: false, error: 'Challenge, story, and verified author required.' };
  }

  // Local ledger save
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(LOCAL_SUBMISSIONS_KEY) : null;
    const list = raw ? JSON.parse(raw) : [];
    if (!list.some((s: any) => s.challenge_id === challengeId && s.post_id === postId)) {
      list.push({
        id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        challenge_id: challengeId,
        post_id: postId,
        author_id: authorId,
        is_featured: false,
        submitted_at: new Date().toISOString(),
      });
      if (typeof window !== 'undefined') localStorage.setItem(LOCAL_SUBMISSIONS_KEY, JSON.stringify(list));
    }
  } catch {}

  if (!isUuid(challengeId) || !isUuid(postId) || !isUuid(authorId)) {
    return { success: true, error: null };
  }

  try {
    const { error } = await supabase.from('challenge_submissions').insert({
      challenge_id: challengeId,
      post_id: postId,
      author_id: authorId,
      is_featured: false,
    });

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'This blog is already submitted to this challenge.' };
      }
      const isPending = error.code === '42P01' || error.message.includes('relation');
      return { success: true, error: isPending ? null : error.message };
    }
    return { success: true, error: null };
  } catch (err: any) {
    return { success: true, error: null };
  }
}

export async function getChallengeSubmissions(
  challengeId: string
): Promise<{ data: ChallengeSubmissionRecord[]; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('challenge_submissions')
      .select('*, post:posts!post_id(*, author:profiles!author_id(*))')
      .eq('challenge_id', challengeId)
      .order('submitted_at', { ascending: false });

    if (error) {
      // Local fallback
      const raw = typeof window !== 'undefined' ? localStorage.getItem(LOCAL_SUBMISSIONS_KEY) : null;
      const list: ChallengeSubmissionRecord[] = raw ? JSON.parse(raw) : [];
      return { data: list.filter(s => s.challenge_id === challengeId), error: null };
    }
    return { data: (data as ChallengeSubmissionRecord[]) || [], error: null };
  } catch {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(LOCAL_SUBMISSIONS_KEY) : null;
    const list: ChallengeSubmissionRecord[] = raw ? JSON.parse(raw) : [];
    return { data: list.filter(s => s.challenge_id === challengeId), error: null };
  }
}
