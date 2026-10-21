import React, { useState, useEffect } from 'react';
import type { Author, Article, Topic, Community } from '../../types';
import { CompactPostCard } from '../feed/CompactPostCard';
import { RightSidebar } from '../layout/RightSidebar';
import {
  MapPin,
  Calendar,
  Clock,
  Award,
  Check,
  Plus,
  BookOpen,
  MessageSquare,
  Repeat,
  Compass,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { penoraKeyAuth, type PenoraUser } from '../../lib/auth/penoraKeyAuth';
import { followUser, unfollowUser, isFollowing as checkIsFollowing, getFollowCounts } from '../../lib/api/follows';
import { getUserArticles } from '../../lib/api/articles';
import { SpatialAuthModalV4 } from '../design-v4/SpatialAuthModalV4';
import type { PostRecord, ProfileRecord } from '../../lib/api/types';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface CreatorProfileViewProps {
  author: Author;
  articles: Article[];
  topics: Topic[];
  communities: Community[];
}

export const CreatorProfileView: React.FC<CreatorProfileViewProps> = ({
  author: initialAuthor,
  articles: fallbackArticles,
  topics,
}) => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [keyUser, setKeyUser] = useState<PenoraUser | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<'posts' | 'blog'>('posts');
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  const [creatorProfile, setCreatorProfile] = useState<Author>(initialAuthor);
  const [creatorPosts, setCreatorPosts] = useState<Article[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  // Subscribe to auth
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

  // Hydrate real creator profile & posts from Supabase
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
            reputationScore: p.reputation ?? 25,
            joinedDate: new Date(p.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
          }));

          // Fetch follow counts
          const fc = await getFollowCounts(p.id);
          if (mounted) {
            setFollowersCount(fc.followers);
            setFollowingCount(fc.following);
          }

          // Fetch real published posts
          const postsRes = await getUserArticles(p.id);
          if (mounted) {
            if (postsRes.data && postsRes.data.length > 0) {
              const mapped: Article[] = postsRes.data
                .filter(post => post.published)
                .map((post: PostRecord) => ({
                  id: post.id,
                  slug: post.slug,
                  title: post.title,
                  excerpt: post.excerpt || post.content.slice(0, 160) + '...',
                  content: post.content,
                  coverImage: post.cover_image_url || undefined,
                  category: post.tags?.[0] || 'Protocol',
                  publishedAt: new Date(post.created_at).toLocaleDateString(),
                  readTime: `${Math.max(1, Math.ceil(post.content.split(/\s+/).length / 200))} min read`,
                  author: {
                    id: p.id,
                    name: p.display_name || p.username,
                    handle: p.username,
                    avatar: p.avatar_url || initialAuthor.avatar,
                    reputationScore: p.reputation ?? 25,
                    isTopContributor: (p.reputation ?? 25) >= 50,
                    followersCount: fc.followers,
                  },
                  curationScore: 0,
                  tags: post.tags || [],
                }));
              setCreatorPosts(mapped);
            } else {
              setCreatorPosts([]);
            }
          }
        } else if (mounted) {
          // If no remote profile found, filter fallback articles for this author
          const matched = fallbackArticles.filter(a => a.author.handle === handle || a.author.id === initialAuthor.id);
          setCreatorPosts(matched);
          setFollowersCount(initialAuthor.followersCount || 0);
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

  // Check if current visitor is following this author
  useEffect(() => {
    const activeUserId = keyUser?.id || user?.id;
    const authorId = creatorProfile.id;
    if (activeUserId && authorId) {
      checkIsFollowing(activeUserId, authorId).then(following => {
        setIsFollowing(following);
      });
    }
  }, [keyUser, user, creatorProfile.id]);

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

  const author = creatorProfile;
  const displayArticles = creatorPosts;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      
      {/* Top Profile Header Banner */}
      <div className="pn-card overflow-hidden mb-6">
        
        {/* Cover Photo / Brand Canvas */}
        <div className="relative h-44 sm:h-52 w-full bg-[#0A2540] overflow-hidden">
          {author.coverImage ? (
            <img
              src={author.coverImage}
              alt={author.name}
              className="w-full h-full object-cover opacity-50"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-[#0A2540] via-[#0B2D4E] to-[#007C8B]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A2540] via-[#0A2540]/30 to-transparent" />
          <div className="absolute bottom-0 inset-x-0 h-[3px] bg-gradient-to-r from-[#007C8B] to-[#00E5F4]" />
        </div>

        {/* Profile Card Body */}
        <div className="relative px-6 pb-6 pt-0 text-[#0A2540]">
          {/* Avatar and Action row */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-14 sm:-mt-16 mb-4">
            
            <div className="flex items-end gap-4">
              <div className="relative p-1 rounded-full bg-gradient-to-tr from-[#007C8B] to-[#00E5F4] shadow-lg">
                <img
                  src={author.avatar}
                  alt={author.name}
                  className="h-24 w-24 sm:h-28 sm:w-28 rounded-full object-cover ring-4 ring-white bg-white"
                />
                <span className="absolute bottom-1 right-1 h-5 w-5 rounded-full bg-[#007C8B] ring-2 ring-white flex items-center justify-center text-white text-[10px] font-bold">
                  ✓
                </span>
              </div>

              <div className="mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#0A2540] tracking-tight">
                    {author.name}
                  </h1>
                  <span className="pn-tag font-mono">
                    {author.reputationScore} Rep
                  </span>
                </div>
                <p className="text-xs text-[#4A5E75] font-medium">@{author.handle}</p>
              </div>
            </div>

            {/* Follow Button */}
            <div className="flex items-center gap-2 mb-2">
              <button
                type="button"
                onClick={handleFollowToggle}
                className={`pn-btn px-5 py-2 rounded-full text-xs ${
                  isFollowing
                    ? 'pn-btn-secondary'
                    : 'pn-btn-brand'
                }`}
              >
                {isFollowing ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>Following</span>
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" />
                    <span>Follow Creator</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Biography snippet */}
          <p className="text-sm text-[#4A5E75] max-w-2xl leading-relaxed mb-4">
            {author.bio || 'Architecting decentralized editorial systems and high-signal Web3 publishing.'}
          </p>

          {/* Stats Bar */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3 px-4 rounded-xl bg-[#F8FAFC] border border-[#0A2540]/8 text-xs font-semibold text-[#0A2540] mb-4">
            <div>
              <span className="font-bold text-[#0A2540]">{followersCount}</span>{' '}
              <span className="text-[#4A5E75] font-normal">followers</span>
            </div>
            <div className="text-[#0A2540]/20">•</div>
            <div>
              <span className="font-bold text-[#0A2540]">{displayArticles.length}</span>{' '}
              <span className="text-[#4A5E75] font-normal">published posts</span>
            </div>
            <div className="text-[#0A2540]/20">•</div>
            <div>
              <span className="font-bold text-[#0A2540]">{followingCount}</span>{' '}
              <span className="text-[#4A5E75] font-normal">following</span>
            </div>
            <div className="text-[#0A2540]/20">•</div>
            <div className="flex items-center gap-1 text-[#007C8B]">
              <Award className="h-3.5 w-3.5" />
              <span>{author.reputationScore} Reputation</span>
            </div>
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-[#4A5E75]">
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-[#007C8B]" />
              <span>{author.location || 'Decentralized Node'}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-[#007C8B]" />
              <span>{author.joinedDate || 'Member'}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-[#7B8FA6]" />
              <span>Verified Creator</span>
            </span>
          </div>

        </div>
      </div>

      {/* 3-Column Steemit-Style Body */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Sidebar */}
        <div className="hidden lg:block lg:col-span-3 sticky top-20">
          <div className="pn-panel p-3 space-y-1">
            <a
              href="/"
              className="pn-nav-item"
            >
              <Compass className="h-4 w-4 text-[#4A5E75]" />
              <span>Explore Feed</span>
            </a>
            
            <div className="pt-2 pb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-[#7B8FA6]">
              Creator Publications
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('posts')}
              className={`pn-nav-item w-full text-left ${activeTab === 'posts' ? 'active' : ''}`}
            >
              <BookOpen className="h-4 w-4" />
              <span>Posts ({displayArticles.length})</span>
            </button>
          </div>
        </div>

        {/* Center Feed Column */}
        <main className="lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-display text-lg font-bold text-[#0A2540] capitalize">
              {author.name}'s Publications
            </h2>
            <span className="text-xs text-[#4A5E75]">
              {displayArticles.length} published essays
            </span>
          </div>

          {loadingPosts ? (
            <div className="pn-card p-10 text-center text-xs text-[#4A5E75]">
              Loading publications…
            </div>
          ) : displayArticles.length === 0 ? (
            <div className="pn-card p-10 text-center space-y-3">
              <div className="h-10 w-10 rounded-2xl bg-[#00E5F4]/15 text-[#007C8B] flex items-center justify-center mx-auto">
                <BookOpen className="h-5 w-5" />
              </div>
              <h3 className="pn-h2">No essays published yet</h3>
              <p className="text-xs text-[#4A5B70] max-w-sm mx-auto leading-relaxed">
                @{author.handle} has not published any public essays yet. Check back soon for new perspectives.
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {displayArticles.map((article) => (
                <CompactPostCard key={article.id} article={article} />
              ))}
            </div>
          )}
        </main>

        {/* Right Sidebar Column */}
        <div className="hidden lg:block lg:col-span-3 sticky top-20">
          <RightSidebar topics={topics} />
        </div>

      </div>

      <SpatialAuthModalV4
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode="login"
        presentation="centered-modal"
      />
    </div>
  );
};
