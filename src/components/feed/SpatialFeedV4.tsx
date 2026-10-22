import '../../styles/mobile-feed.css';
import { usePostVoting } from '../../lib/hooks/usePostVoting';
// src/components/feed/SpatialFeedV4.tsx
// PENORA Blockchain — Main 3-Column Social Publishing Feed
// Unified with the approved PENORA Blockchain Identity System (Deep Navy #0A2540 + Teal #007C8B -> #00E5F4)
// Preserves the clean, balanced, readable 3-column layout and live Supabase integration.
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Home,
  Compass,
  Users,
  User as UserIcon,
  Bookmark,
  ChevronRight,
  ArrowRight,
  MessageCircle,
  MoreVertical,
  Heart,
  Share2,
  TrendingUp,
  Check,
  ShieldCheck,
  Wallet,
  Search,
  Flame,
  Sparkles,
  Repeat2,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { getPublishedArticles } from '../../lib/api/articles';
import { getVotesForPost, type PostVoteStats } from '../../lib/api/votes';
import { readArticleDraft, saveArticleDraft } from '../../lib/articleDrafts';
import { getArticleRewardState } from '../../lib/api/rewards';
import { getCommentsForPost } from '../../lib/api/comments';
import { toggleBookmark } from '../../lib/api/bookmarks';
import { followUser, unfollowUser } from '../../lib/api/follows';
import { getCommunities, isCommunityMember, joinCommunity, leaveCommunity } from '../../lib/api/communities';
import { SpatialAuthModalV4 } from '../design-v4/SpatialAuthModalV4';
import { PenoraEmblem, PenoraLogo } from '../brand/PenoraLogo';
import { penoraKeyAuth, type PenoraUser } from '../../lib/auth/penoraKeyAuth';
import { useLiveProfile } from '../../lib/hooks/useLiveProfile';
import { getUserBookmarks } from '../../lib/api/bookmarks';
import { isFollowing } from '../../lib/api/follows';
import type { ProfileRecord, CommunityRecord } from '../../lib/api/types';
import type { PostRecord } from '../../lib/api/types';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface FeedArticleItem {
  id: string;
  slug: string;
  category: string;
  categoryGroup: string;
  readTime: string;
  title: string;
  excerpt: string;
  author: {
    id?: string;
    name: string;
    handle: string;
    avatar: string;
    reputation: number | null;
    verified: boolean;
  };
  publishedAgo: string;
  thumbnail: string;
  isDbRecord?: boolean;
  tags?: string[];
  publishedAt?: number;
}

const CATEGORIES = [
  'For You',
  'Following',
  'Hot',
  'New',
  'Tech',
  'Design',
  'Lifestyle',
  'Business',
  'Creativity',
] as const;

export const SpatialFeedV4: React.FC = () => {
  const { voteError, submitPostVote } = usePostVoting();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [keyUser, setKeyUser] = useState<PenoraUser | null>(null);
  const [articles, setArticles] = useState<FeedArticleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPendingMigration, setIsPendingMigration] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('For You');
  const [activeNav, setActiveNav] = useState<'Home' | 'Explore' | 'Communities' | 'Profile' | 'Bookmarks'>('Home');

  // Dynamic vote & comment ledgers (no hardcoded counts)
  const [voteStatsMap, setVoteStatsMap] = useState<Record<string, PostVoteStats>>({});
  const [commentsCountMap, setCommentsCountMap] = useState<Record<string, number>>({});
  const [bookmarkedMap, setBookmarkedMap] = useState<Record<string, boolean>>({});
  const [followedMap, setFollowedMap] = useState<Record<string, boolean>>({});
  const [joinedCommunities, setJoinedCommunities] = useState<Record<string, boolean>>({});
  const [communities, setCommunities] = useState<CommunityRecord[]>([]);
  const profile = useLiveProfile(keyUser?.id || user?.id);
  const [ownAvatarFailed, setOwnAvatarFailed] = useState(false);
  useEffect(() => setOwnAvatarFailed(false), [profile?.avatar_url]);
  const [actionError, setActionError] = useState<string | null>(null);

  // Auth modal
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'register' | 'login'>('register');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Subscribe to both Steemit Key Auth and Supabase Auth
  useEffect(() => {
    const unsubKey = penoraKeyAuth.subscribe(ku => {
      setKeyUser(ku);
    });

    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      unsubKey();
      subscription.unsubscribe();
    };
  }, []);

  // Fetch real published articles from Supabase
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getPublishedArticles({ limit: 20 }).then(res => {
      if (!mounted) return;
      if (res.error) setActionError('The feed could not be loaded. Please refresh to try again.');
      if (res.isPendingMigration) {
        setIsPendingMigration(true);
      } else if (res.data) {
        if (res.data.length > 0) {
          const mapped: FeedArticleItem[] = res.data.map((p: PostRecord) => ({
            id: p.id,
            slug: p.slug,
            category: p.tags?.[0] || 'Protocol',
            categoryGroup: 'Tech',
            readTime: `${Math.max(1, Math.ceil(p.content.split(/\s+/).length / 200))} min read`,
            title: p.title,
            excerpt: p.excerpt || p.content.slice(0, 160) + '...',
            author: {
              id: p.author_id,
              name: p.author?.display_name || p.author?.username || 'PENORA Creator',
              handle: p.author?.username || 'creator',
              avatar:
                p.author?.avatar_url ||
                '/favicon.svg',
              reputation: p.author?.reputation ?? null,
              verified: p.author?.reputation != null,
            },
            publishedAgo: new Date(p.created_at).toLocaleDateString(),
            thumbnail:
              p.cover_image_url ||
              '/brand/penora-celestial-cover-default.jpg',
            isDbRecord: true,
            tags: p.tags || [],
            publishedAt: new Date(p.created_at).getTime(),
          }));
          setArticles(mapped);
        } else {
          setArticles([]);
        }
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, []);

  // Hydrate real vote counts & comment counts for all visible articles
  const refreshArticleMetrics = useCallback(
    async (items: FeedArticleItem[], activeVoterId: string) => {
      const voteEntries = await Promise.all(
        items.map(async item => [item.id, await getVotesForPost(item.id, activeVoterId)] as const)
      );
      setVoteStatsMap(Object.fromEntries(voteEntries));

      const commentEntries = await Promise.all(
        items.map(async item => {
          const cRes = await getCommentsForPost(item.id);
          return [item.id, cRes.data ? cRes.data.length : 0] as const;
        })
      );
      setCommentsCountMap(Object.fromEntries(commentEntries));
    },
    []
  );

  useEffect(() => {
    const activeVoterId = keyUser?.id || user?.id || '';
    refreshArticleMetrics(articles, activeVoterId);
  }, [articles, keyUser, user, refreshArticleMetrics]);

  useEffect(() => { let active = true; getCommunities(1).then(res => { if (active) setCommunities(res.data); }); return () => { active = false; }; }, []);
  useEffect(() => {
    let active = true;
    const id = keyUser?.id || user?.id;
    setBookmarkedMap({}); setFollowedMap({});
    if (!id) return;
    Promise.all([getUserBookmarks(id), Promise.all(articles.map(async a => [a.author.handle, await isFollowing(id, a.author.id || a.author.handle)] as const))]).then(([saved, follows]) => {
      if (!active) return;
      setBookmarkedMap(Object.fromEntries(saved.data.map(b => [b.post_id, true])));
      setFollowedMap(Object.fromEntries(follows));
    });
    return () => { active = false; };
  }, [keyUser?.id, user?.id, articles]);
  const suggestedCreators = useMemo(() => Array.from(new Map(articles.filter(a => a.author.id && a.author.id !== (keyUser?.id || user?.id)).map(a => [a.author.id, a.author])).values()).slice(0, 3), [articles, keyUser?.id, user?.id]);
  const trendingTags = useMemo(() => {
    const counts = new Map<string, number>();
    articles.forEach(a => a.tags?.forEach(t => counts.set(t, (counts.get(t) || 0) + 1)));
    return [...counts].sort((a,b) => b[1]-a[1]).slice(0,10).map(([tag]) => tag);
  }, [articles]);

  useEffect(() => {
    let active = true;
    const id = keyUser?.id || user?.id;
    setJoinedCommunities({});
    if (id) Promise.all(communities.map(async c => [c.id, await isCommunityMember(id, c.id)] as const)).then(entries => { if (active) setJoinedCommunities(Object.fromEntries(entries)); });
    return () => { active = false; };
  }, [communities, keyUser?.id, user?.id]);
  const handleCommunity = async (id: string) => {
    const memberId = keyUser?.id || user?.id;
    if (!memberId) { setAuthMode('login'); setAuthModalOpen(true); return; }
    const joined = joinedCommunities[id];
    const result = joined ? await leaveCommunity(memberId, id) : await joinCommunity(memberId, id);
    if (!result.success) { setActionError(result.error || 'Could not update community membership.'); return; }
    setJoinedCommunities(prev => ({ ...prev, [id]: !joined }));
  };

  // Filtered articles
  const displayedArticles = useMemo(() => {
    const filtered = articles.filter(a => {
      if (activeNav === 'Bookmarks') {
        return bookmarkedMap[a.id];
      }
      if (['For You', 'Hot', 'New'].includes(activeCategory)) return true;
      if (activeCategory === 'Following') return followedMap[a.author.handle];
      return (
        a.categoryGroup.toLowerCase() === activeCategory.toLowerCase() ||
        a.category.toLowerCase() === activeCategory.toLowerCase()
      );
    });
    if (activeCategory === 'Hot') return filtered.sort((a, b) => (voteStatsMap[b.id]?.score ?? 0) - (voteStatsMap[a.id]?.score ?? 0));
    if (activeCategory === 'New') return filtered.sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0));
    return filtered;
  }, [articles, activeCategory, activeNav, bookmarkedMap, followedMap, voteStatsMap]);

  // Functional Upvote ▲ and Downvote ▼ handler
  const handleVote = async (articleId: string, direction: 1 | -1) => {
    const voterId = keyUser?.id || user?.id;
    if (!voterId) {
      setAuthMode('login');
      setAuthModalOpen(true);
      return;
    }

    const current: PostVoteStats = voteStatsMap[articleId] ?? {
      upvotes: 0,
      downvotes: 0,
      score: 0,
      userVote: null,
    };

    await submitPostVote(articleId, voterId, direction, current, stats => setVoteStatsMap(prev => ({ ...prev, [articleId]: stats })));
  };

  // Handle bookmark
  const handleBookmark = async (articleId: string) => {
    const voterId = keyUser?.id || user?.id;
    if (!voterId) {
      setAuthMode('login');
      setAuthModalOpen(true);
      return;
    }

    const isBookmarked = bookmarkedMap[articleId];
    const result = await toggleBookmark(voterId, articleId);
    if (result.error) { setActionError(result.error); return; }
    setBookmarkedMap(prev => ({ ...prev, [articleId]: result.isBookmarked }));
  };

  // Handle follow
  const handleFollow = async (handle: string, authorId?: string) => {
    const voterId = keyUser?.id || user?.id;
    if (!voterId) {
      setAuthMode('login');
      setAuthModalOpen(true);
      return;
    }

    const isFollowed = followedMap[handle];
    const result = isFollowed ? await unfollowUser(voterId, authorId || handle) : await followUser(voterId, authorId || handle);
    if (result.error) { setActionError(result.error); return; }
    setFollowedMap(prev => ({ ...prev, [handle]: result.isFollowing }));
  };

  // Share only after the browser confirms completion.
  const handleShare = async (slug: string, articleId: string) => {
    const url = `${window.location.origin}/read?slug=${encodeURIComponent(slug)}`;
    try {
      if (navigator.share) await navigator.share({ url });
      else await navigator.clipboard.writeText(url);
      setCopiedId(articleId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setActionError('Could not share this story. Please copy its link from the reader.');
    }
  };
  const handleReblog = (article: FeedArticleItem) => {
    const authorId = keyUser?.id || user?.id;
    if (!authorId) { setAuthMode('login'); setAuthModalOpen(true); return; }
    if (readArticleDraft()) { setActionError('You have an unfinished draft. Save or publish it in the editor before starting a reblog.'); return; }
    const url = `${window.location.origin}/read?slug=${encodeURIComponent(article.slug)}`;
    const error = saveArticleDraft({ title: `Re: ${article.title}`, tags: (article.tags || []).join(', '), coverImageUrl: '', excerpt: '', content: `Originally published by @${article.author.handle}:\n\n${url}\n\nMy thoughts:\n`, updatedAt: new Date().toISOString(), postId: null, slug: null, authorId });
    if (error) { setActionError(error); return; }
    window.location.href = '/editor';
  };

  const totalUserUpvotes = useMemo(
    () => Object.values(voteStatsMap).filter(s => s.userVote === 1).length,
    [voteStatsMap]
  );

  return (
    <div className="pn-mobile-feed w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {actionError && <p role="alert" className="text-sm text-red-700 p-3 rounded-xl bg-red-50">{actionError}</p>}
      {voteError && <p role="alert" className="text-sm text-red-700 p-3 rounded-xl bg-red-50">{voteError}</p>}
      {/* Main 3-Column Steemit-Inspired Publishing Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ─── LEFT COLUMN: Navigation & Trending Topics (3 cols) ────────── */}
        <aside className="hidden lg:block lg:col-span-3 space-y-4 sticky top-24">
          <div className="pn-panel p-3">
            <nav className="space-y-1" aria-label="Primary Feed Navigation">
              {[
                { key: 'Home' as const, label: 'Home Feed', icon: Home, href: '/' },
                { key: 'Explore' as const, label: 'Explore Topics', icon: Compass, href: '/explore' },
                { key: 'Communities' as const, label: 'Communities', icon: Users, href: '/communities' },
                { key: 'Bookmarks' as const, label: 'Saved Bookmarks', icon: Bookmark, href: '#bookmarks' },
                { key: 'Wallet' as const, label: 'Wallet & Rewards', icon: Wallet, href: '/wallet' },
                { key: 'Profile' as const, label: 'My Profile', icon: UserIcon, href: (keyUser || user) ? '/profile/me' : '#auth' },
              ].map(item => {
                const Icon = item.icon;
                const isActive = activeNav === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => {
                      if (item.key === 'Explore') {
                        window.location.href = '/explore';
                        return;
                      }
                      if (item.key === 'Communities') {
                        window.location.href = '/communities';
                        return;
                      }
                      if (item.key === 'Wallet') {
                        window.location.href = '/wallet';
                        return;
                      }
                      if (item.key === 'Profile') {
                        if (keyUser || user) {
                          window.location.href = '/profile/me';
                        } else {
                          setAuthMode('login');
                          setAuthModalOpen(true);
                        }
                        return;
                      }
                      setActiveNav(item.key);
                    }}
                    className={`pn-nav-item w-full justify-between text-left ${isActive ? 'active' : ''}`}
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </span>
                    {isActive && <ChevronRight className="h-3.5 w-3.5 text-white" />}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Trending Topics */}
          <div className="pn-panel p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-3.5 w-3.5 text-[#007C8B]" />
              <h4 className="pn-label">Trending Topics</h4>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {trendingTags.map(tag => (
                <a
                  key={tag}
                  href={`/explore?tag=${encodeURIComponent(tag.toLowerCase())}`}
                  className="pn-pill"
                >
                  <span className="text-[#007C8B]">#</span>
                  <span>{tag}</span>
                </a>
              ))}
            </div>
          </div>
        </aside>

        {/* ─── CENTER COLUMN: Editorial Feed (6 cols) ─────────────────────── */}
        <main className="col-span-1 lg:col-span-6 min-w-0 space-y-4">
          <form className="pn-mobile-feed-search md:hidden" action="/explore" role="search">
            <Search size={19} aria-hidden="true" />
            <input type="search" name="q" aria-label="Search blogs, creators, topics" placeholder="Search blogs, creators, topics…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            <button type="submit" aria-label="Submit search"><ArrowRight size={18} /></button>
          </form>

          {/* Section Header: Recommended for you */}
          <div className="hidden md:flex items-center justify-between pt-1">
            <h3 className="font-serif font-bold text-sm sm:text-base text-[#0A2540]">
              Recommended for you
            </h3>
            <a href="/explore" className="text-xs font-semibold text-[#007C8B] hover:underline">
              See all
            </a>
          </div>

          <div className="pn-tabs" role="tablist" aria-label="Feed categories">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={activeCategory === cat && activeNav !== 'Bookmarks'}
                onClick={() => {
                  setActiveNav('Home');
                  setActiveCategory(cat);
                }}
                className={`pn-tab ${['For You', 'Following', 'Hot', 'New'].includes(cat) ? 'pn-primary-tab' : 'pn-topic-tab'}`}
              >
                {cat === 'Hot' && <Flame size={15} aria-hidden="true" />}
                {cat === 'New' && <Sparkles size={15} aria-hidden="true" />}
                {cat}
              </button>
            ))}
          </div>

          {/* Articles Feed */}
          {loading ? (
            <div className="pn-card p-14 flex flex-col items-center justify-center gap-3 text-[#4A5B70]">
              <PenoraEmblem size={42} className="pn-emblem-breathe" />
              <p className="text-xs font-medium">Syncing PENORA editorial feed…</p>
            </div>
          ) : displayedArticles.length === 0 ? (
            <div className="pn-card p-10 text-center space-y-3">
              <div className="mx-auto w-fit">
                <PenoraLogo variant="app-icon" size="sm" />
              </div>
              <h3 className="pn-h2">No blogs in this view yet</h3>
              <p className="text-xs text-[#4A5B70] max-w-sm mx-auto leading-relaxed">
                {activeNav === 'Bookmarks'
                  ? "You haven't saved any bookmarks yet. Click the bookmark icon on any blog to build your reading list."
                  : 'Be the first creator to publish a longform perspective in this topic.'}
              </p>
              <div className="pt-1">
                <a href="/editor" className="pn-btn pn-btn-brand pn-btn-sm">
                  <span>Write a Blog</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {displayedArticles.map(article => {
                const vStats = voteStatsMap[article.id] ?? {
                  upvotes: 0,
                  downvotes: 0,
                  score: 0,
                  userVote: null,
                };
                const commentsCount = commentsCountMap[article.id] ?? 0;
                const isBookmarked = Boolean(bookmarkedMap[article.id]);

                return (
                  <article
                    key={article.id}
                    className="pn-feed-article pn-card pn-card-interactive p-5 sm:p-6 group"
                  >
                    <div className="pn-mobile-author md:hidden">
                      <a href={`/profile/${article.author.handle}`} className="pn-mobile-author-link">
                        <img src={article.author.avatar} alt="" className="pn-avatar" loading="lazy" />
                        <div className="min-w-0">
                          <div className="pn-mobile-author-name"><span>{article.author.name}</span><span className="pn-mobile-reputation">Rep {article.author.reputation ?? '—'}</span></div>
                          <p>in {article.category} · {article.readTime} · {article.publishedAgo}</p>
                        </div>
                      </a>
                      <button type="button" className="pn-feed-follow pn-btn pn-btn-secondary pn-btn-sm" onClick={() => handleFollow(article.author.handle, article.author.id)}>{followedMap[article.author.handle] ? 'Following' : 'Follow'}</button>
                    </div>
                    <div className="pn-feed-article-body flex flex-col-reverse sm:flex-row gap-4 sm:gap-5 items-stretch sm:items-start">
                      {/* Left: Article Content */}
                      <div className="pn-feed-article-text flex-1 min-w-0 flex flex-col justify-between">
                        {/* Meta Row */}
                        <div className="pn-feed-meta flex items-center gap-2 mb-2.5 flex-wrap">
                          <span className="pn-tag">{article.category}</span>
                          <span className="pn-meta">{article.readTime}</span>
                          <span className="pn-meta">· {article.publishedAgo}</span>
                        </div>

                        {/* Title */}
                        <a
                          href={`/read?slug=${encodeURIComponent(article.slug)}`}
                          className="pn-feed-title block group-hover:text-[#007C8B] transition-colors"
                        >
                          <h2 className="pn-h2 mb-2 group-hover:text-[#007C8B] transition-colors">
                            {article.title}
                          </h2>
                        </a>

                        {/* Excerpt */}
                        <p className="pn-feed-excerpt text-[13.5px] text-[#4A5B70] leading-relaxed line-clamp-2 mb-4">
                          {article.excerpt}
                        </p>

                        <div className="pn-mobile-tags md:hidden">
                          {(article.tags?.length ? article.tags : [article.category]).slice(0, 4).map(tag => <a key={tag} href={`/explore?tag=${encodeURIComponent(tag)}`}>#{tag}</a>)}
                        </div>
                        {/* Author + Engagement Bar */}
                        <div className="pn-feed-footer flex items-center justify-between gap-2 pt-3.5 border-t border-[#0A2540]/8 flex-wrap">
                          {/* Author */}
                          <a
                            href={`/profile/${article.author.handle}`}
                            className="pn-feed-desktop-author flex items-center gap-2.5 group/author min-w-0"
                          >
                            <img
                              src={article.author.avatar}
                              alt={article.author.name}
                              className="pn-avatar h-8 w-8 flex-shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-[#0A2540] group-hover/author:text-[#007C8B] flex items-center gap-1.5 truncate">
                                <span className="truncate">{article.author.name}</span>
                                {article.author.verified && (
                                  <span
                                    className="inline-flex items-center px-1.5 py-0.2 rounded bg-[#EEFBFC] text-[#007C8B] text-[10px] font-semibold border border-[#007C8B]/15"
                                    title="Creator Reputation Score"
                                  >
                                    Rep {article.author.reputation}
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-[#6E7D90] block truncate">
                                @{article.author.handle}
                              </span>
                            </div>
                          </a>


                          {/* Social Curation Actions: Upvote ▲ / Downvote ▼ + Comments + Bookmark + Share */}
                          <div className="pn-feed-actions flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
                            <div className="pn-vote-group" role="group" aria-label="Article voting">
                              {/* Upvote ▲ */}
                              <button
                                type="button"
                                onClick={() => handleVote(article.id, 1)}
                                data-active={vStats.userVote === 1 ? 'true' : 'false'}
                                aria-pressed={vStats.userVote === 1}
                                aria-label={`Upvote (${vStats.upvotes})`}
                                className="pn-vote-btn pn-vote-up"
                                title="Upvote ▲"
                              >
                                <span aria-hidden="true" className="text-[10px] leading-none">
                                  ▲
                                </span>
                                <span>{vStats.upvotes}</span>
                              </button>

                              {/* Downvote ▼ */}
                              <button
                                type="button"
                                onClick={() => handleVote(article.id, -1)}
                                data-active={vStats.userVote === -1 ? 'true' : 'false'}
                                aria-pressed={vStats.userVote === -1}
                                aria-label={`Downvote (${vStats.downvotes})`}
                                className="pn-vote-btn pn-vote-down"
                                title="Downvote ▼"
                              >
                                <span aria-hidden="true" className="text-[10px] leading-none">
                                  ▼
                                </span>
                                <span>{vStats.downvotes}</span>
                              </button>
                            </div>

                            <span
                              className="text-xs font-mono font-medium text-[#4A5E75] select-none cursor-help px-0.5"
                              title={getArticleRewardState(vStats.score).tooltip}
                            >
                              · {getArticleRewardState(vStats.score).displayUsd}
                            </span>

                            {/* Comments */}
                            <a
                              href={`/read?slug=${encodeURIComponent(article.slug)}#comments`}
                              className="pn-icon-btn"
                              title="Read responses"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              <span>{commentsCount}</span>
                            </a>

                            <button type="button" onClick={() => handleReblog(article)} className="pn-icon-btn" title="Reblog with your thoughts" aria-label="Reblog with your thoughts"><Repeat2 className="h-3.5 w-3.5" /></button>
                            {/* Bookmark */}
                            <button
                              type="button"
                              onClick={() => handleBookmark(article.id)}
                              data-active={isBookmarked ? 'true' : 'false'}
                              aria-pressed={isBookmarked}
                              className="pn-icon-btn"
                              title={isBookmarked ? 'Remove bookmark' : 'Bookmark story'}
                            >
                              <Bookmark className={`h-3.5 w-3.5 ${isBookmarked ? 'fill-current text-[#007C8B]' : ''}`} />
                            </button>

                            {/* Share */}
                            <button
                              type="button"
                              onClick={() => handleShare(article.slug, article.id)}
                              className="pn-icon-btn"
                              title="Copy story link"
                            >
                              {copiedId === article.id ? (
                                <Check className="h-3.5 w-3.5 text-[#007C8B]" />
                              ) : (
                                <Share2 className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Right: Cover Image */}
                      <a
                        href={`/read?slug=${encodeURIComponent(article.slug)}`}
                        className="pn-feed-cover w-full sm:w-44 h-44 sm:h-36 rounded-xl sm:rounded-2xl overflow-hidden flex-shrink-0 border border-[#0A2540]/8 relative block"
                      >
                        <img
                          src={article.thumbnail}
                          alt={article.title}
                          className="w-full h-full object-cover group-hover:scale-[1.015] transition-transform duration-200"
                        />
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* Subtle Database Sync Notice at bottom of feed if migration pending */}
          {isPendingMigration && (
            <div className="pn-alert pn-alert-info items-center">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="h-4 w-4 text-[#007C8B] flex-shrink-0" />
                <span>
                  The feed is temporarily unavailable. Please try again shortly.
                </span>
              </div>
            </div>
          )}
        </main>

        {/* ─── RIGHT COLUMN: Brand CTA, Suggested Creators & Communities (3 cols) ─── */}
        <aside className="hidden lg:block lg:col-span-3 min-w-0 space-y-4 sticky top-24">
          {/* Guest Inverse Brand Card OR Authenticated Summary Card */}
          {!user && !keyUser ? (
            <div className="pn-inverse p-6">
              <div className="relative z-10 text-center space-y-2.5 mb-5">
                <div className="mx-auto w-fit mb-1">
                  <PenoraEmblem size={44} theme="dark" />
                </div>
                <div className="text-[10px] font-semibold tracking-[0.24em] uppercase text-[#00E5F4]">
                  Welcome to PENORA
                </div>
                <h3
                  className="text-lg font-semibold text-white leading-snug"
                  style={{ fontFamily: 'var(--pn-font-display)' }}
                >
                  Join the Curation Community
                </h3>
                <p className="text-xs text-[#B8D4E3] leading-relaxed">
                  Earn verifiable reputation, publish longform blogs, and support independent creators.
                </p>
              </div>
              <div className="relative z-10 space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('register');
                    setAuthModalOpen(true);
                  }}
                  className="pn-btn pn-btn-brand pn-btn-block"
                >
                  <span>Create Account</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setAuthModalOpen(true);
                  }}
                  className="w-full py-2 rounded-full text-xs font-semibold text-[#E2F1F8] hover:text-white hover:bg-white/10 transition-colors"
                >
                  Sign In
                </button>
              </div>
            </div>
          ) : (
            <div className="pn-card p-5 space-y-3.5">
              <div className="flex items-center gap-3">
                {profile?.avatar_url && !profile.avatar_url.includes('/brand/penora-avatar-') && !ownAvatarFailed ? (
                  <img src={profile.avatar_url} alt={profile.display_name || profile.username} className="pn-avatar h-10 w-10 object-cover" onError={() => setOwnAvatarFailed(true)} />
                ) : (
                  <span role="img" aria-label="No profile photo uploaded" className="pn-avatar-initials h-10 w-10 text-sm"><UserIcon className="h-5 w-5" aria-hidden="true" /></span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-xs text-[#0A2540] truncate">
                    @{keyUser?.username || user?.email?.split('@')[0]}
                  </div>
                  <div className="text-[11px] text-[#007C8B] font-medium flex items-center gap-1">
                    <span className="pn-status-dot" />
                    <span>
                      {keyUser ? `${keyUser.keyRole.toUpperCase()} KEY · Rep ${profile?.reputation ?? '—'}` : `Reputation: ${profile?.reputation ?? '—'}`}
                    </span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#0A2540]/8 text-center">
                <div className="p-2 rounded-xl bg-[#F4F7FA]">
                  <div className="text-[10px] text-[#6E7D90] font-medium">Saved</div>
                  <div className="font-bold text-sm text-[#0A2540]">
                    {Object.values(bookmarkedMap).filter(Boolean).length}
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-[#F4F7FA]">
                  <div className="text-[10px] text-[#6E7D90] font-medium">Upvotes</div>
                  <div className="font-bold text-sm text-[#0A2540]">
                    {totalUserUpvotes}
                  </div>
                </div>
              </div>
              <a href="/editor" className="pn-btn pn-btn-primary pn-btn-block pn-btn-sm">
                <span>Write New Blog</span>
                <ArrowRight className="h-3.5 w-3.5 text-[#00E5F4]" />
              </a>
            </div>
          )}

          {/* Suggested Creators */}
          <div className="pn-panel p-4">
            <div className="flex items-center justify-between mb-3.5">
              <h4 className="pn-label">Suggested Creators</h4>
              <a href="/explore" className="text-[11px] font-semibold text-[#007C8B] hover:underline">
                View all
              </a>
            </div>
            <div className="space-y-3">
              {suggestedCreators.map(creator => {
                const isFollowed = followedMap[creator.handle];
                return (
                  <div key={creator.handle} className="flex items-center justify-between gap-2.5">
                    <a
                      href={`/profile/${creator.handle}`}
                      className="flex items-center gap-2.5 min-w-0 group"
                    >
                      <img
                        src={creator.avatar}
                        alt={creator.name}
                        className="pn-avatar h-8 w-8 flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#0A2540] group-hover:text-[#007C8B] truncate">
                          {creator.name}
                        </div>
                        <div className="text-[11px] text-[#6E7D90] truncate">
                          @{creator.handle} · <span className="text-[#007C8B] font-medium">Rep {creator.reputation ?? '—'}</span>
                        </div>
                      </div>
                    </a>
                    <button
                      type="button"
                      onClick={() => handleFollow(creator.handle, creator.id)}
                      className={`pn-btn pn-btn-sm ${
                        isFollowed ? 'pn-btn-subtle' : 'pn-btn-secondary'
                      }`}
                    >
                      {isFollowed ? 'Following' : 'Follow'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <section className="pn-panel p-4 space-y-3" aria-label="Writing prompts">
            <div className="flex items-center justify-between"><h4 className="pn-label">Writing Challenges</h4><a href="/editor" className="text-[11px] text-[#007C8B]">Write now</a></div>
            <a href="/editor" className="block rounded-2xl p-3 bg-gradient-to-r from-[#effcff] to-white border border-[#c9eff5]">
              <span className="text-[10px] tracking-wide uppercase text-[#008fa7]">Writing inspiration</span>
              <h3 className="text-sm font-bold text-[#0A2540] mt-1">A More Open Internet</h3>
              <p className="text-xs leading-relaxed text-[#62788f] mt-1">Share your vision for a kinder, more open internet.</p>
            </a>
          </section>
          {/* Active Communities */}
          <div className="pn-panel p-4">
            <div className="flex items-center justify-between mb-3.5">
              <h4 className="pn-label">Community Spotlight</h4>
              <a href="/communities" className="text-[11px] font-semibold text-[#007C8B] hover:underline">
                Directory
              </a>
            </div>
            <div className="space-y-3">
              {communities.map(comm => {
                const isJoined = joinedCommunities[comm.id];
                return (
                  <div key={comm.id} className="flex items-center justify-between gap-2.5">
                    <a
                      href="/communities"
                      className="flex items-center gap-2.5 min-w-0 group"
                    >
                      <img
                        src={comm.avatar_url || '/favicon.svg'}
                        alt={comm.name}
                        className="h-8 w-8 rounded-xl object-cover border border-[#0A2540]/10 flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#0A2540] group-hover:text-[#007C8B] truncate">
                          {comm.name}
                        </div>
                        <div className="text-[11px] text-[#6E7D90]">
                          {(comm.community_memberships?.[0]?.count ?? 0).toLocaleString()} members
                        </div>
                      </div>
                    </a>
                    <button
                      type="button"
                      onClick={() => handleCommunity(comm.id)}
                      className={`pn-btn pn-btn-sm ${
                        isJoined ? 'pn-btn-subtle' : 'pn-btn-primary'
                      }`}
                    >
                      {isJoined ? 'Joined' : 'Join'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>

      {/* Branded Authentication Modal */}
      <SpatialAuthModalV4
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authMode}
        presentation="centered-modal"
      />
    </div>
  );
};
