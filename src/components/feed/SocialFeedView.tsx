import React, { useState } from 'react';
import type { Article, Topic, Community } from '../../types';
import { CompactPostCard } from './CompactPostCard';
import { LeftSidebar } from '../layout/LeftSidebar';
import { RightSidebar } from '../layout/RightSidebar';
import { TrendingUp, Sparkles, Clock, Flame, Users, Filter, SlidersHorizontal, Info } from 'lucide-react';

interface SocialFeedViewProps {
  articles: Article[];
  topics: Topic[];
  communities: Community[];
  initialTab?: string;
}

export const SocialFeedView: React.FC<SocialFeedViewProps> = ({
  articles,
  topics,
  communities,
  initialTab = 'explore',
}) => {
  const [activeTab, setActiveTab] = useState<'explore' | 'all' | 'following' | 'trending' | 'new'>(
    (initialTab as any) || 'explore'
  );
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'trending' | 'new' | 'payout'>('trending');

  // Filter articles based on tab, tag, and sort
  let filteredArticles = [...articles];

  if (selectedTag) {
    filteredArticles = filteredArticles.filter(a =>
      a.tags.some(t => t.toLowerCase() === selectedTag.toLowerCase()) ||
      a.topic.toLowerCase().includes(selectedTag.toLowerCase())
    );
  } else if (activeTab === 'following') {
    // Simulated following feed (articles by followed authors)
    filteredArticles = filteredArticles.filter(a =>
      a.author.handle === 'erostova' || a.author.handle === 'mateenfatima'
    );
  }

  // Sort
  if (sortOrder === 'new') {
    filteredArticles.reverse();
  } else if (sortOrder === 'payout') {
    filteredArticles.sort((a, b) => b.stats.reputationPoints - a.stats.reputationPoints);
  } else {
    // trending
    filteredArticles.sort((a, b) => b.stats.votesCount - a.stats.votesCount);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      
      {/* 3-Column Desktop Layout (Left Sidebar, Center Social Feed, Right Sidebar) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Navigation & Subscriptions (Steemit-style) */}
        <div className="hidden lg:block lg:col-span-3 sticky top-20">
          <LeftSidebar
            currentTab={activeTab}
            onSelectTab={(tab: string) => {
              setActiveTab(tab as any);
              setSelectedTag(null);
            }}
            communities={communities}
          />
        </div>

        {/* CENTER COLUMN: Real Social Publishing Feed */}
        <main className="lg:col-span-6 space-y-4">
          
          {/* Feed Header Bar (Matching Steemit "All posts | Trending dropdown") */}
          <div className="rounded-2xl bg-white/85 backdrop-blur-md border border-white/90 p-4 shadow-spatial-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-lg font-bold text-penora-cocoa">
                {selectedTag
                  ? `Posts tagged #${selectedTag}`
                  : activeTab === 'following'
                  ? 'My Friends Feed'
                  : activeTab === 'all'
                  ? 'All Posts'
                  : 'Explore Feed'}
              </h1>
              {selectedTag && (
                <button
                  type="button"
                  onClick={() => setSelectedTag(null)}
                  className="text-[11px] text-penora-coral hover:underline"
                >
                  Clear filter
                </button>
              )}
            </div>

            {/* Sort Controls (Matching Steemit "Trending / New / Hot" dropdown) */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-penora-cocoa/5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setSortOrder('trending')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                  sortOrder === 'trending'
                    ? 'bg-white text-penora-cocoa shadow-sm'
                    : 'text-penora-cocoa-muted hover:text-penora-cocoa'
                }`}
              >
                <Flame className="h-3.5 w-3.5 text-penora-coral" />
                <span>Trending</span>
              </button>
              <button
                type="button"
                onClick={() => setSortOrder('new')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                  sortOrder === 'new'
                    ? 'bg-white text-penora-cocoa shadow-sm'
                    : 'text-penora-cocoa-muted hover:text-penora-cocoa'
                }`}
              >
                <Clock className="h-3.5 w-3.5 text-penora-mint" />
                <span>New</span>
              </button>
              <button
                type="button"
                onClick={() => setSortOrder('payout')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                  sortOrder === 'payout'
                    ? 'bg-white text-penora-cocoa shadow-sm'
                    : 'text-penora-cocoa-muted hover:text-penora-cocoa'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 text-penora-coral" />
                <span>Top Rep</span>
              </button>
            </div>
          </div>

          {/* Steemit-style preview disclaimer banner */}
          <div className="p-3 px-4 rounded-xl bg-penora-peach-light/40 border border-penora-peach/30 flex items-center justify-between text-xs text-penora-cocoa">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-penora-coral flex-shrink-0" />
              <span>
                <strong>Curated Feed:</strong> Raised cards, peer upvotes, and non-cash curation points.
              </span>
            </div>
            <span className="text-[11px] font-mono text-penora-mint font-bold hidden sm:inline">
              {filteredArticles.length} Dispatches
            </span>
          </div>

          {/* Stream of Compact 3D Post Cards */}
          <div className="space-y-3.5">
            {filteredArticles.map((article) => (
              <CompactPostCard
                key={article.id}
                article={article}
                onTagClick={(tag) => setSelectedTag(tag)}
              />
            ))}
          </div>

          {filteredArticles.length === 0 && (
            <div className="p-12 text-center rounded-2xl bg-white/70 border border-white/80">
              <p className="text-sm text-penora-cocoa-muted mb-2">No articles match this criteria yet.</p>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('explore');
                  setSelectedTag(null);
                }}
                className="text-xs font-semibold text-penora-mint hover:underline"
              >
                Reset to Explore Feed
              </button>
            </div>
          )}

        </main>

        {/* RIGHT COLUMN: Tags, Announcements, Curators */}
        <div className="hidden lg:block lg:col-span-3 sticky top-20">
          <RightSidebar
            topics={topics}
            onSelectTag={(tag) => setSelectedTag(tag)}
          />
        </div>

      </div>
    </div>
  );
};
