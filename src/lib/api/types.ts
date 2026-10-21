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
  created_at: string;
  updated_at: string;
  author?: ProfileRecord;
}

export interface CommentRecord {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author?: ProfileRecord;
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

export interface CommunityRecord {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  avatar_url?: string | null;
  cover_url?: string | null;
  created_at: string;
}
