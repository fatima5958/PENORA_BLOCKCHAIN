import React, { useState } from 'react';
import type { Article } from '../../types';
import { ArticleCard } from './ArticleCard';
import { FeedFilterTabs } from './FeedFilterTabs';
import { SpatialBadge } from '../3d/SpatialBadge';
import { Info, Sparkles, Filter } from 'lucide-react';

interface FeedSectionProps {
  articles: Article[];
  showTitle?: boolean;
}

export const FeedSection: React.FC<FeedSectionProps> = ({
  articles,
  showTitle = true,
}) => {
  const [selectedTopic, setSelectedTopic] = useState('All');

  const topics = ['All', 'Spatial Computing', 'Creator Economics', 'Editorial Craft', 'Decentralized Systems'];

  const filteredArticles = selectedTopic === 'All'
    ? articles
    : articles.filter(a => a.topic.toLowerCase() === selectedTopic.toLowerCase());

  return (
    <section className="py-12 px-4 sm:px-6 relative">
      <div className="max-w-6xl mx-auto">
        
        {/* Header and filters */}
        {showTitle && (
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <SpatialBadge variant="coral" size="sm" dot>
                  Live Curation Feed
                </SpatialBadge>
                <span className="text-[11px] font-semibold text-penora-cocoa-muted bg-white/70 px-2.5 py-0.5 rounded-full border border-white/80">
                  Preview Mode
                </span>
              </div>
              <h2 className="font-serif text-3xl sm:text-4xl font-bold text-penora-cocoa tracking-tight">
                Dispatches from the Spatial Vanguard
              </h2>
            </div>

            <FeedFilterTabs
              categories={topics}
              selectedCategory={selectedTopic}
              onSelectCategory={setSelectedTopic}
            />
          </div>
        )}

        {/* Demo Disclaimer Pill Bar */}
        <div className="mb-8 p-3 px-4 rounded-2xl bg-penora-peach-light/40 border border-penora-peach/30 flex items-center justify-between text-xs text-penora-cocoa">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-penora-coral flex-shrink-0" />
            <span>
              <strong>Phase 1 In-App Feed Preview:</strong> Articles, upvotes, and reputation points below are realistic mock demonstrations. Real Supabase persistence is scheduled for Phase 2.
            </span>
          </div>
          <span className="hidden sm:inline font-semibold text-penora-coral whitespace-nowrap">
            {filteredArticles.length} Stories Loaded
          </span>
        </div>

        {/* 3D Article Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {filteredArticles.map((article, index) => (
            <ArticleCard
              key={article.id}
              article={article}
              featured={index === 0 && selectedTopic === 'All'}
            />
          ))}
        </div>

        {filteredArticles.length === 0 && (
          <div className="text-center py-16 rounded-3xl liquid-glass">
            <p className="text-penora-cocoa-muted text-sm">No preview articles under this category yet.</p>
          </div>
        )}

      </div>
    </section>
  );
};
