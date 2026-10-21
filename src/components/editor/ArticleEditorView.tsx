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
import { createPost, updatePost, getArticleBySlug } from '../../lib/api/articles';
import { SpatialAuthModalV4 } from '../design-v4/SpatialAuthModalV4';
import { penoraKeyAuth, type PenoraUser } from '../../lib/auth/penoraKeyAuth';
import type { User as SupabaseUser } from '@supabase/supabase-js';
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
          setPublishError(res.error || 'This essay could not be loaded. Use New Blank to start another essay.');
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
    };
    const error = hasDraftContent(draft) ? saveArticleDraft(draft) : removeArticleDraft();
    setDraftStorageError(error);
    setDraftStatus(error ? '' : hasDraftContent(draft) ? 'Draft saved in this browser' : '');
    return error === null;
  }, [title, tagsInput, coverImageUrl, excerpt, content, editingPostId, editingSlug]);

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

  const handleRestoreDraft = () => {
    if (!unsavedDraftAvailable) return;
    setTitle(unsavedDraftAvailable.title);
    setTagsInput(unsavedDraftAvailable.tags);
    setCoverImageUrl(unsavedDraftAvailable.coverImageUrl);
    setExcerpt(unsavedDraftAvailable.excerpt);
    setContent(unsavedDraftAvailable.content);
    setEditingPostId(unsavedDraftAvailable.postId);
    setEditingSlug(unsavedDraftAvailable.slug);
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
      && !window.confirm('Clear editor and discard the browser draft to start a new blank essay?')) {
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

    if (!file.type.startsWith('image/')) {
      setPublishError('Please select a valid image file (PNG, JPEG, WebP, GIF, SVG).');
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
    reader.readAsDataURL(file);
  };

  const insertFormatting = (prefix: string, suffix: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) {
      handleContentChange(content + `\n${prefix} ` + suffix);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = textarea.value;
    const selected = currentText.substring(start, end);
    const replacement = selected ? `${prefix}${selected}${suffix}` : `${prefix}${suffix}`;
    const newContent = currentText.substring(0, start) + replacement + currentText.substring(end);
    handleContentChange(newContent);
    setTimeout(() => {
      textarea.focus();
      const newCursor = start + prefix.length + (selected ? selected.length : 0);
      textarea.setSelectionRange(newCursor, newCursor);
    }, 0);
  };

  const handleSaveDraft = async () => {
    if (isSavingDraft || isPublishing) return;
    setPublishError(null);
    setPublishSuccess(null);
    setPublishSuccessSlug(null);

    if (!title.trim() && !content.trim()) {
      setPublishError('Draft must have a title or content before saving.');
      return;
    }

    const locallySaved = persistCurrentDraft();

    const authorId = user?.id || keyUser?.id;
    if (!authorId) {
      if (locallySaved) setPublishSuccess('Draft saved locally in browser storage. Sign in with your Private Posting Key to sync drafts to the cloud.');
      return;
    }

    setIsSavingDraft(true);
    const slug =
      editingSlug ||
      title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || `draft-${Date.now()}`;

    const tags = tagsInput
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(Boolean);

    try {
      let res;
      if (editingPostId) {
        res = await updatePost(editingPostId, {
          title: title.trim() || 'Untitled Draft',
          excerpt: excerpt.trim() || (content.trim() ? content.trim().slice(0, 160) + '...' : ''),
          content: content.trim(),
          cover_image_url: coverImageUrl.trim() || undefined,
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
          cover_image_url: coverImageUrl.trim() || undefined,
          tags,
          published: false,
        });
        if (res.data?.id) {
          setEditingPostId(res.data.id);
          setEditingSlug(res.data.slug);
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
      setIsSavingDraft(false);
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPublishing || isSavingDraft) return;
    setPublishError(null);
    setPublishSuccess(null);
    setPublishSuccessSlug(null);

    const authorId = user?.id || keyUser?.id;
    if (!authorId) {
      setAuthModalOpen(true);
      return;
    }

    if (keyUser && !penoraKeyAuth.hasPermission('publish')) {
      setPublishError('Your active session does not have Posting permissions to publish essays.');
      return;
    }

    if (!title.trim()) {
      setPublishError('Please enter an essay title before publishing.');
      return;
    }

    if (!content.trim() || content.trim().length < 10) {
      setPublishError('Please provide meaningful essay content (at least 10 characters) before publishing.');
      return;
    }

    const locallySaved = persistCurrentDraft();
    setIsPublishing(true);

    const slug =
      editingSlug ||
      title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || `post-${Date.now()}`;

    const tags = tagsInput
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(Boolean);

    try {
      let res;
      if (editingPostId) {
        res = await updatePost(editingPostId, {
          title: title.trim(),
          excerpt: excerpt.trim() || content.trim().slice(0, 160) + '...',
          content: content.trim(),
          cover_image_url: coverImageUrl.trim() || undefined,
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
          cover_image_url: coverImageUrl.trim() || undefined,
          tags,
          published: true,
        });
      }

      if (res.isPendingMigration) {
        setPublishError(
          locallySaved
            ? 'Publishing is currently unavailable. Your essay is saved as a draft in this browser.'
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
        setPublishSuccess('Essay published successfully!');
        setPublishSuccessSlug(finalSlug);
      }
    } catch (err: any) {
      setPublishError(err.message || 'Failed to publish essay.');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Studio Top Toolbar: Back to Feed | Compose/Preview, Save Draft, Publish Essay */}
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
            disabled={isSavingDraft || isPublishing || !editorReady || !!unsavedDraftAvailable}
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
            disabled={isSavingDraft || isPublishing || !editorReady || !!unsavedDraftAvailable}
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
                <span>Publish Essay</span>
              </>
            )}
          </button>
        </div>
      </div>

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
                <span>Read your published essay live</span>
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
          {!editorReady ? 'Loading essay…' : draftStatus}
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
        disabled={!editorReady || !!unsavedDraftAvailable || isPublishing || isSavingDraft}
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
                placeholder="Essay title..."
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
                    accept="image/*"
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
                  Images are rendered in full original resolution without cropping or distortion.
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
                  onClick={() => insertFormatting('**', '**')}
                  className="pn-icon-btn h-8 w-8"
                  title="Bold"
                >
                  <Bold className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => insertFormatting('*', '*')}
                  className="pn-icon-btn h-8 w-8"
                  title="Italic"
                >
                  <Italic className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => insertFormatting('## ')}
                  className="pn-icon-btn h-8 w-8"
                  title="Section Heading"
                >
                  <Heading2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => insertFormatting('> ')}
                  className="pn-icon-btn h-8 w-8"
                  title="Blockquote"
                >
                  <Quote className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => insertFormatting('```\n', '\n```')}
                  className="pn-icon-btn h-8 w-8"
                  title="Code Block"
                >
                  <Code className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => insertFormatting('- ')}
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
                placeholder="Begin writing your essay..."
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
                  .filter(Boolean)
                  .map(tag => (
                    <span key={tag} className="pn-tag">
                      #{tag.trim()}
                    </span>
                  ))}
              </div>

              <h1 className="pn-h1 text-2xl sm:text-4xl mb-3">
                {title || 'Untitled Essay'}
              </h1>

              {excerpt && (
                <p className="text-base text-[#4A5B70] leading-relaxed pb-4 border-b border-[#0A2540]/10">
                  {excerpt}
                </p>
              )}
            </div>

            <div className="text-[16px] text-[#0A2540] leading-relaxed space-y-4 whitespace-pre-wrap">
              {content || 'Switch to Compose mode to begin writing your essay.'}
            </div>
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
