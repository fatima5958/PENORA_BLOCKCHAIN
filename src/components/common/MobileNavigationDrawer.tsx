// src/components/common/MobileNavigationDrawer.tsx
// PENORA — Premium Mobile Navigation Drawer (Sidebar)
// - Calibrated drawer width: 80–85vw, capped at 320px
// - Balanced horizontal padding, eliminating excessive right-side void
// - Touch-friendly menu items (15–16px typography, 20px icons, 46px+ touch target)
// - Subtle dark backdrop with instant outside-tap dismissal & Escape handling
// - Robust background scroll lock and horizontal overflow prevention
// - Full PENORA branding, creator identity card, and grouped navigation intact

import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { PenoraLogo } from '../brand/PenoraLogo';
import { getFollowCounts } from '../../lib/api/follows';
import { getUserArticles } from '../../lib/api/articles';
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
  const [avatarImageError, setAvatarImageError] = useState(false);
  const [stats, setStats] = useState({
    followers: 0,
    following: 0,
    blogs: 0,
    reputation: 0,
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

  // Lock background scroll without jumping or layout shifts
  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY;
      const originalOverflow = document.body.style.overflow;
      const originalPosition = document.body.style.position;
      const originalTop = document.body.style.top;
      const originalWidth = document.body.style.width;

      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';

      return () => {
        document.body.style.position = originalPosition;
        document.body.style.top = originalTop;
        document.body.style.width = originalWidth;
        document.body.style.overflow = originalOverflow;
        document.documentElement.style.overflow = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onClose();
      window.location.href = `/explore?q=${encodeURIComponent(searchQuery.trim())}`;
    }
  };

  const isLight = theme === 'light';

  if (!isOpen) return null;

  // Base styling for consistent navigation items
  const getItemClassName = (isActive: boolean) =>
    `w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-[15px] font-medium transition-all min-h-[46px] select-none ${
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
      className="fixed inset-0 z-50 lg:hidden flex overflow-hidden"
    >
      {/* ─── 1. Subtle Dark Backdrop (Closes on Tap) ─── */}
      <div
        className="fixed inset-0 bg-black/55 backdrop-blur-[2px] transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* ─── 2. Calibrated Drawer Panel (80–85vw, max 320px) ─── */}
      <div
        className={`relative z-10 w-[82vw] max-w-[320px] h-full shadow-2xl flex flex-col justify-between overflow-x-hidden overflow-y-auto transform transition-all duration-300 ease-out pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] pt-[max(0.875rem,env(safe-area-inset-top,0px))] px-3.5 ${
          isLight
            ? 'bg-gradient-to-b from-[#FFFFFF] via-[#F8FBFD] to-[#F1F6FA] text-[#0A2540] border-r border-[#0A2540]/10'
            : 'bg-gradient-to-b from-[#0A2540] via-[#06182C] to-[#04101E] text-white border-r border-[#00E5F4]/20 shadow-[0_0_40px_rgba(0,229,244,0.12)]'
        }`}
      >
        <div className="space-y-4">
          {/* Header: Brand Logo + Theme Switch + Close Button */}
          <div className="flex items-center justify-between pt-0.5 pb-2.5 border-b border-[#0A2540]/8 dark:border-white/10">
            <a href="/" onClick={onClose} className="flex items-center min-w-0" aria-label="PENORA Home">
              <PenoraLogo
                variant="horizontal"
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

          {/* Creator Profile Header Card */}
          {activeUser ? (
            <div
              className={`p-3 rounded-2xl transition-all ${
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
                    <span className="font-bold text-[14px] truncate text-[#0A2540] dark:text-white">
                      {displayName}
                    </span>
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#00E5F4] shrink-0" />
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[#F59E0B]/15 text-[#D97706] border border-[#F59E0B]/30 shrink-0">
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
              className={`p-3.5 rounded-2xl text-center space-y-2.5 ${
                isLight
                  ? 'bg-white border border-[#0A2540]/8 shadow-xs'
                  : 'bg-white/5 border border-white/10 backdrop-blur-md'
              }`}
            >
              <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-[#007C8B] dark:text-[#00E5F4]">
                <Sparkles className="h-3.5 w-3.5 text-[#00E5F4]" />
                <span>Join PENORA</span>
              </div>
              <p className={`text-xs ${isLight ? 'text-[#52657C]' : 'text-[#7D93AA]'}`}>
                A fairer creator platform to write, curate, and build verifiable reputation.
              </p>
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

          {/* Search Bar Inside Drawer */}
          <form onSubmit={handleSearchSubmit} className="pt-0.5">
            <div
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all ${
                isLight
                  ? 'bg-white border-[#0A2540]/12 focus-within:border-[#007C8B] shadow-xs'
                  : 'bg-white/5 border-white/15 focus-within:border-[#00E5F4]'
              }`}
            >
              <Search className={`h-4 w-4 shrink-0 ${isLight ? 'text-[#6E7D90]' : 'text-[#7D93AA]'}`} />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search PENORA..."
                className={`w-full text-sm bg-transparent border-none focus:outline-none ${
                  isLight ? 'placeholder:text-[#6E7D90]/70 text-[#0A2540]' : 'placeholder:text-[#7D93AA] text-white'
                }`}
              />
            </div>
          </form>

          {/* Grouped Navigation Links */}
          <div className="space-y-4 pt-1">
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

              {/* Explore Topics */}
              <a
                href="/explore"
                onClick={onClose}
                className={getItemClassName(currentPath.startsWith('/explore'))}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Compass className="h-5 w-5 shrink-0" />
                  <span className="truncate">Explore Topics</span>
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
                  <span className="truncate">Creator Discovery</span>
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
                  <span className="h-2 w-2 rounded-full bg-[#EF4444]" />
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
                  <span className="truncate">Writing Challenges</span>
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
                  <span className="truncate">Creator Analytics</span>
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
            className={`block p-3 rounded-2xl transition-all group ${
              isLight
                ? 'bg-gradient-to-r from-[#FCEFF5] to-[#F0F7FB] border border-[#0A2540]/8 hover:border-[#007C8B]/30 shadow-xs'
                : 'bg-gradient-to-r from-white/5 to-[#00E5F4]/10 border border-[#00E5F4]/20 hover:border-[#00E5F4]/40 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-xl shrink-0" aria-hidden="true">👑</span>
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
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-[14px] font-semibold text-[#D0384B] transition-colors min-h-[44px] ${
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
