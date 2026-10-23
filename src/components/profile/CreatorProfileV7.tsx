import { CreatorSidebar } from '../common/CreatorSidebar';
import { usePostVoting } from '../../lib/hooks/usePostVoting';
// src/components/profile/CreatorProfileV7.tsx
// PENORA Blockchain — Creator Profile V7: Exact Reference Design Implementation ⚡
// Full 3-Column Desktop Composition + Panoramic Celestial Cover + Editorial Cards + Preserved Voting UI
import React, { useState, useEffect } from 'react';
import type { Author, Article, Topic, Community } from '../../types';
import { supabase } from '../../lib/supabaseClient';
import { penoraKeyAuth, type PenoraUser } from '../../lib/auth/penoraKeyAuth';
import { followUser, unfollowUser, isFollowing as checkIsFollowing, getFollowCounts } from '../../lib/api/follows';
import { getProfileById, getProfileByUsername } from '../../lib/api/profiles';
import { getUserArticles } from '../../lib/api/articles';
import { getUserBookmarks } from '../../lib/api/bookmarks';
import { getUserComments } from '../../lib/api/comments';
import { getUserReblogs } from '../../lib/api/reblogs';
import { isCreatorMuted, muteCreator, unmuteCreator, blockCreator, submitReport } from '../../lib/api/moderation';

import { getVotesForPost, type PostVoteStats } from '../../lib/api/votes';
import { getArticleRewardState } from '../../lib/api/rewards';
import { EditProfileModalV5 } from './EditProfileModalV5';
import { CreatorReputationDashboard } from './CreatorReputationDashboard';
import { computeCreatorLevel } from '../../lib/api/reputation';
import { SpatialAuthModalV4 } from '../design-v4/SpatialAuthModalV4';
import { PenoraEmblem, PenoraLogo } from '../brand/PenoraLogo';
import type { PostRecord, ProfileRecord, CommentRecord } from '../../lib/api/types';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import {
  Home,
  Compass,
  Users,
  PenLine,
  Bookmark,
  User as UserIcon,
  MapPin,
  Calendar,
  Check,
  Plus,
  BookOpen,
  MessageSquare,
  ExternalLink,
  Edit3,
  Camera,
  ImageIcon,
  Globe,
  Info,
  Lock,
  Share2,
  Crown,
  Award,
  MoreHorizontal,
  Repeat,
  CornerDownRight,
  VolumeX,
  UserX,
  Flag,
  CheckCircle2,
  Loader2,
  MoreVertical,
  ArrowRight,
  Sparkles,
  ChevronRight,
  Wallet,
} from 'lucide-react';

const uploadedAvatar = (url?: string) => url && !url.includes('/brand/penora-avatar-') ? url : '';
const CreatorAvatar = ({ src, name, className }: { src?: string; name: string; className: string }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return uploadedAvatar(src) && !failed
    ? <img src={src} alt={name} className={className} onError={() => setFailed(true)} />
    : <span role="img" aria-label={`${name}: no profile photo uploaded`} className={`${className} inline-flex items-center justify-center bg-[#E5F7F8] text-[#007C8B]`}><UserIcon aria-hidden="true" className="h-1/2 w-1/2" /></span>;
};

interface CreatorProfileV7Props {
  author?: Author;
  articles?: Article[];
  topics?: Topic[];
  communities?: Community[];
  isOwnerView?: boolean;
}

export const CreatorProfileV7: React.FC<CreatorProfileV7Props> = ({
  author: initialAuthor,
  articles: fallbackArticles = [],
  topics = [],
  communities = [],
  isOwnerView = false,
}) => {
  const { voteError, submitPostVote } = usePostVoting();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [keyUser, setKeyUser] = useState<PenoraUser | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  // 6 profile tabs
  const [activeTab, setActiveTab] = useState<'blogs' | 'replies' | 'media' | 'bookmarks' | 'communities' | 'about' | 'reputation'>('blogs');

  // Follow states
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [followError, setFollowError] = useState<string | null>(null);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  // Default fallback creator when viewing /profile/me unauthenticated
  const defaultAuthor: Author = initialAuthor || {
    id: '',
    name: 'Creator',
    handle: 'creator',
    avatar: '',
    coverImage: '/brand/penora-celestial-cover-default.jpg',
    reputationScore: 0,
    role: 'Creator',
    bio: '',
    location: 'Lahore, Pakistan',
    joinedDate: 'Oct 2026',
    followersCount: 0,
    followingCount: 0,
    postsCount: 0,
  };

  // Profile data & Real publications
  const [creatorProfile, setCreatorProfile] = useState<Author>(defaultAuthor);
  const [creatorPosts, setCreatorPosts] = useState<Article[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  // Sync creatorProfile whenever initialAuthor prop updates (e.g. after Supabase fetch completes)
  useEffect(() => {
    if (initialAuthor) {
      setCreatorProfile(prev => ({
        ...prev,
        ...initialAuthor,
        name: initialAuthor.name || prev.name,
        bio: initialAuthor.bio !== undefined && initialAuthor.bio !== null ? initialAuthor.bio : prev.bio,
        avatar: uploadedAvatar(initialAuthor.avatar),
        coverImage: initialAuthor.coverImage || prev.coverImage,
        location: initialAuthor.location !== undefined && initialAuthor.location !== null ? initialAuthor.location : prev.location,
        website: initialAuthor.website !== undefined && initialAuthor.website !== null ? initialAuthor.website : prev.website,
        interests: initialAuthor.interests || prev.interests,
      }));
    }
  }, [initialAuthor]);

  // Moderation state
  const [isAuthorMuted, setIsAuthorMuted] = useState(false);
  const [visitorMenuOpen, setVisitorMenuOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState('Spam');
  const [reportDetails, setReportDetails] = useState('');
  const [reportingBusy, setReportingBusy] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);

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

    // Support opening edit modal via URL query (?edit=true) or custom event
    const openEditHandler = () => setEditModalOpen(true);
    window.addEventListener('penora:open-edit-profile', openEditHandler);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('edit') === 'true') {
        setEditModalOpen(true);
      }
      const tabParam = params.get('tab');
      if (tabParam === 'bookmarks' || tabParam === 'replies' || tabParam === 'about' || tabParam === 'communities' || tabParam === 'reputation') {
        setActiveTab(tabParam as any);
      } else if (tabParam === 'posts' || tabParam === 'blogs') {
        setActiveTab('blogs');
      }
    }

    return () => {
      unsubKey();
      subscription.unsubscribe();
      window.removeEventListener('penora:open-edit-profile', openEditHandler);
    };
  }, []);

  // Hydrate real creator profile & real published blogs from Supabase
  useEffect(() => {
    let mounted = true;
    const activeId = initialAuthor?.id || keyUser?.id || user?.id;
    const targetHandle = initialAuthor?.handle || keyUser?.username || user?.email?.split('@')[0] || 'mateenfatima';

    async function loadCreatorData() {
      setLoadingPosts(true);
      try {
        let prof: ProfileRecord | null = null;
        if (activeId && activeId !== 'mateenfatima') {
          const res = await getProfileById(activeId);
          prof = res.data;
        }
        if (!prof && targetHandle) {
          const res = await getProfileByUsername(targetHandle.toLowerCase());
          prof = res.data;
        }

        if (prof && mounted) {
          const p: ProfileRecord = prof;
          setCreatorProfile(prev => ({
            ...prev,
            id: p.id,
            name: p.display_name || prev.name,
            handle: p.username || prev.handle,
            bio: p.bio !== undefined && p.bio !== null ? p.bio : prev.bio,
            avatar: uploadedAvatar(p.avatar_url || ''),
            coverImage: p.cover_url || prev.coverImage,
            location: p.location !== undefined && p.location !== null ? p.location : prev.location,
            website: p.website !== undefined && p.website !== null ? p.website : prev.website,
            interests: p.interests && p.interests.length > 0 ? p.interests : prev.interests,
            reputationScore: p.reputation ?? prev.reputationScore ?? 0,
            joinedDate: p.created_at ? new Date(p.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : prev.joinedDate,
          }));

          // Real follow counts
          const fc = await getFollowCounts(p.id);
          if (mounted) {
            setFollowersCount(fc.followers ?? 0);
            setFollowingCount(fc.following ?? 0);
          }

          // Real published posts
          const [postsRes, reblogsRes] = await Promise.all([
            getUserArticles(p.id),
            getUserReblogs(p.id)
          ]);
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
                  coverImage: post.cover_image_url || '/brand/article-thumb-build.jpg',
                  coverImageAlt: post.title,
                  topic: post.tags?.[0] || 'Behind the Build',
                  publishedAt: new Date(post.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                  readTimeMinutes: Math.max(1, Math.ceil(post.content.split(/\s+/).length / 200)),
                  author: {
                    id: p.id,
                    name: p.display_name || p.username,
                    handle: p.username,
                    avatar: uploadedAvatar(p.avatar_url || ''),
                    reputationScore: p.reputation ?? 0,
                    role: 'Creator',
                    followersCount: fc.followers,
                  },
                  tags: post.tags || ['Behind the Build'],
                  stats: {
                    votesCount: 0,
                    userHasVoted: false,
                    commentsCount: 0,
                    bookmarksCount: 0,
                    reputationPoints: p.reputation ?? 0,
                  },
                }));
              const rebloggedMapped: (Article & { isReblog?: boolean; rebloggedBy?: string })[] = (reblogsRes.data || []).map(r => ({
                id: r.post.id,
                slug: r.post.slug,
                title: r.post.title,
                subtitle: '',
                excerpt: r.post.excerpt || (r.post.content ? r.post.content.slice(0, 160) + '...' : ''),
                content: [r.post.content],
                coverImage: r.post.cover_image_url || '/brand/article-thumb-build.jpg',
                coverImageAlt: r.post.title,
                topic: r.post.tags?.[0] || 'Curated',
                publishedAt: new Date(r.post.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                readTimeMinutes: Math.max(1, Math.ceil((r.post.content || '').split(/\s+/).length / 200)),
                author: {
                  id: r.post.author?.id || '',
                  name: r.post.author?.display_name || r.post.author?.username || 'Creator',
                  handle: r.post.author?.username || 'creator',
                  avatar: uploadedAvatar(r.post.author?.avatar_url || ''),
                  reputationScore: r.post.author?.reputation ?? 25,
                  role: 'Creator',
                },
                tags: r.post.tags || ['Curated'],
                stats: {
                  votesCount: 0,
                  userHasVoted: false,
                  commentsCount: 0,
                  bookmarksCount: 0,
                  reputationPoints: r.post.author?.reputation ?? 25,
                },
                isReblog: true,
                rebloggedBy: p.display_name || p.username,
              }));
              setCreatorPosts([...mapped, ...rebloggedMapped]);

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
          // If no remote profile found, filter fallback articles for this author or reference
          const matched = fallbackArticles.filter(a => a.author.handle === targetHandle || a.author.id === defaultAuthor.id);
          if (matched.length > 0) {
            setCreatorPosts(matched);
          } else {
            setCreatorPosts([]);
          }
          setFollowersCount(0);
          setFollowingCount(0);
        }
      } catch {
        if (mounted) {
          const matched = fallbackArticles.filter(a => a.author.handle === targetHandle);
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
  }, [initialAuthor?.handle, user, keyUser]);

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
          if (activeUserId && authorId && activeUserId !== authorId) {
      isCreatorMuted(activeUserId, authorId).then(m => setIsAuthorMuted(m));
    }
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

    if (followBusy || !creatorProfile.id || activeUserId === creatorProfile.id) return;
    setFollowBusy(true);
    setFollowError(null);
    try {
      const result = isFollowing
        ? await unfollowUser(activeUserId, creatorProfile.id)
        : await followUser(activeUserId, creatorProfile.id);
      if (result.error) { setFollowError(result.error); return; }
      setIsFollowing(result.isFollowing);
      const counts = await getFollowCounts(creatorProfile.id);
      setFollowersCount(counts.followers);
    } catch {
      setFollowError('Could not update follow. Please try again.');
    } finally { setFollowBusy(false); }
  };

  // Handle upvote / downvote on published blogs with strict vote-switching
  const handleVote = async (postId: string, direction: 1 | -1) => {
    const activeUserId = keyUser?.id || user?.id;
    if (!activeUserId) {
      setAuthModalOpen(true);
      return;
    }

    const currentStats = postVotes[postId] || {
      upvotes: creatorPosts.find(p => p.id === postId)?.stats.votesCount || 0,
      downvotes: 0,
      score: creatorPosts.find(p => p.id === postId)?.stats.votesCount || 0,
      userVote: null,
    };

    await submitPostVote(postId, activeUserId, direction, currentStats, stats => setPostVotes(prev => ({ ...prev, [postId]: stats })));
  };

  const author = creatorProfile;
  const displayArticles = creatorPosts;
  const activeUsername = (keyUser?.username || user?.email?.split('@')[0] || '').toLowerCase();
  const activeUserId = keyUser?.id || user?.id;
  const isOwner = Boolean(activeUserId && activeUserId === author.id);

  const interestTags = author.interests && author.interests.length > 0
    ? author.interests
    : [];

  const cleanJoinedDate = (author.joinedDate || 'Oct 2026').replace(/^joined\s+/i, '');

  // Media gallery items extracted from real blogs
  const mediaItems = displayArticles
    .filter(a => Boolean(a.coverImage))
    .map(a => ({
      url: a.coverImage!,
      title: a.title,
      slug: a.slug,
    }));

  return (
    <div className="pn-creator-profile min-h-screen bg-[#EDF6F9] text-[#0A2540] relative overflow-hidden font-sans selection:bg-[#00E5F4]/30">
      {followError && <p role="alert" className="text-sm text-red-700 p-3 rounded-xl bg-red-50">{followError}</p>}
      {voteError && <p role="alert" className="text-sm text-red-700 p-3 rounded-xl bg-red-50">{voteError}</p>}
      
      {/* Background Soft Celestial Atmosphere Elements */}
      <div
        aria-hidden="true"
        className="fixed top-12 left-10 w-[500px] h-[500px] bg-[#00E5F4]/8 rounded-full blur-[140px] pointer-events-none"
      />
      <div
        aria-hidden="true"
        className="fixed bottom-10 right-10 w-[600px] h-[600px] bg-[#007C8B]/6 rounded-full blur-[160px] pointer-events-none"
      />

      {/* THREE-COLUMN DESKTOP COMPOSITION */}
      <div className="pn-profile-grid max-w-[1440px] mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start relative z-10">
        
        {/* ========================================================================= */}
        {/* LEFT COLUMN: NAVIGATION SIDEBAR & BRANDED ASSETS (~2.5 cols)              */}
        {/* ========================================================================= */}
        <aside className="hidden lg:block lg:col-span-2 xl:col-span-2 space-y-4 sticky top-24">
          <CreatorSidebar activePage={"Profile"} />
        </aside>

        {/* ========================================================================= */}
        {/* CENTER COLUMN: IDENTITY, CELESTIAL BANNER & ARTICLES (~7 cols)            */}
        {/* ========================================================================= */}
        <main className="pn-profile-main lg:col-span-7 xl:col-span-7 space-y-5 min-w-0">
          
          {/* 1. PANORAMIC CELESTIAL COVER BANNER */}
          <div className="pn-profile-cover relative h-60 sm:h-72 w-full rounded-3xl overflow-hidden border border-[#007C8B]/15 shadow-sm bg-[#0A2540]">
            <img
              src={author.coverImage || '/brand/penora-celestial-cover-default.jpg'}
              alt={`${author.name} Celestial Cover`}
              className="w-full h-full object-cover select-none"
              onError={(e) => {
                e.currentTarget.src = '/brand/penora-celestial-cover-default.jpg';
              }}
            />


            {/* Owner "Edit Cover" glass pill button */}
            {isOwner && (
              <div className="absolute top-4 right-4 z-10">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(true)}
                  className="px-3.5 py-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white text-xs font-medium backdrop-blur-md border border-white/25 hover:border-[#00E5F4]/60 shadow-md flex items-center gap-1.5 transition-all"
                >
                  <Camera className="h-3.5 w-3.5 text-[#00E5F4]" />
                  <span>Edit Cover</span>
                </button>
              </div>
            )}
          </div>

          {/* 2. CREATOR IDENTITY CARD */}
          <div className="pn-profile-identity bg-white/95 backdrop-blur-md rounded-3xl p-6 sm:p-7 border border-[#007C8B]/10 shadow-xs relative -mt-8 z-10">
            
            {/* Avatar & Header Action Row */}
            <div className="pn-profile-topline flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-20 sm:-mt-24 mb-3">
              
              {/* Overlapping Avatar with Glowing Cyan Ring & Orbitals */}
              <div className="pn-profile-avatar-wrap relative group flex-shrink-0">
                <div className="relative p-1 rounded-full bg-gradient-to-tr from-[#007C8B] via-[#00E5F4] to-[#0A2540] shadow-xl ring-4 ring-white">
                  <CreatorAvatar src={author.avatar} name={author.name} className="pn-profile-avatar h-28 w-28 sm:h-32 sm:w-32 rounded-full object-cover" />
                  {/* Subtle Orbital Geometry Satellite Arc */}
                  <div
                    aria-hidden="true"
                    className="absolute -inset-2 rounded-full border border-[#00E5F4]/40 pointer-events-none animate-spin"
                    style={{ animationDuration: '30s' }}
                  >
                    <span className="absolute top-1 left-2 h-2 w-2 rounded-full bg-[#00E5F4] shadow-[0_0_6px_#00E5F4]" />
                  </div>
                </div>

                {/* Owner Camera Button on Avatar */}
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => setEditModalOpen(true)}
                    className="absolute bottom-1 right-1 h-8 w-8 rounded-full bg-[#0A2540] hover:bg-[#007C8B] text-white flex items-center justify-center ring-2 ring-white shadow-md transition-colors"
                    aria-label="Change avatar photo"
                  >
                    <Camera className="h-4 w-4 text-[#00E5F4]" />
                  </button>
                )}
              </div>

              {/* Action Buttons: Edit Profile (Owner) vs Follow Button (Visitor) */}
              <div className="pn-profile-actions flex items-center gap-2 mb-1">
                {isOwner ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setEditModalOpen(true)}
                      className="px-5 py-2 rounded-full text-xs font-semibold bg-white border border-[#0A2540]/15 hover:border-[#007C8B] text-[#0A2540] hover:text-[#007C8B] shadow-2xs hover:shadow-xs transition-all flex items-center gap-2"
                    >
                      <Edit3 className="h-3.5 w-3.5 text-[#007C8B]" />
                      <span>Edit Profile</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditModalOpen(true)}
                      className="h-8 w-8 rounded-full bg-white border border-[#0A2540]/15 hover:border-[#007C8B] text-[#6E7D90] hover:text-[#0A2540] flex items-center justify-center shadow-2xs transition-all"
                      aria-label="More profile options"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <div className="flex items-center gap-2 relative">
                    <button
                      type="button"
                      onClick={handleFollowToggle}
                      disabled={followBusy}
                      className={`px-6 py-2 rounded-full text-xs font-semibold transition-all ${
                        isFollowing
                          ? 'bg-[#E5F7F8] text-[#007C8B] border border-[#007C8B]/30'
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

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setVisitorMenuOpen(v => !v)}
                        className="h-8 w-8 rounded-full bg-white border border-[#0A2540]/15 hover:border-[#007C8B] text-[#6E7D90] hover:text-[#0A2540] flex items-center justify-center shadow-2xs transition-all"
                        aria-label="More creator actions"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>

                      {visitorMenuOpen && (
                        <div className="absolute right-0 top-full mt-2 w-48 rounded-2xl bg-white border border-[#0A2540]/10 shadow-lg py-2 z-50 text-xs text-[#0A2540]">
                          <button
                            type="button"
                            onClick={async () => {
                              const activeUserId = keyUser?.id || user?.id;
                              if (!activeUserId) { setAuthModalOpen(true); return; }
                              if (isAuthorMuted) {
                                await unmuteCreator(activeUserId, creatorProfile.id);
                                setIsAuthorMuted(false);
                              } else {
                                await muteCreator(activeUserId, creatorProfile.id);
                                setIsAuthorMuted(true);
                              }
                              setVisitorMenuOpen(false);
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-[#F0F5F8] flex items-center gap-2 text-[#52657C] hover:text-[#0A2540]"
                          >
                            <VolumeX className="h-4 w-4 text-[#007C8B]" />
                            <span>{isAuthorMuted ? 'Unmute Creator' : 'Mute Creator'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              const activeUserId = keyUser?.id || user?.id;
                              if (!activeUserId) { setAuthModalOpen(true); return; }
                              await blockCreator(activeUserId, creatorProfile.id);
                              setIsAuthorMuted(true);
                              setVisitorMenuOpen(false);
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-[#F0F5F8] flex items-center gap-2 text-[#52657C] hover:text-[#0A2540]"
                          >
                            <UserX className="h-4 w-4 text-[#52657C]" />
                            <span>Block Creator</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setReportReason('Spam');
                              setReportDetails('');
                              setReportSubmitted(false);
                              setReportModalOpen(true);
                              setVisitorMenuOpen(false);
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-red-50 flex items-center gap-2 text-red-600 border-t border-[#0A2540]/6 mt-1 pt-2"
                          >
                            <Flag className="h-4 w-4" />
                            <span>Report Creator</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Display Name, Handle & Creator Crown */}
            <div className="pn-profile-name space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#0A2540] tracking-tight">
                  {author.name || 'Creator'}
                </h1>
                <div className="inline-flex items-center text-[#007C8B]">
                  <PenoraEmblem size={22} theme="light" />
                </div>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D]/80 shadow-2xs">
                  <Crown className="h-3 w-3 text-amber-500 fill-amber-500" />
                  <span>Creator</span>
                </span>
              </div>
              <p className="text-xs text-[#6E7D90] font-mono">@{author.handle}</p>
            </div>

            {/* Headline Subtitle from Reference: {author.interests?.slice(0, 3).join(' · ')} */}
            <p className="text-xs font-medium text-[#007C8B] mt-2 tracking-wide">
              {author.interests?.slice(0, 3).join(' · ')}
            </p>

            {/* Bio */}
            <p className="text-xs sm:text-sm text-[#3E526A] leading-relaxed mt-1.5 max-w-2xl">
              {author.bio || ''}
            </p>

            {/* Location & Join Date Row */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#5A6E85] mt-3">
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-[#007C8B]" />
                <span>{author.location || 'Lahore, Pakistan'}</span>
              </span>

              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-[#007C8B]" />
                <span>Joined {cleanJoinedDate}</span>
              </span>
            </div>

            {/* Creator Interest Tag Chips (Reference Light Cyan Rounded Pills) */}
            <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-[#0A2540]/8">
              {interestTags.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-[#E5F7F8] text-[#007C8B] border border-[#007C8B]/20 shadow-2xs"
                >
                  #{tag}
                </span>
              ))}
              {isOwner && (
                <button
                  type="button"
                  onClick={() => setEditModalOpen(true)}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium text-[#007C8B] bg-white border border-dashed border-[#007C8B]/40 hover:bg-[#E5F7F8] transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  <span>Add tag</span>
                </button>
              )}
            </div>

          </div>

          <div className="pn-profile-mobile-stats" aria-label="Creator statistics">
            <div><strong>{followersCount}</strong><span>Followers</span></div>
            <div><strong>{followingCount}</strong><span>Following</span></div>
            <div><strong>{displayArticles.length}</strong><span>Blogs</span></div>
          </div>
          {/* 3. PROFILE NAVIGATION TABS STRIP */}
          <div className="pn-profile-tabs bg-white/90 backdrop-blur-md rounded-2xl p-1.5 border border-[#007C8B]/10 shadow-xs flex items-center justify-between overflow-x-auto gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('blogs')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                activeTab === 'blogs'
                  ? 'bg-gradient-to-r from-[#007C8B] via-[#00B3C4] to-[#00E5F4] text-white font-bold shadow-[0_4px_14px_rgba(0,188,212,0.35)]'
                  : 'text-[#5A6E85] hover:text-[#0A2540] hover:bg-white'
              }`}
            >
              <BookOpen className={`h-3.5 w-3.5 ${activeTab === 'blogs' ? 'text-white' : ''}`} />
              <span>Blogs</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('replies')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                activeTab === 'replies'
                  ? 'bg-gradient-to-r from-[#007C8B] via-[#00B3C4] to-[#00E5F4] text-white font-bold shadow-[0_4px_14px_rgba(0,188,212,0.35)]'
                  : 'text-[#5A6E85] hover:text-[#0A2540] hover:bg-white'
              }`}
            >
              <MessageSquare className={`h-3.5 w-3.5 ${activeTab === 'replies' ? 'text-white' : ''}`} />
              <span>Replies</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('media')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                activeTab === 'media'
                  ? 'bg-gradient-to-r from-[#007C8B] via-[#00B3C4] to-[#00E5F4] text-white font-bold shadow-[0_4px_14px_rgba(0,188,212,0.35)]'
                  : 'text-[#5A6E85] hover:text-[#0A2540] hover:bg-white'
              }`}
            >
              <ImageIcon className={`h-3.5 w-3.5 ${activeTab === 'media' ? 'text-white' : ''}`} />
              <span>Media</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('bookmarks')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                activeTab === 'bookmarks'
                  ? 'bg-gradient-to-r from-[#007C8B] via-[#00B3C4] to-[#00E5F4] text-white font-bold shadow-[0_4px_14px_rgba(0,188,212,0.35)]'
                  : 'text-[#5A6E85] hover:text-[#0A2540] hover:bg-white'
              }`}
            >
              <Bookmark className={`h-3.5 w-3.5 ${activeTab === 'bookmarks' ? 'text-white' : ''}`} />
              <span>Bookmarks</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('communities')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                activeTab === 'communities'
                  ? 'bg-gradient-to-r from-[#007C8B] via-[#00B3C4] to-[#00E5F4] text-white font-bold shadow-[0_4px_14px_rgba(0,188,212,0.35)]'
                  : 'text-[#5A6E85] hover:text-[#0A2540] hover:bg-white'
              }`}
            >
              <Users className={`h-3.5 w-3.5 ${activeTab === 'communities' ? 'text-white' : ''}`} />
              <span>Communities</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('about')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                activeTab === 'about'
                  ? 'bg-gradient-to-r from-[#007C8B] via-[#00B3C4] to-[#00E5F4] text-white font-bold shadow-[0_4px_14px_rgba(0,188,212,0.35)]'
                  : 'text-[#5A6E85] hover:text-[#0A2540] hover:bg-white'
              }`}
            >
              <Info className={`h-3.5 w-3.5 ${activeTab === 'about' ? 'text-white' : ''}`} />
              <span>About</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('reputation')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                activeTab === 'reputation'
                  ? 'bg-gradient-to-r from-[#007C8B] via-[#00B3C4] to-[#00E5F4] text-white font-bold shadow-[0_4px_14px_rgba(0,188,212,0.35)]'
                  : 'text-[#5A6E85] hover:text-[#0A2540] hover:bg-white'
              }`}
            >
              <Award className={`h-3.5 w-3.5 ${activeTab === 'reputation' ? 'text-white' : ''}`} />
              <span>Reputation & Badges</span>
            </button>
          </div>

          {/* 4. TAB CONTENT: BLOGS FEED (TWO-COLUMN CARD ARRANGEMENT MATCHING REFERENCE) */}
          {activeTab === 'blogs' && (
            <div className="space-y-4">
              {loadingPosts ? (
                <div className="py-10 text-center text-xs text-[#5A6E85]">
                  Loading published blogs…
                </div>
              ) : displayArticles.length === 0 ? (
                <div className="py-10 px-6 text-center border border-dashed border-[#0A2540]/12 rounded-3xl bg-white/70 space-y-2">
                  <p className="text-sm font-medium text-[#0A2540]">No published blogs yet</p>
                  <p className="text-xs text-[#5A6E85] max-w-sm mx-auto leading-relaxed">
                    @{author.handle} has not published any public blogs yet. Once published, articles and onchain vote records will appear here.
                  </p>
                </div>
              ) : (
                displayArticles.map((article, idx) => {
                  const stats = postVotes[article.id] || {
                    upvotes: article.stats?.votesCount ?? 0,
                    downvotes: 0,
                    score: article.stats?.votesCount ?? 0,
                    userVote: null,
                  };
                  const reward = getArticleRewardState(stats.score);

                  return (
                    <article
                      key={article.id}
                      className="pn-profile-post bg-white/95 backdrop-blur-md rounded-3xl p-5 border border-[#007C8B]/10 shadow-xs hover:border-[#007C8B]/30 transition-all flex flex-col md:flex-row gap-5 items-stretch"
                    >
                      {/* Left: Article Cover Thumbnail */}
                      <a
                        href={`/read?slug=${encodeURIComponent(article.slug)}`}
                        className="pn-profile-thumbnail w-full md:w-56 h-40 md:h-auto rounded-2xl overflow-hidden flex-shrink-0 border border-[#0A2540]/8 block relative group"
                      >
                        <img
                          src={article.coverImage || (idx === 0 ? '/brand/article-thumb-build.jpg' : '/brand/article-thumb-reset.jpg')}
                          alt={article.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          onError={(e) => {
                            e.currentTarget.src = idx === 0 ? '/brand/article-thumb-build.jpg' : '/brand/article-thumb-reset.jpg';
                          }}
                        />
                      </a>

                      {/* Right: Article Details & Actions */}
                      <div className="pn-profile-post-details flex-1 flex flex-col justify-between space-y-2.5">
                        
                        {/* Author & Timestamp Row */}
                        <div>
                          <div className="pn-profile-post-author flex items-center gap-2 text-xs text-[#6E7D90] mb-1.5 flex-wrap">
                            <CreatorAvatar src={author.avatar} name={author.name} className="h-5 w-5 rounded-full object-cover" />
                            <span className="font-semibold text-[#0A2540]">{author.name}</span>
                            <span className="text-[#6E7D90]">@{author.handle}</span>
                            <span>· {article.publishedAt}</span>
                            {idx === 0 && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FCE7F3] text-[#BE185D]">
                                Pinned
                              </span>
                            )}
                          </div>

                          {/* Article Title */}
                          <h3 className="font-serif text-lg sm:text-xl font-bold text-[#0A2540] hover:text-[#007C8B] transition-colors leading-snug">
                            <a href={`/read?slug=${encodeURIComponent(article.slug)}`}>{article.title}</a>
                          </h3>

                          {/* Excerpt */}
                          <p className="text-xs sm:text-sm text-[#4A5E75] line-clamp-2 leading-relaxed mt-1">
                            {article.excerpt}
                          </p>
                        </div>

                        {/* Tag Pills */}
                        <div className="pn-profile-post-tags flex flex-wrap gap-1.5">
                          {article.tags.map(tag => (
                            <span
                              key={tag}
                              className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#F3E8FF] text-[#6B21A8]"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>

                        {/* Preserved Approved Voting UI Row with USD Worth */}
                        <div className="pn-profile-post-footer pt-2 border-t border-[#0A2540]/6 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            {/* Teal Upvote / Grey Downvote Pill */}
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

                            {/* USD Reward Label beside Voting Controls */}
                            <span
                              className="text-xs font-mono font-medium text-[#4A5E75] select-none cursor-help px-0.5"
                              title={reward.tooltip}
                            >
                              · {reward.displayUsd}
                            </span>

                            {/* Comment Count */}
                            <a
                              href={`/read?slug=${encodeURIComponent(article.slug)}#comments`}
                              className="pn-icon-btn"
                              title="Read responses"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                              <span>{article.stats?.commentsCount ?? 0}</span>
                            </a>
                          </div>

                          {/* Bookmark & Share Icons */}
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              className="pn-icon-btn"
                              title="Save bookmark"
                            >
                              <Bookmark className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              className="pn-icon-btn"
                              title="Share story"
                            >
                              <Share2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                      </div>
                    </article>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: REPLIES */}
          {activeTab === 'replies' && (
            <div className="space-y-4">
              {loadingReplies ? (
                <div className="py-8 text-center text-xs text-[#5A6E85]">Loading replies…</div>
              ) : creatorReplies.length === 0 ? (
                <div className="py-10 px-6 text-center border border-dashed border-[#0A2540]/12 rounded-3xl bg-white/70 space-y-1.5">
                  <p className="text-sm font-medium text-[#0A2540]">No replies yet</p>
                  <p className="text-xs text-[#5A6E85] max-w-sm mx-auto">Comments and replies published by @{author.handle} will appear here.</p>
                </div>
              ) : (
                creatorReplies.map(reply => (
                  <div key={reply.id} className="p-4 bg-white/90 rounded-2xl border border-[#007C8B]/10 space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#0A2540]">@{author.handle}</span>
                        {reply.parent_id && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#007C8B]/10 text-[#007C8B] text-[10px] font-semibold">
                            <CornerDownRight className="h-2.5 w-2.5" />
                            <span>Reply</span>
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-[#6E7D90]">
                        {new Date(reply.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                    <p className="text-sm text-[#3E526A] leading-relaxed">{reply.body}</p>
                    {reply.post && (
                      <div className="pt-2 border-t border-[#0A2540]/6 flex items-center justify-between text-[11px]">
                        <span className="text-[#6E7D90]">In discussion on:</span>
                        <a
                          href={`/read?slug=${encodeURIComponent(reply.post.slug || reply.post.id)}#comments`}
                          className="font-semibold text-[#007C8B] hover:underline truncate max-w-xs sm:max-w-md"
                        >
                          {reply.post.title} →
                        </a>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 3: MEDIA */}
          {activeTab === 'media' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {mediaItems.map((item, idx) => (
                <a key={idx} href={`/read?slug=${encodeURIComponent(item.slug)}`} className="rounded-2xl overflow-hidden aspect-video border border-[#0A2540]/10 block group">
                  <img src={item.url} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                </a>
              ))}
            </div>
          )}

          {/* TAB 4: BOOKMARKS */}
          {activeTab === 'bookmarks' && (
            <div>
              {!isOwner ? (
                <div className="py-10 px-6 text-center border border-dashed border-[#0A2540]/12 rounded-3xl bg-white/70">
                  <p className="text-sm font-medium text-[#0A2540]">Bookmarks are Private</p>
                  <p className="text-xs text-[#5A6E85] mt-1">Bookmarks saved by @{author.handle} are only visible to the owner.</p>
                </div>
              ) : bookmarkedArticles.length === 0 ? (
                <div className="py-10 px-6 text-center border border-dashed border-[#0A2540]/12 rounded-3xl bg-white/70">
                  <p className="text-sm font-medium text-[#0A2540]">No bookmarks saved yet</p>
                </div>
              ) : (
                bookmarkedArticles.map(bPost => (
                  <div key={bPost.id} className="p-4 bg-white/90 rounded-2xl border border-[#007C8B]/10 mb-3">
                    <a href={`/read?slug=${encodeURIComponent(bPost.slug)}`} className="font-serif font-bold text-sm text-[#0A2540] hover:text-[#007C8B]">{bPost.title}</a>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 5: COMMUNITIES */}
          {activeTab === 'communities' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {communities.slice(0, 4).map(comm => (
                <div key={comm.id} className="p-4 bg-white/95 rounded-2xl border border-[#007C8B]/10 space-y-2">
                  <h4 className="font-serif text-sm font-bold text-[#0A2540]">{comm.name}</h4>
                  <p className="text-xs text-[#5A6E85]">{comm.description}</p>
                </div>
              ))}
            </div>
          )}

          {/* TAB 6: ABOUT */}
          {activeTab === 'about' && (
            <div className="p-6 bg-white/95 rounded-3xl border border-[#007C8B]/10 space-y-3">
              <h3 className="font-serif text-lg font-bold text-[#0A2540]">About {author.name}</h3>
              <p className="text-sm text-[#3E526A] leading-relaxed">{author.bio}</p>
              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-[#0A2540]/8 text-xs">
                <div><span className="text-[#6E7D90] block">Location</span><span className="font-semibold text-[#0A2540]">{author.location}</span></div>
                <div><span className="text-[#6E7D90] block">Joined</span><span className="font-semibold text-[#0A2540]">{cleanJoinedDate}</span></div>
              </div>
            </div>
          )}

          {/* TAB 7: REPUTATION & BADGES */}
          {activeTab === 'reputation' && (
            <CreatorReputationDashboard author={author} />
          )}

        </main>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: CONTEXTUAL WIDGETS & STATS (~3.5 cols)                      */}
        {/* ========================================================================= */}
        <aside className="pn-profile-widgets lg:col-span-3 xl:col-span-3 space-y-4 sticky top-20">
          
          {/* Card 1: 4-Stat Overview Card from Reference */}
          <div className="bg-white/95 backdrop-blur-md rounded-2xl p-4 border border-[#007C8B]/10 shadow-xs">
            <div className="grid grid-cols-4 gap-2 text-center divide-x divide-[#0A2540]/8">
              <div className="px-1">
                <span className="block font-serif text-base sm:text-lg font-bold text-[#0A2540]">
                  {followersCount >= 1000 ? `${(followersCount / 1000).toFixed(1)}K` : followersCount}
                </span>
                <span className="text-[10px] text-[#6E7D90] uppercase tracking-wider block">Followers</span>
              </div>
              <div className="px-1">
                <span className="block font-serif text-base sm:text-lg font-bold text-[#0A2540]">
                  {followingCount}
                </span>
                <span className="text-[10px] text-[#6E7D90] uppercase tracking-wider block">Following</span>
              </div>
              <div className="px-1">
                <span className="block font-serif text-base sm:text-lg font-bold text-[#0A2540]">
                  {displayArticles.length}
                </span>
                <span className="text-[10px] text-[#6E7D90] uppercase tracking-wider block">Blogs</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('reputation')}
                className="px-1 text-center hover:opacity-80 transition-opacity"
                title="View reputation & achievement breakdown"
              >
                <span className="block font-serif text-base sm:text-lg font-bold text-[#007C8B]">
                  {author.reputationScore}
                </span>
                <span className="text-[10px] text-[#6E7D90] uppercase tracking-wider block">Reputation</span>
              </button>
            </div>
          </div>

          {/* Card 2: Mission Quote Card from Reference */}
          <div className="bg-gradient-to-br from-white/95 to-[#EBF7F9]/80 backdrop-blur-md rounded-2xl p-4 border border-[#007C8B]/10 shadow-xs relative">
            <span className="text-2xl font-serif text-[#007C8B] leading-none select-none">“</span>
            <p className="font-serif italic text-xs text-[#24425A] leading-relaxed -mt-2">
              A fairer internet for creators where ideas stay yours.
            </p>
            <div className="text-right">
              <span className="text-2xl font-serif text-[#007C8B] leading-none select-none">”</span>
            </div>
          </div>

          {/* Card 3: Creative Explorer Tier Card from Reference */}
          <div className="bg-white/95 backdrop-blur-md rounded-2xl p-4 border border-[#007C8B]/10 shadow-xs space-y-2.5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-9 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0">
                <img
                  src="/brand/penora-crystal-gem.jpg"
                  alt="Creative Explorer Crystal"
                  className="h-full w-full object-contain filter drop-shadow-[0_2px_6px_rgba(0,229,244,0.4)]"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
              <div className="min-w-0">
                <h4 className="font-serif text-xs font-bold text-[#0A2540]">Creative Explorer</h4>
                <p className="text-[10px] text-[#6E7D90]">Writing • Tech • Community</p>
              </div>
            </div>

            {/* Level Progression Bar */}
            <div className="space-y-1">
              <div className="h-1.5 w-full rounded-full bg-[#E2E8F0] overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#007C8B] to-[#00E5F4] rounded-full"
                  style={{ width: `${Math.min(100, Math.max(15, author.reputationScore))}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-[#6E7D90]">
                <span>Level 1</span>
                <span>{author.reputationScore} / 100 XP</span>
              </div>
            </div>
          </div>


          {/* Card 5: My Communities Card from Reference */}
          <div className="bg-white/95 backdrop-blur-md rounded-2xl p-4 border border-[#007C8B]/10 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="font-serif text-xs font-bold text-[#0A2540]">My Communities</h4>
              <a href="/communities" className="text-[10px] font-semibold text-[#007C8B] hover:underline">
                View all
              </a>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between p-1.5 rounded-xl hover:bg-[#F8FAFC] transition-colors">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-7 w-7 rounded-full bg-[#0A2540] text-white flex items-center justify-center text-[10px] font-bold">
                    P
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-xs text-[#0A2540] truncate">PENORA Updates</p>
                    <p className="text-[10px] text-[#6E7D90]">1.2K members</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="h-6 w-6 rounded-full bg-[#F1F5F9] hover:bg-[#007C8B] hover:text-white text-[#4A5E75] flex items-center justify-center text-xs transition-colors"
                  aria-label="Join community"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex items-center justify-between p-1.5 rounded-xl hover:bg-[#F8FAFC] transition-colors">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-7 w-7 rounded-full bg-[#E5F7F8] text-[#007C8B] flex items-center justify-center text-[10px] font-bold">
                    W
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-xs text-[#0A2540] truncate">Writers' Space</p>
                    <p className="text-[10px] text-[#6E7D90]">856 members</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="h-6 w-6 rounded-full bg-[#F1F5F9] hover:bg-[#007C8B] hover:text-white text-[#4A5E75] flex items-center justify-center text-xs transition-colors"
                  aria-label="Join community"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

        </aside>

      </div>

      <style>{`
        .pn-profile-mobile-stats { display: none; }

        @media (min-width: 768px) {
          .pn-profile-grid { max-width: 1520px; padding: 32px 32px 64px; gap: 28px; }
          .pn-profile-main > * + * { margin-top: 28px; }
          .pn-profile-cover { height: 300px; border-radius: 28px 28px 0 0; border-bottom: 0; box-shadow: none; }
          .pn-profile-main > .pn-profile-identity { margin-top: 0 !important; padding: 0 32px 32px; border-radius: 0 0 28px 28px; border-top: 0; box-shadow: 0 14px 40px #0a254007; }
          .pn-profile-topline { margin-top: -60px; margin-bottom: 26px; align-items: flex-end; gap: 24px; }
          .pn-profile-avatar { width: 128px; height: 128px; }
          .pn-profile-avatar-wrap > div { background: #fff; padding: 5px; box-shadow: 0 8px 26px #0a254018; }
          .pn-profile-avatar-wrap .animate-spin { display: none; }
          .pn-profile-actions { gap: 10px; margin-bottom: 4px; padding-top: 76px; }
          .pn-profile-actions button { min-height: 42px; }
          .pn-profile-actions button:first-child { padding: 11px 22px; font-size: 13px; }
          .pn-profile-name { margin-top: 4px; margin-bottom: 16px; }
          .pn-profile-name h1 { font-size: clamp(28px,2.25vw,36px); line-height: 1.2; letter-spacing: -.035em; overflow-wrap: anywhere; }
          .pn-profile-name > p { margin-top: 8px; font-size: 13px; }
          .pn-profile-identity > p.leading-relaxed { margin-top: 14px; max-width: 64ch; font-size: 14px; line-height: 1.85; }
          .pn-profile-identity > .flex-wrap { margin-top: 22px; row-gap: 12px; }
          .pn-profile-identity > .border-t { padding-top: 20px; margin-top: 24px; }
          .pn-profile-tabs { padding: 8px; border-radius: 20px; gap: 4px; }
          .pn-profile-tabs button { min-height: 44px; padding: 10px 14px; font-size: 12px; }
          .pn-profile-post { padding: 24px; gap: 24px; border-radius: 24px; box-shadow: 0 8px 30px #0a254005; }
          .pn-profile-thumbnail { width: 30%; min-height: 190px; border-radius: 17px; }
          .pn-profile-post-details { min-width: 0; gap: 14px; }
          .pn-profile-post-author { line-height: 1.7; margin-bottom: 12px; column-gap: 8px; }
          .pn-profile-post h3 { font-size: clamp(21px,1.8vw,27px); line-height: 1.3; letter-spacing: -.025em; }
          .pn-profile-post-details p { margin-top: 12px; line-height: 1.75; font-size: 13px; }
          .pn-profile-post-tags { gap: 7px; }
          .pn-profile-post-footer { padding-top: 16px; gap: 10px; flex-wrap: wrap; }
          .pn-profile-post-footer > div { flex-wrap: wrap; }
          .pn-profile-widgets { top: 96px; }
          .pn-profile-widgets > div { padding: 22px; border-radius: 22px; }
          .pn-profile-widgets > div + div { margin-top: 22px; }
        }
        @media (min-width: 1024px) {
          .pn-profile-grid { grid-template-columns: 230px minmax(0,1fr); }
          .pn-profile-grid > aside:first-child, .pn-profile-main { grid-column: auto; }
          .pn-profile-widgets { display: none; }
        }
        @media (min-width: 1360px) {
          .pn-profile-grid { grid-template-columns: 230px minmax(0,1fr) 280px; gap: 30px; }
          .pn-profile-widgets { display: block; grid-column: auto; }
        }

        @media (max-width: 767px) {
          .pn-creator-profile { background: #f5fafb; padding-bottom: 30px; }
          .pn-profile-grid { padding: 12px 12px 24px; gap: 16px; }
          .pn-profile-main { display: flex; flex-direction: column; gap: 14px; }
          .pn-profile-main > * { margin-top: 0 !important; }
          .pn-profile-cover { height: 152px; border-radius: 22px 22px 0 0; border-bottom: 0; }
          .pn-profile-identity { padding: 0 18px 18px; border-radius: 0 0 22px 22px; margin-top: -14px !important; box-shadow: 0 6px 24px #0a254006; }
          .pn-profile-topline { flex-direction: row; align-items: flex-end; gap: 10px; margin-top: -36px; margin-bottom: 16px; }
          .pn-profile-avatar { width: 78px; height: 78px; }
          .pn-profile-avatar-wrap > div { padding: 3px; box-shadow: 0 4px 14px #007c8b18; }
          .pn-profile-avatar-wrap .animate-spin { display: none; }
          .pn-profile-actions { gap: 6px; padding-top: 44px; margin: 0; }
          .pn-profile-actions button { min-height: 40px; }
          .pn-profile-actions button:first-child { padding: 9px 14px; }
          .pn-profile-identity h1 { font-size: 25px; line-height: 1.15; overflow-wrap: anywhere; }
          .pn-profile-identity p { overflow-wrap: anywhere; }
          .pn-profile-identity p.leading-relaxed { font-size: 13px; line-height: 1.65; margin-top: 10px; }
          .pn-profile-identity .flex-wrap { gap: 7px; }
          .pn-profile-mobile-stats { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); background: white; border: 1px solid #e0edf0; border-radius: 18px; padding: 14px 0; }
          .pn-profile-mobile-stats > div { display: flex; flex-direction: column; gap: 3px; text-align: center; }
          .pn-profile-mobile-stats > div + div { border-left: 1px solid #e0edf0; }
          .pn-profile-mobile-stats strong { font-size: 18px; font-weight: 700; color: #0a2540; }
          .pn-profile-mobile-stats span { font-size: 11px; color: #61778a; }
          .pn-profile-tabs { border-radius: 16px; padding: 4px; justify-content: flex-start; scrollbar-width: none; }
          .pn-profile-tabs button { min-height: 44px; flex-shrink: 0; padding: 10px 12px; }
          .pn-profile-tabs button:focus-visible, .pn-profile-actions button:focus-visible { outline: 2px solid #007c8b; outline-offset: 2px; }
          .pn-profile-post { padding: 14px; border-radius: 20px; gap: 14px; box-shadow: 0 5px 20px #0a254005; }
          .pn-profile-post { display: grid; grid-template-columns: minmax(0,1fr) 33%; column-gap: 12px; row-gap: 8px; }
          .pn-profile-post-details, .pn-profile-post-details > div:first-child { display: contents; }
          .pn-profile-post-author { grid-column: 1 / -1; grid-row: 1; font-size: 11px; margin-bottom: 5px; }
          .pn-profile-post h3 { grid-column: 1; grid-row: 2; }
          .pn-profile-post-details p { grid-column: 1; grid-row: 3; margin: 0; }
          .pn-profile-thumbnail { grid-column: 2; grid-row: 2 / 4; width: 100%; height: auto; aspect-ratio: 1.15; border-radius: 13px; align-self: start; }
          .pn-profile-post-tags { grid-column: 1 / -1; grid-row: 4; }
          .pn-profile-post-footer { grid-column: 1 / -1; grid-row: 5; margin-top: 4px; }
          .pn-profile-identity { position: relative; }
          .pn-profile-name { margin: 12px 0; min-height: 40px; }
          .pn-profile-name > div > span { display: none; }
          .pn-profile-name > div > div { display: none; }
          .pn-profile-identity h1 { font-size: 24px; }
          .pn-profile-topline { margin-bottom: 0; }
          .pn-profile-actions { padding: 0; align-self: flex-start; margin-top: 48px; }
          .pn-profile-actions button:first-child { font-size: 11px; padding: 8px 10px; }
          .pn-profile-actions button + button { display: none; }
          .pn-profile-avatar { width: 78px; height: 78px; }
          @media (max-width: 380px) { .pn-profile-name { margin: 12px 0; } .pn-profile-actions { margin-top: 48px; } }

          .pn-profile-post h3 { font-size: 22px; line-height: 1.25; letter-spacing: -.025em; overflow-wrap: anywhere; }
          .pn-profile-post > div { min-width: 0; }
          .pn-profile-post .justify-between { flex-wrap: wrap; row-gap: 8px; }
          .pn-profile-post .pn-icon-btn { min-height: 36px; }
          .pn-profile-widgets { display: none; }
        }
        @media (prefers-reduced-motion: reduce) { .pn-creator-profile * { animation: none !important; transition: none !important; } }
      `}</style>
      {/* Edit Profile Modal V5 */}
      <EditProfileModalV5
        isOpen={editModalOpen && isOwner}
        onClose={() => setEditModalOpen(false)}
        profileId={author.id || activeUserId || ''}
        initialDisplayName={author.name}
        initialBio={author.bio || ''}
        initialLocation={author.location || ''}
        initialWebsite={author.website || ''}
        initialInterests={interestTags}
        initialAvatarUrl={uploadedAvatar(author.avatar)}
        initialCoverUrl={author.coverImage}
        onProfileSaved={(updated) => {
          setCreatorProfile(prev => ({
            ...prev,
            name: updated.display_name || prev.name,
            bio: updated.bio,
            location: updated.location ?? prev.location,
            website: updated.website ?? prev.website,
            interests: updated.interests || prev.interests,
            avatar: updated.avatar_url !== undefined ? uploadedAvatar(updated.avatar_url) : prev.avatar,
            coverImage: updated.cover_url || prev.coverImage,
          }));

          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('penora:profile-updated', {
                detail: {
                  avatar_url: updated.avatar_url,
                  display_name: updated.display_name,
                  bio: updated.bio,
                  location: updated.location,
                  website: updated.website,
                  interests: updated.interests,
                  cover_url: updated.cover_url,
                },
              })
            );
          }
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
