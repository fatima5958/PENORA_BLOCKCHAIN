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
import { getVotesForPost, type PostVoteStats } from '../../lib/api/votes';
import { getArticleRewardState } from '../../lib/api/rewards';
import { EditProfileModalV5 } from './EditProfileModalV5';
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
  MoreHorizontal,
  ArrowRight,
  Sparkles,
  ChevronRight,
  Wallet,
} from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'blogs' | 'replies' | 'media' | 'bookmarks' | 'communities' | 'about'>('blogs');

  // Follow states
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  // Default fallback creator when viewing /profile/me unauthenticated
  const defaultAuthor: Author = initialAuthor || {
    id: 'mateenfatima',
    name: 'Mateen Fatima',
    handle: 'mateenwrites',
    avatar: '/brand/penora-avatar-mateen.jpg',
    coverImage: '/brand/penora-celestial-cover-default.jpg',
    reputationScore: 25,
    role: 'Creator',
    bio: 'Building PENORA for a fairer internet where creators truly own their content. Sharing my learning journey, real experiences and small wins ♡',
    location: 'Lahore, Pakistan',
    joinedDate: 'Oct 2026',
    followersCount: 1200,
    followingCount: 320,
    postsCount: 28,
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
        avatar: initialAuthor.avatar || prev.avatar,
        coverImage: initialAuthor.coverImage || prev.coverImage,
        location: initialAuthor.location !== undefined && initialAuthor.location !== null ? initialAuthor.location : prev.location,
        website: initialAuthor.website !== undefined && initialAuthor.website !== null ? initialAuthor.website : prev.website,
        interests: initialAuthor.interests || prev.interests,
      }));
    }
  }, [initialAuthor]);

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
            avatar: p.avatar_url || prev.avatar,
            coverImage: p.cover_url || prev.coverImage,
            location: p.location !== undefined && p.location !== null ? p.location : prev.location,
            website: p.website !== undefined && p.website !== null ? p.website : prev.website,
            interests: p.interests && p.interests.length > 0 ? p.interests : prev.interests,
            reputationScore: p.reputation ?? prev.reputationScore ?? 25,
            joinedDate: p.created_at ? new Date(p.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : prev.joinedDate,
          }));

          // Real follow counts
          const fc = await getFollowCounts(p.id);
          if (mounted) {
            setFollowersCount(fc.followers || defaultAuthor.followersCount || 0);
            setFollowingCount(fc.following || defaultAuthor.followingCount || 0);
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
                  coverImage: post.cover_image_url || '/brand/article-thumb-build.jpg',
                  coverImageAlt: post.title,
                  topic: post.tags?.[0] || 'Behind the Build',
                  publishedAt: new Date(post.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                  readTimeMinutes: Math.max(1, Math.ceil(post.content.split(/\s+/).length / 200)),
                  author: {
                    id: p.id,
                    name: p.display_name || p.username,
                    handle: p.username,
                    avatar: p.avatar_url || defaultAuthor.avatar,
                    reputationScore: p.reputation ?? 25,
                    role: 'Creator',
                    followersCount: fc.followers,
                  },
                  tags: post.tags || ['Behind the Build'],
                  stats: {
                    votesCount: 0,
                    userHasVoted: false,
                    commentsCount: 0,
                    bookmarksCount: 0,
                    reputationPoints: p.reputation ?? 25,
                  },
                }));
              setCreatorPosts(mapped);

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
            // Curate reference articles matching screenshot
            setCreatorPosts([
              {
                id: 'art-why-i-built-penora',
                slug: 'why-i-built-penora',
                title: 'Why I Built PENORA ✦',
                subtitle: '',
                excerpt: 'A honest story about why I started PENORA, what I believe in, and the kind of internet I want to see for creators.',
                content: ['Full story on building PENORA...'],
                coverImage: '/brand/article-thumb-build.jpg',
                coverImageAlt: 'Why I Built PENORA',
                topic: 'Behind the Build',
                publishedAt: '2d ago',
                readTimeMinutes: 5,
                author: defaultAuthor,
                tags: ['Behind the Build', 'Onchain'],
                isFeatured: true,
                stats: {
                  votesCount: 128,
                  userHasVoted: false,
                  commentsCount: 34,
                  bookmarksCount: 12,
                  reputationPoints: 25,
                },
              },
              {
                id: 'art-my-25-day-reset-plan',
                slug: 'my-25-day-reset-plan',
                title: 'My 25-Day Reset Plan',
                subtitle: '',
                excerpt: "Balancing faith, coding, building and a healthier me. Here's my simple plan that actually works.",
                content: ['Full story on my 25-day reset plan...'],
                coverImage: '/brand/article-thumb-reset.jpg',
                coverImageAlt: 'My 25-Day Reset Plan',
                topic: 'Life',
                publishedAt: '5d ago',
                readTimeMinutes: 4,
                author: defaultAuthor,
                tags: ['Life', 'Productivity', 'Personal'],
                stats: {
                  votesCount: 96,
                  userHasVoted: false,
                  commentsCount: 21,
                  bookmarksCount: 8,
                  reputationPoints: 25,
                },
              },
            ]);
          }
          setFollowersCount(defaultAuthor.followersCount || 1200);
          setFollowingCount(defaultAuthor.followingCount || 320);
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
  const isOwner = isOwnerView || Boolean(
    (activeUsername && activeUsername === author.handle.toLowerCase()) ||
    (activeUserId && activeUserId === author.id)
  );

  const interestTags = author.interests && author.interests.length > 0
    ? author.interests
    : ['Writing', 'Tech', 'Faith', 'Productivity', 'Onchain'];

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
    <div className="min-h-screen bg-[#EDF6F9] text-[#0A2540] relative overflow-hidden font-sans selection:bg-[#00E5F4]/30">
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
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start relative z-10">
        
        {/* ========================================================================= */}
        {/* LEFT COLUMN: NAVIGATION SIDEBAR & BRANDED ASSETS (~2.5 cols)              */}
        {/* ========================================================================= */}
        <aside className="hidden lg:block lg:col-span-2 xl:col-span-2 space-y-5 sticky top-20">
          
          {/* Spatial Nav Card */}
          <nav className="bg-white/80 backdrop-blur-md rounded-2xl p-2.5 border border-[#007C8B]/10 shadow-xs space-y-1">
            <a
              href="/"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-[#4A5E75] hover:text-[#0A2540] hover:bg-white/90 transition-all"
            >
              <Home className="h-4 w-4 text-[#4A5E75]" />
              <span>Home</span>
            </a>

            <a
              href="/explore"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-[#4A5E75] hover:text-[#0A2540] hover:bg-white/90 transition-all"
            >
              <Compass className="h-4 w-4 text-[#4A5E75]" />
              <span>Explore</span>
            </a>

            <a
              href="/communities"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-[#4A5E75] hover:text-[#0A2540] hover:bg-white/90 transition-all"
            >
              <Users className="h-4 w-4 text-[#4A5E75]" />
              <span>Communities</span>
            </a>

            <a
              href="/editor"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-[#4A5E75] hover:text-[#0A2540] hover:bg-white/90 transition-all"
            >
              <PenLine className="h-4 w-4 text-[#4A5E75]" />
              <span>Create</span>
            </a>

            <a
              href="/profile/me?tab=bookmarks"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-[#4A5E75] hover:text-[#0A2540] hover:bg-white/90 transition-all"
            >
              <Bookmark className="h-4 w-4 text-[#4A5E75]" />
              <span>Bookmarks</span>
            </a>

            <a
              href="/wallet"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-[#4A5E75] hover:text-[#0A2540] hover:bg-white/90 transition-all"
            >
              <Wallet className="h-4 w-4 text-[#4A5E75]" />
              <span>Wallet</span>
            </a>

            {/* Profile (Active in Reference) */}
            <a
              href="/profile/me"
              className="pn-nav-item active flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all"
            >
              <span className="flex items-center gap-3">
                <UserIcon className="h-4 w-4" />
                <span>Profile</span>
              </span>
              <ChevronRight className="h-4 w-4 opacity-80" />
            </a>
          </nav>

          {/* Floating Ideas & Stories Onchain Card */}
          <div className="bg-gradient-to-br from-white/90 to-[#EBF7F9]/80 backdrop-blur-md rounded-2xl p-4 border border-[#007C8B]/15 shadow-xs relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <div className="h-10 w-8 rounded-lg overflow-hidden flex items-center justify-center">
                <img
                  src="/brand/penora-crystal-gem.jpg"
                  alt="Crystal Gem"
                  className="h-full w-full object-contain filter drop-shadow-[0_2px_8px_rgba(0,229,244,0.4)]"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
              <a
                href="/explore"
                className="h-7 w-7 rounded-full bg-[#0A2540] hover:bg-[#007C8B] text-white flex items-center justify-center transition-colors shadow-2xs"
                aria-label="Explore stories"
              >
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
            <div className="mt-2 text-xs font-serif italic text-[#0A2540] leading-snug">
              <p className="font-semibold not-italic text-[11px] uppercase tracking-wider text-[#007C8B]">Ideas Stories</p>
              <p className="text-[#3E526A]">People Onchain</p>
            </div>
          </div>

          {/* Floating Ringed Celestial Planet Artwork */}
          <div className="relative py-2 px-1 flex flex-col items-center text-center opacity-85">
            <svg className="w-24 h-20 text-[#007C8B]" viewBox="0 0 100 80" fill="none">
              <defs>
                <linearGradient id="planetGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#C4EEF5" />
                  <stop offset="60%" stopColor="#75CAD7" />
                  <stop offset="100%" stopColor="#0A2540" />
                </linearGradient>
              </defs>
              <circle cx="50" cy="40" r="24" fill="url(#planetGrad)" />
              <ellipse cx="50" cy="40" rx="46" ry="12" stroke="#00E5F4" strokeWidth="1.5" strokeOpacity="0.8" transform="rotate(-18 50 40)" />
              <ellipse cx="50" cy="40" rx="38" ry="8" stroke="#FFFFFF" strokeWidth="0.8" strokeOpacity="0.6" transform="rotate(-18 50 40)" />
              <circle cx="75" cy="20" r="1.5" fill="#00E5F4" />
              <circle cx="25" cy="62" r="1" fill="#FFFFFF" />
            </svg>
            <div className="mt-2">
              <span className="font-serif text-[11px] font-bold tracking-wider text-[#0A2540] block">
                PENORA
              </span>
              <p className="text-[10px] text-[#6E7D90] leading-tight">
                A fairer internet for creators.
              </p>
            </div>
          </div>

        </aside>

        {/* ========================================================================= */}
        {/* CENTER COLUMN: IDENTITY, CELESTIAL BANNER & ARTICLES (~7 cols)            */}
        {/* ========================================================================= */}
        <main className="lg:col-span-7 xl:col-span-7 space-y-5 min-w-0">
          
          {/* 1. PANORAMIC CELESTIAL COVER BANNER */}
          <div className="relative h-60 sm:h-72 w-full rounded-3xl overflow-hidden border border-[#007C8B]/15 shadow-sm bg-[#0A2540]">
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
          <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 sm:p-7 border border-[#007C8B]/10 shadow-xs relative -mt-8 z-10">
            
            {/* Avatar & Header Action Row */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-20 sm:-mt-24 mb-3">
              
              {/* Overlapping Avatar with Glowing Cyan Ring & Orbitals */}
              <div className="relative group flex-shrink-0">
                <div className="relative p-1 rounded-full bg-gradient-to-tr from-[#007C8B] via-[#00E5F4] to-[#0A2540] shadow-xl ring-4 ring-white">
                  <img
                    src={author.avatar || '/brand/penora-avatar-mateen.jpg'}
                    alt={author.name}
                    className="h-28 w-28 sm:h-32 sm:w-32 rounded-full object-cover bg-white"
                    onError={(e) => {
                      e.currentTarget.src = '/brand/penora-avatar-mateen.jpg';
                    }}
                  />
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
              <div className="flex items-center gap-2 mb-1">
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
                  <button
                    type="button"
                    onClick={handleFollowToggle}
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
                )}
              </div>
            </div>

            {/* Display Name, Handle & Creator Crown */}
            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#0A2540] tracking-tight">
                  {author.name || 'Mateen Fatima'}
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

            {/* Headline Subtitle from Reference: Writing • Tech • Faith • Soft Living ✧ */}
            <p className="text-xs font-medium text-[#007C8B] mt-2 tracking-wide">
              Writing • Tech • Faith • Soft Living ✧
            </p>

            {/* Bio */}
            <p className="text-xs sm:text-sm text-[#3E526A] leading-relaxed mt-1.5 max-w-2xl">
              {author.bio || 'Building PENORA for a fairer internet where creators truly own their content. Sharing my learning journey, real experiences and small wins ♡'}
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

          {/* 3. PROFILE NAVIGATION TABS STRIP */}
          <div className="bg-white/90 backdrop-blur-md rounded-2xl p-1.5 border border-[#007C8B]/10 shadow-xs flex items-center justify-between overflow-x-auto gap-1">
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
                    upvotes: article.stats?.votesCount || (idx === 0 ? 128 : 96),
                    downvotes: 0,
                    score: article.stats?.votesCount || (idx === 0 ? 128 : 96),
                    userVote: null,
                  };
                  const reward = getArticleRewardState(stats.score);

                  return (
                    <article
                      key={article.id}
                      className="bg-white/95 backdrop-blur-md rounded-3xl p-5 border border-[#007C8B]/10 shadow-xs hover:border-[#007C8B]/30 transition-all flex flex-col md:flex-row gap-5 items-stretch"
                    >
                      {/* Left: Article Cover Thumbnail */}
                      <a
                        href={`/story/${article.slug}`}
                        className="w-full md:w-56 h-40 md:h-auto rounded-2xl overflow-hidden flex-shrink-0 border border-[#0A2540]/8 block relative group"
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
                      <div className="flex-1 flex flex-col justify-between space-y-2.5">
                        
                        {/* Author & Timestamp Row */}
                        <div>
                          <div className="flex items-center gap-2 text-xs text-[#6E7D90] mb-1.5 flex-wrap">
                            <img
                              src={author.avatar || '/brand/penora-avatar-mateen.jpg'}
                              alt={author.name}
                              className="h-5 w-5 rounded-full object-cover"
                            />
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
                            <a href={`/story/${article.slug}`}>{article.title}</a>
                          </h3>

                          {/* Excerpt */}
                          <p className="text-xs sm:text-sm text-[#4A5E75] line-clamp-2 leading-relaxed mt-1">
                            {article.excerpt}
                          </p>
                        </div>

                        {/* Tag Pills */}
                        <div className="flex flex-wrap gap-1.5">
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
                        <div className="pt-2 border-t border-[#0A2540]/6 flex items-center justify-between text-xs">
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
                              href={`/story/${article.slug}#comments`}
                              className="pn-icon-btn"
                              title="Read responses"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                              <span>{article.stats?.commentsCount || (idx === 0 ? 34 : 21)}</span>
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
                  <div key={reply.id} className="p-4 bg-white/90 rounded-2xl border border-[#007C8B]/10 space-y-1.5 text-xs">
                    <span className="font-semibold text-[#0A2540]">@{author.handle}</span>
                    <p className="text-sm text-[#3E526A]">{reply.body}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 3: MEDIA */}
          {activeTab === 'media' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {mediaItems.map((item, idx) => (
                <a key={idx} href={`/story/${item.slug}`} className="rounded-2xl overflow-hidden aspect-video border border-[#0A2540]/10 block group">
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
                    <a href={`/story/${bPost.slug}`} className="font-serif font-bold text-sm text-[#0A2540] hover:text-[#007C8B]">{bPost.title}</a>
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

        </main>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: CONTEXTUAL WIDGETS & STATS (~3.5 cols)                      */}
        {/* ========================================================================= */}
        <aside className="lg:col-span-3 xl:col-span-3 space-y-4 sticky top-20">
          
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
                  {displayArticles.length || 28}
                </span>
                <span className="text-[10px] text-[#6E7D90] uppercase tracking-wider block">Blogs</span>
              </div>
              <div className="px-1">
                <span className="block font-serif text-base sm:text-lg font-bold text-[#007C8B]">
                  {author.reputationScore}
                </span>
                <span className="text-[10px] text-[#6E7D90] uppercase tracking-wider block">Reputation</span>
              </div>
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

      {/* Edit Profile Modal V5 */}
      <EditProfileModalV5
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        profileId={author.id || activeUserId || ''}
        initialDisplayName={author.name}
        initialBio={author.bio || ''}
        initialLocation={author.location || 'Lahore, Pakistan'}
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
