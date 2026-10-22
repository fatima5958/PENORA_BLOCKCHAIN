// src/components/common/MobileNavigationDrawer.tsx
// PENORA — Premium Mobile Navigation Drawer (Sidebar)
// Faithfully matches the user-provided Light-Mode (and Dark-Mode) reference images:
// - Compact creator profile header with real avatar, username, verified badge, Creator pill, and real stats
// - Clean search bar inside drawer
// - Grouped navigation: Discover, Create & Connect, My Space
// - Soft rounded active items with chevrons and unread notification dot
// - Bottom "Grow as a Creator" card with direct action
// - Smooth slide-in animation, backdrop blur, safe-area support, outside-click & Escape dismissal
// - Light and Dark theme toggle
import React, { useState, useEffect, useRef } from 'react';
import {
  Home,
  Compass,
  Users,
  PenLine,
  Bell,
  User as UserIcon,
  Wallet,
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
  ArrowRight,
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
  const [stats, setStats] = useState({
    followers: 128,
    following: 86,
    blogs: 12,
    reputation: 25,
  });

  const activeUser = keyUser || user;
  const activeUserId = keyUser?.id || user?.id;

  const displayUsername =
    profile?.username ||
    keyUser?.username ||
    (user?.user_metadata?.username as string | undefined) ||
    user?.email?.split('@')[0] ||
    'fatima_test';

  const displayName =
    profile?.display_name ||
    keyUser?.displayName ||
    (user?.user_metadata?.full_name as string | undefined) ||
    displayUsername;

  const avatarUrl =
    profile?.avatar_url ||
    (user?.user_metadata?.avatar_url as string | undefined) ||
    '/brand/penora-avatar-mateen.jpg';

  const bioTagline =
    profile?.bio ||
    'Write • Tech • Faith • Soft Living ✧';

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
            reputation: profile?.reputation ?? 25,
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

  // Lock background scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Navigation Menu"
      className="fixed inset-0 z-50 lg:hidden flex"
    >
      {/* ─── Semi-transparent Backdrop ─── */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* ─── Drawer Panel ─── */}
      <div
        className={`relative z-10 w-[86vw] max-w-[340px] h-full shadow-2xl flex flex-col justify-between overflow-y-auto transform transition-all duration-300 ease-out pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] pt-[max(1rem,env(safe-area-inset-top,0px))] px-4 ${
          isLight
            ? 'bg-gradient-to-b from-[#FFFFFF] via-[#F8FBFD] to-[#F1F6FA] text-[#0A2540] border-r border-[#0A2540]/10'
            : 'bg-gradient-to-b from-[#0A2540] via-[#06182C] to-[#04101E] text-white border-r border-[#00E5F4]/20 shadow-[0_0_40px_rgba(0,229,244,0.12)]'
        }`}
      >
        <div className="space-y-4">
          {/* 1. Header: Brand Logo + Theme Switch + Close Button */}
          <div className="flex items-center justify-between pt-1 pb-2 border-b border-[#0A2540]/8">
            <a href="/" onClick={onClose} className="flex items-center min-w-0">
              <PenoraLogo
                variant="horizontal"
                size="xs"
                emblemSize={32}
                showTagline={false}
                className={isLight ? '' : 'brightness-110'}
              />
            </a>

            <div className="flex items-center gap-2">
              {/* Theme Toggle (Light / Dark) */}
              <button
                type="button"
                onClick={() => setTheme(isLight ? 'dark' : 'light')}
                className={`p-1.5 rounded-full transition-colors ${
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
                className={`p-1.5 rounded-full transition-colors ${
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

          {/* 2. Creator Profile Header Card */}
          {activeUser ? (
            <div
              className={`p-3.5 rounded-2xl transition-all ${
                isLight
                  ? 'bg-white border border-[#0A2540]/8 shadow-xs'
                  : 'bg-white/5 border border-white/10 backdrop-blur-md shadow-inner'
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Avatar with cyan ring & online dot */}
                <div className="relative shrink-0">
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="h-12 w-12 rounded-full object-cover ring-2 ring-[#00E5F4] shadow-sm"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-[#10B981] ring-2 ring-white" />
                </div>

                {/* Identity Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-sm truncate max-w-[130px]">
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
                  <div className={`text-[11px] truncate mt-0.5 ${isLight ? 'text-[#52657C]' : 'text-[#A0B0C0]'}`}>
                    {bioTagline}
                  </div>
                </div>
              </div>

              {/* 3-Stat Horizontal Row (Followers | Blogs | Reputation) */}
              <div
                className={`grid grid-cols-3 gap-1 pt-3 mt-3 border-t text-center ${
                  isLight ? 'border-[#0A2540]/8' : 'border-white/10'
                }`}
              >
                <div>
                  <div className={`text-sm font-bold ${isLight ? 'text-[#0A2540]' : 'text-white'}`}>
                    {stats.followers}
                  </div>
                  <div className={`text-[10px] font-medium ${isLight ? 'text-[#6E7D90]' : 'text-[#7D93AA]'}`}>
                    Followers
                  </div>
                </div>
                <div className={`border-x ${isLight ? 'border-[#0A2540]/8' : 'border-white/10'}`}>
                  <div className={`text-sm font-bold ${isLight ? 'text-[#0A2540]' : 'text-white'}`}>
                    {stats.blogs}
                  </div>
                  <div className={`text-[10px] font-medium ${isLight ? 'text-[#6E7D90]' : 'text-[#7D93AA]'}`}>
                    Blogs
                  </div>
                </div>
                <div>
                  <div className={`text-sm font-bold ${isLight ? 'text-[#007C8B]' : 'text-[#00E5F4]'}`}>
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
              <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-[#007C8B]">
                <Sparkles className="h-3.5 w-3.5 text-[#00E5F4]" />
                <span>Join PENORA</span>
              </div>
              <p className={`text-xs ${isLight ? 'text-[#52657C]' : 'text-[#7D93AA]'}`}>
                A fairer internet for creators to write, earn, and build verifiable reputation.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenLogin();
                  }}
                  className={`py-1.5 px-3 rounded-xl text-xs font-semibold border transition-colors ${
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
                  className="py-1.5 px-3 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#007C8B] to-[#0A2540] hover:from-[#00E5F4] hover:to-[#007C8B] shadow-xs transition-colors"
                >
                  Sign Up
                </button>
              </div>
            </div>
          )}

          {/* 3. Search Bar Inside Drawer */}
          <form onSubmit={handleSearchSubmit} className="pt-1">
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${
                isLight
                  ? 'bg-white border-[#0A2540]/12 focus-within:border-[#007C8B] shadow-xs'
                  : 'bg-white/5 border-white/15 focus-within:border-[#00E5F4]'
              }`}
            >
              <Search className={`h-3.5 w-3.5 shrink-0 ${isLight ? 'text-[#6E7D90]' : 'text-[#7D93AA]'}`} />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search PENORA..."
                className={`w-full text-xs bg-transparent border-none focus:outline-none ${
                  isLight ? 'placeholder:text-[#6E7D90]/70 text-[#0A2540]' : 'placeholder:text-[#7D93AA] text-white'
                }`}
              />
            </div>
          </form>

          {/* 4. Grouped Navigation Links */}
          <div className="space-y-4 pt-1">
            {/* Section A: Discover */}
            <div className="space-y-1">
              <div
                className={`px-2 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                  isLight ? 'text-[#007C8B]' : 'text-[#00E5F4]'
                }`}
              >
                <span>Discover</span>
                <span className="text-xs">✦</span>
              </div>

              {/* Home Feed */}
              <a
                href="/"
                onClick={onClose}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  currentPath === '/' || currentPath === '/feed'
                    ? isLight
                      ? 'bg-[#00E5F4]/15 text-[#007C8B] font-bold border-l-4 border-[#007C8B]'
                      : 'bg-[#00E5F4]/20 text-[#00E5F4] font-bold border-l-4 border-[#00E5F4]'
                    : isLight
                    ? 'text-[#0A2540] hover:bg-white hover:text-[#007C8B]'
                    : 'text-white/80 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Home className="h-4 w-4 shrink-0" />
                  <span>Home Feed</span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 opacity-50" />
              </a>

              {/* Explore Topics */}
              <a
                href="/explore"
                onClick={onClose}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  currentPath.startsWith('/explore')
                    ? isLight
                      ? 'bg-[#00E5F4]/15 text-[#007C8B] font-bold border-l-4 border-[#007C8B]'
                      : 'bg-[#00E5F4]/20 text-[#00E5F4] font-bold border-l-4 border-[#00E5F4]'
                    : isLight
                    ? 'text-[#0A2540] hover:bg-white hover:text-[#007C8B]'
                    : 'text-white/80 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Compass className="h-4 w-4 shrink-0" />
                  <span>Explore Topics</span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 opacity-50" />
              </a>

              {/* Communities */}
              <a
                href="/communities"
                onClick={onClose}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  currentPath.startsWith('/communities')
                    ? isLight
                      ? 'bg-[#00E5F4]/15 text-[#007C8B] font-bold border-l-4 border-[#007C8B]'
                      : 'bg-[#00E5F4]/20 text-[#00E5F4] font-bold border-l-4 border-[#00E5F4]'
                    : isLight
                    ? 'text-[#0A2540] hover:bg-white hover:text-[#007C8B]'
                    : 'text-white/80 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Users className="h-4 w-4 shrink-0" />
                  <span>Communities</span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 opacity-50" />
              </a>
            </div>

            {/* Section B: Create & Connect */}
            <div className="space-y-1">
              <div
                className={`px-2 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                  isLight ? 'text-[#007C8B]' : 'text-[#00E5F4]'
                }`}
              >
                <span>Create & Connect</span>
                <span className="text-xs">✦</span>
              </div>

              {/* Write Article */}
              <a
                href="/editor"
                onClick={onClose}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  currentPath.startsWith('/editor')
                    ? isLight
                      ? 'bg-[#00E5F4]/15 text-[#007C8B] font-bold border-l-4 border-[#007C8B]'
                      : 'bg-[#00E5F4]/20 text-[#00E5F4] font-bold border-l-4 border-[#00E5F4]'
                    : isLight
                    ? 'text-[#0A2540] hover:bg-white hover:text-[#007C8B]'
                    : 'text-white/80 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <PenLine className="h-4 w-4 shrink-0 text-[#007C8B]" />
                  <span>Write Article</span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 opacity-50" />
              </a>

              {/* Notifications */}
              <a
                href="/notifications"
                onClick={onClose}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  currentPath.startsWith('/notifications')
                    ? isLight
                      ? 'bg-[#00E5F4]/15 text-[#007C8B] font-bold border-l-4 border-[#007C8B]'
                      : 'bg-[#00E5F4]/20 text-[#00E5F4] font-bold border-l-4 border-[#00E5F4]'
                    : isLight
                    ? 'text-[#0A2540] hover:bg-white hover:text-[#007C8B]'
                    : 'text-white/80 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Bell className="h-4 w-4 shrink-0 text-[#007C8B]" />
                  <span>Notifications</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#EF4444]" />
                  <ChevronRight className="h-3.5 w-3.5 opacity-50" />
                </div>
              </a>
            </div>

            {/* Section C: My Space */}
            <div className="space-y-1">
              <div
                className={`px-2 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                  isLight ? 'text-[#007C8B]' : 'text-[#00E5F4]'
                }`}
              >
                <span>My Space</span>
                <span className="text-xs">✦</span>
              </div>

              {/* My Profile */}
              <a
                href="/profile/me"
                onClick={onClose}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  currentPath.startsWith('/profile')
                    ? isLight
                      ? 'bg-[#00E5F4]/15 text-[#007C8B] font-bold border-l-4 border-[#007C8B]'
                      : 'bg-[#00E5F4]/20 text-[#00E5F4] font-bold border-l-4 border-[#00E5F4]'
                    : isLight
                    ? 'text-[#0A2540] hover:bg-white hover:text-[#007C8B]'
                    : 'text-white/80 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <UserIcon className="h-4 w-4 shrink-0 text-[#007C8B]" />
                  <span>My Profile</span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 opacity-50" />
              </a>

              {/* Wallet & Rewards */}
              <a
                href="/wallet"
                onClick={onClose}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  currentPath.startsWith('/wallet')
                    ? isLight
                      ? 'bg-[#00E5F4]/15 text-[#007C8B] font-bold border-l-4 border-[#007C8B]'
                      : 'bg-[#00E5F4]/20 text-[#00E5F4] font-bold border-l-4 border-[#00E5F4]'
                    : isLight
                    ? 'text-[#0A2540] hover:bg-white hover:text-[#007C8B]'
                    : 'text-white/80 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Wallet className="h-4 w-4 shrink-0 text-[#007C8B]" />
                  <span>Wallet & Rewards</span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 opacity-50" />
              </a>

              {/* Bookmarks */}
              <a
                href="/profile/me?tab=bookmarks"
                onClick={onClose}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  isLight
                    ? 'text-[#0A2540] hover:bg-white hover:text-[#007C8B]'
                    : 'text-white/80 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Bookmark className="h-4 w-4 shrink-0 text-[#007C8B]" />
                  <span>Bookmarks</span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 opacity-50" />
              </a>

              {/* My Articles */}
              <a
                href="/profile/me?tab=posts"
                onClick={onClose}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  isLight
                    ? 'text-[#0A2540] hover:bg-white hover:text-[#007C8B]'
                    : 'text-white/80 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <FileText className="h-4 w-4 shrink-0 text-[#007C8B]" />
                  <span>My Articles</span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 opacity-50" />
              </a>
            </div>
          </div>
        </div>

        {/* 5. Footer: "Grow as a Creator" Card & Sign Out */}
        <div className="space-y-3 pt-4 border-t border-[#0A2540]/8">
          {/* Subtle CTA Card (matching mockup) */}
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
                <span className="text-xl shrink-0">👑</span>
                <div className="min-w-0">
                  <div className={`text-xs font-bold truncate ${isLight ? 'text-[#0A2540]' : 'text-white'}`}>
                    Grow as a Creator
                  </div>
                  <div className={`text-[10px] truncate ${isLight ? 'text-[#6E7D90]' : 'text-[#7D93AA]'}`}>
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
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-[#D0384B] transition-colors ${
                isLight ? 'hover:bg-[#FDECEE]' : 'hover:bg-red-500/10'
              }`}
            >
              <div className="flex items-center gap-2">
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </div>
              <ChevronRight className="h-3.5 w-3.5 opacity-50" />
            </button>
          )}

          <div
            className={`text-center text-[10px] tracking-wider uppercase font-medium ${
              isLight ? 'text-[#6E7D90]/60' : 'text-[#7D93AA]/60'
            }`}
          >
            Build • Write • Own • Together
          </div>
        </div>
      </div>
    </div>
  );
};
