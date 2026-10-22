// src/lib/api/reputation.ts
// PENORA Creator Reputation & Verified Achievements V2
// Calculates genuine reputation signals, progression milestones, levels, and badge verifications.

import { supabase } from '../supabaseClient';
import type {
  AchievementBadge,
  CreatorLevelInfo,
  ReputationBreakdown,
  AchievementBadgeKey,
} from './types';

const LOCAL_ACHIEVEMENTS_KEY = 'penora_creator_achievements_v2';

function isUuid(id?: string | null): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

// -------------------------------------------------------------
// 1. Level Calculation
// -------------------------------------------------------------

export function computeCreatorLevel(score: number): CreatorLevelInfo {
  const s = Math.max(25, Math.min(100, score));

  if (s >= 80) {
    return {
      level: 5,
      title: 'Celestial Luminary',
      score: s,
      minScore: 80,
      nextLevelScore: 100,
      percentToNext: Math.round(((s - 80) / 20) * 100),
      pointsNeeded: Math.max(0, 100 - s),
    };
  }

  if (s >= 65) {
    return {
      level: 4,
      title: 'Guildmaster / Builder',
      score: s,
      minScore: 65,
      nextLevelScore: 80,
      percentToNext: Math.round(((s - 65) / 15) * 100),
      pointsNeeded: 80 - s,
    };
  }

  if (s >= 50) {
    return {
      level: 3,
      title: 'Verified Author',
      score: s,
      minScore: 50,
      nextLevelScore: 65,
      percentToNext: Math.round(((s - 50) / 15) * 100),
      pointsNeeded: 65 - s,
    };
  }

  if (s >= 35) {
    return {
      level: 2,
      title: 'Active Contributor',
      score: s,
      minScore: 35,
      nextLevelScore: 50,
      percentToNext: Math.round(((s - 35) / 15) * 100),
      pointsNeeded: 50 - s,
    };
  }

  return {
    level: 1,
    title: 'Novice Creator',
    score: s,
    minScore: 25,
    nextLevelScore: 35,
    percentToNext: Math.round(((s - 25) / 10) * 100),
    pointsNeeded: 35 - s,
  };
}

// -------------------------------------------------------------
// 2. Real Reputation Breakdown
// -------------------------------------------------------------

export async function getReputationBreakdown(
  userId: string,
  existingScore?: number
): Promise<ReputationBreakdown> {
  let publishedCount = 0;
  let votesCastCount = 0;
  let commentsCount = 0;
  let communitiesCount = 0;

  if (isUuid(userId)) {
    try {
      const [postsRes, votesRes, commentsRes, commRes] = await Promise.all([
        supabase
          .from('posts')
          .select('id', { count: 'exact', head: true })
          .eq('author_id', userId)
          .eq('published', true),
        supabase
          .from('votes')
          .select('id', { count: 'exact', head: true })
          .eq('voter_id', userId),
        supabase
          .from('comments')
          .select('id', { count: 'exact', head: true })
          .eq('author_id', userId),
        supabase
          .from('community_memberships')
          .select('community_id', { count: 'exact', head: true })
          .eq('member_id', userId),
      ]);

      publishedCount = postsRes.count ?? 0;
      votesCastCount = votesRes.count ?? 0;
      commentsCount = commentsRes.count ?? 0;
      communitiesCount = commRes.count ?? 0;
    } catch {
      // ignore
    }
  }

  // Calculate transparent score
  const base = 25;
  const articlesPoints = Math.min(30, publishedCount * 3);
  const votesPoints = Math.min(20, Math.floor(votesCastCount / 2));
  const commentsPoints = Math.min(10, commentsCount);
  const communitiesPoints = Math.min(15, communitiesCount * 2);

  const calculatedTotal = base + articlesPoints + votesPoints + commentsPoints + communitiesPoints;
  // If the profile in Supabase already has a higher verified score, preserve it!
  const finalScore = Math.max(existingScore || 25, calculatedTotal);

  return {
    base,
    articlesPoints,
    votesPoints,
    commentsPoints,
    communitiesPoints,
    total: finalScore,
    publishedCount,
    votesCastCount,
    commentsCount,
    communitiesCount,
  };
}

// -------------------------------------------------------------
// 3. Verified Achievement Badges
// -------------------------------------------------------------

const BADGE_DEFINITIONS: Array<{
  key: AchievementBadgeKey;
  title: string;
  description: string;
  icon: string;
  targetCount: number;
  evaluator: (stats: ReputationBreakdown) => { isEarned: boolean; progressText: string; progressPercent: number };
}> = [
  {
    key: 'first_blog',
    title: 'First Story',
    description: 'Published your very first verified blog on the PENORA commons.',
    icon: 'PenLine',
    targetCount: 1,
    evaluator: (stats) => ({
      isEarned: stats.publishedCount >= 1,
      progressText: stats.publishedCount >= 1 ? 'Unlocked' : '0/1 published stories',
      progressPercent: stats.publishedCount >= 1 ? 100 : 0,
    }),
  },
  {
    key: 'consistent_writer',
    title: 'Consistent Writer',
    description: 'Published 5 or more original essays, articles or research papers.',
    icon: 'BookOpen',
    targetCount: 5,
    evaluator: (stats) => ({
      isEarned: stats.publishedCount >= 5,
      progressText: `${Math.min(5, stats.publishedCount)}/5 published stories`,
      progressPercent: Math.min(100, Math.round((stats.publishedCount / 5) * 100)),
    }),
  },
  {
    key: 'community_contributor',
    title: 'Community Contributor',
    description: 'Contributed 3 or more thoughtful discussion comments or replies.',
    icon: 'MessageSquare',
    targetCount: 3,
    evaluator: (stats) => ({
      isEarned: stats.commentsCount >= 3,
      progressText: `${Math.min(3, stats.commentsCount)}/3 discussion comments`,
      progressPercent: Math.min(100, Math.round((stats.commentsCount / 3) * 100)),
    }),
  },
  {
    key: 'helpful_curator',
    title: 'Helpful Curator',
    description: 'Cast 5 or more genuine upvotes to recognize and reward creator work.',
    icon: 'Heart',
    targetCount: 5,
    evaluator: (stats) => ({
      isEarned: stats.votesCastCount >= 5,
      progressText: `${Math.min(5, stats.votesCastCount)}/5 curation upvotes`,
      progressPercent: Math.min(100, Math.round((stats.votesCastCount / 5) * 100)),
    }),
  },
  {
    key: 'rising_creator',
    title: 'Rising Creator',
    description: 'Reached Level 3 Verified Author milestone with reputation score 50+.',
    icon: 'Sparkles',
    targetCount: 50,
    evaluator: (stats) => ({
      isEarned: stats.total >= 50,
      progressText: `${stats.total}/50 reputation points`,
      progressPercent: Math.min(100, Math.round(((stats.total - 25) / (50 - 25)) * 100)),
    }),
  },
  {
    key: 'community_builder',
    title: 'Community Builder',
    description: 'Reached reputation score 65+ and joined or governs a publishing circle.',
    icon: 'Crown',
    targetCount: 65,
    evaluator: (stats) => ({
      isEarned: stats.total >= 65 && stats.communitiesCount >= 1,
      progressText:
        stats.total >= 65
          ? stats.communitiesCount >= 1
            ? 'Guild unlocked'
            : 'Join or create a guild'
          : `${stats.total}/65 reputation points`,
      progressPercent: Math.min(100, Math.round(((stats.total - 25) / (65 - 25)) * 100)),
    }),
  },
];

export async function getCreatorAchievements(
  userId: string,
  existingScore?: number
): Promise<{ badges: AchievementBadge[]; stats: ReputationBreakdown }> {
  const stats = await getReputationBreakdown(userId, existingScore);

  // Check database recorded achievements
  const recorded = new Map<string, string>();
  if (isUuid(userId)) {
    try {
      const { data } = await supabase
        .from('creator_achievements')
        .select('badge_key, awarded_at')
        .eq('user_id', userId);

      if (data) {
        data.forEach((r: any) => recorded.set(r.badge_key, r.awarded_at));
      }
    } catch {
      // ignore
    }
  }

  // Local storage fallback
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(LOCAL_ACHIEVEMENTS_KEY) : null;
    if (raw) {
      const map = JSON.parse(raw);
      Object.entries(map[userId] || {}).forEach(([k, v]) => {
        if (!recorded.has(k)) recorded.set(k, v as string);
      });
    }
  } catch {}

  const badges: AchievementBadge[] = [];

  for (const def of BADGE_DEFINITIONS) {
    const evalResult = def.evaluator(stats);
    const wasRecorded = recorded.has(def.key);
    const isEarned = evalResult.isEarned || wasRecorded;
    let awardedAt = recorded.get(def.key) || null;

    if (isEarned && !awardedAt) {
      awardedAt = new Date().toISOString();
      // Record achievement
      if (isUuid(userId)) {
        try {
          await supabase.from('creator_achievements').insert({
            user_id: userId,
            badge_key: def.key,
            awarded_at: awardedAt,
          });
        } catch {}
      }

      // Local storage
      try {
        if (typeof window !== 'undefined') {
          const raw = localStorage.getItem(LOCAL_ACHIEVEMENTS_KEY);
          const map = raw ? JSON.parse(raw) : {};
          map[userId] = map[userId] || {};
          map[userId][def.key] = awardedAt;
          localStorage.setItem(LOCAL_ACHIEVEMENTS_KEY, JSON.stringify(map));
        }
      } catch {}
    }

    badges.push({
      key: def.key,
      title: def.title,
      description: def.description,
      icon: def.icon,
      isEarned,
      awardedAt,
      progressText: evalResult.progressText,
      progressPercent: evalResult.progressPercent,
    });
  }

  return { badges, stats };
}
