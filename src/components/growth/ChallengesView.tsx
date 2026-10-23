// src/components/growth/ChallengesView.tsx
// PENORA Writing Challenges & Submissions
// Transparent community writing prompts, prompt guidelines, and story submissions.

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Trophy,
  Calendar,
  Clock,
  ArrowRight,
  Send,
  CheckCircle2,
  AlertCircle,
  FileText,
  Loader2,
  BookOpen,
  Filter,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { penoraKeyAuth, type PenoraUser } from '../../lib/auth/penoraKeyAuth';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { CreatorSidebar } from '../common/CreatorSidebar';
import { SpatialAuthModalV4 } from '../design-v4/SpatialAuthModalV4';
import { getActiveChallenges, submitStoryToChallenge } from '../../lib/api/challenges';
import { getUserArticles } from '../../lib/api/articles';
import type { WritingChallengeRecord, PostRecord } from '../../lib/api/types';

export const ChallengesView: React.FC = () => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [keyUser, setKeyUser] = useState<PenoraUser | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const [challenges, setChallenges] = useState<WritingChallengeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'upcoming'>('all');

  // Submit modal state
  const [selectedChallenge, setSelectedChallenge] = useState<WritingChallengeRecord | null>(null);
  const [userStories, setUserStories] = useState<PostRecord[]>([]);
  const [loadingStories, setLoadingStories] = useState(false);
  const [selectedStoryId, setSelectedStoryId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const activeUserId = keyUser?.id || user?.id || null;

  useEffect(() => {
    const unsubKey = penoraKeyAuth.subscribe(ku => setKeyUser(ku));
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    loadChallenges();

    return () => {
      unsubKey();
      subscription.unsubscribe();
    };
  }, []);

  const loadChallenges = async () => {
    setLoading(true);
    const { data } = await getActiveChallenges();
    setChallenges(data || []);
    setLoading(false);
  };

  const handleOpenSubmit = async (ch: WritingChallengeRecord) => {
    if (!activeUserId) {
      setAuthModalOpen(true);
      return;
    }
    setSelectedChallenge(ch);
    setSelectedStoryId('');
    setSubmitSuccess(false);
    setSubmitError(null);
    setLoadingStories(true);

    try {
      const res = await getUserArticles(activeUserId);
      setUserStories(res.data || []);
      if (res.data && res.data.length > 0) {
        setSelectedStoryId(res.data[0].id);
      }
    } catch {
      setUserStories([]);
    } finally {
      setLoadingStories(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChallenge || !selectedStoryId || !activeUserId) return;

    setSubmitting(true);
    setSubmitError(null);

    const res = await submitStoryToChallenge(selectedChallenge.id, selectedStoryId, activeUserId);
    setSubmitting(false);

    if (res.error) {
      setSubmitError(res.error);
    } else {
      setSubmitSuccess(true);
      setChallenges(prev =>
        prev.map(c =>
          c.id === selectedChallenge.id ? { ...c, submissions_count: (c.submissions_count || 0) + 1 } : c
        )
      );
      setTimeout(() => {
        setSelectedChallenge(null);
        setSubmitSuccess(false);
      }, 2000);
    }
  };

  const filtered = challenges.filter(c => {
    if (filter === 'active') return c.status === 'active';
    if (filter === 'upcoming') return c.status === 'upcoming';
    return true;
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0A2540]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Creator Sidebar Navigation */}
          <div className="hidden lg:block lg:col-span-3 sticky top-20">
            <CreatorSidebar activePage="Challenges" />
          </div>

          {/* Main Challenges Feed */}
          <div className="lg:col-span-9 space-y-6">
            {/* Header Banner */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0A2540] via-[#0E3558] to-[#007C8B] p-6 sm:p-10 text-white shadow-xl">
              <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-[#00E5F4]/10 rounded-full blur-3xl pointer-events-none" />
              <div className="relative z-10 max-w-2xl space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[#00E5F4] text-xs font-semibold">
                  <Trophy className="h-3.5 w-3.5" />
                  <span>PENORA Writing Guild</span>
                </div>
                <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
                  Writing Challenges & Prompts
                </h1>
                <p className="text-sm sm:text-base text-slate-200 leading-relaxed font-light">
                  Publish original thinking, craft thoughtful perspectives, and participate in curated editorial prompts. Submissions are highlighted across PENORA Spotlight based on transparent editorial standards.
                </p>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center justify-between gap-4 border-b border-[#0A2540]/10 pb-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    filter === 'all'
                      ? 'bg-[#007C8B] text-white shadow-sm'
                      : 'bg-white text-[#52657C] hover:bg-[#F0F5F8] border border-[#0A2540]/8'
                  }`}
                >
                  All Prompts ({challenges.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('active')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    filter === 'active'
                      ? 'bg-[#007C8B] text-white shadow-sm'
                      : 'bg-white text-[#52657C] hover:bg-[#F0F5F8] border border-[#0A2540]/8'
                  }`}
                >
                  Active Now
                </button>
              </div>

              <span className="text-xs text-[#6E7D90] font-medium hidden sm:inline">
                Open to all verified writers
              </span>
            </div>

            {/* Challenges List */}
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center text-[#6E7D90] space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-[#007C8B]" />
                <p className="text-sm font-medium">Loading writing challenges...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="pn-panel p-12 text-center space-y-4">
                <FileText className="h-10 w-10 text-[#6E7D90] mx-auto opacity-50" />
                <h3 className="text-lg font-bold text-[#0A2540]">No prompts matching this filter</h3>
                <p className="text-xs text-[#6E7D90] max-w-sm mx-auto">
                  New weekly writing challenges are published on Mondays. Check back soon for the next prompt.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {filtered.map(ch => {
                  const deadline = new Date(ch.ends_at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  });

                  return (
                    <article
                      key={ch.id}
                      className="pn-panel p-6 sm:p-8 transition-all hover:border-[#007C8B]/30 hover:shadow-lg space-y-5 bg-white relative overflow-hidden group"
                    >
                      {/* Top Badges */}
                      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-semibold uppercase tracking-wider text-[10px] ${
                              ch.status === 'active'
                                ? 'bg-[#007C8B]/10 text-[#007C8B] border border-[#007C8B]/20'
                                : 'bg-[#6E7D90]/10 text-[#6E7D90]'
                            }`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                            {ch.status}
                          </span>
                          <span className="text-[#6E7D90] flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-[#007C8B]" />
                            Closes {deadline}
                          </span>
                        </div>

                        <span className="text-xs font-semibold text-[#0A2540]/80 bg-[#F0F5F8] px-3 py-1 rounded-full border border-[#0A2540]/5">
                          {ch.submissions_count} stories submitted
                        </span>
                      </div>

                      {/* Title & Prompt */}
                      <div className="space-y-2">
                        <h2 className="text-xl sm:text-2xl font-bold text-[#0A2540] group-hover:text-[#007C8B] transition-colors">
                          {ch.title}
                        </h2>
                        <p className="text-sm text-[#38485B] italic leading-relaxed">
                          &ldquo;{ch.prompt}&rdquo;
                        </p>
                      </div>

                      {/* Editorial Guidelines */}
                      {ch.guidelines && (
                        <div className="bg-[#F8FAFC] border-l-2 border-[#007C8B] p-3.5 rounded-r-xl text-xs text-[#52657C] leading-relaxed">
                          <span className="font-semibold text-[#0A2540] block mb-0.5">Submission Criteria</span>
                          {ch.guidelines}
                        </div>
                      )}

                      {/* Action Bar */}
                      <div className="pt-2 flex flex-wrap items-center justify-between gap-4 border-t border-[#0A2540]/5">
                        <span className="text-xs text-[#6E7D90]">
                          Submissions judged on clarity, depth, and community engagement.
                        </span>

                        <button
                          type="button"
                          onClick={() => handleOpenSubmit(ch)}
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#007C8B] to-[#00A3B5] text-white text-xs font-bold shadow-md hover:from-[#00A3B5] hover:to-[#00E5F4] hover:text-[#0A2540] transition-all"
                        >
                          <Send className="h-3.5 w-3.5" />
                          <span>Submit an Article</span>
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Submission Modal */}
      {selectedChallenge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0A2540]/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="pn-panel w-full max-w-lg p-6 sm:p-8 bg-white space-y-6 shadow-2xl relative">
            <div className="space-y-1.5">
              <div className="text-xs font-bold text-[#007C8B] uppercase tracking-wider">
                Writing Challenge Entry
              </div>
              <h3 className="text-xl font-bold text-[#0A2540]">
                Submit to &ldquo;{selectedChallenge.title}&rdquo;
              </h3>
              <p className="text-xs text-[#6E7D90]">
                Select one of your published PENORA stories to enter this prompt.
              </p>
            </div>

            {submitSuccess ? (
              <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-2">
                <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
                <h4 className="text-sm font-bold text-emerald-900">Submission Confirmed!</h4>
                <p className="text-xs text-emerald-700">
                  Your story has been officially entered into this writing prompt.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {submitError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}

                {loadingStories ? (
                  <div className="py-8 flex flex-col items-center justify-center text-xs text-[#6E7D90] space-y-2">
                    <Loader2 className="h-6 w-6 animate-spin text-[#007C8B]" />
                    <span>Retrieving your published articles...</span>
                  </div>
                ) : userStories.length === 0 ? (
                  <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#0A2540]/8 text-center space-y-3">
                    <BookOpen className="h-8 w-8 text-[#6E7D90] mx-auto opacity-50" />
                    <p className="text-xs text-[#52657C]">
                      You don&apos;t have any published stories yet. Publish your draft first to enter.
                    </p>
                    <a
                      href="/write"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#007C8B] text-white text-xs font-bold hover:bg-[#00E5F4] hover:text-[#0A2540] transition-colors"
                    >
                      <span>Draft New Article</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </a>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-[#0A2540]">
                      Choose your published story:
                    </label>
                    <select
                      value={selectedStoryId}
                      onChange={e => setSelectedStoryId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#0A2540]/15 text-xs text-[#0A2540] bg-white focus:outline-none focus:ring-2 focus:ring-[#007C8B]"
                    >
                      {userStories.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#0A2540]/8">
                  <button
                    type="button"
                    onClick={() => setSelectedChallenge(null)}
                    disabled={submitting}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-[#52657C] hover:bg-[#F0F5F8] transition-colors"
                  >
                    Cancel
                  </button>

                  {userStories.length > 0 && (
                    <button
                      type="submit"
                      disabled={submitting || !selectedStoryId}
                      className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#007C8B] text-white text-xs font-bold hover:bg-[#00E5F4] hover:text-[#0A2540] transition-all disabled:opacity-50"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Submitting...</span>
                        </>
                      ) : (
                        <>
                          <Send className="h-3.5 w-3.5" />
                          <span>Confirm Entry</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Auth Modal Fallback */}
      <SpatialAuthModalV4
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode="login"
      />
    </div>
  );
};
