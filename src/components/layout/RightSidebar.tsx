import React, { useState } from 'react';
import { Sparkles, Hash, Award, Megaphone, Check, Plus, ExternalLink } from 'lucide-react';
import type { Topic } from '../../types';

interface RightSidebarProps {
  topics?: Topic[];
  onSelectTag?: (tag: string) => void;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
  topics = [],
  onSelectTag,
}) => {
  const [followedCurators, setFollowedCurators] = useState<Record<string, boolean>>({
    erostova: true,
  });

  const toggleFollow = (handle: string) => {
    setFollowedCurators(prev => ({
      ...prev,
      [handle]: !prev[handle],
    }));
  };

  const trendingTags = [
    { name: 'spatialui', count: 142 },
    { name: 'creatorcommons', count: 98 },
    { name: 'typography', count: 87 },
    { name: 'programming', count: 76 },
    { name: 'curation-reports', count: 64 },
    { name: 'openprotocols', count: 53 },
  ];

  const recommendedCurators = [
    {
      name: 'Elena Rostova',
      handle: 'erostova',
      rep: 94,
      role: 'Spatial UI Architect',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
    },
    {
      name: 'Marcus Chen',
      handle: 'marcus_chen',
      rep: 88,
      role: 'Curation Economics Fellow',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80',
    },
    {
      name: 'Fatima Zahra',
      handle: 'mateenfatima',
      rep: 68,
      role: 'Senior SQA Engineer',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=120&q=80',
    },
  ];

  return (
    <aside className="w-full space-y-6">
      {/* Widget 1: Welcome Guide (Matching Screenshot 1 & 3 "New to Steemit? Welcome Guide") */}
      <div className="rounded-2xl bg-white/85 backdrop-blur-md border border-white/90 p-5 shadow-spatial-sm">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-4 w-4 text-penora-coral" />
          <h3 className="font-serif font-bold text-sm text-penora-cocoa">
            New to PENORA?
          </h3>
        </div>
        <p className="text-xs text-penora-cocoa-muted leading-relaxed mb-3">
          Explore spatial editorial depth. Read, upvote with peer consensus, and build non-cash reputation.
        </p>
        <a
          href="/roadmap"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-penora-coral hover:text-penora-coral-hover transition-colors"
        >
          <span>Curators & Welcome Guide</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {/* Widget 2: Platform Announcements (Matching Screenshot 3 "Announcements") */}
      <div className="rounded-2xl bg-white/85 backdrop-blur-md border border-white/90 p-5 shadow-spatial-sm">
        <div className="flex items-center gap-2 mb-3">
          <Megaphone className="h-4 w-4 text-penora-mint" />
          <h3 className="font-serif font-bold text-sm text-penora-cocoa">
            Platform Dispatches
          </h3>
        </div>
        <div className="space-y-3">
          <div>
            <a
              href="/story/daily-curation-report-creator-commons-october"
              className="text-xs font-semibold text-penora-cocoa hover:text-penora-coral transition-colors block line-clamp-2"
            >
              PENORA Update: Community Curators & Season 1 Guidelines
            </a>
            <span className="text-[10px] text-penora-cocoa-muted">2 hours ago</span>
          </div>
          <div className="pt-2 border-t border-penora-cocoa/5">
            <a
              href="/roadmap"
              className="text-xs font-semibold text-penora-cocoa hover:text-penora-coral transition-colors block line-clamp-2"
            >
              Phase 1 Live: 3D Social Publishing Architecture
            </a>
            <span className="text-[10px] text-penora-cocoa-muted">Yesterday</span>
          </div>
        </div>
      </div>

      {/* Widget 3: Trending Tags */}
      <div className="rounded-2xl bg-white/85 backdrop-blur-md border border-white/90 p-5 shadow-spatial-sm">
        <div className="flex items-center gap-2 mb-3">
          <Hash className="h-4 w-4 text-penora-coral" />
          <h3 className="font-serif font-bold text-sm text-penora-cocoa">
            Trending Tags
          </h3>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {trendingTags.map((t) => (
            <button
              key={t.name}
              type="button"
              onClick={() => onSelectTag && onSelectTag(t.name)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-penora-cocoa/5 hover:bg-penora-coral/10 hover:text-penora-coral text-penora-cocoa transition-colors"
            >
              <span>#{t.name}</span>
              <span className="text-[10px] text-penora-cocoa-muted/70">({t.count})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Widget 4: Recommended Curators */}
      <div className="rounded-2xl bg-white/85 backdrop-blur-md border border-white/90 p-5 shadow-spatial-sm">
        <div className="flex items-center gap-2 mb-3.5">
          <Award className="h-4 w-4 text-penora-mint" />
          <h3 className="font-serif font-bold text-sm text-penora-cocoa">
            Distinguished Curators
          </h3>
        </div>
        <div className="space-y-3">
          {recommendedCurators.map((c) => {
            const isFollowing = !!followedCurators[c.handle];
            return (
              <div key={c.handle} className="flex items-center justify-between gap-2">
                <a
                  href={`/profile/${c.handle}`}
                  className="flex items-center gap-2 min-w-0 hover:text-penora-coral transition-colors"
                >
                  <img
                    src={c.avatar}
                    alt={c.name}
                    className="h-8 w-8 rounded-full object-cover ring-1 ring-penora-cocoa/10 flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-penora-cocoa truncate flex items-center gap-1">
                      <span>{c.name}</span>
                      <span className="text-[10px] font-mono text-penora-mint font-bold">
                        ({c.rep})
                      </span>
                    </div>
                    <div className="text-[10px] text-penora-cocoa-muted truncate">
                      {c.role}
                    </div>
                  </div>
                </a>

                <button
                  type="button"
                  onClick={() => toggleFollow(c.handle)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all duration-200 flex-shrink-0 flex items-center gap-1 ${
                    isFollowing
                      ? 'bg-penora-cocoa/10 text-penora-cocoa hover:bg-penora-cocoa/20'
                      : 'bg-penora-mint text-white hover:bg-penora-mint-hover shadow-sm'
                  }`}
                >
                  {isFollowing ? (
                    <>
                      <Check className="h-3 w-3" />
                      <span>Following</span>
                    </>
                  ) : (
                    <>
                      <Plus className="h-3 w-3" />
                      <span>Follow</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
};
