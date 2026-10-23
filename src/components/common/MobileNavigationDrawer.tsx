// src/components/common/MobileNavigationDrawer.tsx
// PENORA — Premium Mobile Navigation Drawer (Sidebar)
// - Calibrated compact drawer width: 75vw, capped at 280px (snug fit, zero excess right void)
// - Mobile font size strictly 16px for optimal readability
// - Integrated live user/creator search preview inside drawer
// - Stack-safe focus trapping & background scroll lock via useOverlayLock
// - Independent internal scrolling (drawer scrolls freely, background stays locked)
// - Proper touch targets (46px+), consistent padding, and zero horizontal overflow

import React, { useState, useEffect, useRef } from 'react';
import '../../styles/mobile-sidebar.css';
import {
  Home,
  Compass,
  Users,
  PenLine,
  Bell,
  User as UserIcon,
  Wallet,
  ArrowLeftRight,
  Bookmark,
  FileText,
  Search,
  X,
  ChevronRight,
  LogOut,
  Crown,
  CheckCircle2,
  Sun,
  Moon,
  Sparkles,
  UserCheck,
  Trophy,
  BarChart3,
  Loader2,
} from 'lucide-react';
import { PenoraLogo, PenoraEmblem } from '../brand/PenoraLogo';
import { getFollowCounts } from '../../lib/api/follows';
import { getUserArticles } from '../../lib/api/articles';
import { searchProfiles } from '../../lib/api/profiles';
import { useOverlayLock } from '../../lib/ui/overlayManager';
import type { ProfileRecord } from '../../lib/api/types';
import type { PenoraUser } from '../../lib/auth/penoraKeyAuth';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface MobileNavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentPath?: string;
  user: SupabaseUser | null;
  keyUser: PenoraUser | null;
  profile: ProfileRecord | null;
  onOpenLogin: () => void;
  onOpenRegister: () => void;
  onLogout: () => void;
}

export const MobileNavigationDrawer: React.FC<MobileNavigationDrawerProps> = ({
  isOpen,
  onClose,
  currentPath = '/',
  user,
  keyUser,
  profile,
  onOpenLogin,
  onOpenRegister,
  onLogout,
}) => {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [searchQuery, setSearchQuery] = useState('');
  const [liveCreators, setLiveCreators] = useState<ProfileRecord[]>([]);
  const [isSearchingCreators, setIsSearchingCreators] = useState(false);
  const [avatarImageError, setAvatarImageError] = useState(false);
  const [stats, setStats] = useState({
    followers: 0,
    following: 0,
    blogs: 0,
    reputation: 0,
  });

  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isPresent, setIsPresent] = useState(isOpen);

  // Retain the panel through its exit; keep focus and scroll locked until it finishes.
  useEffect(() => {
    if (isOpen) {
      setIsPresent(true);
      return;
    }
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220;
    const timer = window.setTimeout(() => setIsPresent(false), duration);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  // Stack-safe background scroll lock, Escape key dismissal, and focus trapping
  useOverlayLock(isOpen || isPresent, {
    containerRef: drawerRef,
    initialFocusRef: closeButtonRef,
    onEscape: onClose,
  });

  const activeUser = keyUser || user;
  const activeUserId = keyUser?.id || user?.id;

  const displayUsername =
    profile?.username ||
    keyUser?.username ||
    (user?.user_metadata?.username as string | undefined) ||
    user?.email?.split('@')[0] ||
    'creator';

  const displayName =
    profile?.display_name ||
    keyUser?.displayName ||
    (user?.user_metadata?.full_name as string | undefined) ||
    displayUsername;

  // Only the creator's saved upload is a profile photo.
  const avatarUrl =
    profile?.avatar_url && !profile.avatar_url.includes('/brand/penora-avatar-')
      ? profile.avatar_url
      : null;

  useEffect(() => setAvatarImageError(false), [avatarUrl, activeUserId]);

  const bioTagline = profile?.bio || '';

  // Fetch real creator stats when opened
  useEffect(() => {
    let mounted = true;
    if (!isOpen || !activeUserId) return;

    async function loadStats() {
      try {
        const [followData, articlesData] = await Promise.all([
          getFollowCounts(activeUserId!),
          getUserArticles(activeUserId!),
        ]);

        if (mounted) {
          const publishedCount = articlesData.data.filter((p) => p.published).length;
          setStats({
            followers: followData.followers,
            following: followData.following,
            blogs: publishedCount,
            reputation: profile?.reputation ?? 0,
          });
        }
      } catch {
        // Keep initial fallback
      }
    }

    loadStats();
    return () => {
      mounted = false;
    };
  }, [isOpen, activeUserId, profile?.reputation]);

  // Debounced live user search inside drawer
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q || q.length < 2) {
      setLiveCreators([]);
      setIsSearchingCreators(false);
      return;
    }

    setIsSearchingCreators(true);
    const timer = setTimeout(async () => {
      const res = await searchProfiles(q, 4);
      setLiveCreators(res.data || []);
      setIsSearchingCreators(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onClose();
      window.location.href = `/explore?q=${encodeURIComponent(searchQuery.trim())}&tab=creators`;
    }
  };

  const isLight = theme === 'light';

  if (!isOpen && !isPresent) return null;

  // Base styling: 16px mobile typography, 46px touch target, snug fit
  const getItemClassName = (isActive: boolean) =>
    `pn-sidebar-link ${isActive ? 'pn-sidebar-link-active' : ''} w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[16px] font-medium min-h-[46px] select-none ${
      isActive
        ? isLight
          ? 'bg-[#007C8B]/10 text-[#007C8B] font-semibold border-l-[3px] border-[#007C8B]'
          : 'bg-[#00E5F4]/15 text-[#00E5F4] font-semibold border-l-[3px] border-[#00E5F4]'
        : isLight
        ? 'text-[#0A2540] hover:bg-white hover:text-[#007C8B] active:bg-[#0A2540]/5'
        : 'text-white/85 hover:bg-white/5 hover:text-white active:bg-white/10'
    }`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Navigation Menu"
      data-state={isOpen ? 'open' : 'closing'}
      data-theme={theme}
      className="pn-sidebar fixed inset-0 z-50 lg:hidden flex overflow-hidden"
    >
      {/* ─── 1. Subtle Dark Backdrop (Closes on Tap) ─── */}
      <div
        className="pn-sidebar-backdrop fixed inset-0 bg-black/55 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* ─── 2. Compact Snug Drawer Panel (75vw, max 280px) ─── */}
      <div
        ref={drawerRef}
        tabIndex={-1}
        className={`pn-sidebar-panel relative z-10 w-[75vw] max-w-[280px] h-full shadow-2xl flex flex-col justify-between overflow-x-hidden overflow-y-auto overscroll-contain touch-pan-y pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] pt-[max(0.875rem,env(safe-area-inset-top,0px))] px-3 ${
          isLight
            ? 'bg-gradient-to-b from-[#FFFFFF] via-[#F8FBFD] to-[#F1F6FA] text-[#0A2540] border-r border-[#0A2540]/10'
            : 'bg-gradient-to-b from-[#0A2540] via-[#06182C] to-[#04101E] text-white border-r border-[#00E5F4]/20 shadow-[0_0_40px_rgba(0,229,244,0.12)]'
        }`}
      >
        <div className="space-y-4">
          <div className="pn-sidebar-brand">
          <div className="pn-sidebar-watermark" aria-hidden="true"><PenoraEmblem size={190} theme="dark" /></div>
          {/* Header: Brand Logo + Theme Switch + Close Button */}
          <div className="pn-sidebar-header flex items-center justify-between pt-0.5 pb-2.5 border-b border-[#0A2540]/8 dark:border-white/10">
            <a href="/" onClick={onClose} className="flex items-center min-w-0" aria-label="PENORA Home">
              <PenoraLogo
                variant="horizontal"
                theme={isLight ? 'light' : 'dark'}
                size="xs"
                emblemSize={30}
                showTagline={false}
                className={isLight ? '' : 'brightness-110'}
              />
            </a>

            <div className="flex items-center gap-1.5">
              {/* Theme Toggle */}
              <button
                type="button"
                onClick={() => setTheme(isLight ? 'dark' : 'light')}
                className={`p-2 rounded-full transition-colors ${
                  isLight
                    ? 'bg-[#0A2540]/5 text-[#52657C] hover:text-[#0A2540]'
                    : 'bg-white/10 text-[#00E5F4] hover:bg-white/15'
                }`}
                title={`Switch to ${isLight ? 'Dark' : 'Light'} Mode`}
                aria-label={`Switch to ${isLight ? 'Dark' : 'Light'} Mode`}
              >
                {isLight ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </button>

              {/* Close Button */}
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                className={`p-2 rounded-full transition-colors ${
                  isLight
                    ? 'bg-[#0A2540]/5 text-[#52657C] hover:bg-[#0A2540]/10 hover:text-[#0A2540]'
                    : 'bg-white/10 text-white/80 hover:bg-white/20 hover:text-white'
                }`}
                aria-label="Close navigation menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="pn-sidebar-manifesto">
            <span className="pn-sidebar-eyebrow">THE CREATOR NETWORK</span>
            <p>Ideas deserve<br /><span>ownership.</span></p>
          </div>
          {/* Creator Profile Header Card */}
          {activeUser ? (
            <div
              className={`pn-sidebar-identity p-3 rounded-2xl ${
                isLight
                  ? 'bg-white border border-[#0A2540]/8 shadow-xs'
                  : 'bg-white/5 border border-white/10 backdrop-blur-md shadow-inner'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {/* Avatar with cyan ring & online dot */}
                <div className="relative shrink-0">
                  {avatarUrl && !avatarImageError ? (
                    <img
                      src={avatarUrl}
                      alt={displayName}
                      className="h-11 w-11 rounded-full object-cover ring-2 ring-[#00E5F4] shadow-sm"
                      onError={() => setAvatarImageError(true)}
                    />
                  ) : (
                    <span
                      role="img"
                      aria-label="Profile initial"
                      className="h-11 w-11 rounded-full bg-[#E5F7F8] text-[#007C8B] ring-2 ring-[#00E5F4] flex items-center justify-center font-bold text-base"
                    >
                      <UserIcon className="h-5 w-5" aria-hidden="true" />
                    </span>
                  )}
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-[#10B981] ring-2 ring-white dark:ring-[#0A2540]" />
                </div>

                {/* Identity Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="pn-sidebar-name font-bold text-[14px] truncate text-[#0A2540] dark:text-white">
                      {displayName}
                    </span>
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#00E5F4] shrink-0" />
                    <span className="pn-sidebar-creator-badge inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[#F59E0B]/15 text-[#D97706] border border-[#F59E0B]/30 shrink-0">
                      <Crown className="h-2.5 w-2.5" />
                      Creator
                    </span>
                  </div>
                  <div className={`text-xs truncate ${isLight ? 'text-[#6E7D90]' : 'text-[#7D93AA]'}`}>
                    @{displayUsername}
                  </div>
                  {bioTagline && (
                    <div className={`text-[11px] truncate mt-0.5 ${isLight ? 'text-[#52657C]' : 'text-[#A0B0C0]'}`}>
                      {bioTagline}
                    </div>
                  )}
                </div>
              </div>

              {/* 3-Stat Horizontal Row (Followers | Blogs | Reputation) */}
              <div
                className={`grid grid-cols-3 gap-1 pt-2.5 mt-2.5 border-t text-center ${
                  isLight ? 'border-[#0A2540]/8' : 'border-white/10'
                }`}
              >
                <div>
                  <div className={`text-[13px] font-bold ${isLight ? 'text-[#0A2540]' : 'text-white'}`}>
                    {stats.followers}
                  </div>
                  <div className={`text-[10px] font-medium ${isLight ? 'text-[#6E7D90]' : 'text-[#7D93AA]'}`}>
                    Followers
                  </div>
                </div>
                <div className={`border-x ${isLight ? 'border-[#0A2540]/8' : 'border-white/10'}`}>
                  <div className={`text-[13px] font-bold ${isLight ? 'text-[#0A2540]' : 'text-white'}`}>
                    {stats.blogs}
                  </div>
                  <div className={`text-[10px] font-medium ${isLight ? 'text-[#6E7D90]' : 'text-[#7D93AA]'}`}>
                    Blogs
                  </div>
                </div>
                <div>
                  <div className={`text-[13px] font-bold ${isLight ? 'text-[#007C8B]' : 'text-[#00E5F4]'}`}>
                    {stats.reputation}
                  </div>
                  <div className={`text-[10px] font-medium ${isLight ? 'text-[#6E7D90]' : 'text-[#7D93AA]'}`}>
                    Reputation
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Guest Card */
            <div
              className={`pn-sidebar-identity p-3.5 rounded-2xl text-center space-y-2.5 ${
                isLight
                  ? 'bg-white border border-[#0A2540]/8 shadow-xs'
                  : 'bg-white/5 border border-white/10 backdrop-blur-md'
              }`}
            >
              <p className="pn-sidebar-invitation">Your voice. Your reputation. Your PENORA.</p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenLogin();
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-colors ${
                    isLight
                      ? 'border-[#0A2540]/15 text-[#0A2540] hover:bg-[#F0F5F8]'
                      : 'border-white/20 text-white hover:bg-white/10'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenRegister();
                  }}
                  className="py-2 px-3 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#007C8B] to-[#0A2540] hover:from-[#00E5F4] hover:to-[#007C8B] shadow-xs transition-colors"
                >
                  Sign Up
                </button>
              </div>
            </div>
          )}

          </div>
          {/* Search Bar Inside Drawer */}
          <div className="space-y-1.5 pt-0.5">
            <form onSubmit={handleSearchSubmit}>
              <div
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all ${
                  isLight
                    ? 'bg-white border-[#0A2540]/12 focus-within:border-[#007C8B] shadow-xs'
                    : 'bg-white/5 border-white/15 focus-within:border-[#00E5F4]'
                }`}
              >
                <Search className={`h-4 w-4 shrink-0 ${isLight ? 'text-[#6E7D90]' : 'text-[#7D93AA]'}`} />
                <input
                  ref={searchInputRef}
                  type="search"
                  aria-label="Search creators and topics"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Find your inspiration"
                  className={`w-full text-sm bg-transparent border-none focus:outline-none ${
                    isLight ? 'placeholder:text-[#6E7D90]/70 text-[#0A2540]' : 'placeholder:text-[#7D93AA] text-white'
                  }`}
                />
                {isSearchingCreators && (
                  <Loader2 className="h-3.5 w-3.5 text-[#007C8B] animate-spin shrink-0" />
                )}
              </div>
            </form>

            {/* Live Creator Matches Inside Drawer */}
            {liveCreators.length > 0 && (
              <div className="p-2 rounded-xl bg-white dark:bg-white/5 border border-[#0A2540]/8 dark:border-white/10 space-y-1 shadow-sm">
                <div className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#007C8B] dark:text-[#00E5F4] flex justify-between items-center">
                  <span>Matching Creators</span>
                  <span className="text-[9px] text-[#6E7D90]">Click to view</span>
                </div>
                {liveCreators.map((c) => {
                  const handle = c.username || c.id;
                  const cName = c.display_name || c.username || 'Creator';
                  const cAvatar = c.avatar_url && !c.avatar_url.includes('/brand/penora-avatar-') ? c.avatar_url : null;
                  return (
                    <a
                      key={c.id}
                      href={`/profile/${encodeURIComponent(handle)}`}
                      onClick={onClose}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-[#EEFBFC] dark:hover:bg-white/10 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {cAvatar ? (
                          <img src={cAvatar} alt={cName} className="h-7 w-7 rounded-full object-cover shrink-0 ring-1 ring-[#007C8B]/30" />
                        ) : (
                          <div className="h-7 w-7 rounded-full bg-[#E5F7F8] text-[#007C8B] flex items-center justify-center font-bold text-xs shrink-0">
                            {cName.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-xs font-bold truncate text-[#0A2540] dark:text-white">
                            {cName}
                          </div>
                          <div className="text-[10px] text-[#6E7D90] truncate">
                            @{c.username || 'creator'}
                          </div>
                        </div>
                      </div>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#007C8B]/10 text-[#007C8B] shrink-0">
                        Rep {c.reputation ?? 25}
                      </span>
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          {/* Grouped Navigation Links */}
          <div className="pn-sidebar-navigation space-y-4 pt-1">
            {/* Section A: Discover */}
            <div className="space-y-1">
              <div
                className={`px-3 py-1 text-xs font-bold uppercase tracking-wider flex items-center justify-between ${
                  isLight ? 'text-[#007C8B]' : 'text-[#00E5F4]'
                }`}
              >
                <span>Discover</span>
                <span className="text-[10px] opacity-60">✦</span>
              </div>

              {/* Home Feed */}
              <a
                href="/"
                onClick={onClose}
                className={getItemClassName(currentPath === '/' || currentPath === '/feed')}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Home className="h-5 w-5 shrink-0" />
                  <span className="truncate">Home Feed</span>
                </div>
                <ChevronRight className="h-4 w-4 opacity-40 shrink-0" />
              </a>

              {/* Following Feed */}
              <a
                href="/following"
                onClick={onClose}
                className={getItemClassName(currentPath === '/following')}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <UserCheck className="h-5 w-5 shrink-0" />
                  <span className="truncate">Following Feed</span>
                </div>
                <ChevronRight className="h-4 w-4 opacity-40 shrink-0" />
              </a>

              {/* Explore Topics & Search */}
              <a
                href="/explore"
                onClick={onClose}
                className={getItemClassName(currentPath.startsWith('/explore'))}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Compass className="h-5 w-5 shrink-0" />
                  <span className="truncate">Explore</span>
                </div>
                <ChevronRight className="h-4 w-4 opacity-40 shrink-0" />
              </a>

              {/* Communities */}
              <a
                href="/communities"
                onClick={onClose}
                className={getItemClassName(currentPath.startsWith('/communities'))}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Users className="h-5 w-5 shrink-0" />
                  <span className="truncate">Communities</span>
                </div>
                <ChevronRight className="h-4 w-4 opacity-40 shrink-0" />
              </a>

              {/* Creator Discovery */}
              <a
                href="/creators"
                onClick={onClose}
                className={getItemClassName(currentPath.startsWith('/creators'))}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Sparkles className="h-5 w-5 shrink-0" />
                  <span className="truncate">Discover Creators</span>
                </div>
                <ChevronRight className="h-4 w-4 opacity-40 shrink-0" />
              </a>
            </div>

            {/* Section B: Create & Connect */}
            <div className="space-y-1">
              <div
                className={`px-3 py-1 text-xs font-bold uppercase tracking-wider flex items-center justify-between ${
                  isLight ? 'text-[#007C8B]' : 'text-[#00E5F4]'
                }`}
              >
                <span>Create & Connect</span>
                <span className="text-[10px] opacity-60">✦</span>
              </div>

              {/* Write Article */}
              <a
                href="/editor"
                onClick={onClose}
                className={getItemClassName(currentPath.startsWith('/editor'))}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <PenLine className="h-5 w-5 shrink-0 text-[#007C8B] dark:text-[#00E5F4]" />
                  <span className="truncate">Write Article</span>
                </div>
                <ChevronRight className="h-4 w-4 opacity-40 shrink-0" />
              </a>

              {/* Notifications */}
              <a
                href="/notifications"
                onClick={onClose}
                className={getItemClassName(currentPath.startsWith('/notifications'))}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Bell className="h-5 w-5 shrink-0 text-[#007C8B] dark:text-[#00E5F4]" />
                  <span className="truncate">Notifications</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#00E5F4] ring-2 ring-white/50 shadow-[0_0_8px_#00E5F4]" />
                  <ChevronRight className="h-4 w-4 opacity-40 shrink-0" />
                </div>
              </a>

              {/* Writing Challenges */}
              <a
                href="/challenges"
                onClick={onClose}
                className={getItemClassName(currentPath.startsWith('/challenges'))}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Trophy className="h-5 w-5 shrink-0 text-[#007C8B] dark:text-[#00E5F4]" />
                  <span className="truncate">Challenges</span>
                </div>
                <ChevronRight className="h-4 w-4 opacity-40 shrink-0" />
              </a>

              {/* Creator Analytics */}
              <a
                href="/analytics"
                onClick={onClose}
                className={getItemClassName(currentPath.startsWith('/analytics'))}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <BarChart3 className="h-5 w-5 shrink-0 text-[#007C8B] dark:text-[#00E5F4]" />
                  <span className="truncate">Analytics</span>
                </div>
                <ChevronRight className="h-4 w-4 opacity-40 shrink-0" />
              </a>
            </div>

            {/* Section C: My Space */}
            <div className="space-y-1">
              <div
                className={`px-3 py-1 text-xs font-bold uppercase tracking-wider flex items-center justify-between ${
                  isLight ? 'text-[#007C8B]' : 'text-[#00E5F4]'
                }`}
              >
                <span>My Space</span>
                <span className="text-[10px] opacity-60">✦</span>
              </div>

              {/* My Profile */}
              <a
                href="/profile/me"
                onClick={onClose}
                className={getItemClassName(currentPath.startsWith('/profile'))}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <UserIcon className="h-5 w-5 shrink-0 text-[#007C8B] dark:text-[#00E5F4]" />
                  <span className="truncate">My Profile</span>
                </div>
                <ChevronRight className="h-4 w-4 opacity-40 shrink-0" />
              </a>

              {/* Wallet & Rewards */}
              <a
                href="/wallet"
                onClick={onClose}
                className={getItemClassName(currentPath.startsWith('/wallet'))}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Wallet className="h-5 w-5 shrink-0 text-[#007C8B] dark:text-[#00E5F4]" />
                  <span className="truncate">Wallet & Rewards</span>
                </div>
                <ChevronRight className="h-4 w-4 opacity-40 shrink-0" />
              </a>

              {/* Exchange */}
              <a
                href="/exchange"
                onClick={onClose}
                aria-current={currentPath.startsWith('/exchange') ? 'page' : undefined}
                className={getItemClassName(currentPath.startsWith('/exchange'))}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <ArrowLeftRight className="h-5 w-5 shrink-0 text-[#007C8B] dark:text-[#00E5F4]" />
                  <span className="truncate">Exchange</span>
                </div>
                <ChevronRight className="h-4 w-4 opacity-40 shrink-0" />
              </a>

              {/* Bookmarks */}
              <a
                href="/profile/me?tab=bookmarks"
                onClick={onClose}
                className={getItemClassName(currentPath.includes('tab=bookmarks'))}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Bookmark className="h-5 w-5 shrink-0 text-[#007C8B] dark:text-[#00E5F4]" />
                  <span className="truncate">Bookmarks</span>
                </div>
                <ChevronRight className="h-4 w-4 opacity-40 shrink-0" />
              </a>

              {/* My Articles */}
              <a
                href="/profile/me?tab=posts"
                onClick={onClose}
                className={getItemClassName(currentPath.includes('tab=posts'))}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-5 w-5 shrink-0 text-[#007C8B] dark:text-[#00E5F4]" />
                  <span className="truncate">My Articles</span>
                </div>
                <ChevronRight className="h-4 w-4 opacity-40 shrink-0" />
              </a>
            </div>
          </div>
        </div>

        {/* Footer: "Grow as a Creator" Card & Sign Out */}
        <div className="space-y-3 pt-3.5 mt-4 border-t border-[#0A2540]/8 dark:border-white/10">
          {/* Subtle CTA Card */}
          <a
            href="/editor"
            onClick={onClose}
            className={`pn-sidebar-cta block p-3 rounded-2xl group ${
              isLight
                ? 'bg-gradient-to-r from-[#FCEFF5] to-[#F0F7FB] border border-[#0A2540]/8 hover:border-[#007C8B]/30 shadow-xs'
                : 'bg-gradient-to-r from-white/5 to-[#00E5F4]/10 border border-[#00E5F4]/20 hover:border-[#00E5F4]/40 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="pn-sidebar-cta-icon shrink-0" aria-hidden="true"><PenLine className="h-4 w-4" /></span>
                <div className="min-w-0">
                  <div className={`text-[13px] font-bold truncate ${isLight ? 'text-[#0A2540]' : 'text-white'}`}>
                    Grow as a Creator
                  </div>
                  <div className={`text-[11px] truncate ${isLight ? 'text-[#6E7D90]' : 'text-[#7D93AA]'}`}>
                    Write, connect and earn on PENORA
                  </div>
                </div>
              </div>
              <div
                className={`p-1.5 rounded-full shrink-0 group-hover:translate-x-0.5 transition-transform ${
                  isLight ? 'bg-white shadow-xs text-[#0A2540]' : 'bg-white/10 text-white'
                }`}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </div>
            </div>
          </a>

          {/* Sign Out CTA (if logged in) */}
          {activeUser && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onLogout();
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-[15px] font-semibold text-[#D0384B] transition-colors min-h-[44px] ${
                isLight ? 'hover:bg-[#FDECEE] active:bg-[#FDECEE]/80' : 'hover:bg-red-500/10 active:bg-red-500/20'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </div>
              <ChevronRight className="h-3.5 w-3.5 opacity-50" />
            </button>
          )}

          <div
            className={`text-center text-[10px] tracking-wider uppercase font-medium ${
              isLight ? 'text-[#6E7D90]/70' : 'text-[#7D93AA]/70'
            }`}
          >
            Build • Write • Own • Together
          </div>
        </div>
      </div>
    </div>
  );
};
