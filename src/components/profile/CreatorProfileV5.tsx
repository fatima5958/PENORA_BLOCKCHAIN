import { usePostVoting } from '../../lib/hooks/usePostVoting';
// src/components/profile/CreatorProfileV5.tsx
// PENORA Blockchain — Creator Profile V6: Visual Refinement
// Refined Editorial Layout + Celestial Aesthetics + Real Supabase Data + Financially Honest Rewards
import React, { useState, useEffect } from 'react';
import type { Author, Article, Topic, Community } from '../../types';
import { supabase } from '../../lib/supabaseClient';
import { penoraKeyAuth, type PenoraUser } from '../../lib/auth/penoraKeyAuth';
import { followUser, unfollowUser, isFollowing as checkIsFollowing, getFollowCounts } from '../../lib/api/follows';
import { getUserArticles } from '../../lib/api/articles';
import { getUserBookmarks } from '../../lib/api/bookmarks';
import { getUserComments } from '../../lib/api/comments';
import { getVotesForPost, type PostVoteStats } from '../../lib/api/votes';
import { getArticleRewardState } from '../../lib/api/rewards';
import { EditProfileModalV5 } from './EditProfileModalV5';
import { SpatialAuthModalV4 } from '../design-v4/SpatialAuthModalV4';
import { PenoraEmblem } from '../brand/PenoraLogo';
import type { PostRecord, ProfileRecord, CommentRecord } from '../../lib/api/types';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import {
  MapPin,
  Calendar,
  Award,
  Check,
  Plus,
  BookOpen,
  MessageSquare,
  Bookmark,
  ExternalLink,
  Edit3,
  Camera,
  Image as ImageIcon,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  Key,
  Users,
  ShieldCheck,
  Globe,
  Info,
  Lock,
  Share2,
} from 'lucide-react';

interface CreatorProfileV5Props {
  author: Author;
  articles: Article[];
  topics: Topic[];
  communities: Community[];
}

export const CreatorProfileV5: React.FC<CreatorProfileV5Props> = ({
  author: initialAuthor,
  articles: fallbackArticles,
  topics,
  communities,
}) => {
  const { voteError, submitPostVote } = usePostVoting();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [keyUser, setKeyUser] = useState<PenoraUser | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  // 6 profile tabs
  const [activeTab, setActiveTab] = useState<'blogs' | 'replies' | 'media' | 'bookmarks' | 'communities' | 'about'>('blogs');

  // Follow states
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  // Profile data & Real publications
  const [creatorProfile, setCreatorProfile] = useState<Author>(initialAuthor);
  const [creatorPosts, setCreatorPosts] = useState<Article[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  // Secondary tab data
  const [creatorReplies, setCreatorReplies] = useState<CommentRecord[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [bookmarkedArticles, setBookmarkedArticles] = useState<PostRecord[]>([]);
  const [loadingBookmarks, setLoadingBookmarks] = useState(false);

  // Real vote stats cache: postId -> PostVoteStats
  const [postVotes, setPostVotes] = useState<Record<string, PostVoteStats>>({});

  // Auth subscriptions
  useEffect(() => {
    const unsubKey = penoraKeyAuth.subscribe(ku => setKeyUser(ku));
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      unsubKey();
      subscription.unsubscribe();
    };
  }, []);

  // Hydrate real creator profile & real published blogs from Supabase
  useEffect(() => {
    let mounted = true;
    const handle = initialAuthor.handle;

    async function loadCreatorData() {
      setLoadingPosts(true);
      try {
        const { data: prof } = await supabase
          .from('profiles')
          .select('*')
          .eq('username', handle.toLowerCase())
          .maybeSingle();

        if (prof && mounted) {
          const p: ProfileRecord = prof;
          setCreatorProfile(prev => ({
            ...prev,
            id: p.id,
            name: p.display_name || p.username,
            handle: p.username,
            bio: p.bio || prev.bio,
            avatar: p.avatar_url || prev.avatar,
            coverImage: p.cover_url || prev.coverImage,
            location: p.location || prev.location || '',
            website: p.website || prev.website || '',
            interests: p.interests && p.interests.length > 0 ? p.interests : (prev.interests || ['Writing', 'Tech', 'Faith', 'Productivity', 'Onchain']),
            reputationScore: p.reputation ?? 25,
            joinedDate: new Date(p.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
          }));

          // Real follow counts
          const fc = await getFollowCounts(p.id);
          if (mounted) {
            setFollowersCount(fc.followers);
            setFollowingCount(fc.following);
          }

          // Real published posts
          const postsRes = await getUserArticles(p.id);
          if (mounted) {
            if (postsRes.data && postsRes.data.length > 0) {
              const mapped: Article[] = postsRes.data
                .filter(post => post.published)
                .map((post: PostRecord) => ({
                  id: post.id,
                  slug: post.slug,
                  title: post.title,
                  subtitle: '',
                  excerpt: post.excerpt || post.content.slice(0, 160) + '...',
                  content: [post.content],
                  coverImage: post.cover_image_url || '',
                  coverImageAlt: post.title,
                  topic: post.tags?.[0] || 'Protocol',
                  publishedAt: new Date(post.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
                  readTimeMinutes: Math.max(1, Math.ceil(post.content.split(/\s+/).length / 200)),
                  author: {
                    id: p.id,
                    name: p.display_name || p.username,
                    handle: p.username,
                    avatar: p.avatar_url || initialAuthor.avatar,
                    reputationScore: p.reputation ?? 25,
                    role: 'Creator',
                    followersCount: fc.followers,
                  },
                  tags: post.tags || [],
                  stats: {
                    votesCount: 0,
                    userHasVoted: false,
                    commentsCount: 0,
                    bookmarksCount: 0,
                    reputationPoints: p.reputation ?? 25,
                  },
                }));
              setCreatorPosts(mapped);

              // Hydrate vote statistics for each article
              for (const a of mapped) {
                getVotesForPost(a.id, (keyUser?.id || user?.id)).then(st => {
                  if (mounted && st) {
                    setPostVotes(prev => ({ ...prev, [a.id]: st }));
                  }
                });
              }
            } else {
              setCreatorPosts([]);
            }
          }
        } else if (mounted) {
          const matched = fallbackArticles.filter(a => a.author.handle === handle || a.author.id === initialAuthor.id);
          setCreatorPosts(matched);
          setFollowersCount(initialAuthor.followersCount || 0);
          setFollowingCount(initialAuthor.followingCount || 0);
        }
      } catch {
        if (mounted) {
          const matched = fallbackArticles.filter(a => a.author.handle === handle);
          setCreatorPosts(matched);
        }
      } finally {
        if (mounted) setLoadingPosts(false);
      }
    }

    loadCreatorData();
    return () => {
      mounted = false;
    };
  }, [initialAuthor.handle, initialAuthor.id]);

  // Load secondary tab data when selected
  useEffect(() => {
    let mounted = true;
    const authorId = creatorProfile.id;

    if (activeTab === 'replies' && authorId) {
      setLoadingReplies(true);
      getUserComments(authorId).then(res => {
        if (mounted) {
          setCreatorReplies(res.data);
          setLoadingReplies(false);
        }
      });
    }

    const activeUserId = keyUser?.id || user?.id;
    if (activeTab === 'bookmarks' && activeUserId && isOwner) {
      setLoadingBookmarks(true);
      getUserBookmarks(activeUserId).then(res => {
        if (mounted) {
          const validPosts = res.data.map(b => b.post).filter((p): p is PostRecord => Boolean(p));
          setBookmarkedArticles(validPosts);
          setLoadingBookmarks(false);
        }
      });
    }
  }, [activeTab, creatorProfile.id, user, keyUser]);

  // Check if active visitor is following this author
  useEffect(() => {
    const activeUserId = keyUser?.id || user?.id;
    const authorId = creatorProfile.id;
    if (activeUserId && authorId) {
      checkIsFollowing(activeUserId, authorId).then(following => {
        setIsFollowing(following);
      });
    }
  }, [keyUser, user, creatorProfile.id]);

  // Handle follow / unfollow toggle
  const handleFollowToggle = async () => {
    const activeUserId = keyUser?.id || user?.id;
    if (!activeUserId) {
      setAuthModalOpen(true);
      return;
    }

    const nextState = !isFollowing;
    setIsFollowing(nextState);
    setFollowersCount(prev => (nextState ? prev + 1 : Math.max(0, prev - 1)));

    if (nextState) {
      await followUser(activeUserId, creatorProfile.id || creatorProfile.handle);
    } else {
      await unfollowUser(activeUserId, creatorProfile.id || creatorProfile.handle);
    }
  };

  // Handle upvote / downvote on published blogs with vote-switching
  const handleVote = async (postId: string, direction: 1 | -1) => {
    const activeUserId = keyUser?.id || user?.id;
    if (!activeUserId) {
      setAuthModalOpen(true);
      return;
    }

    const currentStats = postVotes[postId] || { upvotes: 0, downvotes: 0, score: 0, userVote: null };
    await submitPostVote(postId, activeUserId, direction, currentStats, stats => setPostVotes(prev => ({ ...prev, [postId]: stats })));
  };

  const author = creatorProfile;
  const displayArticles = creatorPosts;
  const activeUsername = (keyUser?.username || user?.email?.split('@')[0] || '').toLowerCase();
  const activeUserId = keyUser?.id || user?.id;
  const isOwner = Boolean(
    (activeUsername && activeUsername === author.handle.toLowerCase()) ||
    (activeUserId && activeUserId === author.id)
  );

  const interestTags = author.interests && author.interests.length > 0
    ? author.interests
    : ['Writing', 'Tech', 'Faith', 'Productivity', 'Onchain'];

  // Clean join date (prevents "Joined Joined November 2021")
  const cleanJoinedDate = (author.joinedDate || 'October 2024').replace(/^joined\s+/i, '');

  // Media gallery items extracted from real blogs
  const mediaItems = displayArticles
    .filter(a => Boolean(a.coverImage))
    .map(a => ({
      url: a.coverImage!,
      title: a.title,
      slug: a.slug,
    }));

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 font-sans">
      {voteError && <p role="alert" className="text-sm text-red-700 p-3 rounded-xl bg-red-50">{voteError}</p>}
      
      {/* 1. TOP PROFILE HEADER (REFINED EDITORIAL STYLE) */}
      <div className="overflow-hidden mb-6 bg-white border border-[#0A2540]/8 rounded-2xl shadow-xs">
        
        {/* Cover Canvas: Elegant Bespoke PENORA Celestial Cover */}
        <div className="relative h-44 sm:h-56 w-full bg-[#030914] overflow-hidden select-none">
          {author.coverImage ? (
            <img
              src={author.coverImage}
              alt={`${author.name} Cover`}
              className="w-full h-full object-cover opacity-85 transition-opacity"
            />
          ) : (
            /* Bespoke PENORA Celestial Atmospheric Canvas */
            <div className="w-full h-full relative overflow-hidden bg-gradient-to-r from-[#030914] via-[#08182B] to-[#041D26]">
              {/* Soft stellar nebula glow */}
              <div
                aria-hidden="true"
                className="absolute top-1/3 left-1/4 -translate-y-1/2 w-96 h-36 bg-[#00E5F4]/12 rounded-full blur-3xl pointer-events-none"
              />
              <div
                aria-hidden="true"
                className="absolute top-1/4 right-1/4 w-80 h-32 bg-[#007C8B]/20 rounded-full blur-3xl pointer-events-none"
              />

              {/* Celestial SVG Geometry: Delicate Orbital Arcs & Constellations */}
              <svg
                className="absolute inset-0 w-full h-full opacity-60 pointer-events-none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <linearGradient id="celestialOrbit" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#00E5F4" stopOpacity="0.4" />
                    <stop offset="50%" stopColor="#007C8B" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#0A2540" stopOpacity="0.05" />
                  </linearGradient>
                </defs>

                {/* Orbital Arcs */}
                <ellipse cx="25%" cy="90%" rx="380" ry="140" fill="none" stroke="url(#celestialOrbit)" strokeWidth="1" strokeDasharray="4 6" />
                <ellipse cx="75%" cy="20%" rx="440" ry="180" fill="none" stroke="url(#celestialOrbit)" strokeWidth="0.8" />
                <circle cx="55%" cy="65%" r="160" fill="none" stroke="#00E5F4" strokeOpacity="0.08" strokeWidth="1" />

                {/* Subtle Constellation Stars */}
                <circle cx="12%" cy="30%" r="1.5" fill="#FFFFFF" fillOpacity="0.85" />
                <circle cx="18%" cy="22%" r="1" fill="#00E5F4" fillOpacity="0.75" />
                <circle cx="28%" cy="45%" r="1.5" fill="#FFFFFF" fillOpacity="0.6" />
                <circle cx="42%" cy="20%" r="2" fill="#00E5F4" fillOpacity="0.9" />
                <circle cx="68%" cy="35%" r="1.5" fill="#FFFFFF" fillOpacity="0.7" />
                <circle cx="82%" cy="25%" r="2" fill="#FFFFFF" fillOpacity="0.85" />
                <circle cx="88%" cy="55%" r="1" fill="#00E5F4" fillOpacity="0.6" />
                <circle cx="94%" cy="40%" r="1.5" fill="#FFFFFF" fillOpacity="0.8" />
              </svg>
            </div>
          )}

          {/* Hairline bottom border */}
          <div className="absolute bottom-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-[#00E5F4]/30 to-transparent" />

          {/* Owner "Edit Cover" button */}
          {isOwner && (
            <div className="absolute top-3.5 right-3.5 z-10">
              <button
                type="button"
                onClick={() => setEditModalOpen(true)}
                className="px-3 py-1.5 rounded-full bg-black/50 hover:bg-black/75 text-white text-xs font-medium backdrop-blur-md border border-white/20 hover:border-[#00E5F4]/50 shadow-md flex items-center gap-1.5 transition-all"
              >
                <Camera className="h-3.5 w-3.5 text-[#00E5F4]" />
                <span>Edit Cover</span>
              </button>
            </div>
          )}
        </div>

        {/* Profile Identity Body */}
        <div className="relative px-6 sm:px-8 pb-5 pt-0">
          
          {/* Avatar and Action Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12 sm:-mt-14 mb-3">
            
            {/* Avatar + Name Lockup */}
            <div className="flex items-end gap-4">
              <div className="relative group flex-shrink-0">
                <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-full overflow-hidden ring-4 ring-white shadow-md bg-white border border-[#007C8B]/20">
                  <img
                    src={author.avatar}
                    alt={author.name}
                    className="h-full w-full object-cover"
                  />
                </div>

                {/* Owner Camera Button on Avatar */}
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => setEditModalOpen(true)}
                    className="absolute inset-0 rounded-full bg-black/45 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-2xs cursor-pointer"
                    aria-label="Change profile photo"
                  >
                    <Camera className="h-5 w-5 text-[#00E5F4]" />
                  </button>
                )}
              </div>

              {/* Display Name & Handle */}
              <div className="mb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#0A2540] tracking-tight">
                    {author.name}
                  </h1>
                  <div className="inline-flex items-center" title="PENORA Identity">
                    <PenoraEmblem size={20} theme="light" />
                  </div>
                </div>
                <p className="text-xs text-[#6E7D90] font-mono mt-0.5">@{author.handle}</p>
              </div>
            </div>

            {/* Action Button: Edit Profile (Owner) vs Follow Button (Visitor) */}
            <div className="flex items-center gap-2 mb-1">
              {isOwner ? (
                <button
                  type="button"
                  onClick={() => setEditModalOpen(true)}
                  className="px-4 py-2 rounded-full text-xs font-medium border border-[#0A2540]/15 hover:border-[#007C8B] text-[#0A2540] hover:text-[#007C8B] hover:bg-[#F0FAFA] transition-all flex items-center gap-1.5 shadow-2xs"
                >
                  <Edit3 className="h-3.5 w-3.5 text-[#007C8B]" />
                  <span>Edit Profile</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleFollowToggle}
                  className={`px-5 py-2 rounded-full text-xs font-medium transition-all ${
                    isFollowing
                      ? 'border border-[#007C8B]/30 text-[#007C8B] bg-[#007C8B]/5 hover:bg-[#007C8B]/10'
                      : 'bg-[#007C8B] hover:bg-[#006572] text-white shadow-2xs'
                  }`}
                >
                  {isFollowing ? (
                    <span className="flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5" />
                      <span>Following</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <Plus className="h-3.5 w-3.5" />
                      <span>Follow</span>
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Bio */}
          {author.bio && (
            <p className="text-sm text-[#3E526A] max-w-2xl leading-relaxed mb-3">
              {author.bio}
            </p>
          )}

          {/* Metadata & Single Compact Statistics Row */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#5A6E85] mb-3">
            {author.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-[#007C8B]" />
                <span>{author.location}</span>
              </span>
            )}

            {author.website && (
              <a
                href={author.website.startsWith('http') ? author.website : `https://${author.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[#007C8B] hover:underline"
              >
                <Globe className="h-3.5 w-3.5" />
                <span>{author.website.replace(/^https?:\/\//, '')}</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}

            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-[#007C8B]" />
              <span>Joined {cleanJoinedDate}</span>
            </span>

            <span className="text-[#0A2540]/15 hidden sm:inline">•</span>

            {/* Compact Statistics in a Single Row */}
            <span><strong className="font-semibold text-[#0A2540]">{followersCount}</strong> followers</span>
            <span><strong className="font-semibold text-[#0A2540]">{followingCount}</strong> following</span>
            <span><strong className="font-semibold text-[#0A2540]">{displayArticles.length}</strong> blogs</span>
            <span className="inline-flex items-center gap-1 text-[#007C8B]">
              <Award className="h-3.5 w-3.5" />
              <strong className="font-semibold text-[#0A2540]">{author.reputationScore}</strong> Rep
            </span>
          </div>

          {/* Creator Interest Tag Chips */}
          {interestTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#0A2540]/6">
              {interestTags.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-normal text-[#4A5E75] bg-[#F4F7FA] border border-[#0A2540]/6"
                >
                  #{tag}
                </span>
              ))}
              {isOwner && (
                <button
                  type="button"
                  onClick={() => setEditModalOpen(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs text-[#007C8B] hover:bg-[#007C8B]/8 transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  <span>Add tag</span>
                </button>
              )}
            </div>
          )}

        </div>
      </div>

      {/* 2. MAIN 2-COLUMN LAYOUT: TABS & FEED (8 COLS) + SIDEBAR (4 COLS) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: 6 Tabs & Content (8 cols on lg) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Subtle Editorial Tab Navigation Bar with Teal Underline */}
          <div className="border-b border-[#0A2540]/10 flex items-center gap-6 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('blogs')}
              className={`pb-3 text-xs sm:text-sm whitespace-nowrap transition-colors border-b-2 flex items-center gap-1.5 ${
                activeTab === 'blogs'
                  ? 'border-[#007C8B] text-[#007C8B] font-semibold'
                  : 'border-transparent text-[#5A6E85] hover:text-[#0A2540] font-medium'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Blogs ({displayArticles.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('replies')}
              className={`pb-3 text-xs sm:text-sm whitespace-nowrap transition-colors border-b-2 flex items-center gap-1.5 ${
                activeTab === 'replies'
                  ? 'border-[#007C8B] text-[#007C8B] font-semibold'
                  : 'border-transparent text-[#5A6E85] hover:text-[#0A2540] font-medium'
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Replies</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('media')}
              className={`pb-3 text-xs sm:text-sm whitespace-nowrap transition-colors border-b-2 flex items-center gap-1.5 ${
                activeTab === 'media'
                  ? 'border-[#007C8B] text-[#007C8B] font-semibold'
                  : 'border-transparent text-[#5A6E85] hover:text-[#0A2540] font-medium'
              }`}
            >
              <ImageIcon className="h-3.5 w-3.5" />
              <span>Media ({mediaItems.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('bookmarks')}
              className={`pb-3 text-xs sm:text-sm whitespace-nowrap transition-colors border-b-2 flex items-center gap-1.5 ${
                activeTab === 'bookmarks'
                  ? 'border-[#007C8B] text-[#007C8B] font-semibold'
                  : 'border-transparent text-[#5A6E85] hover:text-[#0A2540] font-medium'
              }`}
            >
              <Bookmark className="h-3.5 w-3.5" />
              <span>Bookmarks</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('communities')}
              className={`pb-3 text-xs sm:text-sm whitespace-nowrap transition-colors border-b-2 flex items-center gap-1.5 ${
                activeTab === 'communities'
                  ? 'border-[#007C8B] text-[#007C8B] font-semibold'
                  : 'border-transparent text-[#5A6E85] hover:text-[#0A2540] font-medium'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Communities</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('about')}
              className={`pb-3 text-xs sm:text-sm whitespace-nowrap transition-colors border-b-2 flex items-center gap-1.5 ${
                activeTab === 'about'
                  ? 'border-[#007C8B] text-[#007C8B] font-semibold'
                  : 'border-transparent text-[#5A6E85] hover:text-[#0A2540] font-medium'
              }`}
            >
              <Info className="h-3.5 w-3.5" />
              <span>About</span>
            </button>
          </div>

          {/* TAB 1: BLOGS (REFINED EDITORIAL FOCUS) */}
          {activeTab === 'blogs' && (
            <div className="space-y-5">
              {loadingPosts ? (
                <div className="py-8 text-center text-xs text-[#5A6E85]">
                  Loading published blogs…
                </div>
              ) : displayArticles.length === 0 ? (
                <div className="py-8 px-6 text-center border border-dashed border-[#0A2540]/12 rounded-xl bg-[#FAFBFD] space-y-1.5">
                  <p className="text-sm font-medium text-[#0A2540]">No published blogs yet</p>
                  <p className="text-xs text-[#5A6E85] max-w-sm mx-auto leading-relaxed">
                    @{author.handle} has not published any public blogs yet. Once published, articles and onchain vote records will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {displayArticles.map(article => {
                    const stats = postVotes[article.id] || {
                      upvotes: article.stats?.votesCount || 0,
                      downvotes: 0,
                      score: article.stats?.votesCount || 0,
                      userVote: null,
                    };
                    const reward = getArticleRewardState(stats.score);

                    return (
                      <article
                        key={article.id}
                        className="p-5 sm:p-6 bg-white border border-[#0A2540]/8 hover:border-[#007C8B]/30 rounded-xl shadow-2xs hover:shadow-xs transition-all space-y-3"
                      >
                        {/* Category & Date */}
                        <div className="flex items-center justify-between text-xs text-[#6E7D90]">
                          <span className="font-medium text-[#007C8B]">
                            {article.topic || 'Protocol'}
                          </span>
                          <span>
                            {article.publishedAt} · {article.readTimeMinutes} min read
                          </span>
                        </div>

                        {/* Article Title */}
                        <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#0A2540] hover:text-[#007C8B] transition-colors leading-snug">
                          <a href={`/article/${article.slug}`}>{article.title}</a>
                        </h3>

                        {/* Article Excerpt */}
                        <p className="text-xs sm:text-sm text-[#4A5E75] line-clamp-3 leading-relaxed">
                          {article.excerpt}
                        </p>

                        {/* Optional Cover Thumbnail */}
                        {article.coverImage && (
                          <div className="rounded-lg overflow-hidden max-h-48 w-full border border-[#0A2540]/8">
                            <img
                              src={article.coverImage}
                              alt={article.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}

                        {/* Actions Row: Exact Approved Voting Component + USD Worth + Comments + Bookmark + Share */}
                        <div className="pt-3 border-t border-[#0A2540]/6 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div className="pn-vote-group" role="group" aria-label="Article voting">
                              <button
                                type="button"
                                onClick={() => handleVote(article.id, 1)}
                                data-active={stats.userVote === 1 ? 'true' : 'false'}
                                aria-pressed={stats.userVote === 1}
                                className="pn-vote-btn pn-vote-up"
                                title="Upvote ▲"
                              >
                                <span aria-hidden="true" className="text-[10px] leading-none">
                                  ▲
                                </span>
                                <span>{stats.upvotes}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleVote(article.id, -1)}
                                data-active={stats.userVote === -1 ? 'true' : 'false'}
                                aria-pressed={stats.userVote === -1}
                                className="pn-vote-btn pn-vote-down"
                                title="Downvote ▼"
                              >
                                <span aria-hidden="true" className="text-[10px] leading-none">
                                  ▼
                                </span>
                                <span>{stats.downvotes}</span>
                              </button>
                            </div>

                            <span
                              className="text-xs font-mono font-medium text-[#4A5E75] select-none cursor-help px-0.5"
                              title={reward.tooltip}
                            >
                              · {reward.displayUsd}
                            </span>

                            <a
                              href={`/story/${article.slug}#comments`}
                              className="pn-icon-btn"
                              title="Read responses"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                              <span>{article.stats?.commentsCount || 0}</span>
                            </a>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              className="pn-icon-btn"
                              title="Bookmark blog"
                            >
                              <Bookmark className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              className="pn-icon-btn"
                              title="Share blog"
                            >
                              <Share2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: REPLIES */}
          {activeTab === 'replies' && (
            <div className="space-y-4">
              {loadingReplies ? (
                <div className="py-8 text-center text-xs text-[#5A6E85]">
                  Loading creator replies…
                </div>
              ) : creatorReplies.length === 0 ? (
                <div className="py-8 px-6 text-center border border-dashed border-[#0A2540]/12 rounded-xl bg-[#FAFBFD] space-y-1.5">
                  <p className="text-sm font-medium text-[#0A2540]">No replies yet</p>
                  <p className="text-xs text-[#5A6E85] max-w-sm mx-auto leading-relaxed">
                    Comments and discussions published by @{author.handle} on PENORA blogs will be listed here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {creatorReplies.map(reply => (
                    <div
                      key={reply.id}
                      className="p-4 bg-white border border-[#0A2540]/8 rounded-xl space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between text-[#6E7D90]">
                        <span className="font-semibold text-[#0A2540]">@{author.handle}</span>
                        <span>{new Date(reply.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className="text-sm text-[#3E526A] leading-relaxed">{reply.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: MEDIA */}
          {activeTab === 'media' && (
            <div>
              {mediaItems.length === 0 ? (
                <div className="py-8 px-6 text-center border border-dashed border-[#0A2540]/12 rounded-xl bg-[#FAFBFD] space-y-1.5">
                  <p className="text-sm font-medium text-[#0A2540]">No media published yet</p>
                  <p className="text-xs text-[#5A6E85] max-w-sm mx-auto leading-relaxed">
                    Images and cover visuals from @{author.handle}'s published blogs will appear in this gallery.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {mediaItems.map((item, idx) => (
                    <a
                      key={idx}
                      href={`/article/${item.slug}`}
                      className="group relative rounded-xl overflow-hidden aspect-video border border-[#0A2540]/8 shadow-2xs block"
                    >
                      <img
                        src={item.url}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-2.5 flex items-end">
                        <p className="text-[11px] text-white font-medium line-clamp-1">{item.title}</p>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: BOOKMARKS */}
          {activeTab === 'bookmarks' && (
            <div>
              {!isOwner ? (
                <div className="py-8 px-6 text-center border border-dashed border-[#0A2540]/12 rounded-xl bg-[#FAFBFD] space-y-1.5">
                  <p className="text-sm font-medium text-[#0A2540]">Bookmarks are Private</p>
                  <p className="text-xs text-[#5A6E85] max-w-sm mx-auto leading-relaxed">
                    Bookmarks saved by @{author.handle} are securely private to the profile owner.
                  </p>
                </div>
              ) : loadingBookmarks ? (
                <div className="py-8 text-center text-xs text-[#5A6E85]">
                  Loading private bookmarks…
                </div>
              ) : bookmarkedArticles.length === 0 ? (
                <div className="py-8 px-6 text-center border border-dashed border-[#0A2540]/12 rounded-xl bg-[#FAFBFD] space-y-1.5">
                  <p className="text-sm font-medium text-[#0A2540]">No bookmarks saved yet</p>
                  <p className="text-xs text-[#5A6E85] max-w-sm mx-auto leading-relaxed">
                    When you bookmark insightful blogs across PENORA, they will be organized here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {bookmarkedArticles.map(bPost => (
                    <div
                      key={bPost.id}
                      className="p-4 bg-white border border-[#0A2540]/8 rounded-xl space-y-1"
                    >
                      <h4 className="font-serif text-sm font-bold text-[#0A2540] hover:text-[#007C8B]">
                        <a href={`/article/${bPost.slug}`}>{bPost.title}</a>
                      </h4>
                      <p className="text-xs text-[#5A6E85] line-clamp-2">{bPost.excerpt || bPost.content.slice(0, 140)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: COMMUNITIES */}
          {activeTab === 'communities' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {communities.slice(0, 4).map(comm => (
                <div
                  key={comm.id}
                  className="p-4 bg-white border border-[#0A2540]/8 rounded-xl space-y-2.5 flex flex-col justify-between"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-[#007C8B]/10 text-[#007C8B] flex items-center justify-center font-bold text-xs flex-shrink-0">
                      {comm.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-serif text-sm font-bold text-[#0A2540]">{comm.name}</h4>
                      <p className="text-xs text-[#5A6E85] line-clamp-2 mt-0.5">{comm.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-[#6E7D90] pt-2 border-t border-[#0A2540]/6">
                    <span>{comm.subscriberCount.toLocaleString()} members</span>
                    <a
                      href={`/c/${comm.slug}`}
                      className="text-[#007C8B] font-medium hover:underline flex items-center gap-1"
                    >
                      <span>View</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 6: ABOUT */}
          {activeTab === 'about' && (
            <div className="p-6 bg-white border border-[#0A2540]/8 rounded-xl space-y-4">
              <div className="space-y-1.5">
                <h3 className="font-serif text-lg font-bold text-[#0A2540]">About {author.name}</h3>
                <p className="text-sm text-[#3E526A] leading-relaxed">
                  {author.bio || 'Architecting decentralized editorial systems and high-signal Web3 publishing.'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-[#0A2540]/6 text-xs">
                {author.location && (
                  <div>
                    <span className="text-[#6E7D90] font-medium block mb-0.5">Location</span>
                    <span className="font-semibold text-[#0A2540]">{author.location}</span>
                  </div>
                )}
                <div>
                  <span className="text-[#6E7D90] font-medium block mb-0.5">Joined</span>
                  <span className="font-semibold text-[#0A2540]">{cleanJoinedDate}</span>
                </div>
                {author.website && (
                  <div>
                    <span className="text-[#6E7D90] font-medium block mb-0.5">Website</span>
                    <a
                      href={author.website.startsWith('http') ? author.website : `https://${author.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-[#007C8B] hover:underline"
                    >
                      {author.website}
                    </a>
                  </div>
                )}
                <div>
                  <span className="text-[#6E7D90] font-medium block mb-0.5">Reputation</span>
                  <span className="font-semibold text-[#007C8B]">{author.reputationScore} Points</span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Right Sidebar Column: Minimal, Useful & Verified Information (4 cols on lg) */}
        <div className="lg:col-span-4 space-y-5">
          
          {/* Card 1: Creator Bio Card */}
          <div className="p-5 bg-white border border-[#0A2540]/8 rounded-xl shadow-2xs space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#6E7D90]">
              About the Creator
            </h4>
            <p className="text-xs text-[#4A5E75] leading-relaxed">
              {author.bio || 'Architecting decentralized editorial systems and high-signal Web3 publishing.'}
            </p>
            {author.location && (
              <div className="flex items-center gap-1.5 text-xs text-[#6E7D90] pt-1">
                <MapPin className="h-3.5 w-3.5 text-[#007C8B]" />
                <span>{author.location}</span>
              </div>
            )}
          </div>

          {/* Card 2: "My Keys" Account Authority Card (Shown to Owner Only) */}
          {isOwner && (
            <div className="p-5 bg-white border border-[#0A2540]/8 rounded-xl shadow-2xs space-y-3">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-[#007C8B]" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#0A2540]">
                  My Keys Authority
                </h4>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#F8FAFC]">
                  <span className="text-[#4A5E75]">Posting Key</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                    <Check className="h-3 w-3" /> Active
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#F8FAFC]">
                  <span className="text-[#4A5E75]">Active Key</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                    <Check className="h-3 w-3" /> Active
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#F8FAFC]">
                  <span className="text-[#4A5E75]">Owner Key</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-[#007C8B]">
                    <ShieldCheck className="h-3 w-3" /> Secure
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-[#6E7D90] leading-relaxed">
                Private keys are securely maintained in your local Key Suite and never exposed to the network.
              </p>
            </div>
          )}

          {/* Card 3: Active Communities Card */}
          <div className="p-5 bg-white border border-[#0A2540]/8 rounded-xl shadow-2xs space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#6E7D90]">
              Active Communities
            </h4>
            <div className="space-y-2">
              {communities.slice(0, 3).map(comm => (
                <a
                  key={comm.id}
                  href={`/c/${comm.slug}`}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-[#F4F7FA] transition-colors text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-md bg-[#007C8B]/10 text-[#007C8B] font-bold flex items-center justify-center text-[10px]">
                      {comm.name.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="font-semibold text-[#0A2540]">{comm.name}</span>
                  </div>
                  <span className="text-[#6E7D90] text-[11px]">{comm.subscriberCount.toLocaleString()}</span>
                </a>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* Edit Profile Modal V5 */}
      <EditProfileModalV5
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        profileId={author.id || activeUserId || ''}
        initialDisplayName={author.name}
        initialBio={author.bio || ''}
        initialLocation={author.location || ''}
        initialWebsite={author.website || ''}
        initialInterests={interestTags}
        initialAvatarUrl={author.avatar}
        initialCoverUrl={author.coverImage}
        onProfileSaved={(updated) => {
          setCreatorProfile(prev => ({
            ...prev,
            name: updated.display_name || prev.name,
            bio: updated.bio,
            location: updated.location || prev.location,
            website: updated.website || prev.website,
            interests: updated.interests || prev.interests,
            avatar: updated.avatar_url || prev.avatar,
            coverImage: updated.cover_url || prev.coverImage,
          }));
        }}
      />

      {/* Auth Modal for Visitors */}
      <SpatialAuthModalV4
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode="login"
        presentation="centered-modal"
      />
    </div>
  );
};
