// src/components/editor/ArticleEditorView.tsx
// PENORA Blockchain — Article Studio Shell (/editor)
// Aligned with the approved PENORA Blockchain Identity System.
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bold,
  Italic,
  Heading2,
  Quote,
  Code,
  List,
  Eye,
  Edit3,
  Send,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  Upload,
  ImageIcon,
  Trash2,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { createPost, updatePost, getArticleBySlug, getUserArticles, deletePost } from '../../lib/api/articles';
import { SpatialAuthModalV4 } from '../design-v4/SpatialAuthModalV4';
import { penoraKeyAuth, type PenoraUser } from '../../lib/auth/penoraKeyAuth';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { PostRecord } from '../../lib/api/types';
import { ArticleMarkdown } from './ArticleMarkdown';
import { formatMarkdown, articleSlug, normalizeTags, isValidCoverUrl, type MarkdownAction } from '../../lib/articleEditor';
import { validateImageFile } from '../../lib/api/storage';
import {
  hasDraftContent,
  readArticleDraft,
  saveArticleDraft,
  removeArticleDraft,
  type ArticleDraft,
} from '../../lib/articleDrafts';

export const ArticleEditorView: React.FC = () => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [keyUser, setKeyUser] = useState<PenoraUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Editor fields — start completely blank on new entry
  const [title, setTitle] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [content, setContent] = useState('');
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState<string | null>(null);
  const [publishSuccessSlug, setPublishSuccessSlug] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  // Editing existing post vs writing fresh
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [editingPublished, setEditingPublished] = useState(false);
  const [editingAuthorId, setEditingAuthorId] = useState<string | null>(null);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [cloudDrafts, setCloudDrafts] = useState<PostRecord[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const mutationInFlight = useRef(false);
  const activeAuthorId = user?.id || keyUser?.id || null;
  const ownershipError = editingAuthorId && activeAuthorId && editingAuthorId !== activeAuthorId
    ? 'You can only edit your own blogs.' : null;
  const [unsavedDraftAvailable, setUnsavedDraftAvailable] = useState<ArticleDraft | null>(null);
  const [editorReady, setEditorReady] = useState(false);
  const [hasLocalEdits, setHasLocalEdits] = useState(false);
  const [draftStatus, setDraftStatus] = useState('');
  const [draftStorageError, setDraftStorageError] = useState<string | null>(null);
  const editorLoadSequence = useRef(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const loadSequence = ++editorLoadSequence.current;
    const params = new URLSearchParams(window.location.search);
    const editSlug = params.get('edit');
    if (editSlug) {
      getArticleBySlug(editSlug).then(res => {
        if (editorLoadSequence.current !== loadSequence) return;
        if (res.data) {
          setEditingPostId(res.data.id);
          setEditingSlug(res.data.slug);
          setEditingPublished(res.data.published);
          setEditingAuthorId(res.data.author_id);
          setTitle(res.data.title);
          setTagsInput((res.data.tags || []).join(', '));
          setCoverImageUrl(res.data.cover_image_url || '');
          setExcerpt(res.data.excerpt || '');
          setContent(res.data.content);
          const saved = readArticleDraft();
          if (saved?.postId === res.data.id && saved.slug === res.data.slug) {
            setUnsavedDraftAvailable(saved);
          }
          setEditorReady(true);
        } else {
          setPublishError(res.error || 'This blog could not be loaded. Use New Blank to start another blog.');
        }
      });
    } else {
      // Keep recovery opt-in; mounting a blank editor must never overwrite a saved draft.
      setUnsavedDraftAvailable(readArticleDraft());
      setEditorReady(true);
    }

    return () => { editorLoadSequence.current += 1; };
  }, []);

  const persistCurrentDraft = useCallback(() => {
    const draft: ArticleDraft = {
      title,
      tags: tagsInput,
      coverImageUrl,
      excerpt,
      content,
      updatedAt: new Date().toISOString(),
      postId: editingPostId,
      slug: editingSlug,
      authorId: editingAuthorId,
    };
    const error = hasDraftContent(draft) ? saveArticleDraft(draft) : removeArticleDraft();
    setDraftStorageError(error);
    setDraftStatus(error ? '' : hasDraftContent(draft) ? 'Draft saved in this browser' : '');
    return error === null;
  }, [title, tagsInput, coverImageUrl, excerpt, content, editingPostId, editingSlug, editingAuthorId]);

  useEffect(() => {
    if (!editorReady || !hasLocalEdits || unsavedDraftAvailable) return;
    setDraftStatus('Saving draft…');
    const timer = window.setTimeout(persistCurrentDraft, 500);

    // Flush the debounce when leaving so the last title/tag edit survives an immediate refresh.
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!persistCurrentDraft()) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    const handlePageHide = () => { persistCurrentDraft(); };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') persistCurrentDraft();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [editorReady, hasLocalEdits, unsavedDraftAvailable, persistCurrentDraft]);

  const handleRestoreDraft = async () => {
    if (!unsavedDraftAvailable) return;
    setTitle(unsavedDraftAvailable.title);
    setTagsInput(unsavedDraftAvailable.tags);
    setCoverImageUrl(unsavedDraftAvailable.coverImageUrl);
    setExcerpt(unsavedDraftAvailable.excerpt);
    setContent(unsavedDraftAvailable.content);
    setEditingPostId(unsavedDraftAvailable.postId);
    setEditingSlug(unsavedDraftAvailable.slug);
    setEditingAuthorId(unsavedDraftAvailable.authorId || null);
    // Treat unknown recovered cloud posts as published until the server confirms otherwise.
    setEditingPublished(Boolean(unsavedDraftAvailable.postId));
    if (unsavedDraftAvailable.postId && unsavedDraftAvailable.slug) {
      const sequence = editorLoadSequence.current;
      setEditorReady(false);
      const result = await getArticleBySlug(unsavedDraftAvailable.slug);
      if (sequence !== editorLoadSequence.current) return;
      if (result.data?.id === unsavedDraftAvailable.postId) {
        setEditingPublished(result.data.published);
        setEditingAuthorId(result.data.author_id);
      }
      setEditorReady(true);
    }
    setHasLocalEdits(true);
    setUnsavedDraftAvailable(null);
  };

  const handleDiscardDraft = () => {
    const error = removeArticleDraft();
    setDraftStorageError(error);
    if (error) return;
    setUnsavedDraftAvailable(null);
  };

  const resetEditor = () => {
    // Invalidate an in-flight edit load before clearing the target article.
    editorLoadSequence.current += 1;
    setTitle('');
    setTagsInput('');
    setCoverImageUrl('');
    setExcerpt('');
    setContent('');
    setEditingPostId(null);
    setEditingSlug(null);
    setEditingPublished(false);
    setEditingAuthorId(null);
    setUnsavedDraftAvailable(null);
    setHasLocalEdits(false);
    setDraftStatus('');
    setDraftStorageError(removeArticleDraft());
    setMode('edit');
    setEditorReady(true);
    const url = new URL(window.location.href);
    url.searchParams.delete('edit');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  };

  const handleClearEditor = () => {
    if ((hasDraftContent({ title, tags: tagsInput, coverImageUrl, excerpt, content }) || unsavedDraftAvailable)
      && !window.confirm('Clear editor and discard the browser draft to start a new blank blog?')) {
      return;
    }
    resetEditor();
    setPublishSuccess(null);
    setPublishSuccessSlug(null);
    setPublishError(null);
  };

  useEffect(() => {
    let mounted = true;
    const unsubKeyAuth = penoraKeyAuth.subscribe(ku => {
      if (mounted) {
        setKeyUser(ku);
        if (ku) setAuthLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setUser(data.session?.user ?? null);
        setAuthLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setUser(session?.user ?? null);
        setAuthLoading(false);
      }
    });

    return () => {
      mounted = false;
      unsubKeyAuth();
      subscription.unsubscribe();
    };
  }, []);

  const handleContentChange = (val: string) => {
    setHasLocalEdits(true);
    setContent(val);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = '';
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setPublishError(validation.error || 'Please select a valid image.');
      return;
    }

    // Read untouched, full-resolution file data URL without ANY cropping or resizing
    const uploadSequence = editorLoadSequence.current;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (editorLoadSequence.current !== uploadSequence) return;
      const result = event.target?.result as string;
      if (result) {
        setCoverImageUrl(result);
        setHasLocalEdits(true);
        setPublishError(null);
      }
    };
    reader.onerror = () => setPublishError('This image could not be read. Please try another file.');
    reader.readAsDataURL(file);
  };

  const insertFormatting = (action: MarkdownAction) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const result = formatMarkdown(textarea.value, textarea.selectionStart, textarea.selectionEnd, action);
    handleContentChange(result.text);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(result.start, result.end);
    });
  };

  const handleOpenDrafts = async () => {
    if (!activeAuthorId) { setAuthModalOpen(true); return; }
    setDraftsOpen(true);
    setDraftsLoading(true);
    const result = await getUserArticles(activeAuthorId);
    setCloudDrafts(result.data.filter(post => !post.published));
    setPublishError(result.error);
    setDraftsLoading(false);
  };

  const handleDeleteDraft = async (draft: PostRecord) => {
    if (mutationInFlight.current || !window.confirm(`Delete draft "${draft.title}"? This cannot be undone.`)) return;
    mutationInFlight.current = true;
    setIsSavingDraft(true);
    try {
      const result = await deletePost(draft.id);
      if (result.error || !result.success) { setPublishError(result.error || 'Draft could not be deleted.'); return; }
      setCloudDrafts(current => current.filter(post => post.id !== draft.id));
      if (editingPostId === draft.id) resetEditor();
    } finally { mutationInFlight.current = false; setIsSavingDraft(false); }
  };

  const handleSaveDraft = async () => {
    if (mutationInFlight.current || !editorReady || unsavedDraftAvailable || ownershipError) return;
    setPublishError(null);
    setPublishSuccess(null);
    setPublishSuccessSlug(null);

    if (!title.trim() && !content.trim()) {
      setPublishError('Draft must have a title or content before saving.');
      return;
    }

    if (!isValidCoverUrl(coverImageUrl)) { setPublishError('Use a valid http or https cover image URL.'); return; }
    const locallySaved = persistCurrentDraft();
    if (editingPostId && editingPublished) {
      if (locallySaved) setPublishSuccess('Changes saved in this browser. Your published blog stays unchanged until you select Update Blog.');
      return;
    }

    const authorId = user?.id || keyUser?.id;
    if (!authorId) {
      if (locallySaved) setPublishSuccess('Draft saved locally in browser storage. Sign in with your Private Posting Key to sync drafts to the cloud.');
      return;
    }

    mutationInFlight.current = true;
    setIsSavingDraft(true);
    const slug = editingSlug || articleSlug(title || 'Untitled Draft');
    const tags = normalizeTags(tagsInput);

    try {
      let res;
      if (editingPostId) {
        res = await updatePost(editingPostId, {
          title: title.trim() || 'Untitled Draft',
          excerpt: excerpt.trim() || (content.trim() ? content.trim().slice(0, 160) + '...' : ''),
          content: content.trim(),
          cover_image_url: coverImageUrl.trim() || null,
          tags,
          published: false,
        });
      } else {
        res = await createPost({
          author_id: authorId,
          author_username: keyUser?.username || user?.email?.split('@')[0],
          title: title.trim() || 'Untitled Draft',
          slug,
          excerpt: excerpt.trim() || (content.trim() ? content.trim().slice(0, 160) + '...' : ''),
          content: content.trim(),
          cover_image_url: coverImageUrl.trim() || null,
          tags,
          published: false,
        });
        if (res.data?.id) {
          setEditingPostId(res.data.id);
          setEditingSlug(res.data.slug);
          setEditingAuthorId(res.data.author_id);
          setHasLocalEdits(true);
        }
      }

      if (res.isPendingMigration) {
        if (locallySaved) setPublishSuccess('Draft saved in this browser. Cloud draft sync is currently unavailable.');
      } else if (res.error) {
        if (res.error.includes('row-level security') || res.error.includes('42501')) {
          if (locallySaved) setPublishSuccess('Draft saved locally in browser storage. (Cloud database sync requires an active authenticated session).');
        } else {
          setPublishError(res.error);
        }
      } else if (res.data) {
        setPublishSuccess('Draft saved privately to your account (unpublished).');
      }
    } catch (err: any) {
      setPublishError(err.message || 'Failed to save draft.');
    } finally {
      mutationInFlight.current = false;
      setIsSavingDraft(false);
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mutationInFlight.current || !editorReady || unsavedDraftAvailable) return;
    if (ownershipError) { setPublishError(ownershipError); return; }
    setPublishError(null);
    setPublishSuccess(null);
    setPublishSuccessSlug(null);

    const authorId = user?.id || keyUser?.id;
    if (!authorId) {
      setAuthModalOpen(true);
      return;
    }

    if (keyUser && !penoraKeyAuth.hasPermission('publish')) {
      setPublishError('Your active session does not have Posting permissions to publish blogs.');
      return;
    }

    if (!title.trim()) {
      setPublishError('Please enter a blog title before publishing.');
      return;
    }

    if (!content.trim() || content.trim().length < 10) {
      setPublishError('Please provide meaningful blog content (at least 10 characters) before publishing.');
      return;
    }

    if (!isValidCoverUrl(coverImageUrl)) { setPublishError('Use a valid http or https cover image URL.'); return; }
    const locallySaved = persistCurrentDraft();
    mutationInFlight.current = true;
    setIsPublishing(true);

    const slug = editingSlug || articleSlug(title);
    const tags = normalizeTags(tagsInput);

    try {
      let res;
      if (editingPostId) {
        res = await updatePost(editingPostId, {
          title: title.trim(),
          excerpt: excerpt.trim() || content.trim().slice(0, 160) + '...',
          content: content.trim(),
          cover_image_url: coverImageUrl.trim() || null,
          tags,
          published: true,
        });
      } else {
        res = await createPost({
          author_id: authorId,
          author_username: keyUser?.username || user?.email?.split('@')[0],
          title: title.trim(),
          slug,
          excerpt: excerpt.trim() || content.trim().slice(0, 160) + '...',
          content: content.trim(),
          cover_image_url: coverImageUrl.trim() || null,
          tags,
          published: true,
        });
      }

      if (res.isPendingMigration) {
        setPublishError(
          locallySaved
            ? 'Publishing is currently unavailable. Your blog is saved as a draft in this browser.'
            : 'Publishing is currently unavailable and your browser draft could not be saved. Keep this page open and copy your writing.'
        );
      } else if (res.error) {
        if (res.error.includes('row-level security') || res.error.includes('42501')) {
          setPublishError('Publishing requires an active authenticated session. Please sign in or complete email verification.');
        } else {
          setPublishError(res.error);
        }
      } else if (res.data) {
        const finalSlug = res.data.slug || editingSlug || slug;
        resetEditor();
        setPublishSuccess('Blog published successfully!');
        setPublishSuccessSlug(finalSlug);
      }
    } catch (err: any) {
      setPublishError(err.message || 'Failed to publish blog.');
    } finally {
      mutationInFlight.current = false;
      setIsPublishing(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Studio Top Toolbar: Back to Feed | Compose/Preview, Save Draft, Publish Blog */}
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div>
          <a href="/" className="pn-btn pn-btn-secondary pn-btn-sm sm:h-9">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Feed</span>
          </a>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
          {/* Edit / Preview Segmented Switcher */}
          <div className="pn-segmented w-56 sm:w-60 mr-1 sm:mr-2">
            <button
              type="button"
              aria-selected={mode === 'edit'}
              onClick={() => setMode('edit')}
              className="flex items-center justify-center gap-2 px-3.5 py-1"
            >
              <Edit3 className="h-3.5 w-3.5 shrink-0" />
              <span>Compose</span>
            </button>
            <button
              type="button"
              aria-selected={mode === 'preview'}
              onClick={() => setMode('preview')}
              className="flex items-center justify-center gap-2 px-3.5 py-1"
            >
              <Eye className="h-3.5 w-3.5 shrink-0" />
              <span>Preview</span>
            </button>
          </div>

          {/* New / Clear Draft CTA */}
          <button
            type="button"
            onClick={handleClearEditor}
            disabled={isSavingDraft || isPublishing}
            className="pn-btn pn-btn-secondary pn-btn-sm sm:h-9"
            title="Start new blank story"
          >
            <Trash2 className="h-3.5 w-3.5 text-[#52657C]" />
            <span className="hidden sm:inline">New Blank</span>
          </button>

          {/* Save Draft CTA */}
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={isSavingDraft || isPublishing || !editorReady || !!unsavedDraftAvailable || !!ownershipError}
            className="pn-btn pn-btn-secondary pn-btn-sm sm:h-9"
            title="Save draft"
          >
            {isSavingDraft ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Saving…</span>
              </>
            ) : (
              <span>Save Draft</span>
            )}
          </button>

          {/* Branded Publish CTA */}
          <button
            type="button"
            onClick={handlePublish}
            disabled={isSavingDraft || isPublishing || !editorReady || !!unsavedDraftAvailable || !!ownershipError}
            className="pn-btn pn-btn-brand pn-btn-sm sm:h-9 sm:px-5"
          >
            {isPublishing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Publishing…</span>
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                <span>{editingPublished ? 'Update Blog' : 'Publish Blog'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="mb-5 flex items-center justify-between gap-3 flex-wrap">
        <button type="button" onClick={handleOpenDrafts} className="pn-btn pn-btn-secondary pn-btn-sm">My Drafts</button>
        <span className="text-xs text-[#4A5B70]">{content.trim() ? content.trim().split(/\s+/).length : 0} words · {Math.max(1, Math.ceil(content.trim().split(/\s+/).filter(Boolean).length / 200))} min read</span>
      </div>
      {draftsOpen && (
        <div className="pn-panel p-4 mb-6 space-y-3" aria-label="My saved drafts">
          <div className="flex justify-between items-center"><strong>My Drafts</strong><button type="button" className="pn-btn pn-btn-ghost pn-btn-sm" onClick={() => setDraftsOpen(false)}>Close</button></div>
          {draftsLoading ? <p role="status">Loading drafts…</p> : cloudDrafts.length ? cloudDrafts.map(draft => (
            <div key={draft.id} className="flex items-center justify-between gap-3 border-t border-[#0A2540]/10 pt-3">
              <a className="text-sm text-[#007C8B] underline" href={`/editor?edit=${encodeURIComponent(draft.slug)}`}>{draft.title || 'Untitled Draft'}</a>
              <button type="button" className="pn-btn pn-btn-ghost pn-btn-sm" disabled={isSavingDraft} onClick={() => handleDeleteDraft(draft)} aria-label={`Delete draft ${draft.title}`}>Delete</button>
            </div>
          )) : <p className="text-sm text-[#4A5B70]">No cloud drafts saved to this account yet.</p>}
        </div>
      )}
      {ownershipError && <p role="alert" className="pn-alert pn-alert-error mb-6">{ownershipError}</p>}
      {/* Status Alerts */}
      {publishSuccess && (
        <div className="pn-alert pn-alert-success mb-6">
          <CheckCircle2 className="h-4 w-4 text-[#0E9F6E] flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <strong className="font-semibold block">{publishSuccessSlug ? 'Publication Confirmed' : 'Draft Saved'}</strong>
            <p>{publishSuccess}</p>
            {publishSuccessSlug && (
              <a
                href={`/story/${publishSuccessSlug}`}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0E9F6E] underline hover:opacity-80 pt-1"
              >
                <span>Read your published blog live</span>
                <ArrowRight className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      )}

      {unsavedDraftAvailable && (
        <div className="pn-panel p-4 mb-6 flex items-center justify-between gap-3 border border-[#007C8B]/30 bg-[#00E5F4]/5 flex-wrap">
          <div className="text-xs text-[#0A2540]">
            <strong className="font-bold block text-sm text-[#007C8B]">Unsaved Draft Detected</strong>
            <span>An unsaved draft ("{unsavedDraftAvailable.title || 'Untitled'}") was saved in your browser. Would you like to restore it?</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleRestoreDraft}
              className="pn-btn pn-btn-brand pn-btn-sm text-xs"
            >
              Restore Draft
            </button>
            <button
              type="button"
              onClick={handleDiscardDraft}
              className="pn-btn pn-btn-secondary pn-btn-sm text-xs"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {publishError && (
        <div className="pn-alert pn-alert-error mb-6">
          <AlertCircle className="h-4 w-4 text-[#D0384B] flex-shrink-0 mt-0.5" />
          <div>
            <strong className="font-semibold block">Publishing Error</strong>
            <p>{publishError}</p>
          </div>
        </div>
      )}

      {draftStorageError ? (
        <div role="alert" className="pn-alert pn-alert-error mb-6">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{draftStorageError}</p>
        </div>
      ) : (
        <p role="status" aria-live="polite" className="text-xs text-[#4A5B70] mb-4 min-h-4">
          {!editorReady ? 'Loading blog…' : draftStatus}
        </p>
      )}

      {!user && !keyUser && !authLoading && (
        <div className="pn-alert pn-alert-info mb-6 items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-4 w-4 text-[#007C8B] flex-shrink-0" />
            <span>
              Composing in local draft mode. Sign in to publish under your verified PENORA creator identity.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setAuthModalOpen(true)}
            className="pn-btn pn-btn-primary pn-btn-sm flex-shrink-0"
          >
            Sign In
          </button>
        </div>
      )}

      {/* Main Studio Card */}
      <fieldset
        disabled={!editorReady || !!unsavedDraftAvailable || isPublishing || isSavingDraft || !!ownershipError || (!!editingPostId && !activeAuthorId)}
        className="pn-card p-6 sm:p-10 relative overflow-hidden min-w-0"
      >
        {/* Top signature teal gradient accent */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-1"
          style={{ background: 'var(--pn-gradient)' }}
        />

        {mode === 'edit' ? (
          <div className="space-y-6">
            {/* Title Input */}
            <div>
              <input
                type="text"
                value={title}
                onChange={e => { setHasLocalEdits(true); setTitle(e.target.value); }}
                placeholder="Blog title..."
                className="pn-display w-full text-2xl sm:text-3xl font-bold text-[#0A2540] placeholder:text-[#6E7D90]/50 bg-transparent border-none focus:outline-none leading-tight"
              />
            </div>

            {/* Subtitle / Excerpt */}
            <div>
              <input
                type="text"
                value={excerpt}
                onChange={e => { setHasLocalEdits(true); setExcerpt(e.target.value); }}
                placeholder="Write a concise summary or thesis statement..."
                className="w-full text-sm text-[#4A5B70] placeholder:text-[#6E7D90]/60 bg-transparent border-none focus:outline-none"
              />
            </div>

            {/* Meta Fields: Cover Image & Tags */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[#0A2540]/8">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="pn-field-label mb-0">Cover Image</label>
                  {coverImageUrl && (
                    <button
                      type="button"
                      onClick={() => { setHasLocalEdits(true); setCoverImageUrl(''); }}
                      className="text-[11px] text-[#C44] hover:underline inline-flex items-center gap-1 font-medium"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={coverImageUrl.startsWith('data:') ? 'Local Image File Attached (Original Aspect Ratio)' : coverImageUrl}
                    onChange={e => { setHasLocalEdits(true); setCoverImageUrl(e.target.value); }}
                    placeholder="Paste image URL (https://...)"
                    className="pn-input text-xs h-10 flex-1 truncate"
                    disabled={coverImageUrl.startsWith('data:')}
                  />
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="pn-btn pn-btn-secondary pn-btn-sm h-10 px-3 text-xs flex-shrink-0"
                    title="Upload image as-is (no cropping or resizing)"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>Upload</span>
                  </button>
                </div>
                <p className="text-[11px] text-[#6E7D90] mt-1">
                  PNG, JPEG, WebP or GIF · up to 5 MB. Original proportions are preserved.
                </p>
              </div>

              <div>
                <label className="pn-field-label">Topic Tags (comma separated)</label>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={e => { setHasLocalEdits(true); setTagsInput(e.target.value); }}
                  placeholder="protocol, design, web3"
                  className="pn-input text-xs h-10"
                />
              </div>
            </div>

            {/* Markdown Formatting Toolbar */}
            <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[#F4F7FA] border border-[#0A2540]/8 overflow-x-auto">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => insertFormatting('bold')}
                  className="pn-icon-btn h-8 w-8"
                  title="Bold"
                >
                  <Bold className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => insertFormatting('italic')}
                  className="pn-icon-btn h-8 w-8"
                  title="Italic"
                >
                  <Italic className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => insertFormatting('heading')}
                  className="pn-icon-btn h-8 w-8"
                  title="Section Heading"
                >
                  <Heading2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => insertFormatting('quote')}
                  className="pn-icon-btn h-8 w-8"
                  title="Blockquote"
                >
                  <Quote className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => insertFormatting('code')}
                  className="pn-icon-btn h-8 w-8"
                  title="Code Block"
                >
                  <Code className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => insertFormatting('list')}
                  className="pn-icon-btn h-8 w-8"
                  title="Bullet List"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
              <span className="text-[11px] text-[#6E7D90] pr-2 hidden sm:inline">
                Markdown supported
              </span>
            </div>

            {/* Body Editor */}
            <div>
              <textarea
                ref={textareaRef}
                value={content}
                onChange={e => handleContentChange(e.target.value)}
                onKeyDown={e => {
                  if (!(e.ctrlKey || e.metaKey)) return;
                  const key = e.key.toLowerCase();
                  if (key === 'b' || key === 'i') { e.preventDefault(); insertFormatting(key === 'b' ? 'bold' : 'italic'); }
                  if (key === 's') { e.preventDefault(); void handleSaveDraft(); }
                }}
                placeholder="Begin writing your blog..."
                rows={15}
                className="w-full text-[15.5px] text-[#0A2540] placeholder:text-[#6E7D90]/50 bg-transparent border-none focus:outline-none resize-none leading-relaxed"
                style={{ minHeight: '360px' }}
              />
            </div>
          </div>
        ) : (
          /* Live Preview Mode */
          <div className="space-y-6">
            {coverImageUrl && (
              <div className="w-full rounded-2xl overflow-hidden border border-[#0A2540]/8 bg-black/[0.02]">
                <img
                  src={coverImageUrl}
                  alt={title}
                  className="w-full h-auto block rounded-2xl"
                />
              </div>
            )}

            <div>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                {tagsInput
                  .split(',')
                  .map(tag => tag.trim())
                  .filter((tag, index, values) => tag && values.indexOf(tag) === index)
                  .map(tag => (
                    <span key={tag} className="pn-tag">
                      #{tag.trim()}
                    </span>
                  ))}
              </div>

              <h1 className="pn-h1 text-2xl sm:text-4xl mb-3">
                {title || 'Untitled Blog'}
              </h1>

              {excerpt && (
                <p className="text-base text-[#4A5B70] leading-relaxed pb-4 border-b border-[#0A2540]/10">
                  {excerpt}
                </p>
              )}
            </div>

            <ArticleMarkdown content={content || 'Switch to Compose mode to begin writing your blog.'} />
          </div>
        )}
      </fieldset>

      <SpatialAuthModalV4
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode="login"
        presentation="centered-modal"
      />
    </div>
  );
};
