// src/components/feed/FollowingFeedView.tsx
// PENORA — Following Feed
// Displays real published articles exclusively from creators followed by the user.

import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  Compass,
  ArrowRight,
  Clock,
  Sparkles,
  Loader2,
  RefreshCw,
  Repeat,
  MessageSquare,
  Bookmark,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { penoraKeyAuth, type PenoraUser } from '../../lib/auth/penoraKeyAuth';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { getFollowingArticles } from '../../lib/api/articles';
import { getProfiles } from '../../lib/api/profiles';
import { followUser, isFollowing, unfollowUser } from '../../lib/api/follows';
import { CreatorSidebar } from '../common/CreatorSidebar';
import { SpatialAuthModalV4 } from '../design-v4/SpatialAuthModalV4';
import type { PostRecord, ProfileRecord } from '../../lib/api/types';

export const FollowingFeedView: React.FC = () => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [keyUser, setKeyUser] = useState<PenoraUser | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageOffset, setPageOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // Suggested creators for zero-state
  const [suggestedCreators, setSuggestedCreators] = useState<ProfileRecord[]>([]);
  const [followMap, setFollowMap] = useState<Record<string, boolean>>({});
  const [followBusy, setFollowBusy] = useState<Record<string, boolean>>({});

  const activeUserId = keyUser?.id || user?.id || null;

  useEffect(() => {
    const unsubKey = penoraKeyAuth.subscribe(ku => setKeyUser(ku));
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

  const loadFeed = async (userId: string | null, offset = 0, append = false) => {
    if (!userId) {
      setLoading(false);
      setPosts([]);
      return;
    }

    if (offset === 0) setLoading(true);
    else setLoadingMore(true);
    setError(null);

    try {
      const res = await getFollowingArticles(userId, { limit: 12, offset });
      if (res.error) {
        setError(res.error);
      } else {
        const fetched = res.data || [];
        setPosts(prev => (append ? [...prev, ...fetched] : fetched));
        setHasMore(fetched.length === 12);
        setPageOffset(offset + fetched.length);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load following feed');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadFeed(activeUserId, 0, false);

    // If zero follows or loading empty state, also load suggested creators
    getProfiles({ limit: 6 }).then((res: { data: ProfileRecord[]; error: string | null }) => {
      if (res.data) {
        setSuggestedCreators(res.data.filter((p: ProfileRecord) => p.id !== activeUserId));
      }
    });
  }, [activeUserId]);

  const handleFollowCreator = async (creatorId: string) => {
    if (!activeUserId) {
      setAuthModalOpen(true);
      return;
    }
    setFollowBusy(prev => ({ ...prev, [creatorId]: true }));
    const currentlyFollowing = followMap[creatorId] || false;
    try {
      if (currentlyFollowing) {
        await unfollowUser(activeUserId, creatorId);
        setFollowMap(prev => ({ ...prev, [creatorId]: false }));
      } else {
        await followUser(activeUserId, creatorId);
        setFollowMap(prev => ({ ...prev, [creatorId]: true }));
        // Refresh feed after following a new creator
        setTimeout(() => loadFeed(activeUserId, 0, false), 600);
      }
    } finally {
      setFollowBusy(prev => ({ ...prev, [creatorId]: false }));
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Sidebar on Desktop */}
        <aside className="hidden lg:block lg:col-span-3">
          <CreatorSidebar activePage="Following" />
        </aside>

        {/* Main Feed Column */}
        <main className="lg:col-span-9 space-y-6">
          {/* Header Banner */}
          <div className="pn-panel p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#007C8B]/10 text-[#007C8B] text-xs font-semibold uppercase tracking-wider mb-2">
                <UserCheck className="h-3.5 w-3.5" />
                <span>Curated Circle</span>
              </div>
              <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#0A2540]">
                Following Feed
              </h1>
              <p className="text-sm text-[#52657C] mt-1">
                Real-time stories, longform essays, and updates exclusively from creators you follow.
              </p>
            </div>

            {activeUserId && (
              <button
                type="button"
                onClick={() => loadFeed(activeUserId, 0, false)}
                disabled={loading}
                className="pn-btn pn-btn-ghost self-start sm:self-center text-xs gap-1.5"
                title="Refresh feed"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            )}
          </div>

          {/* Not Logged In State */}
          {!activeUserId && (
            <div className="pn-panel p-8 sm:p-12 text-center space-y-4">
              <div className="h-14 w-14 rounded-2xl bg-[#007C8B]/10 text-[#007C8B] flex items-center justify-center mx-auto">
                <UserCheck className="h-7 w-7" />
              </div>
              <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#0A2540]">
                Sign in to see your personalized following feed
              </h2>
              <p className="text-sm text-[#52657C] max-w-md mx-auto">
                Follow your favorite writers and researchers to curate an algorithmic-free, high-signal stream of ideas.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setAuthModalOpen(true)}
                  className="pn-btn pn-btn-brand"
                >
                  <span>Sign In / Connect Keys</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Loading State */}
          {activeUserId && loading && (
            <div className="pn-panel p-12 text-center space-y-3">
              <Loader2 className="h-8 w-8 text-[#007C8B] animate-spin mx-auto" />
              <p className="text-sm text-[#52657C]">Loading your creators' stories…</p>
            </div>
          )}

          {/* Error State */}
          {activeUserId && !loading && error && (
            <div className="pn-panel p-6 border-red-200 bg-red-50 text-red-800 text-sm">
              {error}
            </div>
          )}

          {/* Empty State: Zero Follows or Zero Posts */}
          {activeUserId && !loading && posts.length === 0 && (
            <div className="space-y-6">
              <div className="pn-panel p-8 sm:p-10 text-center space-y-3">
                <div className="h-12 w-12 rounded-full bg-[#007C8B]/10 text-[#007C8B] flex items-center justify-center mx-auto">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h3 className="font-serif text-lg font-bold text-[#0A2540]">
                  No stories in your following feed yet
                </h3>
                <p className="text-xs sm:text-sm text-[#52657C] max-w-md mx-auto">
                  You haven't followed any creators who have published stories yet, or your followed creators haven't posted recently.
                </p>
                <div className="pt-2">
                  <a href="/explore" className="pn-btn pn-btn-secondary pn-btn-sm inline-flex items-center gap-1.5">
                    <Compass className="h-3.5 w-3.5" />
                    <span>Explore Authors & Topics</span>
                  </a>
                </div>
              </div>

              {/* Suggested Creators Section */}
              {suggestedCreators.length > 0 && (
                <div className="pn-panel p-6 space-y-4">
                  <h4 className="font-serif text-base font-bold text-[#0A2540]">
                    Suggested Creators on PENORA
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {suggestedCreators.map(creator => {
                      const isF = followMap[creator.id] || false;
                      const busy = followBusy[creator.id] || false;
                      return (
                        <div
                          key={creator.id}
                          className="flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-[#0A2540]/8 bg-white"
                        >
                          <a
                            href={`/profile/${creator.username}`}
                            className="flex items-center gap-3 min-w-0 group"
                          >
                            {creator.avatar_url ? (
                              <img
                                src={creator.avatar_url}
                                alt={creator.username}
                                className="h-10 w-10 rounded-full object-cover shrink-0 ring-1 ring-[#007C8B]/20"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-[#007C8B] to-[#00E5F4] text-white font-bold text-xs flex items-center justify-center shrink-0">
                                {creator.username[0]?.toUpperCase() || 'P'}
                              </div>
                            )}
                            <div className="min-w-0">
                              <span className="block text-xs font-bold text-[#0A2540] truncate group-hover:text-[#007C8B]">
                                {creator.display_name || creator.username}
                              </span>
                              <span className="block text-[11px] text-[#6E7D90] truncate">
                                @{creator.username} · Rep {creator.reputation || 25}
                              </span>
                            </div>
                          </a>

                          <button
                            type="button"
                            onClick={() => handleFollowCreator(creator.id)}
                            disabled={busy}
                            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors shrink-0 ${
                              isF
                                ? 'bg-[#F0F5F8] text-[#52657C]'
                                : 'bg-[#007C8B] text-white hover:bg-[#00E5F4] hover:text-[#0A2540]'
                            }`}
                          >
                            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : isF ? 'Following' : 'Follow'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Posts Feed */}
          {activeUserId && !loading && posts.length > 0 && (
            <div className="space-y-4">
              {posts.map(post => {
                const author = post.author;
                const authorName = author?.display_name || author?.username || 'Creator';
                const authorHandle = author?.username || 'author';
                const authorAvatar = author?.avatar_url || '';
                const dateStr = post.created_at ? new Date(post.created_at).toLocaleDateString() : '';

                return (
                  <article
                    key={post.id}
                    className="pn-panel p-5 sm:p-6 transition-all hover:border-[#007C8B]/30 hover:shadow-md space-y-4"
                  >
                    {/* Author Byline */}
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <a href={`/profile/${authorHandle}`} className="flex items-center gap-2.5 group">
                        {authorAvatar ? (
                          <img
                            src={authorAvatar}
                            alt={authorName}
                            className="h-8 w-8 rounded-full object-cover ring-1 ring-[#007C8B]/20 shrink-0"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-[#007C8B] to-[#00E5F4] text-white font-bold text-xs flex items-center justify-center shrink-0">
                            {authorName[0]?.toUpperCase() || 'P'}
                          </div>
                        )}
                        <div>
                          <span className="font-semibold text-[#0A2540] group-hover:text-[#007C8B]">
                            {authorName}
                          </span>
                          <span className="text-[#6E7D90] ml-1.5 font-normal">
                            @{authorHandle} · {dateStr}
                          </span>
                        </div>
                      </a>

                      {post.tags && post.tags.length > 0 && (
                        <span className="pn-tag text-[10px] hidden sm:inline-block">
                          {post.tags[0]}
                        </span>
                      )}
                    </div>

                    {/* Story Title & Excerpt */}
                    <div className="space-y-2">
                      <a
                        href={`/read?slug=${encodeURIComponent(post.slug || post.id)}`}
                        className="block font-serif text-lg sm:text-xl font-bold text-[#0A2540] hover:text-[#007C8B] transition-colors leading-snug"
                      >
                        {post.title}
                      </a>
                      {post.excerpt && (
                        <p className="text-xs sm:text-sm text-[#4A5B70] leading-relaxed line-clamp-2">
                          {post.excerpt}
                        </p>
                      )}
                    </div>

                    {/* Cover Preview if present */}
                    {post.cover_image_url && (
                      <a
                        href={`/read?slug=${encodeURIComponent(post.slug || post.id)}`}
                        className="block overflow-hidden rounded-2xl aspect-[21/9] sm:aspect-[24/9] bg-black/[0.02]"
                      >
                        <img
                          src={post.cover_image_url}
                          alt={post.title}
                          className="w-full h-full object-cover transition-transform duration-300 hover:scale-[1.02]"
                        />
                      </a>
                    )}

                    {/* Engagement Actions */}
                    <div className="flex items-center justify-between pt-3 border-t border-[#0A2540]/6 text-xs text-[#6E7D90]">
                      <div className="flex items-center gap-4">
                        <span className="inline-flex items-center gap-1 font-semibold text-[#007C8B]">
                          <span aria-hidden="true" className="text-[10px]">▲</span>
                          <span>Upvote</span>
                        </span>
                        <a
                          href={`/read?slug=${encodeURIComponent(post.slug || post.id)}#comments`}
                          className="inline-flex items-center gap-1 hover:text-[#007C8B]"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          <span>Discuss</span>
                        </a>
                      </div>

                      <a
                        href={`/read?slug=${encodeURIComponent(post.slug || post.id)}`}
                        className="inline-flex items-center gap-1 text-[#007C8B] font-semibold hover:underline"
                      >
                        <span>Read Story</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </article>
                );
              })}

              {/* Pagination */}
              {hasMore && (
                <div className="text-center pt-4">
                  <button
                    type="button"
                    onClick={() => loadFeed(activeUserId, pageOffset, true)}
                    disabled={loadingMore}
                    className="pn-btn pn-btn-secondary pn-btn-sm"
                  >
                    {loadingMore ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <span>Load More Stories</span>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </main>
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
