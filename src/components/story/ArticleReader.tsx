// src/components/story/ArticleReader.tsx
// PENORA Blockchain — Longform Essay Reader & Curation View
import React, { useState, useEffect } from 'react';
import type { Article } from '../../types';
import {
  ArrowLeft,
  MessageSquare,
  Bookmark,
  Share2,
  Send,
  Check,
  Loader2,
  Trash2,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { getArticleBySlug } from '../../lib/api/articles';
import { castVote, getVotesForPost, type PostVoteStats } from '../../lib/api/votes';
import { getCommentsForPost, addComment, deleteComment } from '../../lib/api/comments';
import { toggleBookmark, isPostBookmarked } from '../../lib/api/bookmarks';
import { followUser, isFollowing } from '../../lib/api/follows';
import { SpatialAuthModalV4 } from '../design-v4/SpatialAuthModalV4';
import { penoraKeyAuth, type PenoraUser } from '../../lib/auth/penoraKeyAuth';
import type { CommentRecord, PostRecord } from '../../lib/api/types';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface ArticleReaderProps {
  article: Article;
}

export const ArticleReader: React.FC<ArticleReaderProps> = ({ article: initialArticle }) => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [keyUser, setKeyUser] = useState<PenoraUser | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [article, setArticle] = useState<Article>(initialArticle);

  const [voteStats, setVoteStats] = useState<PostVoteStats>({
    upvotes: 0,
    downvotes: 0,
    score: 0,
    userVote: null,
  });

  const [bookmarked, setBookmarked] = useState(false);
  const [followingAuthor, setFollowingAuthor] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const [comments, setComments] = useState<
    Array<{ id?: string; authorId?: string; author: string; rep: number; text: string; time: string }>
  >([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Hydrate real post from Supabase if viewing by slug
  useEffect(() => {
    let mounted = true;
    const pathSlug = typeof window !== 'undefined'
      ? window.location.pathname.replace(/^\/story\//, '').replace(/\/$/, '')
      : initialArticle.slug;
    const targetSlug = pathSlug || initialArticle.slug;

    if (targetSlug) {
      getArticleBySlug(targetSlug).then(res => {
        if (!mounted || !res.data) return;
        const p: PostRecord = res.data;
        setArticle({
          id: p.id,
          slug: p.slug,
          title: p.title,
          excerpt: p.excerpt || p.content.slice(0, 160) + '...',
          content: p.content,
          coverImage: p.cover_image_url || initialArticle.coverImage,
          category: p.tags?.[0] || 'Protocol',
          publishedAt: p.created_at,
          readTime: `${Math.max(1, Math.ceil(p.content.split(/\s+/).length / 200))} min read`,
          author: {
            id: p.author_id,
            name: p.author?.display_name || p.author?.username || 'PENORA Creator',
            handle: p.author?.username || 'creator',
            avatar: p.author?.avatar_url || initialArticle.author.avatar,
            bio: p.author?.bio || '',
            reputationScore: p.author?.reputation ?? 25,
            isTopContributor: (p.author?.reputation ?? 25) >= 50,
            followersCount: 0,
          },
          curationScore: 0,
          tags: p.tags || [],
        });
      });
    }

    return () => {
      mounted = false;
    };
  }, [initialArticle.slug]);

  useEffect(() => {
    const unsubKey = penoraKeyAuth.subscribe(ku => {
      setKeyUser(ku);
    });

    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      const activeId = u?.id || penoraKeyAuth.getCurrentUser()?.id;
      if (activeId) {
        isPostBookmarked(activeId, article.id).then(b => setBookmarked(b));
        if (article.author.id) {
          isFollowing(activeId, article.author.id).then(f => setFollowingAuthor(f));
        }
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    getCommentsForPost(article.id).then(res => {
      if (res.data && res.data.length > 0) {
        const mapped = res.data.map((c: CommentRecord) => ({
          id: c.id,
          authorId: c.author_id,
          author: c.author?.display_name || c.author?.username || 'Community Member',
          rep: c.author?.reputation ?? 25,
          text: c.body,
          time: new Date(c.created_at).toLocaleDateString(),
        }));
        setComments(mapped);
      }
    });

    return () => {
      unsubKey();
      subscription.unsubscribe();
    };
  }, [article.id, article.author.id]);

  useEffect(() => {
    const voterId = keyUser?.id || user?.id || '';
    getVotesForPost(article.id, voterId).then(stats => {
      setVoteStats(stats);
    });
  }, [article.id, keyUser, user]);

  const handleVote = async (direction: 1 | -1) => {
    const voterId = keyUser?.id || user?.id;
    if (!voterId) {
      setAuthModalOpen(true);
      return;
    }

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

  const handleBookmark = async () => {
    const voterId = keyUser?.id || user?.id;
    if (!voterId) {
      setAuthModalOpen(true);
      return;
    }
    const next = !bookmarked;
    setBookmarked(next);
    await toggleBookmark(voterId, article.id);
  };

  const handleFollow = async () => {
    const voterId = keyUser?.id || user?.id;
    if (!voterId) {
      setAuthModalOpen(true);
      return;
    }
    const next = !followingAuthor;
    setFollowingAuthor(next);
    await followUser(voterId, article.author.id || article.author.handle);
  };

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleDeleteComment = async (commentId?: string) => {
    if (!commentId) return;
    setComments(prev => prev.filter(c => c.id !== commentId));
    await deleteComment(commentId);
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const authorId = keyUser?.id || user?.id;
    if (!authorId) {
      setAuthModalOpen(true);
      return;
    }

    if (!newCommentText.trim()) return;
    const text = newCommentText.trim();
    setSubmittingComment(true);

    const authorHandle = keyUser?.username || user?.email?.split('@')[0] || 'You';
    const tempId = `temp_${Date.now()}`;
    setComments(prev => [
      ...prev,
      {
        id: tempId,
        authorId,
        author: authorHandle,
        rep: 25,
        text,
        time: 'Just now',
      },
    ]);
    setNewCommentText('');

    try {
      const res = await addComment({
        post_id: article.id,
        author_id: authorId,
        body: text,
        author_name: authorHandle,
      });
      if (res.data?.id) {
        setComments(prev => prev.map(c => c.id === tempId ? { ...c, id: res.data!.id } : c));
      }
    } finally {
      setSubmittingComment(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-4">
        <a href="/" className="pn-btn pn-btn-secondary pn-btn-sm">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Feed</span>
        </a>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleBookmark}
            data-active={bookmarked ? 'true' : 'false'}
            aria-pressed={bookmarked}
            className="pn-icon-btn h-9 w-9 bg-white border border-[#0A2540]/10"
            title={bookmarked ? 'Remove bookmark' : 'Bookmark story'}
          >
            <Bookmark className={`h-4 w-4 ${bookmarked ? 'fill-current text-[#007C8B]' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="pn-icon-btn h-9 w-9 bg-white border border-[#0A2540]/10"
            title="Copy story link"
          >
            {copiedLink ? <Check className="h-4 w-4 text-[#007C8B]" /> : <Share2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Main Article Card */}
      <article className="pn-card p-6 sm:p-12">
        <div className="flex items-center gap-2 mb-4">
          <span className="pn-tag">{article.topic}</span>
          <span className="pn-meta">· {article.readTimeMinutes} min read</span>
        </div>

        <h1 className="pn-h1 text-3xl sm:text-4xl leading-tight mb-6">
          {article.title}
        </h1>

        {/* Author Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 border-y border-[#0A2540]/8 mb-8">
          <a href={`/profile/${article.author.handle}`} className="flex items-center gap-3 group">
            <img
              src={article.author.avatar}
              alt={article.author.name}
              className="pn-avatar h-11 w-11"
            />
            <div>
              <div className="text-sm font-semibold text-[#0A2540] group-hover:text-[#007C8B] flex items-center gap-2">
                <span>{article.author.name}</span>
                <span className="pn-tag">Rep {article.author.reputationScore}</span>
              </div>
              <p className="text-xs text-[#6E7D90]">@{article.author.handle}</p>
            </div>
          </a>

          <button
            type="button"
            onClick={handleFollow}
            className={`pn-btn pn-btn-sm ${
              followingAuthor ? 'pn-btn-subtle' : 'pn-btn-brand'
            }`}
          >
            {followingAuthor ? 'Following' : '+ Follow Creator'}
          </button>
        </div>

        {article.coverImage && (
          <div className="w-full rounded-2xl overflow-hidden mb-8 border border-[#0A2540]/8 bg-black/[0.02]">
            <img
              src={article.coverImage}
              alt={article.title}
              className="w-full h-auto block rounded-2xl"
            />
          </div>
        )}

        {article.excerpt && (
          <p className="text-base sm:text-lg text-[#4A5B70] leading-relaxed pb-6 mb-6 border-b border-[#0A2540]/8">
            {article.excerpt}
          </p>
        )}

        <div className="text-base sm:text-[17px] text-[#0A2540] leading-relaxed space-y-6">
          {Array.isArray(article.content) ? (
            article.content.map((para: string, i: number) => <p key={i}>{para}</p>)
          ) : (
            <p>{String(article.content)}</p>
          )}
        </div>

        {/* Steemit-Inspired Curation Voting Dock */}
        <div className="mt-10 pt-6 border-t border-[#0A2540]/8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="pn-vote-group" role="group" aria-label="Article voting">
              <button
                type="button"
                onClick={() => handleVote(1)}
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
                onClick={() => handleVote(-1)}
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
            <span className="text-xs text-[#4A5B70]">
              {voteStats.userVote === 1
                ? 'You upvoted this essay'
                : voteStats.userVote === -1
                ? 'You downvoted this essay'
                : 'Curate to reward creator reputation'}
            </span>
          </div>

          <button
            type="button"
            onClick={handleBookmark}
            className={`pn-btn pn-btn-sm ${bookmarked ? 'pn-btn-subtle' : 'pn-btn-secondary'}`}
          >
            <Bookmark className={`h-3.5 w-3.5 ${bookmarked ? 'fill-current text-[#007C8B]' : ''}`} />
            <span>{bookmarked ? 'Saved to Bookmarks' : 'Save Essay'}</span>
          </button>
        </div>
      </article>

      {/* Responses Thread */}
      <div id="comments" className="pn-card p-6 sm:p-10 space-y-6">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-[#007C8B]" />
          <h3 className="pn-h2">Community Responses ({comments.length})</h3>
        </div>

        <form onSubmit={handlePostComment} className="space-y-3">
          <textarea
            value={newCommentText}
            onChange={e => setNewCommentText(e.target.value)}
            placeholder={
              user || keyUser
                ? 'Contribute a thoughtful perspective...'
                : 'Sign in to join the discussion...'
            }
            rows={3}
            className="pn-input resize-none"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submittingComment || !newCommentText.trim()}
              className="pn-btn pn-btn-brand pn-btn-sm"
            >
              {submittingComment ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              <span>Post Response</span>
            </button>
          </div>
        </form>

        {comments.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-[#0A2540]/8">
            {comments.map((c, i) => {
              const currentUserId = keyUser?.id || user?.id;
              const currentUsername = keyUser?.username || user?.email?.split('@')[0];
              const isOwnComment = (c.authorId && c.authorId === currentUserId) || (c.author && c.author === currentUsername);

              return (
                <div key={c.id || i} className="p-4 rounded-2xl bg-[#F4F7FA] border border-[#0A2540]/6 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#0A2540]">@{c.author}</span>
                      <span className="pn-tag">Rep {c.rep}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="pn-meta">{c.time}</span>
                      {isOwnComment && c.id && (
                        <button
                          type="button"
                          onClick={() => handleDeleteComment(c.id)}
                          className="text-[#8C9BAE] hover:text-[#D93838] transition-colors p-1"
                          title="Delete comment"
                          aria-label="Delete comment"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm text-[#4A5B70] leading-relaxed">{c.text}</p>
                </div>
              );
            })}
          </div>
        )}
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
