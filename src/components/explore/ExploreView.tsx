// src/components/explore/ExploreView.tsx
// PENORA Blockchain Brand Suite & UI/UX System
// Browsing topics, trending categories, and editorial circles.
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
} from 'lucide-react';
import { getPublishedArticles } from '../../lib/api/articles';
import type { PostRecord } from '../../lib/api/types';

interface ExploreViewProps {
  topics: Topic[];
}

const iconMap: Record<string, React.FC<{ className?: string }>> = {
  Layers,
  Coins,
  Feather,
  Cpu,
};

export const ExploreView: React.FC<ExploreViewProps> = ({ topics }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [matchingArticles, setMatchingArticles] = useState<PostRecord[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const q = new URLSearchParams(window.location.search).get('q');
    if (q) setSearchQuery(q);
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setMatchingArticles([]);
      return;
    }

    const timer = setTimeout(() => {
      setIsSearching(true);
      getPublishedArticles({ search: searchQuery.trim(), limit: 10 }).then(res => {
        setIsSearching(false);
        if (res.data) setMatchingArticles(res.data);
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filteredTopics = topics.filter(t => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-10">
      {/* Editorial Header */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <span className="pn-tag">
          Community Architecture
        </span>
        <h1 className="font-display text-3xl sm:text-5xl font-bold text-[#0A2540] tracking-tight">
          Explore Niche Circles
        </h1>
        <p className="text-xs sm:text-sm text-[#4A5E75] leading-relaxed">
          Communities in PENORA are self-governing editorial domains. Writers build shared reputation and curate domain-specific feeds together.
        </p>

        {/* Search Input */}
        <div className="pt-4 max-w-md mx-auto">
          <div className="pn-search rounded-full h-11 px-4 flex items-center gap-3">
            <Search className="h-4 w-4 text-[#4A5E75] flex-shrink-0" />
            <input
              type="search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search topics, guilds, or concepts..."
              className="w-full bg-transparent text-xs text-[#0A2540] placeholder:text-[#7B8FA6] focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Live Search Results (Real Published Articles) */}
      {searchQuery.trim() && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-[#0A2540]">
              Articles matching "{searchQuery}"
            </h2>
            <span className="text-xs text-[#4A5E75]">
              {isSearching ? 'Searching…' : `${matchingArticles.length} found`}
            </span>
          </div>

          {matchingArticles.length > 0 ? (
            <div className="space-y-3">
              {matchingArticles.map(p => (
                <div key={p.id} className="pn-card pn-card-interactive p-4 flex items-center justify-between gap-4">
                  <div>
                    <span className="pn-tag text-[10px] uppercase mb-1 inline-block">{p.tags?.[0] || 'Article'}</span>
                    <a href={`/read?slug=${encodeURIComponent(p.slug)}`}>
                      <h3 className="pn-h3 text-base hover:text-[#007C8B] transition-colors">{p.title}</h3>
                    </a>
                    <p className="text-xs text-[#4A5B70] line-clamp-1 mt-0.5">{p.excerpt || p.content.slice(0, 120)}</p>
                  </div>
                  <a href={`/read?slug=${encodeURIComponent(p.slug)}`} className="pn-btn pn-btn-secondary pn-btn-sm flex-shrink-0">
                    <span>Read</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ))}
            </div>
          ) : !isSearching ? (
            <div className="pn-card p-6 text-center text-xs text-[#4A5E75]">
              No published articles matched "{searchQuery}". Try exploring topics below.
            </div>
          ) : null}
        </div>
      )}

      {/* Featured Spatial Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredTopics.map(topic => {
          const Icon = iconMap[topic.iconName] || BookOpen;
          return (
            <div
              key={topic.id}
              className="pn-card pn-card-interactive p-7 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="h-12 w-12 rounded-2xl bg-[#00E5F4]/15 text-[#007C8B] flex items-center justify-center border border-[#007C8B]/15">
                    <Icon className="h-6 w-6" />
                  </div>
                  <span className="text-[11px] font-semibold text-[#4A5E75] bg-[#F8FAFC] px-3 py-1 rounded-full border border-[#0A2540]/10">
                    Trending #{topic.trendingRank}
                  </span>
                </div>

                <h2 className="font-display text-xl font-bold text-[#0A2540] mb-2">
                  {topic.name}
                </h2>
                <p className="text-xs sm:text-sm text-[#4A5E75] leading-relaxed mb-6">
                  {topic.description}
                </p>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[#0A2540]/8 text-xs text-[#4A5E75]">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5 text-[#007C8B]" />
                    <span>{topic.articleCount} articles</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-[#007C8B]" />
                    <span>{topic.followerCount} curators</span>
                  </span>
                </div>

                <a
                  href={`/?category=${encodeURIComponent(topic.name)}`}
                  className="pn-btn pn-btn-brand px-3.5 py-1.5 rounded-full text-[11px]"
                >
                  <span>Explore Feed</span>
                  <ArrowRight className="h-3 w-3" />
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
