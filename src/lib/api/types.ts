// src/lib/api/types.ts
// Common types for PENORA Supabase database records

export interface ProfileRecord {
  id: string;
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
  cover_url?: string | null;
  bio?: string | null;
  location?: string | null;
  website?: string | null;
  interests?: string[] | null;
  reputation: number;
  created_at: string;
}

export interface PostRecord {
  id: string;
  author_id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  content: string;
  cover_image_url?: string | null;
  tags?: string[] | null;
  published: boolean;
  published_at?: string | null;
  payout_at?: string | null;
  created_at: string;
  updated_at: string;
  author?: ProfileRecord;
}

export interface CommentRecord {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  parent_id?: string | null;
  created_at: string;
  author?: ProfileRecord;
  replies?: CommentRecord[];
  post?: PostRecord;
}

export interface ReblogRecord {
  id: string;
  user_id: string;
  post_id: string;
  created_at: string;
  post?: PostRecord;
  reblogger?: ProfileRecord;
}

export interface MuteRecord {
  id: string;
  muter_id: string;
  muted_id: string;
  created_at: string;
}

export interface BlockRecord {
  id: string;
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}

export interface ReportRecord {
  id: string;
  reporter_id: string;
  target_type: 'post' | 'comment' | 'profile';
  target_id: string;
  reason: string;
  details?: string | null;
  status: 'pending' | 'reviewed' | 'dismissed' | 'actioned';
  created_at: string;
}

export interface VoteRecord {
  id: string;
  voter_id: string;
  post_id?: string | null;
  comment_id?: string | null;
  value: -1 | 1;
  created_at: string;
}

export interface BookmarkRecord {
  user_id: string;
  post_id: string;
  created_at: string;
  post?: PostRecord;
}

export interface FollowRecord {
  follower_id: string;
  followee_id: string;
  created_at: string;
}

export type CommunityRole = 'owner' | 'admin' | 'moderator' | 'member' | 'guest';

export interface CommunityRecord {
  id: string;
  created_by?: string | null;
  community_memberships?: Array<{ count: number }>;
  name: string;
  slug: string;
  description?: string | null;
  rules?: string | null;
  avatar_url?: string | null;
  cover_url?: string | null;
  created_at: string;
}

export interface CommunityMemberRecord {
  community_id: string;
  member_id: string;
  role: 'member' | 'moderator' | 'admin' | 'owner';
  created_at: string;
  profile?: ProfileRecord;
}

export interface CommunityPinnedPostRecord {
  id: string;
  community_id: string;
  post_id: string;
  pinned_by: string;
  pinned_at: string;
  post?: PostRecord;
}

export interface CommunityAuditLogRecord {
  id: string;
  community_id: string;
  actor_id: string;
  action: string;
  target_id?: string | null;
  details?: string | null;
  created_at: string;
  actor?: ProfileRecord;
}


export type AchievementBadgeKey =
  | 'first_blog'
  | 'consistent_writer'
  | 'community_contributor'
  | 'helpful_curator'
  | 'rising_creator'
  | 'community_builder';

export interface AchievementBadge {
  key: AchievementBadgeKey;
  title: string;
  description: string;
  icon: string;
  isEarned: boolean;
  awardedAt?: string | null;
  progressText: string;
  progressPercent: number;
}

export interface CreatorLevelInfo {
  level: number;
  title: string;
  score: number;
  minScore: number;
  nextLevelScore: number;
  percentToNext: number;
  pointsNeeded: number;
}

export interface ReputationBreakdown {
  base: number;
  articlesPoints: number;
  votesPoints: number;
  commentsPoints: number;
  communitiesPoints: number;
  total: number;
  publishedCount: number;
  votesCastCount: number;
  commentsCount: number;
  communitiesCount: number;
}


export interface WritingChallengeRecord {
  id: string;
  title: string;
  slug: string;
  prompt: string;
  guidelines: string;
  starts_at: string;
  ends_at: string;
  status: 'upcoming' | 'active' | 'completed';
  cover_url?: string | null;
  created_at: string;
  submissions_count?: number;
}

export interface ChallengeSubmissionRecord {
  id: string;
  challenge_id: string;
  post_id: string;
  author_id: string;
  is_featured: boolean;
  submitted_at: string;
  post?: PostRecord;
  author?: ProfileRecord;
}

export interface StoryPerformanceRecord {
  id: string;
  title: string;
  slug: string;
  publishedAt: string;
  views: number;
  upvotes: number;
  comments: number;
}

export interface CreatorStreakInfo {
  currentWeekStreak: number;
  longestWeekStreak: number;
  totalStoriesPublished: number;
  lastPublishedAt?: string | null;
  weeklyActivity: boolean[]; // Last 6 weeks activity
}

export interface CreatorAnalyticsData {
  totalViews: number;
  totalUpvotes: number;
  totalComments: number;
  totalFollowers: number;
  totalStories: number;
  streak: CreatorStreakInfo;
  topStories: StoryPerformanceRecord[];
}
