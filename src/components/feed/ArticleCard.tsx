import React, { useState, useEffect } from 'react';
import type { Article } from '../../types';
import { FloatingCard } from '../3d/FloatingCard';
import { SpatialBadge } from '../3d/SpatialBadge';
import { ReputationIndicator } from './ReputationIndicator';
import { ArrowUpRight, MessageSquare, Bookmark, Share2, Check, Sparkles } from 'lucide-react';
import { castVote, getVotesForPost, type PostVoteStats } from '../../lib/api/votes';
import { getArticleRewardState } from '../../lib/api/rewards';
import { penoraKeyAuth } from '../../lib/auth/penoraKeyAuth';

interface ArticleCardProps {
  article: Article;
  featured?: boolean;
  className?: string;
}

const GUEST_VOTER_KEY = 'penora_guest_voter_id_v1';

function getVoterId(): string {
  const keyUser = penoraKeyAuth.getCurrentUser();
  if (keyUser?.id) return keyUser.id;
  if (typeof window !== 'undefined' && window.localStorage) {
    let guestId = window.localStorage.getItem(GUEST_VOTER_KEY);
    if (!guestId) {
      guestId = `voter_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      window.localStorage.setItem(GUEST_VOTER_KEY, guestId);
    }
    return guestId;
  }
  return 'voter_session';
}

export const ArticleCard: React.FC<ArticleCardProps> = ({
  article,
  featured = false,
  className = '',
}) => {
  const [voteStats, setVoteStats] = useState<PostVoteStats>({
    upvotes: 0,
    downvotes: 0,
    score: 0,
    userVote: null,
  });
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    let mounted = true;
    const voterId = getVoterId();
    getVotesForPost(article.id, voterId).then(stats => {
      if (mounted) setVoteStats(stats);
    });
    return () => {
      mounted = false;
    };
  }, [article.id]);

  const handleVote = async (e: React.MouseEvent, direction: 1 | -1) => {
    e.preventDefault();
    e.stopPropagation();

    const voterId = getVoterId();
    let nextUp = voteStats.upvotes;
    let nextDown = voteStats.downvotes;
    let nextUserVote: 1 | -1 | null = direction;

    if (voteStats.userVote === direction) {
      nextUserVote = null;
      if (direction === 1) nextUp = Math.max(0, nextUp - 1);
      else nextDown = Math.max(0, nextDown - 1);
    } else {
      if (voteStats.userVote === 1) nextUp = Math.max(0, nextUp - 1);
      if (voteStats.userVote === -1) nextDown = Math.max(0, nextDown - 1);
      if (direction === 1) nextUp += 1;
      else nextDown += 1;
    }

    setVoteStats({
      upvotes: nextUp,
      downvotes: nextDown,
      score: nextUp - nextDown,
      userVote: nextUserVote,
    });

    const res = await castVote({
      voter_id: voterId,
      post_id: article.id,
      value: direction,
    });
    if (res.stats) setVoteStats(res.stats);
  };

  const handleBookmark = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsBookmarked(prev => !prev);
  };

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(`${window.location.origin}/story/${article.slug}`);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
  };

  return (
    <FloatingCard
      depth={featured ? 'hero' : 'md'}
      glowColor={featured ? 'coral' : 'ivory'}
      className={`group flex flex-col justify-between ${
        featured ? 'md:col-span-2 p-7 md:p-8' : 'p-6'
      } ${className}`}
    >
      <div>
        {/* Top bar: Author + Topic Tag */}
        <div className="flex items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <img
              src={article.author.avatar}
              alt={article.author.name}
              className="h-10 w-10 rounded-full object-cover ring-2 ring-white/80 shadow-spatial-sm"
              loading="lazy"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-penora-cocoa text-sm">
                  {article.author.name}
                </span>
                <ReputationIndicator score={article.author.reputationScore} size="sm" />
              </div>
              <p className="text-xs text-penora-cocoa-muted">@{article.author.handle} · {article.publishedAt}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {article.isEditorsPick && (
              <SpatialBadge variant="coral" size="sm" dot>
                Editor's Pick
              </SpatialBadge>
            )}
            <SpatialBadge variant="ivory" size="sm">
              {article.topic}
            </SpatialBadge>
          </div>
        </div>

        {/* Cover image if featured */}
        {featured ? (
          <div className="relative mb-6 overflow-hidden rounded-2xl aspect-[16/8] shadow-spatial-sm">
            <img
              src={article.coverImage}
              alt={article.coverImageAlt}
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-penora-cocoa-dark/70 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-white text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/20 backdrop-blur-md px-2.5 py-1 font-medium border border-white/30">
                <Sparkles className="h-3 w-3 text-penora-peach" /> {article.readTimeMinutes} min deep read
              </span>
            </div>
          </div>
        ) : null}

        {/* Title and Excerpt */}
        <a href={`/story/${article.slug}`} className="block group/link">
          <h3
            className={`font-serif font-bold text-penora-cocoa group-hover/link:text-[#007C8B] transition-colors tracking-tight ${
              featured ? 'text-2xl md:text-3xl mb-3' : 'text-xl mb-2.5'
            }`}
          >
            {article.title}
          </h3>
          <p className="text-penora-cocoa-muted text-sm leading-relaxed mb-4 line-clamp-2 md:line-clamp-3">
            {article.excerpt}
          </p>
        </a>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-6">
          {article.tags.map(tag => (
            <span
              key={tag}
              className="text-[11px] font-medium text-penora-cocoa-muted/80 bg-penora-cocoa/5 px-2 py-0.5 rounded-md"
            >
              #{tag}
            </span>
          ))}
        </div>
      </div>

      {/* Footer bar: Upvote ▲ / Downvote ▼, Comments, Bookmark, Share */}
      <div className="pt-4 border-t border-penora-cocoa/8 flex items-center justify-between text-xs text-penora-cocoa-muted">
        <div className="flex items-center gap-2">
          <div className="pn-vote-group" role="group" aria-label="Article voting">
            <button
              type="button"
              onClick={e => handleVote(e, 1)}
              data-active={voteStats.userVote === 1 ? 'true' : 'false'}
              aria-pressed={voteStats.userVote === 1}
              className="pn-vote-btn pn-vote-up"
              title="Upvote ▲"
            >
              <span aria-hidden="true" className="text-[10px] leading-none">
                ▲
              </span>
              <span>{voteStats.upvotes}</span>
            </button>
            <button
              type="button"
              onClick={e => handleVote(e, -1)}
              data-active={voteStats.userVote === -1 ? 'true' : 'false'}
              aria-pressed={voteStats.userVote === -1}
              className="pn-vote-btn pn-vote-down"
              title="Downvote ▼"
            >
              <span aria-hidden="true" className="text-[10px] leading-none">
                ▼
              </span>
              <span>{voteStats.downvotes}</span>
            </button>
          </div>

          <span
            className="text-xs font-mono font-medium text-penora-cocoa-muted select-none cursor-help px-0.5"
            title={getArticleRewardState(voteStats.score).tooltip}
          >
            · {getArticleRewardState(voteStats.score).displayUsd}
          </span>

          <a
            href={`/story/${article.slug}#comments`}
            className="pn-icon-btn"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>{article.stats.commentsCount}</span>
          </a>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleBookmark}
            data-active={isBookmarked ? 'true' : 'false'}
            aria-pressed={isBookmarked}
            title="Save to bookmarks"
            className="pn-icon-btn"
          >
            <Bookmark className={`h-3.5 w-3.5 ${isBookmarked ? 'fill-current text-[#007C8B]' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleShare}
            title="Share story link"
            className="pn-icon-btn"
          >
            {shared ? <Check className="h-3.5 w-3.5 text-[#007C8B]" /> : <Share2 className="h-3.5 w-3.5" />}
          </button>

          <a
            href={`/story/${article.slug}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#007C8B] hover:underline ml-1"
          >
            <span>Read</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </FloatingCard>
  );
};
