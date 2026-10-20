export interface Author {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  reputationScore: number;
  role: string;
  isVerified?: boolean;
  bio?: string;
  coverImage?: string;
  followersCount?: number;
  followingCount?: number;
  postsCount?: number;
  location?: string;
  joinedDate?: string;
  activeStatus?: string;
}

export interface Community {
  id: string;
  slug: string;
  name: string;
  description: string;
  avatar: string;
  bannerImage?: string;
  subscriberCount: number;
  activePostsCount: number;
  isSubscribed?: boolean;
  moderators?: string[];
  category?: string;
}

export interface Article {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  excerpt: string;
  content: string[];
  coverImage: string;
  coverImageAlt: string;
  author: Author;
  publishedAt: string;
  readTimeMinutes: number;
  topic: string;
  tags: string[];
  stats: {
    votesCount: number;
    userHasVoted?: boolean;
    commentsCount: number;
    bookmarksCount: number;
    reputationPoints: number; // Non-cash curation score
  };
  isFeatured?: boolean;
  isEditorsPick?: boolean;
}

export interface Topic {
  id: string;
  slug: string;
  name: string;
  description: string;
  iconName: string;
  articleCount: number;
  followerCount: number;
  trendingRank?: number;
}
