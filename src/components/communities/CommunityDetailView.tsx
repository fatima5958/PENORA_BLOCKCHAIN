// src/components/communities/CommunityDetailView.tsx
// PENORA Communities V2 — Professional Community Hub with Governance, Feeds, Mod Tools & Member Management

import React, { useState, useEffect } from 'react';
import {
  Users,
  Shield,
  Crown,
  Pin,
  Settings,
  BookOpen,
  Plus,
  Check,
  Search,
  Clock,
  Sparkles,
  ArrowRight,
  EyeOff,
  AlertTriangle,
  FileText,
  Loader2,
  Trash2,
  MoreVertical,
  MessageSquare,
  Repeat,
  ExternalLink,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { penoraKeyAuth, type PenoraUser } from '../../lib/auth/penoraKeyAuth';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import {
  getCommunityBySlug,
  getUserCommunityRole,
  getCommunityMembers,
  joinCommunity,
  leaveCommunity,
  updateMemberRole,
  removeMember,
  updateCommunityDetails,
  pinPostInCommunity,
  unpinPostInCommunity,
  hidePostInCommunity,
  getCommunityAuditLogs,
  getCommunityFeed,
} from '../../lib/api/communities';
import { CreatorSidebar } from '../common/CreatorSidebar';
import { SpatialAuthModalV4 } from '../design-v4/SpatialAuthModalV4';
import type {
  CommunityRecord,
  CommunityRole,
  CommunityMemberRecord,
  CommunityAuditLogRecord,
  PostRecord,
} from '../../lib/api/types';

export const CommunityDetailView: React.FC = () => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [keyUser, setKeyUser] = useState<PenoraUser | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Community details
  const [community, setCommunity] = useState<CommunityRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<CommunityRole>('guest');
  const [isJoined, setIsJoined] = useState(false);
  const [joiningBusy, setJoiningBusy] = useState(false);

  // Navigation tab
  const [activeTab, setActiveTab] = useState<'feed' | 'about' | 'members' | 'mod'>('feed');
  const [feedFilter, setFeedFilter] = useState<'trending' | 'latest' | 'pinned'>('trending');

  // Feed posts
  const [posts, setPosts] = useState<(PostRecord & { isPinned?: boolean })[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);

  // Members tab
  const [members, setMembers] = useState<CommunityMemberRecord[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Mod Center
  const [auditLogs, setAuditLogs] = useState<CommunityAuditLogRecord[]>([]);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editRules, setEditRules] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editCover, setEditCover] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSavedSuccess, setSettingsSavedSuccess] = useState(false);

  const activeUserId = keyUser?.id || user?.id || null;

  // Extract slug from URL
  useEffect(() => {
    let slug = '';
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (parts[0] === 'community' && parts[1]) {
      slug = parts[1];
    } else {
      const urlParams = new URLSearchParams(window.location.search);
      slug = urlParams.get('slug') || 'spatial-alliance';
    }

    setLoading(true);
    getCommunityBySlug(slug).then((res) => {
      setLoading(false);
      if (res.data) {
        setCommunity(res.data);
        setEditName(res.data.name);
        setEditDesc(res.data.description || '');
        setEditRules(res.data.rules || '1. Be constructive and respectful to all creators.\n2. No spam or plagiarism.\n3. Keep submissions relevant to this guild.\n4. Credit original sources.');
        setEditAvatar(res.data.avatar_url || '');
        setEditCover(res.data.cover_url || '');
      } else {
        setError('Community not found. Check the URL or discover other circles.');
      }
    });
  }, []);

  // Auth listener
  useEffect(() => {
    const unsubKey = penoraKeyAuth.subscribe((ku) => setKeyUser(ku));
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      unsubKey();
      subscription.unsubscribe();
    };
  }, []);

  // Check Role & Membership
  useEffect(() => {
    if (!community) return;
    if (activeUserId) {
      getUserCommunityRole(community.id, activeUserId).then((r) => {
        setRole(r);
        setIsJoined(r !== 'guest');
      });
    } else {
      setRole('guest');
      setIsJoined(false);
    }
  }, [community?.id, activeUserId]);

  // Load Feed
  const refreshFeed = () => {
    if (!community) return;
    setLoadingPosts(true);
    getCommunityFeed(community.id, community.slug, feedFilter).then((res) => {
      setLoadingPosts(false);
      setPosts(res.data || []);
    });
  };

  useEffect(() => {
    if (community && activeTab === 'feed') {
      refreshFeed();
    }
  }, [community?.id, feedFilter, activeTab]);

  // Load Members
  useEffect(() => {
    if (community && activeTab === 'members') {
      setLoadingMembers(true);
      getCommunityMembers(community.id, memberSearch).then((res) => {
        setLoadingMembers(false);
        setMembers(res.data || []);
      });
    }
  }, [community?.id, activeTab, memberSearch]);

  // Load Audit Logs
  useEffect(() => {
    if (community && activeTab === 'mod') {
      getCommunityAuditLogs(community.id).then((res) => {
        setAuditLogs(res.data || []);
      });
    }
  }, [community?.id, activeTab]);

  const handleToggleJoin = async () => {
    if (!activeUserId) {
      setAuthModalOpen(true);
      return;
    }
    if (!community || joiningBusy) return;
    setJoiningBusy(true);

    try {
      if (isJoined) {
        await leaveCommunity(activeUserId, community.id);
        setIsJoined(false);
        setRole('guest');
      } else {
        await joinCommunity(activeUserId, community.id);
        setIsJoined(true);
        setRole('member');
      }
    } finally {
      setJoiningBusy(false);
    }
  };

  const handlePinToggle = async (postId: string, currentPinned: boolean) => {
    if (!community || !activeUserId) return;
    if (currentPinned) {
      await unpinPostInCommunity(community.id, postId, activeUserId);
    } else {
      await pinPostInCommunity(community.id, postId, activeUserId);
    }
    refreshFeed();
  };

  const handleRemovePost = async (postId: string) => {
    if (!community || !activeUserId) return;
    const reason = prompt('Reason for removing post from community feed:');
    if (!reason || !reason.trim()) return;
    await hidePostInCommunity(community.id, postId, reason.trim(), activeUserId);
    refreshFeed();
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!community || !activeUserId) return;
    setSavingSettings(true);
    try {
      const res = await updateCommunityDetails(
        community.id,
        {
          name: editName,
          description: editDesc,
          rules: editRules,
          avatar_url: editAvatar,
          cover_url: editCover,
        },
        activeUserId
      );
      if (res.success) {
        setSettingsSavedSuccess(true);
        setCommunity((prev) =>
          prev
            ? {
                ...prev,
                name: editName,
                description: editDesc,
                rules: editRules,
                avatar_url: editAvatar,
                cover_url: editCover,
              }
            : null
        );
        setTimeout(() => setSettingsSavedSuccess(false), 2000);
      }
    } finally {
      setSavingSettings(false);
    }
  };

  const handleChangeRole = async (memberId: string, newRole: 'member' | 'moderator' | 'admin') => {
    if (!community || !activeUserId) return;
    await updateMemberRole(community.id, memberId, newRole, activeUserId);
    const updated = await getCommunityMembers(community.id, memberSearch);
    setMembers(updated.data || []);
  };

  const handleKickMember = async (memberId: string) => {
    if (!community || !activeUserId) return;
    if (!confirm('Are you sure you want to remove this member from the guild?')) return;
    await removeMember(community.id, memberId, activeUserId);
    const updated = await getCommunityMembers(community.id, memberSearch);
    setMembers(updated.data || []);
  };

  const isLeader = role === 'owner' || role === 'admin' || role === 'moderator';

  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto px-4 py-20 text-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#007C8B] mx-auto" />
        <p className="text-sm text-[#52657C]">Opening community guild…</p>
      </div>
    );
  }

  if (error || !community) {
    return (
      <div className="w-full max-w-4xl mx-auto px-4 py-20 text-center space-y-4">
        <h2 className="font-serif text-2xl font-bold text-[#0A2540]">Circle Not Found</h2>
        <p className="text-sm text-[#52657C]">{error || 'Please discover our other creator circles.'}</p>
        <a href="/communities" className="pn-btn pn-btn-brand inline-flex items-center gap-1.5">
          <span>Browse Communities</span>
        </a>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
      {/* ─── 1. COMMUNITY PANORAMIC HEADER ─── */}
      <div className="rounded-3xl border border-[#0A2540]/10 bg-white overflow-hidden shadow-sm">
        {/* Panoramic Cover */}
        <div className="relative h-44 sm:h-64 w-full bg-gradient-to-r from-[#0A2540] via-[#004B57] to-[#007C8B] overflow-hidden">
          {community.cover_url ? (
            <img src={community.cover_url} alt={community.name} className="w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_30%_30%,#00E5F4_0%,transparent_60%)]" />
          )}
          {/* Subtle Grid Pattern Overlay */}
          <div className="absolute inset-0 bg-black/15 backdrop-blur-[0.5px]" />
        </div>

        {/* Content Bar & Profile Bar */}
        <div className="px-6 pb-6 pt-0 relative">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12 sm:-mt-16 mb-4">
            {/* Avatar & Title */}
            <div className="flex items-end gap-4">
              <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-2xl bg-white p-1 ring-4 ring-white shadow-xl overflow-hidden shrink-0">
                {community.avatar_url ? (
                  <img
                    src={community.avatar_url}
                    alt={community.name}
                    className="w-full h-full rounded-xl object-cover"
                  />
                ) : (
                  <div className="w-full h-full rounded-xl bg-gradient-to-tr from-[#007C8B] to-[#00E5F4] text-white font-bold text-3xl flex items-center justify-center">
                    {community.name[0]?.toUpperCase() || 'C'}
                  </div>
                )}
              </div>

              <div className="pb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#0A2540] leading-tight">
                    {community.name}
                  </h1>
                  {role !== 'guest' && (
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        role === 'owner'
                          ? 'bg-[#F59E0B]/15 text-[#D97706]'
                          : role === 'admin'
                          ? 'bg-[#007C8B]/15 text-[#007C8B]'
                          : role === 'moderator'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {role === 'owner' && <Crown className="h-3 w-3" />}
                      {role === 'admin' && <Shield className="h-3 w-3" />}
                      {role === 'moderator' && <Settings className="h-3 w-3" />}
                      <span className="capitalize">{role}</span>
                    </span>
                  )}
                </div>
                <div className="text-xs text-[#52657C] mt-0.5">/c/{community.slug}</div>
              </div>
            </div>

            {/* Actions: Join, Create Blog, Mod Tools */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={handleToggleJoin}
                disabled={joiningBusy}
                className={`px-5 py-2 rounded-full text-xs font-semibold transition-all shadow-xs ${
                  isJoined
                    ? 'bg-[#F0F5F8] text-[#52657C] hover:bg-[#E5EEF2]'
                    : 'bg-[#007C8B] text-white hover:bg-[#00E5F4] hover:text-[#0A2540]'
                }`}
              >
                {joiningBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : isJoined ? (
                  <span className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5" />
                    <span>Joined Guild</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Plus className="h-3.5 w-3.5" />
                    <span>Join Guild</span>
                  </span>
                )}
              </button>

              <a
                href={`/editor?community=${community.slug}`}
                className="pn-btn pn-btn-secondary pn-btn-sm inline-flex items-center gap-1.5 text-xs"
              >
                <Plus className="h-3.5 w-3.5 text-[#007C8B]" />
                <span>Write Story</span>
              </a>

              {isLeader && (
                <button
                  type="button"
                  onClick={() => setActiveTab('mod')}
                  className={`pn-btn pn-btn-sm text-xs inline-flex items-center gap-1.5 ${
                    activeTab === 'mod'
                      ? 'bg-[#007C8B] text-white'
                      : 'border border-[#007C8B]/30 text-[#007C8B] hover:bg-[#007C8B]/5'
                  }`}
                >
                  <Shield className="h-3.5 w-3.5" />
                  <span>Mod Tools</span>
                </button>
              )}
            </div>
          </div>

          <p className="text-sm text-[#4A5E75] max-w-3xl leading-relaxed mt-2">
            {community.description}
          </p>

          {/* Metrics */}
          <div className="flex items-center gap-6 pt-4 mt-4 border-t border-[#0A2540]/8 text-xs text-[#52657C]">
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-[#007C8B]" />
              <strong className="text-[#0A2540]">{community.community_memberships?.[0]?.count ?? 1}</strong> members
            </div>
            <div className="flex items-center gap-1.5">
              <BookOpen className="h-4 w-4 text-[#007C8B]" />
              <strong className="text-[#0A2540]">{posts.length}</strong> published stories
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 bg-[#F8FBFD] border-t border-[#0A2540]/8 flex items-center gap-2 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('feed')}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 transition-colors shrink-0 ${
              activeTab === 'feed'
                ? 'border-[#007C8B] text-[#007C8B]'
                : 'border-transparent text-[#52657C] hover:text-[#0A2540]'
            }`}
          >
            Community Feed
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('about')}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 transition-colors shrink-0 ${
              activeTab === 'about'
                ? 'border-[#007C8B] text-[#007C8B]'
                : 'border-transparent text-[#52657C] hover:text-[#0A2540]'
            }`}
          >
            About & Rules
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 transition-colors shrink-0 ${
              activeTab === 'members'
                ? 'border-[#007C8B] text-[#007C8B]'
                : 'border-transparent text-[#52657C] hover:text-[#0A2540]'
            }`}
          >
            Guild Members
          </button>
          {isLeader && (
            <button
              type="button"
              onClick={() => setActiveTab('mod')}
              className={`py-3.5 px-4 text-xs font-bold border-b-2 transition-colors shrink-0 flex items-center gap-1.5 ${
                activeTab === 'mod'
                  ? 'border-[#007C8B] text-[#007C8B]'
                  : 'border-transparent text-[#52657C] hover:text-[#0A2540]'
              }`}
            >
              <Shield className="h-3 w-3" />
              <span>Moderation & Audit</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── 2. MAIN 2-COLUMN VIEW (Sidebar + Content) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Sidebar on Desktop */}
        <aside className="hidden lg:block lg:col-span-3">
          <CreatorSidebar activePage="Communities" />
        </aside>

        {/* Content Column */}
        <main className="lg:col-span-9 space-y-6">
          {/* TAB 1: COMMUNITY FEED */}
          {activeTab === 'feed' && (
            <div className="space-y-6">
              {/* Filter Bar */}
              <div className="flex items-center justify-between gap-4 p-3 rounded-2xl bg-white border border-[#0A2540]/8">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFeedFilter('trending')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                      feedFilter === 'trending'
                        ? 'bg-[#007C8B] text-white'
                        : 'text-[#52657C] hover:bg-[#F0F5F8]'
                    }`}
                  >
                    Trending
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeedFilter('latest')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                      feedFilter === 'latest'
                        ? 'bg-[#007C8B] text-white'
                        : 'text-[#52657C] hover:bg-[#F0F5F8]'
                    }`}
                  >
                    Latest
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeedFilter('pinned')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1 ${
                      feedFilter === 'pinned'
                        ? 'bg-[#007C8B] text-white'
                        : 'text-[#52657C] hover:bg-[#F0F5F8]'
                    }`}
                  >
                    <Pin className="h-3 w-3" />
                    <span>Pinned</span>
                  </button>
                </div>

                <a
                  href={`/editor?community=${community.slug}`}
                  className="text-xs font-bold text-[#007C8B] hover:underline flex items-center gap-1 pr-2"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Publish in Guild</span>
                </a>
              </div>

              {/* Feed List */}
              {loadingPosts ? (
                <div className="p-12 text-center text-sm text-[#52657C]">
                  <Loader2 className="h-6 w-6 animate-spin text-[#007C8B] mx-auto mb-2" />
                  <span>Loading community stories…</span>
                </div>
              ) : posts.length === 0 ? (
                <div className="p-12 rounded-3xl bg-white border border-dashed border-[#0A2540]/15 text-center space-y-3">
                  <BookOpen className="h-8 w-8 text-[#007C8B]/60 mx-auto" />
                  <h3 className="font-serif text-lg font-bold text-[#0A2540]">No articles published yet</h3>
                  <p className="text-xs text-[#52657C] max-w-sm mx-auto">
                    Be the pioneer creator to publish an essay or perspective to {community.name}.
                  </p>
                  <div className="pt-2">
                    <a
                      href={`/editor?community=${community.slug}`}
                      className="pn-btn pn-btn-brand pn-btn-sm"
                    >
                      Publish First Story
                    </a>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {posts.map((post) => {
                    const author = post.author;
                    const authorName = author?.display_name || author?.username || 'Creator';
                    const authorHandle = author?.username || 'creator';

                    return (
                      <article
                        key={post.id}
                        className={`p-6 rounded-3xl bg-white border transition-all ${
                          post.isPinned
                            ? 'border-[#007C8B]/40 shadow-sm bg-gradient-to-br from-white to-[#F0FAFB]'
                            : 'border-[#0A2540]/8 hover:border-[#007C8B]/30 hover:shadow-xs'
                        } space-y-4`}
                      >
                        {/* Pinned Announcement Badge */}
                        {post.isPinned && (
                          <div className="flex items-center justify-between text-xs font-bold text-[#007C8B] pb-2 border-b border-[#007C8B]/15">
                            <span className="flex items-center gap-1.5">
                              <Pin className="h-3.5 w-3.5 fill-current" />
                              <span>Pinned Community Announcement</span>
                            </span>
                            {isLeader && (
                              <button
                                type="button"
                                onClick={() => handlePinToggle(post.id, true)}
                                className="text-[11px] font-normal hover:underline text-[#52657C]"
                              >
                                Unpin
                              </button>
                            )}
                          </div>
                        )}

                        {/* Author Byline */}
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <a href={`/profile/${authorHandle}`} className="flex items-center gap-2.5 group">
                            {author?.avatar_url ? (
                              <img
                                src={author.avatar_url}
                                alt={authorName}
                                className="h-8 w-8 rounded-full object-cover ring-1 ring-[#007C8B]/20 shrink-0"
                              />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-[#007C8B] to-[#00E5F4] text-white font-bold text-xs flex items-center justify-center shrink-0">
                                {authorName[0]?.toUpperCase() || 'P'}
                              </div>
                            )}
                            <div>
                              <span className="font-semibold text-[#0A2540] group-hover:text-[#007C8B]">
                                {authorName}
                              </span>
                              <span className="text-[#6E7D90] ml-1.5 font-normal">
                                @{authorHandle} · {new Date(post.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </a>

                          {/* Mod Quick Options */}
                          {isLeader && (
                            <div className="flex items-center gap-2">
                              {!post.isPinned && (
                                <button
                                  type="button"
                                  onClick={() => handlePinToggle(post.id, false)}
                                  className="text-[#6E7D90] hover:text-[#007C8B] p-1 text-xs flex items-center gap-1"
                                  title="Pin to top"
                                >
                                  <Pin className="h-3.5 w-3.5" />
                                  <span className="hidden sm:inline">Pin</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleRemovePost(post.id)}
                                className="text-[#6E7D90] hover:text-red-600 p-1 text-xs flex items-center gap-1"
                                title="Remove from community feed"
                              >
                                <EyeOff className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Remove</span>
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Title and Excerpt */}
                        <div className="space-y-1.5">
                          <a
                            href={`/read?slug=${encodeURIComponent(post.slug || post.id)}`}
                            className="block font-serif text-lg sm:text-xl font-bold text-[#0A2540] hover:text-[#007C8B] transition-colors leading-snug"
                          >
                            {post.title}
                          </a>
                          {post.excerpt && (
                            <p className="text-xs sm:text-sm text-[#4A5E75] line-clamp-2 leading-relaxed">
                              {post.excerpt}
                            </p>
                          )}
                        </div>

                        {/* Cover image if available */}
                        {post.cover_image_url && (
                          <a
                            href={`/read?slug=${encodeURIComponent(post.slug || post.id)}`}
                            className="block rounded-2xl overflow-hidden aspect-[21/9] bg-black/[0.02]"
                          >
                            <img
                              src={post.cover_image_url}
                              alt={post.title}
                              className="w-full h-full object-cover transition-transform duration-300 hover:scale-[1.02]"
                            />
                          </a>
                        )}

                        {/* Engagement Bottom Bar */}
                        <div className="flex items-center justify-between pt-3 border-t border-[#0A2540]/6 text-xs text-[#6E7D90]">
                          <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1 font-semibold text-[#007C8B]">
                              <span aria-hidden="true" className="text-[10px]">▲</span>
                              <span>Upvote</span>
                            </span>
                            <a
                              href={`/read?slug=${encodeURIComponent(post.slug || post.id)}#comments`}
                              className="flex items-center gap-1 hover:text-[#007C8B]"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                              <span>Discuss</span>
                            </a>
                          </div>

                          <a
                            href={`/read?slug=${encodeURIComponent(post.slug || post.id)}`}
                            className="text-[#007C8B] font-semibold hover:underline inline-flex items-center gap-1"
                          >
                            <span>Read Story</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ABOUT & RULES */}
          {activeTab === 'about' && (
            <div className="space-y-6">
              {/* Guidelines & Rules Card */}
              <div className="p-6 sm:p-8 rounded-3xl bg-white border border-[#0A2540]/8 space-y-5">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-[#007C8B]" />
                  <h2 className="font-serif text-xl font-bold text-[#0A2540]">
                    Guild Rules & Curation Standards
                  </h2>
                </div>
                <div className="text-xs sm:text-sm text-[#4A5E75] leading-relaxed whitespace-pre-line space-y-3 bg-[#F8FBFD] p-5 rounded-2xl border border-[#0A2540]/6">
                  {community.rules || 'No custom rules posted yet. Standard PENORA community standards apply.'}
                </div>
              </div>

              {/* Founder & Guild Information Card */}
              <div className="p-6 sm:p-8 rounded-3xl bg-white border border-[#0A2540]/8 space-y-4">
                <h3 className="font-serif text-lg font-bold text-[#0A2540]">
                  Guild Governance & Transparency
                </h3>
                <p className="text-xs text-[#52657C] leading-relaxed">
                  Communities on PENORA are self-governing publishing circles. Guild leaders curate submissions, enforce quality guidelines, and maintain community reputation.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-xs">
                  <div className="p-3 rounded-xl bg-[#F0F5F8]/60">
                    <span className="text-[#6E7D90] block">Created:</span>
                    <strong className="text-[#0A2540]">{new Date(community.created_at).toLocaleDateString()}</strong>
                  </div>
                  <div className="p-3 rounded-xl bg-[#F0F5F8]/60">
                    <span className="text-[#6E7D90] block">URL Identifier:</span>
                    <strong className="text-[#0A2540]">/c/{community.slug}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: MEMBERS TAB */}
          {activeTab === 'members' && (
            <div className="space-y-6">
              {/* Member Search Bar */}
              <div className="p-4 rounded-2xl bg-white border border-[#0A2540]/8 flex items-center gap-2">
                <Search className="h-4 w-4 text-[#6E7D90] shrink-0" />
                <input
                  type="search"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Search guild members by name or handle..."
                  className="w-full text-xs text-[#0A2540] bg-transparent border-none focus:outline-none"
                />
              </div>

              {loadingMembers ? (
                <div className="p-8 text-center text-xs text-[#52657C]">Loading members…</div>
              ) : members.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#52657C] bg-white rounded-2xl border">
                  No members matched your search.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {members.map((m) => {
                    const profile = m.profile;
                    const name = profile?.display_name || profile?.username || 'Creator';
                    const handle = profile?.username || 'member';
                    const canManageThisUser =
                      (role === 'owner' || role === 'admin') && m.role !== 'owner' && m.member_id !== activeUserId;

                    return (
                      <div
                        key={m.member_id}
                        className="p-4 rounded-2xl bg-white border border-[#0A2540]/8 flex items-center justify-between gap-3 shadow-2xs"
                      >
                        <a href={`/profile/${handle}`} className="flex items-center gap-3 min-w-0 group">
                          {profile?.avatar_url ? (
                            <img
                              src={profile.avatar_url}
                              alt={name}
                              className="h-10 w-10 rounded-full object-cover shrink-0 ring-1 ring-[#007C8B]/20"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-[#007C8B] to-[#00E5F4] text-white font-bold text-xs flex items-center justify-center shrink-0">
                              {name[0]?.toUpperCase() || 'M'}
                            </div>
                          )}
                          <div className="min-w-0">
                            <span className="block text-xs font-bold text-[#0A2540] truncate group-hover:text-[#007C8B]">
                              {name}
                            </span>
                            <span className="block text-[11px] text-[#6E7D90] truncate">
                              @{handle} · Rep {profile?.reputation || 25}
                            </span>
                          </div>
                        </a>

                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              m.role === 'owner'
                                ? 'bg-amber-100 text-amber-800'
                                : m.role === 'admin'
                                ? 'bg-[#007C8B]/15 text-[#007C8B]'
                                : m.role === 'moderator'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {m.role}
                          </span>

                          {canManageThisUser && (
                            <div className="flex items-center gap-1">
                              <select
                                value={m.role}
                                onChange={(e) =>
                                  handleChangeRole(m.member_id, e.target.value as 'member' | 'moderator' | 'admin')
                                }
                                className="text-[10px] p-1 rounded-lg border border-[#0A2540]/15 bg-[#F8FBFD]"
                              >
                                <option value="member">Member</option>
                                <option value="moderator">Moderator</option>
                                <option value="admin">Admin</option>
                              </select>
                              <button
                                type="button"
                                onClick={() => handleKickMember(m.member_id)}
                                className="text-[#8C9BAE] hover:text-red-600 p-1"
                                title="Remove member"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: MOD CENTER & AUDIT LOGS */}
          {activeTab === 'mod' && isLeader && (
            <div className="space-y-6">
              {/* Guild Settings Form */}
              <div className="p-6 sm:p-8 rounded-3xl bg-white border border-[#0A2540]/8 space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-[#0A2540]/8">
                  <div className="flex items-center gap-2">
                    <Settings className="h-5 w-5 text-[#007C8B]" />
                    <h2 className="font-serif text-lg font-bold text-[#0A2540]">
                      Community Governance Settings
                    </h2>
                  </div>
                  {settingsSavedSuccess && (
                    <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                      <Check className="h-3.5 w-3.5" />
                      <span>Changes Saved</span>
                    </span>
                  )}
                </div>

                <form onSubmit={handleSaveSettings} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-[#0A2540]">Guild Name</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-[#0A2540]/15 bg-[#F8FBFD] focus:outline-none focus:border-[#007C8B]"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-[#0A2540]">Avatar Image URL</label>
                      <input
                        type="url"
                        value={editAvatar}
                        onChange={(e) => setEditAvatar(e.target.value)}
                        placeholder="https://..."
                        className="w-full text-xs p-2.5 rounded-xl border border-[#0A2540]/15 bg-[#F8FBFD] focus:outline-none focus:border-[#007C8B]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[#0A2540]">Cover Banner Image URL</label>
                    <input
                      type="url"
                      value={editCover}
                      onChange={(e) => setEditCover(e.target.value)}
                      placeholder="https://..."
                      className="w-full text-xs p-2.5 rounded-xl border border-[#0A2540]/15 bg-[#F8FBFD] focus:outline-none focus:border-[#007C8B]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[#0A2540]">Description</label>
                    <textarea
                      rows={2}
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-[#0A2540]/15 bg-[#F8FBFD] focus:outline-none focus:border-[#007C8B] resize-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[#0A2540]">Guild Rules & Guidelines</label>
                    <textarea
                      rows={4}
                      value={editRules}
                      onChange={(e) => setEditRules(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-[#0A2540]/15 bg-[#F8FBFD] focus:outline-none focus:border-[#007C8B] font-mono text-[11px]"
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={savingSettings}
                      className="pn-btn pn-btn-brand text-xs px-6 py-2"
                    >
                      {savingSettings ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save Guild Settings'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Audit Log Trail */}
              <div className="p-6 sm:p-8 rounded-3xl bg-white border border-[#0A2540]/8 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-[#0A2540]/8">
                  <Clock className="h-5 w-5 text-[#007C8B]" />
                  <h3 className="font-serif text-lg font-bold text-[#0A2540]">
                    Moderation Audit Trail
                  </h3>
                </div>
                <p className="text-xs text-[#52657C]">
                  All leadership actions (pinning, removals, role promotions) are permanently recorded in the audit ledger.
                </p>

                {auditLogs.length === 0 ? (
                  <div className="py-6 text-center text-xs text-[#6E7D90] bg-[#F8FBFD] rounded-2xl border">
                    No moderation actions logged yet.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {auditLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-3 rounded-xl bg-[#F8FBFD] border border-[#0A2540]/6 text-xs flex items-center justify-between gap-4"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#0A2540] uppercase text-[10px] tracking-wider px-1.5 py-0.5 rounded bg-[#007C8B]/10 text-[#007C8B]">
                              {log.action}
                            </span>
                            <span className="text-xs text-[#3E526A] truncate">{log.details || 'Action performed'}</span>
                          </div>
                        </div>
                        <span className="text-[10px] text-[#6E7D90] shrink-0">
                          {new Date(log.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
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
