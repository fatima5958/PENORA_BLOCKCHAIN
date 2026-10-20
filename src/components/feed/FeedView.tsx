import React from 'react';
import type { Article, Topic } from '../../types';
import { FeedSection } from './FeedSection';
import { FloatingCard } from '../3d/FloatingCard';
import { SpatialBadge } from '../3d/SpatialBadge';
import { ReputationIndicator } from './ReputationIndicator';
import { Award, Compass, ShieldAlert } from 'lucide-react';

interface FeedViewProps {
  articles: Article[];
  topics: Topic[];
}

export const FeedView: React.FC<FeedViewProps> = ({ articles, topics }) => {
  return (
    <div className="pt-28 pb-16 px-4 sm:px-6 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <SpatialBadge variant="coral" size="sm" dot>
            Phase 1 In-App Feed Prototype
          </SpatialBadge>
          <span className="text-xs text-penora-cocoa-muted">
            Optimistic client-side voting enabled
          </span>
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-penora-cocoa tracking-tight">
          Curated Dispatches
        </h1>
        <p className="text-penora-cocoa-muted text-sm sm:text-base mt-2 max-w-2xl leading-relaxed">
          Articles ranked by peer reputation consensus rather than sensationalist algorithms. Read, vote, and see non-cash curation points adjust in real time.
        </p>
      </div>

      {/* Main Grid: Articles + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Primary Articles Stream */}
        <div className="lg:col-span-8">
          <FeedSection articles={articles} showTitle={false} />
        </div>

        {/* Spatial Sidebar */}
        <aside className="lg:col-span-4 space-y-6">
          {/* Curators of the Week Card */}
          <FloatingCard depth="sm" className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Award className="h-4 w-4 text-penora-coral" />
              <h3 className="font-serif font-bold text-base text-penora-cocoa">
                Distinguished Curators
              </h3>
            </div>
            <div className="space-y-3.5">
              {articles.slice(0, 3).map(({ author }) => (
                <div key={author.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={author.avatar}
                      alt={author.name}
                      className="h-8 w-8 rounded-full object-cover ring-1 ring-white/80"
                    />
                    <div>
                      <div className="text-xs font-semibold text-penora-cocoa leading-none mb-1">
                        {author.name}
                      </div>
                      <div className="text-[11px] text-penora-cocoa-muted">@{author.handle}</div>
                    </div>
                  </div>
                  <ReputationIndicator score={author.reputationScore} size="sm" />
                </div>
              ))}
            </div>
          </FloatingCard>

          {/* Trending Topics Card */}
          <FloatingCard depth="sm" className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Compass className="h-4 w-4 text-penora-coral" />
              <h3 className="font-serif font-bold text-base text-penora-cocoa">
                Active Topics
              </h3>
            </div>
            <div className="space-y-2.5">
              {topics.map(topic => (
                <a
                  key={topic.id}
                  href={`/explore#${topic.slug}`}
                  className="flex items-center justify-between p-2 rounded-xl hover:bg-penora-cocoa/5 transition-colors group"
                >
                  <div>
                    <div className="text-xs font-semibold text-penora-cocoa group-hover:text-penora-coral transition-colors">
                      {topic.name}
                    </div>
                    <div className="text-[10px] text-penora-cocoa-muted">
                      {topic.articleCount} articles
                    </div>
                  </div>
                  <span className="text-[11px] font-medium text-penora-cocoa-muted bg-white/70 px-2 py-0.5 rounded-full border border-white/80">
                    #{topic.trendingRank}
                  </span>
                </a>
              ))}
            </div>
          </FloatingCard>

          {/* Safety & Protocol Card */}
          <div className="p-5 rounded-3xl bg-penora-peach-light/30 border border-penora-peach/30 text-xs text-penora-cocoa space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-penora-coral">
              <ShieldAlert className="h-4 w-4" />
              <span>Phase 1 Sandbox Notice</span>
            </div>
            <p className="text-[11px] text-penora-cocoa-muted leading-relaxed">
              All voting interactions operate on local component state. In Phase 2, these will connect to PostgreSQL RLS with cryptographic anti-sybil checks.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
};
