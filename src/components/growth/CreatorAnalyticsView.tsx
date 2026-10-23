// src/components/growth/CreatorAnalyticsView.tsx
// PENORA Real Creator Analytics & Publishing Streaks
// Verifiable views, upvotes, comments, followers, and weekly publishing consistency.

import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Flame,
  Eye,
  MessageSquare,
  Users,
  BookOpen,
  Calendar,
  Sparkles,
  TrendingUp,
  Loader2,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { penoraKeyAuth, type PenoraUser } from '../../lib/auth/penoraKeyAuth';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { CreatorSidebar } from '../common/CreatorSidebar';
import { SpatialAuthModalV4 } from '../design-v4/SpatialAuthModalV4';
import { getCreatorAnalytics } from '../../lib/api/analytics';
import type { CreatorAnalyticsData } from '../../lib/api/types';

export const CreatorAnalyticsView: React.FC = () => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [keyUser, setKeyUser] = useState<PenoraUser | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const [analytics, setAnalytics] = useState<CreatorAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const activeUserId = keyUser?.id || user?.id || null;

  useEffect(() => {
    const unsubKey = penoraKeyAuth.subscribe(ku => setKeyUser(ku));
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      unsubKey();
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (activeUserId) {
      loadAnalytics(activeUserId);
    } else {
      setLoading(false);
      setAnalytics(null);
    }
  }, [activeUserId]);

  const loadAnalytics = async (authorId: string) => {
    setLoading(true);
    try {
      const data = await getCreatorAnalytics(authorId);
      setAnalytics(data);
    } catch {
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0A2540]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Creator Sidebar Navigation */}
          <div className="hidden lg:block lg:col-span-3 sticky top-20">
            <CreatorSidebar activePage="Analytics" />
          </div>

          {/* Main Analytics Column */}
          <div className="lg:col-span-9 space-y-8">
            {/* Header Banner */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0A2540] via-[#0E3558] to-[#007C8B] p-6 sm:p-10 text-white shadow-xl">
              <div className="absolute -right-8 -top-8 w-60 h-60 bg-[#00E5F4]/10 rounded-full blur-3xl pointer-events-none" />
              <div className="relative z-10 max-w-2xl space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[#00E5F4] text-xs font-semibold">
                  <BarChart3 className="h-3.5 w-3.5" />
                  <span>Real Creator Signals</span>
                </div>
                <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
                  Creator Growth & Analytics
                </h1>
                <p className="text-sm sm:text-base text-slate-200 leading-relaxed font-light">
                  Direct, verifiable signals across your published stories. PENORA measures genuine read sessions, organic community discussions, and consistent publishing cadence without fabricated metrics.
                </p>
              </div>
            </div>

            {/* If Not Signed In */}
            {!activeUserId && !loading && (
              <div className="pn-panel p-12 text-center space-y-4 bg-white">
                <BarChart3 className="h-12 w-12 text-[#6E7D90] mx-auto opacity-50" />
                <h2 className="text-xl font-bold text-[#0A2540]">
                  Sign in to view your Creator Analytics
                </h2>
                <p className="text-xs sm:text-sm text-[#6E7D90] max-w-md mx-auto">
                  Access your story performance, readership reach, and genuine publishing streak.
                </p>
                <button
                  type="button"
                  onClick={() => setAuthModalOpen(true)}
                  className="px-6 py-2.5 rounded-full bg-[#007C8B] text-white text-xs font-bold hover:bg-[#00E5F4] hover:text-[#0A2540] transition-all shadow-md"
                >
                  Sign In to PENORA
                </button>
              </div>
            )}

            {/* Loading State */}
            {loading && (
              <div className="py-20 flex flex-col items-center justify-center text-[#6E7D90] space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-[#007C8B]" />
                <p className="text-sm font-medium">Computing your real analytics ledger...</p>
              </div>
            )}

            {/* Analytics Content */}
            {activeUserId && !loading && analytics && (
              <div className="space-y-8">
                {/* 4 Key Stat Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="pn-panel p-5 bg-white space-y-2 hover:border-[#007C8B]/30 transition-all">
                    <div className="flex items-center justify-between text-[#6E7D90]">
                      <span className="text-xs font-semibold">Total Reads</span>
                      <Eye className="h-4 w-4 text-[#007C8B]" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-[#0A2540]">
                      {analytics.totalViews.toLocaleString()}
                    </div>
                    <span className="text-[11px] text-[#6E7D90] block">Organic page reads</span>
                  </div>

                  <div className="pn-panel p-5 bg-white space-y-2 hover:border-[#007C8B]/30 transition-all">
                    <div className="flex items-center justify-between text-[#6E7D90]">
                      <span className="text-xs font-semibold">Community Upvotes</span>
                      <span className="text-[#007C8B] font-bold text-sm" aria-hidden="true">▲</span>
                    </div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-[#0A2540]">
                      {analytics.totalUpvotes.toLocaleString()}
                    </div>
                    <span className="text-[11px] text-[#6E7D90] block">Weighted reputation votes</span>
                  </div>

                  <div className="pn-panel p-5 bg-white space-y-2 hover:border-[#007C8B]/30 transition-all">
                    <div className="flex items-center justify-between text-[#6E7D90]">
                      <span className="text-xs font-semibold">Discussions</span>
                      <MessageSquare className="h-4 w-4 text-[#00E5F4]" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-[#0A2540]">
                      {analytics.totalComments.toLocaleString()}
                    </div>
                    <span className="text-[11px] text-[#6E7D90] block">Reader responses</span>
                  </div>

                  <div className="pn-panel p-5 bg-white space-y-2 hover:border-[#007C8B]/30 transition-all">
                    <div className="flex items-center justify-between text-[#6E7D90]">
                      <span className="text-xs font-semibold">Followers</span>
                      <Users className="h-4 w-4 text-[#0A2540]" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-[#0A2540]">
                      {analytics.totalFollowers.toLocaleString()}
                    </div>
                    <span className="text-[11px] text-[#6E7D90] block">Subscribed readers</span>
                  </div>
                </div>

                {/* Writing Streaks & Consistency Panel */}
                <div className="pn-panel p-6 sm:p-8 bg-white space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                        <Flame className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-[#0A2540]">
                          Publishing Cadence & Streaks
                        </h3>
                        <p className="text-xs text-[#6E7D90]">
                          Genuine weekly writing consistency across recent weeks.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <span className="text-xs font-semibold text-[#6E7D90]">Current Streak:</span>
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 font-bold text-xs">
                        <Flame className="h-3.5 w-3.5" />
                        {analytics.streak.currentWeekStreak} {analytics.streak.currentWeekStreak === 1 ? 'Week' : 'Weeks'}
                      </span>
                    </div>
                  </div>

                  {/* 6-Week Cadence Dots */}
                  <div className="space-y-3 pt-2">
                    <div className="grid grid-cols-6 gap-3">
                      {analytics.streak.weeklyActivity.map((hasPublished: boolean, idx: number) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center transition-all ${
                            hasPublished
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                              : 'bg-[#F8FAFC] border-[#0A2540]/8 text-[#6E7D90]'
                          }`}
                        >
                          <span className="text-xs font-bold">Week {idx + 1}</span>
                          <span className="text-[10px] mt-0.5 opacity-80">
                            {hasPublished ? 'Published' : '—'}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#6E7D90] pt-1">
                      <span>6 weeks ago</span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
                        <span>Published article week</span>
                      </span>
                      <span>This week</span>
                    </div>
                  </div>
                </div>

                {/* Published Stories Performance Breakdown */}
                <div className="pn-panel p-6 sm:p-8 bg-white space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-[#0A2540] flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-[#007C8B]" />
                      <span>Story Performance Table</span>
                    </h3>
                    <span className="text-xs text-[#6E7D90]">
                      {analytics.topStories.length} published stories
                    </span>
                  </div>

                  {analytics.topStories.length === 0 ? (
                    <div className="py-8 text-center text-xs text-[#6E7D90]">
                      No published stories found. Once you publish articles, their real-time performance will appear here.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-[#0A2540]/10 text-[#6E7D90] uppercase font-bold text-[10px] tracking-wider">
                            <th className="pb-3">Story Title</th>
                            <th className="pb-3 text-center">Reads</th>
                            <th className="pb-3 text-center">Votes</th>
                            <th className="pb-3 text-center">Replies</th>
                            <th className="pb-3 text-right">Published</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#0A2540]/5">
                          {analytics.topStories.map(story => (
                            <tr key={story.id} className="hover:bg-[#F8FAFC] transition-colors">
                              <td className="py-3.5 pr-4 max-w-xs sm:max-w-md">
                                <a
                                  href={`/read?slug=${encodeURIComponent(story.slug)}`}
                                  className="font-semibold text-[#0A2540] hover:text-[#007C8B] transition-colors block truncate"
                                >
                                  {story.title}
                                </a>
                              </td>
                              <td className="py-3.5 text-center text-[#52657C] font-medium">
                                {story.views.toLocaleString()}
                              </td>
                              <td className="py-3.5 text-center text-[#52657C] font-medium">
                                {story.upvotes.toLocaleString()}
                              </td>
                              <td className="py-3.5 text-center text-[#52657C] font-medium">
                                {story.comments.toLocaleString()}
                              </td>
                              <td className="py-3.5 text-right text-[#6E7D90] whitespace-nowrap">
                                {new Date(story.publishedAt).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Auth Modal */}
      <SpatialAuthModalV4
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode="login"
      />
    </div>
  );
};
