// src/components/explore/ExploreView.tsx
// PENORA — Unified Search & Discovery Engine
// Supports Creators (Users), Articles, and Communities with real Supabase data.
import React, { useState, useEffect } from 'react';
import type { Topic } from '../../types';
import {
  Search,
  BookOpen,
  ArrowRight,
  Layers,
  Coins,
  Feather,
  Cpu,
  Users,
  ExternalLink,
  User as UserIcon,
  CheckCircle2,
  Sparkles,
  Loader2,
  FileText,
} from 'lucide-react';
import { getPublishedArticles } from '../../lib/api/articles';
import { searchProfiles } from '../../lib/api/profiles';
import type { PostRecord, ProfileRecord } from '../../lib/api/types';

interface ExploreViewProps {
  topics: Topic[];
}

const iconMap: Record<string, React.FC<{ className?: string }>> = {
  Layers,
  Coins,
  Feather,
  Cpu,
};

type SearchTab = 'all' | 'creators' | 'articles' | 'communities';

export const ExploreView: React.FC<ExploreViewProps> = ({ topics }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SearchTab>('all');
  const [matchingArticles, setMatchingArticles] = useState<PostRecord[]>([]);
  const [matchingProfiles, setMatchingProfiles] = useState<ProfileRecord[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Sync with initial URL params
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    const tab = params.get('tab') as SearchTab | null;
    if (q) setSearchQuery(q);
    if (tab && ['all', 'creators', 'articles', 'communities'].includes(tab)) {
      setActiveTab(tab);
    }
  }, []);

  // Debounced search for both users and articles
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setMatchingArticles([]);
      setMatchingProfiles([]);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    const timer = setTimeout(async () => {
      try {
        const [articlesRes, profilesRes] = await Promise.all([
          getPublishedArticles({ search: trimmed, limit: 12 }),
          searchProfiles(trimmed, 12),
        ]);

        setMatchingArticles(articlesRes.data || []);
        setMatchingProfiles(profilesRes.data || []);
        if (profilesRes.error && !articlesRes.data?.length) {
          setSearchError(profilesRes.error);
        }
      } catch (err: any) {
        setSearchError(err.message || 'Error executing search');
      } finally {
        setIsSearching(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filteredTopics = topics.filter((t) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q)
    );
  });

  const totalResults =
    matchingProfiles.length + matchingArticles.length + (searchQuery.trim() ? filteredTopics.length : 0);

  return (
    <div className="w-full max-w-6xl mx-auto px-3.5 sm:px-6 py-8 sm:py-12 space-y-8">
      {/* Editorial Header */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <span className="pn-tag inline-flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-[#007C8B]" />
          <span>Unified Discovery &amp; Search</span>
        </span>
        <h1 className="font-display text-2xl sm:text-4xl md:text-5xl font-bold text-[#0A2540] tracking-tight">
          Explore PENORA
        </h1>
        <p className="text-xs sm:text-sm text-[#4A5E75] leading-relaxed">
          Find verified creators, deep-dive articles, and creator-governed circles.
        </p>

        {/* Global Search Bar */}
        <div className="pt-3 max-w-lg mx-auto">
          <div className="pn-search rounded-2xl h-12 px-4 flex items-center gap-3 bg-white border border-[#0A2540]/12 shadow-sm focus-within:border-[#007C8B] focus-within:ring-2 focus-within:ring-[#007C8B]/15 transition-all">
            <Search className="h-4 w-4 text-[#4A5E75] shrink-0" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by @handle, creator name, article, or guild..."
              className="w-full bg-transparent text-sm text-[#0A2540] placeholder:text-[#7B8FA6] focus:outline-none"
              aria-label="Search creators, articles, and guilds"
            />
            {isSearching ? (
              <Loader2 className="h-4 w-4 text-[#007C8B] animate-spin shrink-0" />
            ) : searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-xs text-[#6E7D90] hover:text-[#0A2540] px-1 font-medium"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Search Category Filter Tabs */}
      {searchQuery.trim() && (
        <div className="flex items-center justify-center gap-1.5 sm:gap-2 flex-wrap border-b border-[#0A2540]/8 pb-4">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'all'
                ? 'bg-[#007C8B] text-white shadow-xs'
                : 'bg-[#F4F7FA] text-[#4A5E75] hover:bg-[#EAEFF5] hover:text-[#0A2540]'
            }`}
          >
            <span>All</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/10 dark:bg-white/20">
              {totalResults}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('creators')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'creators'
                ? 'bg-[#007C8B] text-white shadow-xs'
                : 'bg-[#F4F7FA] text-[#4A5E75] hover:bg-[#EAEFF5] hover:text-[#0A2540]'
            }`}
          >
            <UserIcon className="h-3.5 w-3.5" />
            <span>Creators</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/10">
              {matchingProfiles.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('articles')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'articles'
                ? 'bg-[#007C8B] text-white shadow-xs'
                : 'bg-[#F4F7FA] text-[#4A5E75] hover:bg-[#EAEFF5] hover:text-[#0A2540]'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Articles</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/10">
              {matchingArticles.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('communities')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'communities'
                ? 'bg-[#007C8B] text-white shadow-xs'
                : 'bg-[#F4F7FA] text-[#4A5E75] hover:bg-[#EAEFF5] hover:text-[#0A2540]'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Communities</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/10">
              {filteredTopics.length}
            </span>
          </button>
        </div>
      )}

      {/* Error state */}
      {searchError && (
        <div className="p-4 rounded-xl bg-red-50 text-red-700 text-xs text-center border border-red-200">
          {searchError}
        </div>
      )}

      {/* ─── SECTION 1: CREATORS / USERS RESULTS ─── */}
      {searchQuery.trim() && (activeTab === 'all' || activeTab === 'creators') && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base sm:text-lg font-bold text-[#0A2540] flex items-center gap-2">
              <UserIcon className="h-4 w-4 text-[#007C8B]" />
              <span>Creators &amp; Users</span>
            </h2>
            <span className="text-xs text-[#6E7D90] font-medium">
              {matchingProfiles.length} found
            </span>
          </div>

          {matchingProfiles.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {matchingProfiles.map((p) => {
                const profileHandle = p.username || p.id;
                const displayName = p.display_name || p.username || 'Creator';
                const avatar = p.avatar_url && !p.avatar_url.includes('/brand/penora-avatar-') ? p.avatar_url : null;
                const repScore = p.reputation ?? 25;

                return (
                  <a
                    key={p.id}
                    href={`/profile/${encodeURIComponent(profileHandle)}`}
                    className="p-3.5 rounded-2xl bg-white border border-[#0A2540]/8 hover:border-[#007C8B]/40 hover:shadow-md transition-all flex items-center gap-3 group"
                  >
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      {avatar ? (
                        <img
                          src={avatar}
                          alt={displayName}
                          className="h-11 w-11 rounded-full object-cover ring-2 ring-[#00E5F4]/40"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="h-11 w-11 rounded-full bg-[#E6F7F8] text-[#007C8B] ring-2 ring-[#00E5F4]/40 flex items-center justify-center font-bold text-sm">
                          {displayName.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-[#10B981] ring-2 ring-white" />
                    </div>

                    {/* Details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-[#0A2540] truncate group-hover:text-[#007C8B] transition-colors">
                          {displayName}
                        </span>
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#007C8B] shrink-0" />
                      </div>
                      <div className="text-xs text-[#6E7D90] truncate">
                        @{p.username || 'creator'}
                      </div>
                      {p.bio && (
                        <p className="text-[11px] text-[#52657C] truncate mt-0.5">
                          {p.bio}
                        </p>
                      )}
                    </div>

                    {/* Reputation badge */}
                    <div className="shrink-0 text-right">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#007C8B]/10 text-[#007C8B] border border-[#007C8B]/20">
                        Rep {repScore}
                      </span>
                    </div>
                  </a>
                );
              })}
            </div>
          ) : !isSearching && activeTab === 'creators' ? (
            <div className="p-6 rounded-2xl bg-[#F8FAFC] border border-[#0A2540]/8 text-center text-xs text-[#6E7D90]">
              No creators found matching &ldquo;{searchQuery}&rdquo;. Try searching by username, display name, or handle.
            </div>
          ) : null}
        </div>
      )}

      {/* ─── SECTION 2: ARTICLES RESULTS ─── */}
      {searchQuery.trim() && (activeTab === 'all' || activeTab === 'articles') && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base sm:text-lg font-bold text-[#0A2540] flex items-center gap-2">
              <FileText className="h-4 w-4 text-[#007C8B]" />
              <span>Articles</span>
            </h2>
            <span className="text-xs text-[#6E7D90] font-medium">
              {matchingArticles.length} found
            </span>
          </div>

          {matchingArticles.length > 0 ? (
            <div className="space-y-2.5">
              {matchingArticles.map((p) => (
                <div
                  key={p.id}
                  className="pn-card p-4 rounded-2xl flex items-center justify-between gap-4 hover:border-[#007C8B]/30 hover:shadow-xs transition-all"
                >
                  <div className="min-w-0 flex-1">
                    <span className="pn-tag text-[10px] uppercase mb-1 inline-block">
                      {p.tags?.[0] || 'Article'}
                    </span>
                    <a href={`/read?slug=${encodeURIComponent(p.slug)}`} className="block">
                      <h3 className="text-sm sm:text-base font-bold text-[#0A2540] hover:text-[#007C8B] transition-colors truncate">
                        {p.title}
                      </h3>
                    </a>
                    <p className="text-xs text-[#52657C] line-clamp-1 mt-0.5">
                      {p.excerpt || p.content.slice(0, 130)}
                    </p>
                  </div>
                  <a
                    href={`/read?slug=${encodeURIComponent(p.slug)}`}
                    className="pn-btn pn-btn-secondary pn-btn-sm shrink-0 flex items-center gap-1.5 text-xs"
                  >
                    <span>Read</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ))}
            </div>
          ) : !isSearching && activeTab === 'articles' ? (
            <div className="p-6 rounded-2xl bg-[#F8FAFC] border border-[#0A2540]/8 text-center text-xs text-[#6E7D90]">
              No articles found matching &ldquo;{searchQuery}&rdquo;.
            </div>
          ) : null}
        </div>
      )}

      {/* ─── SECTION 3: COMMUNITIES & GUILDS RESULTS ─── */}
      {(activeTab === 'all' || activeTab === 'communities' || !searchQuery.trim()) && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base sm:text-lg font-bold text-[#0A2540] flex items-center gap-2">
              <Users className="h-4 w-4 text-[#007C8B]" />
              <span>{searchQuery.trim() ? 'Matching Communities' : 'Featured Editorial Circles'}</span>
            </h2>
            <span className="text-xs text-[#6E7D90] font-medium">
              {filteredTopics.length} circles
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {filteredTopics.map((topic) => {
              const Icon = iconMap[topic.iconName] || BookOpen;
              return (
                <div
                  key={topic.id}
                  className="pn-card p-5 sm:p-7 rounded-2xl flex flex-col justify-between hover:border-[#007C8B]/30 hover:shadow-xs transition-all"
                >
                  <div>
                    <div className="flex items-start justify-between gap-4 mb-3 sm:mb-4">
                      <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-[#00E5F4]/15 text-[#007C8B] flex items-center justify-center border border-[#007C8B]/15">
                        <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                      </div>
                      <span className="text-[11px] font-semibold text-[#4A5E75] bg-[#F8FAFC] px-2.5 py-0.5 rounded-full border border-[#0A2540]/10">
                        Rank #{topic.trendingRank}
                      </span>
                    </div>

                    <h3 className="font-display text-lg sm:text-xl font-bold text-[#0A2540] mb-1.5">
                      {topic.name}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#4A5E75] leading-relaxed mb-4">
                      {topic.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[#0A2540]/8 text-xs text-[#4A5E75]">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-3.5 w-3.5 text-[#007C8B]" />
                        <span>{topic.articleCount} articles</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-[#007C8B]" />
                        <span>{topic.followerCount} curators</span>
                      </span>
                    </div>

                    <a
                      href={`/?category=${encodeURIComponent(topic.name)}`}
                      className="pn-btn pn-btn-brand px-3 py-1.5 rounded-full text-[11px] flex items-center gap-1"
                    >
                      <span>Feed</span>
                      <ArrowRight className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Global Empty State (All tabs returned empty) */}
      {searchQuery.trim() && !isSearching && totalResults === 0 && (
        <div className="p-8 rounded-2xl bg-[#F8FAFC] border border-[#0A2540]/8 text-center space-y-2">
          <p className="text-sm font-semibold text-[#0A2540]">
            No results found for &ldquo;{searchQuery}&rdquo;
          </p>
          <p className="text-xs text-[#6E7D90] max-w-md mx-auto">
            Try checking for typos or searching by creator handle (e.g. &ldquo;@fatima&rdquo;), article title keywords, or domain topics.
          </p>
        </div>
      )}
    </div>
  );
};
