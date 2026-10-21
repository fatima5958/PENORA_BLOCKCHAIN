import React, { useState, useEffect } from 'react';
import type { Article } from '../../types';
import { MessageSquare, Bookmark, Share2, Check } from 'lucide-react';
import { castVote, getVotesForPost, type PostVoteStats } from '../../lib/api/votes';
import { getArticleRewardState } from '../../lib/api/rewards';
import { penoraKeyAuth } from '../../lib/auth/penoraKeyAuth';
import { supabase } from '../../lib/supabaseClient';

interface CompactPostCardProps {
  article: Article;
  onTagClick?: (tag: string) => void;
  className?: string;
}

const GUEST_VOTER_KEY = 'penora_guest_voter_id_v1';

function getActiveVoterId(supabaseUserId?: string): string {
  const keyUser = penoraKeyAuth.getCurrentUser();
  if (keyUser?.id) return keyUser.id;
  if (supabaseUserId) return supabaseUserId;
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

export const CompactPostCard: React.FC<CompactPostCardProps> = ({
  article,
  onTagClick,
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
  const [supabaseUserId, setSupabaseUserId] = useState<string | undefined>(undefined);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const uid = data.session?.user?.id;
      setSupabaseUserId(uid);
      const voterId = getActiveVoterId(uid);
      getVotesForPost(article.id, voterId).then(stats => {
        if (mounted) setVoteStats(stats);
      });
    });
    return () => {
      mounted = false;
    };
  }, [article.id]);

  const handleVote = async (e: React.MouseEvent, direction: 1 | -1) => {
    e.preventDefault();
    e.stopPropagation();

    const voterId = getActiveVoterId(supabaseUserId);
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

    if (res.stats) {
      setVoteStats(res.stats);
    }
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
    <article
      className={`group relative pn-card pn-card-interactive p-4 sm:p-5 ${className}`}
    >
      {/* Top Meta Header */}
      <div className="flex items-center justify-between gap-2 mb-3 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href={`/profile/${article.author.handle}`}
            className="flex items-center gap-1.5 hover:text-[#007C8B] transition-colors"
          >
            <img
              src={article.author.avatar}
              alt={article.author.name}
              className="h-6 w-6 rounded-full object-cover ring-1 ring-[#0A2540]/10"
              loading="lazy"
            />
            <span className="font-semibold text-[#0A2540]">
              {article.author.name}
            </span>
            <span className="pn-tag font-mono text-[10px]">
              Rep {article.author.reputationScore}
            </span>
          </a>

          <span className="text-[#6E7D90]">in</span>

          <a
            href={`/communities#${article.topic.toLowerCase().replace(/\s+/g, '-')}`}
            className="font-medium text-[#4A5B70] hover:text-[#007C8B] transition-colors"
          >
            #{article.topic.toLowerCase().replace(/\s+/g, '')}
          </a>

          <span className="text-[#6E7D90]">•</span>
          <span className="text-[#6E7D90]">{article.publishedAt}</span>
        </div>

        {article.isEditorsPick && (
          <span className="pn-tag hidden sm:inline-flex">
            Featured
          </span>
        )}
      </div>

      {/* Main Row: Thumbnail + Title & Excerpt */}
      <div className="flex gap-4 sm:gap-5 items-start mb-3.5">
        <a
          href={`/story/${article.slug}`}
          className="relative block w-28 h-20 sm:w-44 sm:h-28 rounded-xl overflow-hidden flex-shrink-0 border border-[#0A2540]/8 group/thumb"
        >
          <img
            src={article.coverImage}
            alt={article.coverImageAlt}
            className="w-full h-full object-cover transition-transform duration-200 group-hover/thumb:scale-[1.015]"
            loading="lazy"
          />
        </a>

        <div className="flex-1 min-w-0">
          <a href={`/story/${article.slug}`} className="block group/title">
            <h3 className="pn-h3 group-hover/title:text-[#007C8B] transition-colors leading-snug line-clamp-2 mb-1.5">
              {article.title}
            </h3>
            <p className="text-xs sm:text-sm text-[#4A5B70] leading-relaxed line-clamp-2">
              {article.excerpt}
            </p>
          </a>

          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {article.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                onClick={() => onTagClick && onTagClick(tag)}
                className="pn-pill h-6 px-2 text-[10.5px] cursor-pointer"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Action Row: Upvote ▲ / Downvote ▼ + Comments + Bookmark + Share */}
      <div className="pt-3 border-t border-[#0A2540]/8 flex items-center justify-between text-xs">
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
            className="text-xs font-mono font-medium text-[#4A5E75] select-none cursor-help px-0.5"
            title={getArticleRewardState(voteStats.score).tooltip}
          >
            · {getArticleRewardState(voteStats.score).displayUsd}
          </span>

          <a
            href={`/story/${article.slug}#comments`}
            className="pn-icon-btn"
            title="Read responses"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>{article.stats.commentsCount}</span>
          </a>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleBookmark}
            data-active={isBookmarked ? 'true' : 'false'}
            aria-pressed={isBookmarked}
            className="pn-icon-btn"
            title={isBookmarked ? 'Remove bookmark' : 'Save bookmark'}
          >
            <Bookmark className={`h-3.5 w-3.5 ${isBookmarked ? 'fill-current text-[#007C8B]' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="pn-icon-btn"
            title="Share article link"
          >
            {shared ? (
              <Check className="h-3.5 w-3.5 text-[#007C8B]" />
            ) : (
              <Share2 className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>
    </article>
  );
};
