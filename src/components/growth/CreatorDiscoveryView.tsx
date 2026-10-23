// src/components/growth/CreatorDiscoveryView.tsx
// PENORA Creator Discovery & Spotlight Showcase
// Discover emerging & established writers, filter by topics, explore curated spotlight stories.

import React, { useState, useEffect } from 'react';
import {
  Compass,
  Search,
  Sparkles,
  Users,
  Award,
  Loader2,
  TrendingUp,
  BookOpen,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { penoraKeyAuth, type PenoraUser } from '../../lib/auth/penoraKeyAuth';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { CreatorSidebar } from '../common/CreatorSidebar';
import { SpatialAuthModalV4 } from '../design-v4/SpatialAuthModalV4';
import { getProfiles } from '../../lib/api/profiles';
import { getSpotlightArticles, getSpotlightCreators, type SpotlightArticle } from '../../lib/api/spotlight';
import { followUser, isFollowing, unfollowUser } from '../../lib/api/follows';
import type { ProfileRecord } from '../../lib/api/types';

export const CreatorDiscoveryView: React.FC = () => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [keyUser, setKeyUser] = useState<PenoraUser | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const [creators, setCreators] = useState<ProfileRecord[]>([]);
  const [spotlightStories, setSpotlightStories] = useState<SpotlightArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTopic, setSelectedTopic] = useState<string>('all');

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

    loadData();

    return () => {
      unsubKey();
      subscription.unsubscribe();
    };
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [cRes, sRes] = await Promise.all([
      getSpotlightCreators(24),
      getSpotlightArticles(3),
    ]);

    const creatorList = cRes.data || [];
    setCreators(creatorList);
    setSpotlightStories(sRes.data || []);

    // Check following status for active user
    const curUserId = penoraKeyAuth.getCurrentUser()?.id;
    if (curUserId && creatorList.length > 0) {
      const statusMap: Record<string, boolean> = {};
      await Promise.all(
        creatorList.map(async c => {
          if (c.id !== curUserId) {
            const following = await isFollowing(curUserId, c.id);
            statusMap[c.id] = following;
          }
        })
      );
      setFollowMap(statusMap);
    }

    setLoading(false);
  };

  const handleFollowToggle = async (creatorId: string) => {
    if (!activeUserId) {
      setAuthModalOpen(true);
      return;
    }

    const currentlyFollowing = followMap[creatorId] || false;
    setFollowBusy(prev => ({ ...prev, [creatorId]: true }));

    if (currentlyFollowing) {
      const res = await unfollowUser(activeUserId, creatorId);
      if (!res.error) {
        setFollowMap(prev => ({ ...prev, [creatorId]: false }));
      }
    } else {
      const res = await followUser(activeUserId, creatorId);
      if (!res.error) {
        setFollowMap(prev => ({ ...prev, [creatorId]: true }));
      }
    }

    setFollowBusy(prev => ({ ...prev, [creatorId]: false }));
  };

  // Extract unique interests/topics from creators
  const allTopics = Array.from(
    new Set(
      creators.flatMap(c => c.interests || []).filter(Boolean)
    )
  ).slice(0, 8);

  const filteredCreators = creators.filter(c => {
    const matchesSearch =
      (c.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      (c.username?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      (c.bio?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

    const matchesTopic =
      selectedTopic === 'all' ||
      (c.interests && c.interests.includes(selectedTopic));

    return matchesSearch && matchesTopic;
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0A2540]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Creator Sidebar Navigation */}
          <div className="hidden lg:block lg:col-span-3 sticky top-20">
            <CreatorSidebar activePage="Creators" />
          </div>

          {/* Main Discover Column */}
          <div className="lg:col-span-9 space-y-8">
            {/* Header Banner */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0A2540] via-[#0E3558] to-[#007C8B] p-6 sm:p-10 text-white shadow-xl">
              <div className="absolute -right-8 -top-8 w-60 h-60 bg-[#00E5F4]/10 rounded-full blur-3xl pointer-events-none" />
              <div className="relative z-10 max-w-2xl space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[#00E5F4] text-xs font-semibold">
                  <Compass className="h-3.5 w-3.5" />
                  <span>Verified Discovery Network</span>
                </div>
                <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
                  Creator Discovery & Spotlight
                </h1>
                <p className="text-sm sm:text-base text-slate-200 leading-relaxed font-light">
                  Explore original essayists, technical architects, and community contributors on PENORA. Creators are ranked transparently by publishing record and community trust.
                </p>
              </div>
            </div>

            {/* Spotlight Stories Section */}
            {spotlightStories.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold text-[#0A2540]">
                    <Sparkles className="h-4 w-4 text-[#007C8B]" />
                    <span>PENORA Spotlight Stories</span>
                  </div>
                  <span className="text-xs text-[#6E7D90]">Curated by organic signal</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {spotlightStories.map(story => (
                    <a
                      key={story.id}
                      href={`/read?slug=${encodeURIComponent(story.slug)}`}
                      className="pn-panel p-4 flex flex-col justify-between hover:border-[#007C8B]/40 hover:shadow-md transition-all group bg-white"
                    >
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-[#007C8B] uppercase tracking-wider block">
                          Spotlight Selection
                        </span>
                        <h3 className="text-sm font-bold text-[#0A2540] group-hover:text-[#007C8B] transition-colors line-clamp-2">
                          {story.title}
                        </h3>
                        {story.excerpt && (
                          <p className="text-xs text-[#6E7D90] line-clamp-2">
                            {story.excerpt}
                          </p>
                        )}
                      </div>

                      <div className="pt-3 mt-3 border-t border-[#0A2540]/5 flex items-center justify-between text-[11px] text-[#6E7D90]">
                        <span className="truncate max-w-[120px] font-medium text-[#0A2540]">
                          {story.author?.display_name || story.author?.username || 'Writer'}
                        </span>
                        <div className="flex items-center gap-1 text-[#007C8B] group-hover:translate-x-0.5 transition-transform">
                          <span>Read</span>
                          <ArrowRight className="h-3 w-3" />
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Search and Filters */}
            <div className="pn-panel p-4 sm:p-5 bg-white space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="h-4 w-4 text-[#6E7D90] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search writers by name, handle, or bio..."
                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-[#0A2540]/10 text-xs text-[#0A2540] placeholder-[#6E7D90] focus:outline-none focus:ring-2 focus:ring-[#007C8B]"
                  />
                </div>

                <div className="text-xs text-[#6E7D90] font-medium shrink-0 self-center">
                  Showing {filteredCreators.length} creators
                </div>
              </div>

              {/* Topic Pills */}
              {allTopics.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setSelectedTopic('all')}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                      selectedTopic === 'all'
                        ? 'bg-[#007C8B] text-white shadow-sm'
                        : 'bg-[#F0F5F8] text-[#52657C] hover:bg-[#E2ECF2]'
                    }`}
                  >
                    All Topics
                  </button>
                  {allTopics.map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSelectedTopic(t)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                        selectedTopic === t
                          ? 'bg-[#007C8B] text-white shadow-sm'
                          : 'bg-[#F0F5F8] text-[#52657C] hover:bg-[#E2ECF2]'
                      }`}
                    >
                      #{t}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Creators Grid */}
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center text-[#6E7D90] space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-[#007C8B]" />
                <p className="text-sm font-medium">Discovering PENORA creators...</p>
              </div>
            ) : filteredCreators.length === 0 ? (
              <div className="pn-panel p-12 text-center space-y-3 bg-white">
                <Users className="h-10 w-10 text-[#6E7D90] mx-auto opacity-50" />
                <h3 className="text-base font-bold text-[#0A2540]">No creators found</h3>
                <p className="text-xs text-[#6E7D90] max-w-sm mx-auto">
                  No writers found matching &ldquo;{searchQuery}&rdquo;. Try another name or topic.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredCreators.map(creator => {
                  const isCurUser = creator.id === activeUserId;
                  const isFollowingCreator = followMap[creator.id] || false;
                  const busy = followBusy[creator.id] || false;
                  const rep = creator.reputation || 25;

                  return (
                    <div
                      key={creator.id}
                      className="pn-panel p-5 bg-white flex flex-col justify-between hover:border-[#007C8B]/40 hover:shadow-md transition-all space-y-4"
                    >
                      <div className="space-y-3">
                        {/* Avatar & Follow Button */}
                        <div className="flex items-start justify-between gap-3">
                          <a
                            href={`/profile/${creator.username}`}
                            className="flex items-center gap-3 min-w-0 group"
                          >
                            {creator.avatar_url ? (
                              <img
                                src={creator.avatar_url}
                                alt={creator.username}
                                className="h-12 w-12 rounded-full object-cover shrink-0 ring-2 ring-[#007C8B]/20"
                              />
                            ) : (
                              <div className="h-12 w-12 rounded-full bg-gradient-to-tr from-[#007C8B] to-[#00E5F4] text-white font-bold text-sm flex items-center justify-center shrink-0">
                                {creator.username[0]?.toUpperCase() || 'P'}
                              </div>
                            )}

                            <div className="min-w-0">
                              <span className="block text-sm font-bold text-[#0A2540] truncate group-hover:text-[#007C8B] transition-colors">
                                {creator.display_name || creator.username}
                              </span>
                              <span className="block text-xs text-[#6E7D90] truncate">
                                @{creator.username}
                              </span>
                            </div>
                          </a>

                          {!isCurUser && (
                            <button
                              type="button"
                              onClick={() => handleFollowToggle(creator.id)}
                              disabled={busy}
                              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 ${
                                isFollowingCreator
                                  ? 'bg-[#F0F5F8] text-[#52657C] hover:bg-[#E2ECF2]'
                                  : 'bg-[#007C8B] text-white hover:bg-[#00E5F4] hover:text-[#0A2540] shadow-sm'
                              }`}
                            >
                              {busy ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : isFollowingCreator ? (
                                'Following'
                              ) : (
                                'Follow'
                              )}
                            </button>
                          )}
                        </div>

                        {/* Bio */}
                        {creator.bio && (
                          <p className="text-xs text-[#52657C] line-clamp-2 leading-relaxed">
                            {creator.bio}
                          </p>
                        )}
                      </div>

                      {/* Footer Badge & Interests */}
                      <div className="pt-3 border-t border-[#0A2540]/5 flex items-center justify-between text-xs">
                        <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#007C8B] bg-[#007C8B]/8 px-2.5 py-1 rounded-full">
                          <Award className="h-3 w-3" />
                          <span>Rep {rep}</span>
                        </div>

                        <a
                          href={`/profile/${creator.username}`}
                          className="text-xs font-semibold text-[#6E7D90] hover:text-[#007C8B] transition-colors flex items-center gap-1"
                        >
                          <span>Profile</span>
                          <ArrowRight className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Auth Modal */}
      <SpatialAuthModalV4
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode="login"
      />
    </div>
  );
};
