// src/components/story/ArticleReader.tsx
// PENORA Blockchain — Longform Blog Reader & Premium Mobile Reading Experience (≤767px)
// Faithfully matches user-provided reference mockups (Screens 1, 2, 3, 4):
// - Sticky branded header with back arrow, PENORA emblem, bookmark, and share
// - Slim reading progress bar tracking scroll percentage and estimated time left
// - Full-bleed / rounded editorial cover image with category tag pill
// - Large editorial serif title, subtitle/excerpt, and compact author byline with Follow
// - Mobile quick engagement bar: Heart upvote, comments count, bookmark, and share
// - Floating bottom reading dock with font size adjuster (Aa), progress pill, and jump action
// - Clean mobile comments section with inline composer, replies, and heart reactions
// - "More from [author]" section featuring author's other articles and creator support card
// - Desktop layout preserved on md: screens
import React, { useState, useEffect, useRef } from 'react';
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
  MoreVertical,
  ChevronRight,
  List,
  Sparkles,
  Crown,
  CheckCircle2,
  Type,
  CornerDownRight,
  Repeat,
  VolumeX,
  UserX,
  Flag,
  AlertTriangle,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { getArticleBySlug, getUserArticles } from '../../lib/api/articles';
import { getVotesForPost, type PostVoteStats } from '../../lib/api/votes';
import { getArticleRewardState } from '../../lib/api/rewards';
import { getCommentsForPost, addComment, deleteComment } from '../../lib/api/comments';
import { toggleBookmark, isPostBookmarked } from '../../lib/api/bookmarks';
import { followUser, isFollowing, unfollowUser } from '../../lib/api/follows';
import { getReblogState, toggleReblog } from '../../lib/api/reblogs';
import { isCreatorMuted, muteCreator, unmuteCreator, blockCreator, submitReport } from '../../lib/api/moderation';
import { recordArticleView } from '../../lib/api/analytics';

import { SpatialAuthModalV4 } from '../design-v4/SpatialAuthModalV4';
import { VotingStrengthModal } from './VotingStrengthModal';
import { PenoraLogo } from '../brand/PenoraLogo';
import { penoraKeyAuth, type PenoraUser } from '../../lib/auth/penoraKeyAuth';
import type { CommentRecord, PostRecord } from '../../lib/api/types';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { ArticleRewardPanel } from './ArticleRewardPanel';
import { ArticleMarkdown } from '../editor/ArticleMarkdown';
import { usePostVoting } from '../../lib/hooks/usePostVoting';
import { MOCK_ARTICLES } from '../../data/mockArticles';

interface ArticleReaderProps {
  article?: Article;
}

const EMPTY_ARTICLE: Article = {
  id: '',
  slug: '',
  title: '',
  subtitle: '',
  excerpt: '',
  content: [],
  coverImage: '',
  coverImageAlt: '',
  publishedAt: '',
  readTimeMinutes: 0,
  topic: '',
  tags: [],
  author: { id: '', name: '', handle: '', avatar: '', reputationScore: 0, role: 'Creator' },
  stats: { votesCount: 0, commentsCount: 0, bookmarksCount: 0, reputationPoints: 0 },
};

export const ArticleReader: React.FC<ArticleReaderProps> = ({ article: initialArticle = EMPTY_ARTICLE }) => {
  const { voteError, submitPostVote } = usePostVoting();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [keyUser, setKeyUser] = useState<PenoraUser | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [article, setArticle] = useState<Article>(EMPTY_ARTICLE);
  const [rewardPublishedAt, setRewardPublishedAt] = useState<string | null>(null);
  const [articleLoading, setArticleLoading] = useState(true);
  const [articleError, setArticleError] = useState<string | null>(null);

  // Voting, Bookmarks, and Follow
  const [votingModalOpen, setVotingModalOpen] = useState(false);
  const [votingDirection, setVotingDirection] = useState<1 | -1>(1);
  const [voteStats, setVoteStats] = useState<PostVoteStats>({
    upvotes: 0,
    downvotes: 0,
    score: 0,
    userVote: null,
  });
  const [bookmarked, setBookmarked] = useState(false);
  const [followingAuthor, setFollowingAuthor] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Reblog state
  const [reblogged, setReblogged] = useState(false);
  const [reblogCount, setReblogCount] = useState(0);

  // Threaded Comments state
  interface CommentItem {
    id: string;
    authorId?: string;
    author: string;
    rep: number;
    text: string;
    time: string;
    parent_id?: string | null;
    replies?: CommentItem[];
  }
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  // Moderation state (Mute / Block / Report)
  const [isAuthorMuted, setIsAuthorMuted] = useState(false);
  const [showMutedContent, setShowMutedContent] = useState(false);
  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ type: 'post' | 'comment'; id: string; name?: string }>({
    type: 'post',
    id: '',
  });
  const [reportReason, setReportReason] = useState('Spam');
  const [reportDetails, setReportDetails] = useState('');
  const [reportingBusy, setReportingBusy] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);

  // More articles from this author
  const [moreArticles, setMoreArticles] = useState<PostRecord[]>([]);

  // Mobile Reading Assistant State
  const [readingProgress, setReadingProgress] = useState(0);
  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'xl'>('normal');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const commentsSectionRef = useRef<HTMLDivElement>(null);

  // Scroll Progress Listener
  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0) {
        const current = window.scrollY;
        setReadingProgress(Math.min(100, Math.max(0, (current / totalHeight) * 100)));
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Fetch Article by Slug
  useEffect(() => {
    let mounted = true;
    const url = new URL(window.location.href);
    const pathSlug = url.pathname.startsWith('/story/')
      ? url.pathname.slice(7).replace(/\/$/, '')
      : url.pathname.startsWith('/article/')
      ? url.pathname.slice(9).replace(/\/$/, '')
      : '';
    let targetSlug = url.searchParams.get('slug') || pathSlug || initialArticle.slug;
    try {
      targetSlug = decodeURIComponent(targetSlug);
    } catch {
      // Use original
    }
    if (!targetSlug) {
      setArticleError('This blog link is incomplete.');
      setArticleLoading(false);
      return;
    }

    getArticleBySlug(targetSlug).then((res) => {
      if (!mounted) return;
      setArticleLoading(false);
      if (!res.data) {
        setArticleError(res.error || 'This blog was not found or is not public.');
        return;
      }
      const p = res.data;
      setRewardPublishedAt(p.published_at ?? null);
      setArticle({
        id: p.id,
        slug: p.slug,
        title: p.title,
        subtitle: '',
        excerpt: p.excerpt || '',
        content: [p.content],
        coverImage: p.cover_image_url || '/brand/penora-celestial-cover-default.jpg',
        coverImageAlt: p.title,
        publishedAt: p.published_at || p.created_at,
        readTimeMinutes: Math.max(1, Math.ceil(p.content.trim().split(/\s+/).length / 200)),
        topic: p.tags?.[0] || 'Productivity',
        tags: p.tags || [],
        author: {
          id: p.author_id,
          name: p.author?.display_name || p.author?.username || 'Creator',
          handle: p.author?.username || 'creator',
          avatar: p.author?.avatar_url || '/brand/penora-avatar-mateen.jpg',
          bio: p.author?.bio || '',
          reputationScore: p.author?.reputation ?? 25,
          role: 'Creator',
        },
        stats: { votesCount: 0, commentsCount: 0, bookmarksCount: 0, reputationPoints: 0 },
      });

      recordArticleView(p.id, keyUser?.id || user?.id);

      // Load more articles from this author
      if (p.author_id) {
        getUserArticles(p.author_id).then((userArts) => {
          if (mounted && userArts.data) {
            setMoreArticles(userArts.data.filter((a) => a.id !== p.id && a.published).slice(0, 3));
          }
        });
      }
    });

    return () => {
      mounted = false;
    };
  }, [initialArticle.slug]);

  // Auth, Bookmark, and Follow Subscription
  useEffect(() => {
    if (!article.id) return;
    const unsubKey = penoraKeyAuth.subscribe((ku) => {
      setKeyUser(ku);
    });

    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      const activeId = u?.id || penoraKeyAuth.getCurrentUser()?.id;
      if (activeId) {
        isPostBookmarked(activeId, article.id).then((b) => setBookmarked(b));
        if (article.author.id) {
          isFollowing(activeId, article.author.id).then((f) => setFollowingAuthor(f));
        }
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    // Load Real Threaded Comments
    getCommentsForPost(article.id).then((res) => {
      if (res.data) {
        const rawItems: CommentItem[] = res.data.map((c: CommentRecord) => ({
          id: c.id,
          authorId: c.author_id,
          author: c.author?.display_name || c.author?.username || 'community_member',
          rep: c.author?.reputation ?? 25,
          text: c.body,
          time: new Date(c.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          parent_id: c.parent_id || null,
        }));

        const map = new Map<string, CommentItem>();
        const roots: CommentItem[] = [];
        rawItems.forEach(item => map.set(item.id, { ...item, replies: [] }));
        rawItems.forEach(item => {
          const node = map.get(item.id)!;
          if (item.parent_id && map.has(item.parent_id)) {
            const p = map.get(item.parent_id)!;
            p.replies = p.replies || [];
            p.replies.push(node);
          } else {
            roots.push(node);
          }
        });
        setComments(roots);
      }
    });

    // Reblog and Mute Status
    const activeVisitorId = keyUser?.id || user?.id;
    getReblogState(article.id, activeVisitorId).then(st => {
      setReblogged(st.isReblogged);
      setReblogCount(st.reblogCount);
    });
    if (activeVisitorId && article.author.id) {
      isCreatorMuted(activeVisitorId, article.author.id).then(m => setIsAuthorMuted(m));
    }

    return () => {
      unsubKey();
      subscription.unsubscribe();
    };
  }, [article.id, article.author.id]);

  // Vote Stats
  useEffect(() => {
    if (!article.id) return;
    const voterId = keyUser?.id || user?.id || '';
    getVotesForPost(article.id, voterId).then((stats) => {
      setVoteStats({
        ...stats,
        upvotes: stats.upvotes || 0,
      });
    });
  }, [article.id, keyUser, user]);

  const handleVote = async (direction: 1 | -1) => {
    const voterId = keyUser?.id || user?.id;
    if (!voterId) {
      setAuthModalOpen(true);
      return;
    }
    if (voteStats.userVote === direction) {
      await submitPostVote(article.id, voterId, direction, voteStats, setVoteStats);
      return;
    }
    setVotingDirection(direction);
    setVotingModalOpen(true);
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
    if (next) {
      await followUser(voterId, article.author.id || article.author.handle);
    } else {
      await unfollowUser(voterId, article.author.id || article.author.handle);
    }
  };

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleReblog = async () => {
    const activeId = keyUser?.id || user?.id;
    if (!activeId) {
      setAuthModalOpen(true);
      return;
    }
    const next = !reblogged;
    setReblogged(next);
    setReblogCount(c => next ? c + 1 : Math.max(0, c - 1));
    const res = await toggleReblog(activeId, article.id);
    if (!res.success && res.error) {
      setReblogged(!next);
      setReblogCount(c => !next ? c + 1 : Math.max(0, c - 1));
    }
  };

  const handlePostReply = async (e: React.FormEvent, parentId: string) => {
    e.preventDefault();
    const authorId = keyUser?.id || user?.id;
    if (!authorId) {
      setAuthModalOpen(true);
      return;
    }
    if (!replyText.trim()) return;
    const text = replyText.trim();
    setSubmittingReply(true);

    const authorHandle = keyUser?.username || user?.email?.split('@')[0] || 'You';
    const tempId = `temp_${Date.now()}`;
    const newReplyItem: CommentItem = {
      id: tempId,
      authorId,
      author: authorHandle,
      rep: 25,
      text,
      time: 'Just now',
      parent_id: parentId,
    };

    setComments(prev => prev.map(c => {
      if (c.id === parentId) {
        return { ...c, replies: [...(c.replies || []), newReplyItem] };
      }
      return c;
    }));
    setReplyText('');
    setReplyingToCommentId(null);

    try {
      const res = await addComment({
        post_id: article.id,
        author_id: authorId,
        body: text,
        parent_id: parentId,
        author_name: authorHandle,
      });
      if (res.data?.id) {
        setComments(prev => prev.map(c => {
          if (c.id === parentId) {
            return {
              ...c,
              replies: (c.replies || []).map(r => r.id === tempId ? { ...r, id: res.data!.id } : r)
            };
          }
          return c;
        }));
      }
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleToggleMute = async () => {
    const activeId = keyUser?.id || user?.id;
    if (!activeId || !article.author.id) {
      setAuthModalOpen(true);
      return;
    }
    if (isAuthorMuted) {
      await unmuteCreator(activeId, article.author.id);
      setIsAuthorMuted(false);
    } else {
      await muteCreator(activeId, article.author.id);
      setIsAuthorMuted(true);
    }
    setOptionsMenuOpen(false);
  };

  const handleBlockAuthor = async () => {
    const activeId = keyUser?.id || user?.id;
    if (!activeId || !article.author.id) {
      setAuthModalOpen(true);
      return;
    }
    await blockCreator(activeId, article.author.id);
    setIsAuthorMuted(true);
    setOptionsMenuOpen(false);
  };

  const handleOpenReport = (type: 'post' | 'comment', id: string, name?: string) => {
    setReportTarget({ type, id, name });
    setReportReason('Spam');
    setReportDetails('');
    setReportSubmitted(false);
    setReportModalOpen(true);
    setOptionsMenuOpen(false);
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeId = keyUser?.id || user?.id;
    if (!activeId) {
      setAuthModalOpen(true);
      return;
    }
    setReportingBusy(true);
    try {
      await submitReport({
        reporterId: activeId,
        targetType: reportTarget.type,
        targetId: reportTarget.id,
        reason: reportReason,
        details: reportDetails,
      });
      setReportSubmitted(true);
      setTimeout(() => {
        setReportModalOpen(false);
        setReportSubmitted(false);
      }, 1500);
    } finally {
      setReportingBusy(false);
    }
  };

  const handleDeleteComment = async (commentId?: string) => {
    if (!commentId) return;
    setComments((prev) =>
      prev
        .filter((c) => c.id !== commentId)
        .map((c) => ({
          ...c,
          replies: (c.replies || []).filter((r) => r.id !== commentId),
        }))
    );
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
    setComments((prev) => [
      {
        id: tempId,
        authorId,
        author: authorHandle,
        rep: 25,
        text,
        time: 'Just now',
        likes: 1,
      },
      ...prev,
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
        setComments((prev) => prev.map((c) => (c.id === tempId ? { ...c, id: res.data!.id } : c)));
      }
    } finally {
      setSubmittingComment(false);
    }
  };

  const scrollToComments = () => {
    commentsSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const toggleFontSize = () => {
    if (fontSize === 'normal') setFontSize('large');
    else if (fontSize === 'large') setFontSize('xl');
    else setFontSize('normal');
  };

  const minutesLeft = Math.max(1, Math.ceil(article.readTimeMinutes * (1 - readingProgress / 100)));

  if (articleLoading || articleError) {
    return (
      <div className="w-full max-w-4xl mx-auto px-4 py-12">
        <a href="/" className="pn-btn pn-btn-secondary pn-btn-sm mb-6 inline-flex items-center gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Feed</span>
        </a>
        <div className="pn-card p-8 rounded-3xl" role={articleError ? 'alert' : 'status'}>
          {articleLoading ? (
            <div className="flex items-center gap-3 text-sm text-[#0A2540]">
              <Loader2 className="h-5 w-5 animate-spin text-[#007C8B]" />
              <span>Loading blog…</span>
            </div>
          ) : (
            articleError
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* ─── DESKTOP ARTICLE READER (≥768px): 100% ORIGINAL HEAD DESIGN ─── */}
      <div className="hidden md:block">
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">

      {voteError && <p role="alert" className="text-sm text-red-700 p-3 rounded-xl bg-red-50">{voteError}</p>}
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-4">
        <a href="/" className="pn-btn pn-btn-secondary pn-btn-sm">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Feed</span>
        </a>

        <div className="flex items-center gap-2 relative">
          {/* Reblog Button */}
          <button
            type="button"
            onClick={handleReblog}
            data-active={reblogged ? 'true' : 'false'}
            aria-pressed={reblogged}
            className={`pn-icon-btn h-9 px-3 gap-1.5 bg-white border border-[#0A2540]/10 ${
              reblogged ? 'text-[#007C8B] font-semibold' : ''
            }`}
            title={reblogged ? 'Undo reblog' : 'Reblog story to your profile'}
          >
            <Repeat className={`h-4 w-4 ${reblogged ? 'text-[#007C8B]' : ''}`} />
            {reblogCount > 0 && <span className="text-xs">{reblogCount}</span>}
          </button>

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

          {/* Desktop More Options Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setOptionsMenuOpen(prev => !prev)}
              className="pn-icon-btn h-9 w-9 bg-white border border-[#0A2540]/10"
              title="More options"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            {optionsMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 rounded-2xl bg-white border border-[#0A2540]/10 shadow-lg py-2 z-50 text-xs text-[#0A2540]">
                <button
                  type="button"
                  onClick={handleToggleMute}
                  className="w-full text-left px-4 py-2 hover:bg-[#F0F5F8] flex items-center gap-2 text-[#52657C] hover:text-[#0A2540]"
                >
                  <VolumeX className="h-4 w-4 text-[#007C8B]" />
                  <span>{isAuthorMuted ? 'Unmute Author' : 'Mute Author'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleBlockAuthor}
                  className="w-full text-left px-4 py-2 hover:bg-[#F0F5F8] flex items-center gap-2 text-[#52657C] hover:text-[#0A2540]"
                >
                  <UserX className="h-4 w-4 text-[#52657C]" />
                  <span>Block Author</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenReport('post', article.id, article.title)}
                  className="w-full text-left px-4 py-2 hover:bg-red-50 flex items-center gap-2 text-red-600 border-t border-[#0A2540]/6 mt-1 pt-2"
                >
                  <Flag className="h-4 w-4" />
                  <span>Report Story</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <ArticleRewardPanel publishedAt={rewardPublishedAt} articleId={article.id} />

            {/* Muted Author Alert Banner */}
      {isAuthorMuted && !showMutedContent && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <VolumeX className="h-4 w-4 text-amber-700 shrink-0" />
            <span>You have muted @{article.author.handle}. Story content is collapsed.</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowMutedContent(true)}
              className="font-bold underline text-amber-800 hover:text-amber-950"
            >
              View Story
            </button>
            <button
              type="button"
              onClick={handleToggleMute}
              className="px-2.5 py-1 rounded-lg bg-amber-200 text-amber-900 font-semibold"
            >
              Unmute
            </button>
          </div>
        </div>
      )}

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
          <ArticleMarkdown content={article.content.join('\n\n')} />
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
            <span
              className="text-xs font-mono font-medium text-[#4A5E75] select-none cursor-help px-0.5"
              title={getArticleRewardState(voteStats.score).tooltip}
            >
              · {getArticleRewardState(voteStats.score).displayUsd}
            </span>
            <span className="text-xs text-[#4A5B70]">
              {voteStats.userVote === 1
                ? 'You upvoted this blog'
                : voteStats.userVote === -1
                ? 'You downvoted this blog'
                : 'Curate to reward creator reputation'}
            </span>
          </div>

          <button
            type="button"
            onClick={handleBookmark}
            className={`pn-btn pn-btn-sm ${bookmarked ? 'pn-btn-subtle' : 'pn-btn-secondary'}`}
          >
            <Bookmark className={`h-3.5 w-3.5 ${bookmarked ? 'fill-current text-[#007C8B]' : ''}`} />
            <span>{bookmarked ? 'Saved to Bookmarks' : 'Save Blog'}</span>
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

        {comments.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#6E7D90] border-t border-[#0A2540]/6">
            No responses yet. Be the first to start the discussion!
          </div>
        ) : (
          <div className="space-y-4 pt-4 border-t border-[#0A2540]/8">
            {comments.map((c, i) => {
              const currentUserId = keyUser?.id || user?.id;
              const currentUsername = keyUser?.username || user?.email?.split('@')[0];
              const isOwnComment = (c.authorId && c.authorId === currentUserId) || (c.author && c.author === currentUsername);

              return (
                <div key={c.id || i} className="p-4 rounded-2xl bg-[#F4F7FA] border border-[#0A2540]/6 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#0A2540]">@{c.author}</span>
                      <span className="pn-tag">Rep {c.rep}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="pn-meta">{c.time}</span>
                      <button
                        type="button"
                        onClick={() => handleOpenReport('comment', c.id, c.text.slice(0, 30))}
                        className="text-[#8C9BAE] hover:text-red-600 transition-colors p-1"
                        title="Report comment"
                      >
                        <Flag className="h-3 w-3" />
                      </button>
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

                  <div className="flex items-center gap-3 pt-1 text-xs text-[#6E7D90]">
                    <button
                      type="button"
                      onClick={() => setReplyingToCommentId(replyingToCommentId === c.id ? null : c.id)}
                      className="hover:text-[#007C8B] font-medium flex items-center gap-1"
                    >
                      <CornerDownRight className="h-3 w-3" />
                      <span>Reply</span>
                    </button>
                  </div>

                  {/* Inline Reply Composer */}
                  {replyingToCommentId === c.id && (
                    <form onSubmit={(e) => handlePostReply(e, c.id)} className="mt-3 pl-3 border-l-2 border-[#007C8B]/40 space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-[#52657C]">
                        <span>Replying to <strong>@{c.author}</strong></span>
                        <button type="button" onClick={() => setReplyingToCommentId(null)} className="hover:text-[#D93838]">Cancel</button>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder={`Reply to @${c.author}...`}
                          className="w-full text-xs px-3 py-1.5 rounded-xl border border-[#0A2540]/15 bg-white focus:outline-none focus:border-[#007C8B]"
                          autoFocus
                        />
                        <button
                          type="submit"
                          disabled={submittingReply || !replyText.trim()}
                          className="px-3 py-1.5 rounded-xl bg-[#007C8B] text-white text-xs font-semibold disabled:opacity-40 hover:bg-[#00E5F4] hover:text-[#0A2540]"
                        >
                          {submittingReply ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Reply'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Threaded Nested Replies */}
                  {c.replies && c.replies.length > 0 && (
                    <div className="mt-3 pl-4 border-l-2 border-[#007C8B]/25 space-y-2.5">
                      {c.replies.map(rep => {
                        const isOwnRep = (rep.authorId && rep.authorId === currentUserId) || rep.author === currentUsername;
                        return (
                          <div key={rep.id} className="p-3 rounded-xl bg-white border border-[#0A2540]/6 space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-[#0A2540]">@{rep.author}</span>
                                <span className="text-[10px] text-[#6E7D90]">· {rep.time}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenReport('comment', rep.id, rep.text.slice(0, 30))}
                                  className="text-[#8C9BAE] hover:text-red-600 transition-colors p-1"
                                  title="Report reply"
                                >
                                  <Flag className="h-2.5 w-2.5" />
                                </button>
                                {isOwnRep && rep.id && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteComment(rep.id)}
                                    className="text-[#8C9BAE] hover:text-[#D93838] p-1 transition-colors"
                                    title="Delete reply"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                            <p className="text-xs text-[#374151] leading-relaxed">{rep.text}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

            {/* Mobile More Options Dropdown Modal */}
      {optionsMenuOpen && (
        <div className="fixed inset-0 z-50 bg-[#0A2540]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xs rounded-2xl bg-white border border-[#0A2540]/10 shadow-2xl p-4 space-y-2 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#0A2540]/8">
              <span className="font-bold text-[#0A2540]">Story Options</span>
              <button type="button" onClick={() => setOptionsMenuOpen(false)} className="text-[#6E7D90]">✕</button>
            </div>
            <button
              type="button"
              onClick={handleToggleMute}
              className="w-full text-left p-2.5 rounded-xl hover:bg-[#F0F5F8] flex items-center gap-2.5 text-[#52657C]"
            >
              <VolumeX className="h-4 w-4 text-[#007C8B]" />
              <span>{isAuthorMuted ? 'Unmute Author' : 'Mute Author'}</span>
            </button>
            <button
              type="button"
              onClick={handleBlockAuthor}
              className="w-full text-left p-2.5 rounded-xl hover:bg-[#F0F5F8] flex items-center gap-2.5 text-[#52657C]"
            >
              <UserX className="h-4 w-4" />
              <span>Block Author</span>
            </button>
            <button
              type="button"
              onClick={() => handleOpenReport('post', article.id, article.title)}
              className="w-full text-left p-2.5 rounded-xl hover:bg-red-50 flex items-center gap-2.5 text-red-600 border-t border-[#0A2540]/6 pt-2"
            >
              <Flag className="h-4 w-4" />
              <span>Report Story</span>
            </button>
          </div>
        </div>
      )}

      {/* Safety Report Modal */}
      {reportModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0A2540]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl border border-[#0A2540]/10 shadow-2xl p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-600 font-bold text-base">
                <Flag className="h-5 w-5" />
                <span>Report Content</span>
              </div>
              <button
                type="button"
                onClick={() => setReportModalOpen(false)}
                className="text-[#6E7D90] hover:text-[#0A2540] text-sm"
              >
                ✕
              </button>
            </div>

            {reportSubmitted ? (
              <div className="py-6 text-center space-y-2 text-emerald-700">
                <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-600" />
                <h4 className="font-bold text-sm">Report Received</h4>
                <p className="text-xs text-[#52657C]">Thank you for helping keep PENORA safe. Our moderation team will review this submission.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmitReport} className="space-y-4">
                <p className="text-xs text-[#52657C]">
                  Reporting {reportTarget.type === 'comment' ? 'comment' : 'story'}{reportTarget.name ? `: "${reportTarget.name}"` : ''}.
                </p>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#0A2540]">Reason for report</label>
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-[#0A2540]/15 bg-white text-[#0A2540] focus:outline-none focus:border-[#007C8B]"
                  >
                    <option value="Spam">Spam or unwanted promotional content</option>
                    <option value="Harassment">Harassment, threats, or abuse</option>
                    <option value="Plagiarism">Plagiarism or copyright infringement</option>
                    <option value="Misinformation">Misleading or deceptive information</option>
                    <option value="Inappropriate">Inappropriate or offensive content</option>
                    <option value="Other">Other policy violation</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#0A2540]">Additional details (optional)</label>
                  <textarea
                    rows={3}
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    placeholder="Provide details to assist our moderation review..."
                    className="w-full text-xs p-2.5 rounded-xl border border-[#0A2540]/15 bg-white text-[#0A2540] focus:outline-none focus:border-[#007C8B] resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setReportModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-[#52657C] hover:bg-[#F0F5F8]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={reportingBusy}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {reportingBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Flag className="h-3.5 w-3.5" />}
                    <span>Submit Report</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <SpatialAuthModalV4
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode="login"
        presentation="centered-modal"
      />

      <VotingStrengthModal
        isOpen={votingModalOpen}
        onClose={() => setVotingModalOpen(false)}
        articleId={article.id}
        articleTitle={article.title}
        direction={votingDirection}
        onConfirmSocialVote={async (_weight) => {
          const voterId = keyUser?.id || user?.id;
          if (voterId) {
            await submitPostVote(article.id, voterId, votingDirection, voteStats, setVoteStats);
          }
        }}
      />

        </div>
      </div>

      {/* ─── MOBILE ARTICLE READER (≤767px): MOBILE REDESIGN ─── */}
      <div className="md:hidden min-h-screen bg-[#F8FBFD] text-[#0A2540]">

      {/* ─── SLIM READING PROGRESS BAR (STICKY AT TOP) ─── */}
      <div
        aria-hidden="true"
        className="fixed top-0 inset-x-0 h-1 z-50 bg-[#0A2540]/5"
      >
        <div
          className="h-full bg-gradient-to-r from-[#007C8B] via-[#00E5F4] to-[#0A2540] transition-all duration-150"
          style={{ width: `${readingProgress}%` }}
        />
      </div>

      {/* ─── MOBILE STICKY TOP NAV BAR (≤767px) ─── */}
      <nav
        aria-label="Article Navigation"
        className="md:hidden sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#0A2540]/8 px-4 py-2.5 flex items-center justify-between shadow-xs"
      >
        <a
          href="/"
          className="p-1.5 -ml-1.5 rounded-full text-[#52657C] hover:text-[#0A2540] hover:bg-[#F0F5F8] transition-colors"
          aria-label="Back to feed"
        >
          <ArrowLeft className="h-5 w-5" />
        </a>

        {/* Center Logo */}
        <a href="/" className="flex items-center">
          <PenoraLogo variant="horizontal" size="xs" emblemSize={26} showTagline={false} />
        </a>

        {/* Right Actions */}
        <div className="flex items-center gap-1 -mr-1">
          <button
            type="button"
            onClick={handleBookmark}
            aria-pressed={bookmarked}
            className={`p-1.5 rounded-full transition-colors ${
              bookmarked ? 'text-[#007C8B]' : 'text-[#52657C] hover:text-[#0A2540]'
            }`}
            title={bookmarked ? 'Remove bookmark' : 'Bookmark story'}
          >
            <Bookmark className={`h-5 w-5 ${bookmarked ? 'fill-current' : ''}`} />
          </button>

          {/* Reblog Action */}
          <button
            type="button"
            onClick={handleReblog}
            aria-pressed={reblogged}
            className={`p-1.5 rounded-full transition-colors ${
              reblogged ? 'text-[#007C8B]' : 'text-[#52657C] hover:text-[#0A2540]'
            }`}
            title={reblogged ? 'Undo reblog' : 'Reblog story'}
          >
            <Repeat className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="p-1.5 rounded-full text-[#52657C] hover:text-[#0A2540] transition-colors"
            title="Share article"
          >
            {copiedLink ? <Check className="h-5 w-5 text-emerald-600" /> : <Share2 className="h-5 w-5" />}
          </button>

          <button
            type="button"
            onClick={() => setOptionsMenuOpen(v => !v)}
            className="p-1.5 rounded-full text-[#52657C] hover:text-[#0A2540] transition-colors"
            title="More options"
          >
            <MoreVertical className="h-5 w-5" />
          </button>
        </div>
      </nav>

      {/* ─── DESKTOP HEADER BAR (≥768px) ─── */}
      <div className="hidden md:flex max-w-4xl mx-auto items-center justify-between px-6 pt-6 pb-2">
        <a href="/" className="pn-btn pn-btn-secondary pn-btn-sm inline-flex items-center gap-1.5">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Feed</span>
        </a>

        <div className="flex items-center gap-2 relative">
          {/* Reblog Button */}
          <button
            type="button"
            onClick={handleReblog}
            data-active={reblogged ? 'true' : 'false'}
            aria-pressed={reblogged}
            className={`pn-icon-btn h-9 px-3 gap-1.5 bg-white border border-[#0A2540]/10 ${
              reblogged ? 'text-[#007C8B] font-semibold' : ''
            }`}
            title={reblogged ? 'Undo reblog' : 'Reblog story to your profile'}
          >
            <Repeat className={`h-4 w-4 ${reblogged ? 'text-[#007C8B]' : ''}`} />
            {reblogCount > 0 && <span className="text-xs">{reblogCount}</span>}
          </button>

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

          {/* Desktop More Options Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setOptionsMenuOpen(prev => !prev)}
              className="pn-icon-btn h-9 w-9 bg-white border border-[#0A2540]/10"
              title="More options"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            {optionsMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 rounded-2xl bg-white border border-[#0A2540]/10 shadow-lg py-2 z-50 text-xs text-[#0A2540]">
                <button
                  type="button"
                  onClick={handleToggleMute}
                  className="w-full text-left px-4 py-2 hover:bg-[#F0F5F8] flex items-center gap-2 text-[#52657C] hover:text-[#0A2540]"
                >
                  <VolumeX className="h-4 w-4 text-[#007C8B]" />
                  <span>{isAuthorMuted ? 'Unmute Author' : 'Mute Author'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleBlockAuthor}
                  className="w-full text-left px-4 py-2 hover:bg-[#F0F5F8] flex items-center gap-2 text-[#52657C] hover:text-[#0A2540]"
                >
                  <UserX className="h-4 w-4 text-[#52657C]" />
                  <span>Block Author</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenReport('post', article.id, article.title)}
                  className="w-full text-left px-4 py-2 hover:bg-red-50 flex items-center gap-2 text-red-600 border-t border-[#0A2540]/6 mt-1 pt-2"
                >
                  <Flag className="h-4 w-4" />
                  <span>Report Story</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── MAIN ARTICLE CONTAINER ─── */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-3 sm:py-6 space-y-6">
        {voteError && (
          <p role="alert" className="text-sm text-red-700 p-3 rounded-2xl bg-red-50 border border-red-200">
            {voteError}
          </p>
        )}

        {/* ─── ARTICLE HERO & COVER IMAGE (Matching Mobile Screen 2) ─── */}
        <article className="bg-white rounded-3xl border border-[#0A2540]/8 shadow-sm overflow-hidden">
          {/* Cover Image with Category Pill Overlay */}
          {article.coverImage && (
            <div className="relative w-full aspect-[16/10] sm:aspect-[21/9] bg-black/[0.02] overflow-hidden">
              <img
                src={article.coverImage}
                alt={article.coverImageAlt || article.title}
                className="w-full h-full object-cover block"
              />
              {/* Floating Category Pill */}
              <div className="absolute top-3.5 left-3.5 z-10">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/90 backdrop-blur-md text-[#0A2540] shadow-sm border border-black/5">
                  {article.topic}
                </span>
              </div>
            </div>
          )}

          {/* Article Header Content */}
          <div className="p-5 sm:p-12 space-y-5">
            {/* Title */}
            <h1 className="font-serif text-2xl sm:text-4xl font-bold leading-snug text-[#0A2540] tracking-tight">
              {article.title}
            </h1>

            {/* Subtitle / Excerpt */}
            {article.excerpt && (
              <p className="text-base sm:text-lg text-[#52657C] italic leading-relaxed font-light">
                {article.excerpt}
              </p>
            )}

            {/* ─── COMPACT AUTHOR ROW (Matching Mobile Screen 2) ─── */}
            <div className="flex items-center justify-between gap-3 py-3 border-y border-[#0A2540]/8">
              <a href={`/profile/${article.author.handle}`} className="flex items-center gap-3 min-w-0 group">
                <div className="relative shrink-0">
                  <img
                    src={article.author.avatar}
                    alt={article.author.name}
                    className="h-11 w-11 rounded-full object-cover ring-2 ring-[#00E5F4]/50 shadow-xs"
                  />
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-[#10B981] ring-2 ring-white" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-bold text-[#0A2540] group-hover:text-[#007C8B] truncate max-w-[130px]">
                      {article.author.name}
                    </span>
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[#F59E0B]/15 text-[#D97706] border border-[#F59E0B]/30 shrink-0">
                      <Crown className="h-2.5 w-2.5" />
                      Creator
                    </span>
                  </div>
                  <div className="text-[11px] text-[#6E7D90]">
                    <span>2 days ago</span> · <span>{article.readTimeMinutes} min read</span>
                  </div>
                </div>
              </a>

              {/* Follow Button */}
              <button
                type="button"
                onClick={handleFollow}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 ${
                  followingAuthor
                    ? 'bg-[#F0F5F8] text-[#52657C] hover:bg-[#E5EEF2]'
                    : 'bg-[#00E5F4]/15 text-[#007C8B] hover:bg-[#00E5F4]/30 border border-[#007C8B]/30'
                }`}
              >
                {followingAuthor ? 'Following' : 'Follow'}
              </button>
            </div>

            {/* ─── QUICK ENGAGEMENT BAR (Authentic Steemit Upvote/Downvote) ─── */}
            <div className="flex items-center justify-between py-2 text-[#52657C] text-sm">
              <div className="flex items-center gap-3">
                {/* Steemit Upvote ▲ / Downvote ▼ Group */}
                <div className="pn-vote-group" role="group" aria-label="Article voting">
                  <button
                    type="button"
                    onClick={() => handleVote(1)}
                    data-active={voteStats.userVote === 1 ? 'true' : 'false'}
                    aria-pressed={voteStats.userVote === 1}
                    aria-label={`Upvote (${voteStats.upvotes})`}
                    className="pn-vote-btn pn-vote-up"
                    title="Upvote ▲"
                  >
                    <span aria-hidden="true" className="text-[10px] leading-none">▲</span>
                    <span>{voteStats.upvotes}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleVote(-1)}
                    data-active={voteStats.userVote === -1 ? 'true' : 'false'}
                    aria-pressed={voteStats.userVote === -1}
                    aria-label={`Downvote (${voteStats.downvotes})`}
                    className="pn-vote-btn pn-vote-down"
                    title="Downvote ▼"
                  >
                    <span aria-hidden="true" className="text-[10px] leading-none">▼</span>
                    <span>{voteStats.downvotes}</span>
                  </button>
                </div>

                {/* Comment Counter & Scroll */}
                <button
                  type="button"
                  onClick={scrollToComments}
                  className="flex items-center gap-1.5 hover:text-[#007C8B] transition-colors text-xs font-semibold px-2.5 py-1 rounded-full bg-[#F4F7FA] border border-[#0A2540]/8"
                  aria-label="Scroll to comments"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>{comments.length}</span>
                </button>
              </div>

              <div className="flex items-center gap-3">
                {/* Reblog Action */}
                <button
                  type="button"
                  onClick={handleReblog}
                  className={`flex items-center gap-1 p-1.5 rounded-full transition-colors ${
                    reblogged ? 'text-[#007C8B] font-semibold' : 'hover:text-[#0A2540]'
                  }`}
                  aria-label="Reblog story"
                  title={reblogged ? 'Undo reblog' : 'Reblog story'}
                >
                  <Repeat className="h-5 w-5" />
                  {reblogCount > 0 && <span className="text-xs">{reblogCount}</span>}
                </button>

                {/* Bookmark Action */}
                <button
                  type="button"
                  onClick={handleBookmark}
                  className={`p-1.5 rounded-full transition-colors ${
                    bookmarked ? 'text-[#007C8B]' : 'hover:text-[#0A2540]'
                  }`}
                  aria-label="Bookmark"
                >
                  <Bookmark className={`h-5 w-5 ${bookmarked ? 'fill-current' : ''}`} />
                </button>

                {/* Share Action */}
                <button
                  type="button"
                  onClick={handleShare}
                  className="p-1.5 rounded-full hover:text-[#0A2540] transition-colors"
                  aria-label="Share"
                >
                  <Share2 className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* ─── ARTICLE BODY TYPOGRAPHY ─── */}
            <div
              className={`pt-4 leading-relaxed transition-all ${
                fontSize === 'large'
                  ? 'text-lg sm:text-xl'
                  : fontSize === 'xl'
                  ? 'text-xl sm:text-2xl'
                  : 'text-base sm:text-lg'
              }`}
            >
              <ArticleMarkdown content={article.content.join('\n\n')} />
            </div>

            {/* Tags Row */}
            {article.tags.length > 0 && (
              <div className="flex items-center gap-2 pt-6 border-t border-[#0A2540]/8 flex-wrap">
                {article.tags.map((tag) => (
                  <a
                    key={tag}
                    href={`/explore?q=${encodeURIComponent(tag)}`}
                    className="px-3 py-1 rounded-full text-xs font-semibold bg-[#F0F5F8] text-[#007C8B] hover:bg-[#00E5F4]/15 transition-colors"
                  >
                    #{tag}
                  </a>
                ))}
              </div>
            )}
          </div>
        </article>

        {/* ─── COMMENTS SECTION (Matching Mobile Screen 3) ─── */}
        <section
          ref={commentsSectionRef}
          id="comments"
          aria-label="Comments"
          className="bg-white rounded-3xl border border-[#0A2540]/8 shadow-sm p-5 sm:p-10 space-y-5"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#0A2540]/8">
            <h2 className="text-lg font-bold text-[#0A2540] flex items-center gap-2">
              <span>Comments</span>
              <span className="text-sm font-normal text-[#6E7D90]">({comments.length})</span>
            </h2>
            <div className="text-xs font-medium text-[#52657C] flex items-center gap-1 cursor-pointer">
              <span>Newest</span>
              <span>▾</span>
            </div>
          </div>

          {/* Inline Comment Composer */}
          <form onSubmit={handlePostComment} className="flex items-center gap-2.5 pt-1">
            <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-[#007C8B] to-[#00E5F4] flex items-center justify-center text-white font-bold text-xs shrink-0">
              {(keyUser?.username || user?.email || 'U')[0].toUpperCase()}
            </div>
            <div className="flex-1 relative flex items-center">
              <input
                type="text"
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder="Share your thoughts..."
                className="w-full text-xs sm:text-sm px-4 py-2.5 rounded-full border border-[#0A2540]/15 bg-[#F9FBFC] focus:outline-none focus:border-[#007C8B] pr-10"
              />
              <button
                type="submit"
                disabled={submittingComment || !newCommentText.trim()}
                className="absolute right-2 p-1.5 rounded-full bg-[#007C8B] text-white disabled:opacity-40 hover:bg-[#00E5F4] hover:text-[#0A2540] transition-colors"
                title="Post comment"
              >
                {submittingComment ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </form>

          {/* Comments List */}
          <div className="space-y-4 pt-2">
            {comments.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#6E7D90]">
                No comments yet. Be the first to share your thoughts!
              </div>
            ) : (
              comments.map((c, i) => {
                const currentUserId = keyUser?.id || user?.id;
                const currentUsername = keyUser?.username || user?.email?.split('@')[0];
                const isOwnComment =
                  (c.authorId && c.authorId === currentUserId) || (c.author && c.author === currentUsername);

                return (
                  <div key={c.id || i} className="space-y-2 pb-3 border-b border-[#0A2540]/5 last:border-none">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-[#0A2540]/5 flex items-center justify-center font-bold text-xs text-[#007C8B] shrink-0">
                          {c.author[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[#0A2540] flex items-center gap-1.5">
                            <span>{c.author}</span>
                            <span className="text-[10px] font-normal text-[#6E7D90]">· {c.time}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenReport('comment', c.id, c.text.slice(0, 30))}
                          className="text-[#8C9BAE] hover:text-red-600 p-1 transition-colors"
                          title="Report comment"
                        >
                          <Flag className="h-3 w-3" />
                        </button>
                        {isOwnComment && c.id && (
                          <button
                            type="button"
                            onClick={() => handleDeleteComment(c.id)}
                            className="text-[#8C9BAE] hover:text-[#D93838] p-1 transition-colors"
                            title="Delete comment"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-[#374151] pl-10 leading-relaxed">{c.text}</p>

                    <div className="flex items-center gap-4 pl-10 text-[11px] text-[#6E7D90]">
                      <button
                        type="button"
                        onClick={() => setReplyingToCommentId(replyingToCommentId === c.id ? null : c.id)}
                        className="hover:text-[#007C8B] font-medium flex items-center gap-1"
                      >
                        <CornerDownRight className="h-3 w-3" />
                        <span>Reply</span>
                      </button>
                    </div>

                    {/* Mobile Inline Reply Composer */}
                    {replyingToCommentId === c.id && (
                      <form onSubmit={(e) => handlePostReply(e, c.id)} className="ml-10 mt-2 p-2.5 rounded-2xl bg-[#F0F5F8]/80 border border-[#007C8B]/20 space-y-2">
                        <div className="flex items-center justify-between text-[10px] text-[#52657C]">
                          <span>Replying to <strong>@{c.author}</strong></span>
                          <button type="button" onClick={() => setReplyingToCommentId(null)} className="hover:text-[#D93838]">Cancel</button>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder={`Reply to @${c.author}...`}
                            className="w-full text-xs px-3 py-1.5 rounded-xl border border-[#0A2540]/15 bg-white focus:outline-none focus:border-[#007C8B]"
                            autoFocus
                          />
                          <button
                            type="submit"
                            disabled={submittingReply || !replyText.trim()}
                            className="px-3 py-1.5 rounded-xl bg-[#007C8B] text-white text-xs font-semibold disabled:opacity-40"
                          >
                            {submittingReply ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Send'}
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Mobile Threaded Replies */}
                    {c.replies && c.replies.length > 0 && (
                      <div className="ml-10 mt-2 pl-3 border-l-2 border-[#007C8B]/30 space-y-2">
                        {c.replies.map(rep => {
                          const isOwnRep = (rep.authorId && rep.authorId === currentUserId) || rep.author === currentUsername;
                          return (
                            <div key={rep.id} className="p-2.5 rounded-xl bg-[#F8FBFD] border border-[#0A2540]/6 space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-[#0A2540]">@{rep.author}</span>
                                  <span className="text-[10px] text-[#6E7D90]">· {rep.time}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenReport('comment', rep.id, rep.text.slice(0, 30))}
                                    className="text-[#8C9BAE] hover:text-red-600 p-0.5"
                                    title="Report reply"
                                  >
                                    <Flag className="h-2.5 w-2.5" />
                                  </button>
                                  {isOwnRep && rep.id && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteComment(rep.id)}
                                      className="text-[#8C9BAE] hover:text-[#D93838] p-0.5"
                                      title="Delete reply"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                              <p className="text-xs text-[#374151] leading-relaxed">{rep.text}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* ─── "MORE FROM AUTHOR" (Matching Mobile Screen 4) ─── */}
        <section aria-label="More from author" className="bg-white rounded-3xl border border-[#0A2540]/8 shadow-sm p-5 sm:p-8 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#0A2540]/8">
            <h2 className="text-base font-bold text-[#0A2540]">More from {article.author.name}</h2>
            <a
              href={`/profile/${article.author.handle}`}
              className="text-xs font-semibold text-[#007C8B] hover:underline"
            >
              View all
            </a>
          </div>

          {/* Author Mini Card */}
          <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#F8FBFD] border border-[#0A2540]/6">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={article.author.avatar}
                alt={article.author.name}
                className="h-11 w-11 rounded-full object-cover ring-2 ring-[#00E5F4]/40 shrink-0"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-sm text-[#0A2540] truncate">{article.author.name}</span>
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[#F59E0B]/15 text-[#D97706]">
                    <Crown className="h-2.5 w-2.5" />
                    Creator
                  </span>
                </div>
                <div className="text-[11px] text-[#6E7D90] truncate">@{article.author.handle}</div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleFollow}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors shrink-0 ${
                followingAuthor
                  ? 'bg-white text-[#52657C] border border-[#0A2540]/15'
                  : 'bg-[#00E5F4]/20 text-[#007C8B] hover:bg-[#00E5F4]/30'
              }`}
            >
              {followingAuthor ? 'Following' : 'Follow'}
            </button>
          </div>

          {/* Related Articles List */}
          <div className="space-y-3 pt-1">
            {(moreArticles.length > 0 ? moreArticles : MOCK_ARTICLES.slice(0, 3)).map((item: any) => (
              <a
                key={item.id}
                href={`/read?slug=${encodeURIComponent(item.slug)}`}
                className="flex items-center gap-3.5 p-2 rounded-2xl hover:bg-[#F8FBFD] transition-colors group"
              >
                <img
                  src={item.cover_image_url || item.coverImage || '/brand/penora-celestial-cover-default.jpg'}
                  alt={item.title}
                  className="h-16 w-16 rounded-xl object-cover shrink-0 border border-[#0A2540]/10"
                />
                <div className="min-w-0 flex-1">
                  <h3 className="text-xs sm:text-sm font-bold text-[#0A2540] group-hover:text-[#007C8B] line-clamp-2 leading-snug">
                    {item.title}
                  </h3>
                  <div className="flex items-center gap-3 text-[11px] text-[#6E7D90] mt-1">
                    <span>{Math.max(1, Math.ceil((item.content?.length || 600) / 1000))} min read</span>
                    <span>·</span>
                    <span className="text-[11px] text-[#007C8B] font-semibold">
                      ▲ Read story
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>

          {/* Support Creator CTA Card */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#00E5F4]/10 via-[#007C8B]/10 to-transparent border border-[#007C8B]/20 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-xl shrink-0">🪷</span>
              <div className="min-w-0">
                <div className="text-xs font-bold text-[#0A2540] truncate">Support creators on PENORA</div>
                <div className="text-[10px] text-[#52657C] truncate">Read, share and be part of the community ♡</div>
              </div>
            </div>
            <a
              href={`/profile/${article.author.handle}`}
              className="p-1 rounded-full bg-white shadow-xs text-[#007C8B] hover:text-[#0A2540] shrink-0"
              title="Visit profile"
            >
              <ChevronRight className="h-4 w-4" />
            </a>
          </div>
        </section>
      </main>

      {/* ─── FLOATING MOBILE READING DOCK (Matching Mobile Screen 2 bottom) ─── */}
      <div
        aria-label="Reading Controls"
        className="md:hidden fixed bottom-4 inset-x-4 z-30 max-w-sm mx-auto bg-white/95 backdrop-blur-md rounded-full border border-[#0A2540]/12 shadow-[0_8px_30px_rgba(10,37,64,0.12)] py-2 px-4 flex items-center justify-between text-xs"
      >
        {/* Font Size Adjuster Aa */}
        <button
          type="button"
          onClick={toggleFontSize}
          className="flex items-center gap-1 text-[#52657C] hover:text-[#0A2540] font-serif font-bold text-sm px-2 py-1 rounded-full hover:bg-[#F0F5F8]"
          title="Adjust reading text size"
        >
          <span>Aa</span>
        </button>

        {/* Reading Progress Indicator Slider */}
        <div className="flex-1 mx-4 flex items-center gap-2">
          <div className="h-1.5 w-full bg-[#0A2540]/10 rounded-full overflow-hidden">
            <div className="h-full bg-[#007C8B] rounded-full" style={{ width: `${readingProgress}%` }} />
          </div>
          <span className="text-[11px] text-[#6E7D90] whitespace-nowrap">{minutesLeft} min left</span>
        </div>

        {/* Jump to Comments / TOC */}
        <button
          type="button"
          onClick={scrollToComments}
          className="p-1.5 text-[#52657C] hover:text-[#0A2540] rounded-full hover:bg-[#F0F5F8]"
          title="Jump to responses"
          aria-label="Jump to responses"
        >
          <List className="h-4 w-4" />
        </button>
      </div>

            {/* Mobile More Options Dropdown Modal */}
      {optionsMenuOpen && (
        <div className="fixed inset-0 z-50 bg-[#0A2540]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xs rounded-2xl bg-white border border-[#0A2540]/10 shadow-2xl p-4 space-y-2 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#0A2540]/8">
              <span className="font-bold text-[#0A2540]">Story Options</span>
              <button type="button" onClick={() => setOptionsMenuOpen(false)} className="text-[#6E7D90]">✕</button>
            </div>
            <button
              type="button"
              onClick={handleToggleMute}
              className="w-full text-left p-2.5 rounded-xl hover:bg-[#F0F5F8] flex items-center gap-2.5 text-[#52657C]"
            >
              <VolumeX className="h-4 w-4 text-[#007C8B]" />
              <span>{isAuthorMuted ? 'Unmute Author' : 'Mute Author'}</span>
            </button>
            <button
              type="button"
              onClick={handleBlockAuthor}
              className="w-full text-left p-2.5 rounded-xl hover:bg-[#F0F5F8] flex items-center gap-2.5 text-[#52657C]"
            >
              <UserX className="h-4 w-4" />
              <span>Block Author</span>
            </button>
            <button
              type="button"
              onClick={() => handleOpenReport('post', article.id, article.title)}
              className="w-full text-left p-2.5 rounded-xl hover:bg-red-50 flex items-center gap-2.5 text-red-600 border-t border-[#0A2540]/6 pt-2"
            >
              <Flag className="h-4 w-4" />
              <span>Report Story</span>
            </button>
          </div>
        </div>
      )}

      {/* Safety Report Modal */}
      {reportModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0A2540]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl border border-[#0A2540]/10 shadow-2xl p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-600 font-bold text-base">
                <Flag className="h-5 w-5" />
                <span>Report Content</span>
              </div>
              <button
                type="button"
                onClick={() => setReportModalOpen(false)}
                className="text-[#6E7D90] hover:text-[#0A2540] text-sm"
              >
                ✕
              </button>
            </div>

            {reportSubmitted ? (
              <div className="py-6 text-center space-y-2 text-emerald-700">
                <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-600" />
                <h4 className="font-bold text-sm">Report Received</h4>
                <p className="text-xs text-[#52657C]">Thank you for helping keep PENORA safe. Our moderation team will review this submission.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmitReport} className="space-y-4">
                <p className="text-xs text-[#52657C]">
                  Reporting {reportTarget.type === 'comment' ? 'comment' : 'story'}{reportTarget.name ? `: "${reportTarget.name}"` : ''}.
                </p>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#0A2540]">Reason for report</label>
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-[#0A2540]/15 bg-white text-[#0A2540] focus:outline-none focus:border-[#007C8B]"
                  >
                    <option value="Spam">Spam or unwanted promotional content</option>
                    <option value="Harassment">Harassment, threats, or abuse</option>
                    <option value="Plagiarism">Plagiarism or copyright infringement</option>
                    <option value="Misinformation">Misleading or deceptive information</option>
                    <option value="Inappropriate">Inappropriate or offensive content</option>
                    <option value="Other">Other policy violation</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#0A2540]">Additional details (optional)</label>
                  <textarea
                    rows={3}
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    placeholder="Provide details to assist our moderation review..."
                    className="w-full text-xs p-2.5 rounded-xl border border-[#0A2540]/15 bg-white text-[#0A2540] focus:outline-none focus:border-[#007C8B] resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setReportModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-[#52657C] hover:bg-[#F0F5F8]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={reportingBusy}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {reportingBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Flag className="h-3.5 w-3.5" />}
                    <span>Submit Report</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <SpatialAuthModalV4
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode="login"
        presentation="centered-modal"
      />

      <VotingStrengthModal
        isOpen={votingModalOpen}
        onClose={() => setVotingModalOpen(false)}
        articleId={article.id}
        articleTitle={article.title}
        direction={votingDirection}
        onConfirmSocialVote={async (_weight) => {
          const voterId = keyUser?.id || user?.id;
          if (voterId) {
            await submitPostVote(article.id, voterId, votingDirection, voteStats, setVoteStats);
          }
        }}
      />

      </div>
    </div>
  );
};
