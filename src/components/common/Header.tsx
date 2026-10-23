// src/components/common/Header.tsx
// PENORA Blockchain — Global Top Navigation Header
// Integrates the approved PENORA Blockchain Horizontal Logo Lockup,
// refined search bar with live Creator and Article suggestions,
// mobile search modal with accessible focus trapping and scroll lock,
// branded pen shortcut, and live session state.

import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Bell,
  LogOut,
  User,
  Menu,
  X,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  Wallet,
  ArrowLeftRight,
  Sparkles,
  FileText,
  Loader2,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useLiveProfile } from '../../lib/hooks/useLiveProfile';
import type { PostRecord, ProfileRecord } from '../../lib/api/types';
import { searchProfiles } from '../../lib/api/profiles';
import { getPublishedArticles } from '../../lib/api/articles';
import { useOverlayLock } from '../../lib/ui/overlayManager';
import { SpatialAuthModalV4 } from '../design-v4/SpatialAuthModalV4';
import { PenoraLogo } from '../brand/PenoraLogo';
import { PenoraWriteIcon } from '../brand/PenoraWriteIcon';
import { MobileNavigationDrawer } from './MobileNavigationDrawer';
import { penoraKeyAuth, type PenoraUser } from '../../lib/auth/penoraKeyAuth';
import { fetchUserNotifications } from '../../lib/api/notifications';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface HeaderProps {
  currentPath?: string;
}

/** Returns 1–2 uppercase initials from a name, username, or email address. */
function getInitials(nameOrEmail: string): string {
  if (!nameOrEmail) return 'U';
  const clean = nameOrEmail.replace(/^@/, '').trim();
  const parts = clean.split(/[._\s-]/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

export const Header: React.FC<HeaderProps> = ({ currentPath = '/' }) => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [keyUser, setKeyUser] = useState<PenoraUser | null>(null);
  const profile = useLiveProfile(keyUser?.id || user?.id);
  const [avatarImageError, setAvatarImageError] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authStep, setAuthStep] = useState<'email' | 'otp' | 'keys' | 'backup' | 'success'>('email');
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // Live unread notifications watcher
  useEffect(() => {
    let mounted = true;
    const uid = keyUser?.id || user?.id;
    if (!uid) {
      setUnreadNotifications(0);
      return;
    }

    const checkNotifications = async () => {
      try {
        const username = keyUser?.username || (user?.user_metadata?.username as string) || user?.email?.split('@')[0];
        const res = await fetchUserNotifications(uid, username);
        if (mounted && res.data) {
          const unread = res.data.filter((n) => !n.read).length;
          setUnreadNotifications(unread);
        }
      } catch {
        // preserve previous state
      }
    };

    checkNotifications();

    const handler = () => {
      checkNotifications();
    };

    window.addEventListener('penora:notifications-updated', handler);
    window.addEventListener('penora:vote-cast', handler);
    window.addEventListener('penora:comment-added', handler);
    window.addEventListener('penora:follow-changed', handler);
    const interval = window.setInterval(checkNotifications, 15000);

    return () => {
      mounted = false;
      window.removeEventListener('penora:notifications-updated', handler);
      window.removeEventListener('penora:vote-cast', handler);
      window.removeEventListener('penora:comment-added', handler);
      window.removeEventListener('penora:follow-changed', handler);
      window.clearInterval(interval);
    };
  }, [keyUser?.id, user?.id]);

  // Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const [previewCreators, setPreviewCreators] = useState<ProfileRecord[]>([]);
  const [previewArticles, setPreviewArticles] = useState<PostRecord[]>([]);
  const [isSearchingLive, setIsSearchingLive] = useState(false);
  const [searchTab, setSearchTab] = useState<'all' | 'creators' | 'articles'>('all');

  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchDropdownRef = useRef<HTMLDivElement>(null);
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchContainerRef = useRef<HTMLDivElement>(null);

  // Accessible scroll lock and focus management for mobile search modal
  useOverlayLock(mobileSearchOpen, {
    containerRef: mobileSearchContainerRef,
    initialFocusRef: mobileSearchInputRef,
    onEscape: () => setMobileSearchOpen(false),
  });

  // Initialize session, subscribe to auth state changes, and support ?auth= URL trigger
  useEffect(() => {
    let mounted = true;

    const params = new URLSearchParams(window.location.search);
    const authParam = params.get('auth');
    const stepParam = params.get('step') as 'email' | 'otp' | 'keys' | 'backup' | 'success' | null;
    if (authParam === 'login' || authParam === 'register') {
      setAuthMode(authParam);
      if (stepParam) setAuthStep(stepParam);
      setAuthModalOpen(true);
    }

    const unsubscribeKeyAuth = penoraKeyAuth.subscribe((ku) => {
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

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setUser(session?.user ?? null);
        setAuthLoading(false);
      }
    });

    return () => {
      mounted = false;
      unsubscribeKeyAuth();
      authListener?.subscription.unsubscribe();
    };
  }, []);

  // Debounced search for both desktop instant preview and mobile search overlay
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setPreviewCreators([]);
      setPreviewArticles([]);
      setIsSearchingLive(false);
      return;
    }

    setIsSearchingLive(true);
    const timer = setTimeout(async () => {
      try {
        const [creatorsRes, articlesRes] = await Promise.all([
          searchProfiles(q, 4),
          getPublishedArticles({ search: q, limit: 3 }),
        ]);
        setPreviewCreators(creatorsRes.data || []);
        setPreviewArticles(articlesRes.data || []);
      } catch {
        // Fallback silently
      } finally {
        setIsSearchingLive(false);
      }
    }, 240);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Global keyboard shortcut '/' to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
        setSearchDropdownOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close desktop search and profile dropdown on outside click or escape
  useEffect(() => {
    const closeOnOutside = (e: MouseEvent) => {
      if (
        profileDropdownRef.current &&
        !profileDropdownRef.current.contains(e.target as Node)
      ) {
        setProfileDropdownOpen(false);
      }
      if (
        searchDropdownRef.current &&
        !searchDropdownRef.current.contains(e.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(e.target as Node)
      ) {
        setSearchDropdownOpen(false);
      }
    };

    const closeOnEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setProfileDropdownOpen(false);
        setSearchDropdownOpen(false);
        setMobileMenuOpen(false);
        setMobileSearchOpen(false);
      }
    };

    document.addEventListener('mousedown', closeOnOutside);
    window.addEventListener('keydown', closeOnEsc);
    return () => {
      document.removeEventListener('mousedown', closeOnOutside);
      window.removeEventListener('keydown', closeOnEsc);
    };
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setSearchDropdownOpen(false);
      setMobileSearchOpen(false);
      window.location.href = `/explore?q=${encodeURIComponent(searchQuery.trim())}`;
    }
  };

  const handleLogout = async () => {
    try {
      penoraKeyAuth.logout();
      await supabase.auth.signOut();
      setUser(null);
      setKeyUser(null);
      setProfileDropdownOpen(false);
      window.location.href = '/';
    } catch {
      window.location.reload();
    }
  };

  const openLogin = () => {
    setAuthMode('login');
    setAuthStep('email');
    setAuthModalOpen(true);
    setMobileMenuOpen(false);
    setMobileSearchOpen(false);
  };

  const openRegister = () => {
    setAuthMode('register');
    setAuthStep('email');
    setAuthModalOpen(true);
    setMobileMenuOpen(false);
    setMobileSearchOpen(false);
  };

  const activeUser = keyUser || user;
  const displayUsername =
    profile?.username ||
    keyUser?.username ||
    (user?.user_metadata?.username as string | undefined) ||
    user?.email?.split('@')[0] ||
    '';
  const displayName =
    profile?.display_name ||
    keyUser?.displayName ||
    (user?.user_metadata?.full_name as string | undefined) ||
    displayUsername ||
    user?.email ||
    '';
  const avatarUrl =
    profile?.avatar_url && !profile.avatar_url.includes('/brand/penora-avatar-')
      ? profile.avatar_url
      : null;
  const reputation = profile?.reputation ?? 25;

  return (
    <>
      <header
        className={`pn-header sticky top-0 z-40 ${
          currentPath === '/' || currentPath === '/feed' ? 'pn-feed-header' : ''
        }`}
      >
        <div className="max-w-[1400px] mx-auto px-3 sm:px-6 lg:px-8 h-full flex items-center justify-between gap-2 sm:gap-4">
          {/* Left: Mobile Drawer Button + Official PENORA Horizontal Logo Lockup */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle navigation menu"
              className="lg:hidden pn-icon-btn h-8 w-8 sm:h-9 sm:w-9 text-[#0A2540] flex-shrink-0"
            >
              {mobileMenuOpen ? <X className="h-4 w-4 sm:h-5 sm:w-5" /> : <Menu className="h-4 w-4 sm:h-5 sm:w-5" />}
            </button>

            <a
              href="/"
              className="pn-focus flex items-center rounded-xl py-1 transition-opacity hover:opacity-90 min-w-0"
              aria-label="PENORA Blockchain Home"
            >
              <span className="sm:hidden flex items-center">
                <PenoraLogo variant="horizontal" size="xs" emblemSize={32} showTagline={false} className="scale-90 origin-left" />
              </span>
              <span className="hidden sm:inline-flex">
                <PenoraLogo variant="horizontal" size="sm" emblemSize={40} showTagline={true} />
              </span>
            </a>
          </div>

          {/* Center: Refined PENORA Search Bar with Live Suggestions */}
          <div className="relative flex-1 max-w-[480px] hidden md:block">
            <form onSubmit={handleSearchSubmit}>
              <div className="pn-search">
                <Search className="h-4 w-4 text-[#4A5B70] flex-shrink-0" />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={searchQuery}
                  onFocus={() => setSearchDropdownOpen(true)}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSearchDropdownOpen(true);
                  }}
                  placeholder="Search creators, @handle, articles, or topics..."
                  aria-label="Search creators, handles, articles, or topics"
                />
                {isSearchingLive ? (
                  <Loader2 className="h-3.5 w-3.5 text-[#007C8B] animate-spin" />
                ) : searchQuery ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSearchDropdownOpen(false);
                    }}
                    className="text-[11px] font-medium text-[#4A5B70] hover:text-[#0A2540] px-1.5"
                  >
                    Clear
                  </button>
                ) : (
                  <kbd className="pn-kbd hidden sm:inline-block" title="Press / to search">
                    /
                  </kbd>
                )}
              </div>
            </form>

            {/* Desktop Instant Search Dropdown */}
            {searchDropdownOpen && searchQuery.trim().length >= 2 && (
              <div
                ref={searchDropdownRef}
                className="absolute top-full left-0 right-0 mt-2 rounded-2xl bg-white border border-[#0A2540]/12 shadow-xl p-3 space-y-3 z-50 animate-in fade-in zoom-in-95 duration-150"
              >
                {/* Creators Section */}
                {previewCreators.length > 0 && (
                  <div className="space-y-1">
                    <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-[#007C8B] flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <User className="h-3 w-3" />
                        <span>Creators</span>
                      </span>
                      <span className="text-[9px] text-[#6E7D90]">Verified</span>
                    </div>
                    {previewCreators.map((c) => {
                      const cHandle = c.username || c.id;
                      const cName = c.display_name || c.username || 'Creator';
                      const cAvatar = c.avatar_url && !c.avatar_url.includes('/brand/penora-avatar-') ? c.avatar_url : null;
                      return (
                        <a
                          key={c.id}
                          href={`/profile/${encodeURIComponent(cHandle)}`}
                          onClick={() => setSearchDropdownOpen(false)}
                          className="flex items-center justify-between p-2 rounded-xl hover:bg-[#F4F7FA] transition-colors group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {cAvatar ? (
                              <img src={cAvatar} alt={cName} className="h-7 w-7 rounded-full object-cover shrink-0 ring-1 ring-[#007C8B]/30" />
                            ) : (
                              <div className="h-7 w-7 rounded-full bg-[#E5F7F8] text-[#007C8B] flex items-center justify-center font-bold text-xs shrink-0">
                                {cName.slice(0, 1).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-[#0A2540] group-hover:text-[#007C8B] transition-colors truncate">
                                {cName}
                              </div>
                              <div className="text-[10px] text-[#6E7D90] truncate">
                                @{c.username || 'creator'}
                              </div>
                            </div>
                          </div>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#007C8B]/10 text-[#007C8B] shrink-0">
                            Rep {c.reputation ?? 25}
                          </span>
                        </a>
                      );
                    })}
                  </div>
                )}

                {/* Articles Section */}
                {previewArticles.length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-[#0A2540]/6">
                    <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-[#007C8B] flex items-center gap-1.5">
                      <FileText className="h-3 w-3" />
                      <span>Articles</span>
                    </div>
                    {previewArticles.map((a) => (
                      <a
                        key={a.id}
                        href={`/read?slug=${encodeURIComponent(a.slug)}`}
                        onClick={() => setSearchDropdownOpen(false)}
                        className="block p-2 rounded-xl hover:bg-[#F4F7FA] transition-colors group"
                      >
                        <div className="text-xs font-bold text-[#0A2540] group-hover:text-[#007C8B] transition-colors truncate">
                          {a.title}
                        </div>
                        <div className="text-[10px] text-[#6E7D90] truncate mt-0.5">
                          {a.excerpt || a.content.slice(0, 80)}
                        </div>
                      </a>
                    ))}
                  </div>
                )}

                {/* No results */}
                {previewCreators.length === 0 && previewArticles.length === 0 && !isSearchingLive && (
                  <div className="p-3 text-center text-xs text-[#6E7D90]">
                    No matches found for &ldquo;{searchQuery}&rdquo;. Press Enter to explore all topics.
                  </div>
                )}

                {/* Footer link to explore page */}
                <a
                  href={`/explore?q=${encodeURIComponent(searchQuery.trim())}`}
                  onClick={() => setSearchDropdownOpen(false)}
                  className="w-full py-2 px-3 rounded-xl bg-[#007C8B]/10 hover:bg-[#007C8B]/15 text-[#007C8B] text-xs font-bold flex items-center justify-between transition-colors"
                >
                  <span>View all results for &ldquo;{searchQuery}&rdquo;</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
            )}
          </div>

          {/* Right: Article Studio shortcut, Divider & Auth Controls (Simple Header) */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Article Studio pen shortcut */}
            <a
              href="/editor"
              aria-label="Open Article Studio"
              title="Create a blog"
              className="pn-focus inline-flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl border border-[#007C8B]/20 bg-[#F4F7FA] shadow-xs transition-colors hover:bg-[#00E5F4]/10 hover:border-[#007C8B]/50"
            >
              <PenoraWriteIcon className="h-6 w-6 sm:h-8 sm:w-8" />
            </a>

            {/* Subtle Divider */}
            <div className="h-5 w-px bg-[#0A2540]/10 hidden sm:block" />

            {/* Auth / Profile Area */}
            {authLoading ? (
              <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-[#0A2540]/5 animate-pulse" />
            ) : activeUser ? (
              <div className="flex items-center gap-2">
                {/* Mobile Search Button */}
                <button
                  type="button"
                  onClick={() => setMobileSearchOpen(true)}
                  className="pn-icon-btn h-8 w-8 md:hidden text-[#0A2540]"
                  aria-label="Search creators and topics"
                >
                  <Search className="h-4 w-4" />
                </button>

                {/* Notifications Link with Active Dynamic Indicator */}
                <a
                  href="/notifications"
                  className="pn-icon-btn relative h-8 w-8 sm:h-9 sm:w-9 text-[#0A2540] hover:text-[#007C8B] transition-colors"
                  aria-label={
                    unreadNotifications > 0
                      ? `${unreadNotifications} unread notifications`
                      : 'Notifications'
                  }
                  title={
                    unreadNotifications > 0
                      ? `${unreadNotifications} unread notifications`
                      : 'Notifications'
                  }
                >
                  <Bell className="h-4 w-4" />
                  {unreadNotifications > 0 && (
                    <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[#00E5F4] ring-2 ring-white shadow-[0_0_8px_#00E5F4]" />
                  )}
                </a>

                {/* Profile Dropdown */}
                <div className="relative" ref={profileDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setProfileDropdownOpen((v) => !v)}
                    className="pn-focus flex items-center gap-1.5 p-1 rounded-full border border-[#007C8B]/30 hover:border-[#007C8B] transition-colors"
                    aria-expanded={profileDropdownOpen}
                    aria-haspopup="true"
                    aria-label="Open creator profile menu"
                  >
                    <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full overflow-hidden bg-[#007C8B]/10 text-[#007C8B] font-bold flex items-center justify-center text-xs">
                      {avatarUrl && !avatarImageError ? (
                        <img
                          src={avatarUrl}
                          alt={displayName}
                          className="h-full w-full object-cover"
                          onError={() => setAvatarImageError(true)}
                        />
                      ) : (
                        getInitials(displayName)
                      )}
                    </div>
                    <ChevronDown className="h-3 w-3 text-[#4A5B70] hidden sm:block" />
                  </button>

                  {/* Dropdown Menu */}
                  {profileDropdownOpen && (
                    <div
                      role="menu"
                      className="absolute right-0 mt-2 w-56 rounded-2xl bg-white border border-[#0A2540]/10 shadow-xl p-2 space-y-1 z-50 text-xs text-[#0A2540] animate-in fade-in duration-100"
                    >
                      <div className="px-3 py-2 border-b border-[#0A2540]/6 mb-1">
                        <div className="font-bold truncate text-[#0A2540]">{displayName}</div>
                        <div className="text-[11px] text-[#6E7D90] truncate">@{displayUsername}</div>
                        <div className="mt-1 inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#007C8B]/10 text-[#007C8B]">
                          Reputation: {reputation}
                        </div>
                      </div>

                      <a
                        href="/profile/me"
                        role="menuitem"
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#0A2540] hover:bg-[#F4F7FA] hover:text-[#007C8B] transition-colors font-medium"
                      >
                        <User className="h-4 w-4 text-[#007C8B]" />
                        <span>My Profile</span>
                      </a>

                      <a
                        href="/wallet"
                        role="menuitem"
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#0A2540] hover:bg-[#F4F7FA] hover:text-[#007C8B] transition-colors font-medium"
                      >
                        <Wallet className="h-4 w-4 text-[#007C8B]" />
                        <span>Wallet &amp; Power</span>
                      </a>

                      <a
                        href="/exchange"
                        role="menuitem"
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#0A2540] hover:bg-[#F4F7FA] hover:text-[#007C8B] font-medium"
                      >
                        <ArrowLeftRight className="h-4 w-4 text-[#007C8B]" />
                        <span>Exchange · Buy PNR</span>
                      </a>

                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#D0384B] hover:bg-[#FDECEE] transition-colors font-medium text-left cursor-pointer"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Guest Controls */
              <div className="flex items-center gap-1.5 sm:gap-2">
                {/* Mobile Search Button */}
                <button
                  type="button"
                  onClick={() => setMobileSearchOpen(true)}
                  className="pn-icon-btn h-8 w-8 md:hidden text-[#0A2540]"
                  aria-label="Search creators and topics"
                >
                  <Search className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={openLogin}
                  className="pn-btn pn-btn-ghost pn-btn-sm !hidden sm:!inline-flex sm:h-9"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={openRegister}
                  className="pn-btn pn-btn-brand pn-btn-sm px-2.5 sm:h-9 sm:px-4"
                >
                  <span>Sign Up</span>
                  <ArrowRight className="h-3.5 w-3.5 hidden sm:inline" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ─── DEDICATED MOBILE SEARCH MODAL (Full accessibility & scroll lock) ─── */}
      {mobileSearchOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Search PENORA"
          className="fixed inset-0 z-50 md:hidden flex flex-col bg-white overflow-hidden animate-in fade-in duration-200"
        >
          {/* Top Search Header Bar */}
          <div className="flex items-center gap-2 px-3 py-3 border-b border-[#0A2540]/10 bg-[#F8FBFD]">
            <button
              type="button"
              onClick={() => setMobileSearchOpen(false)}
              className="p-2 rounded-full text-[#4A5E75] hover:text-[#0A2540] hover:bg-[#0A2540]/5 transition-colors"
              aria-label="Back to page"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            <form onSubmit={handleSearchSubmit} className="flex-1 min-w-0">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-[#0A2540]/15 focus-within:border-[#007C8B] shadow-2xs">
                <Search className="h-4 w-4 text-[#4A5E75] shrink-0" />
                <input
                  ref={mobileSearchInputRef}
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search creators, @handle, stories..."
                  className="w-full text-[15px] bg-transparent border-none focus:outline-none text-[#0A2540] placeholder:text-[#6E7D90]"
                  aria-label="Search query"
                />
                {isSearchingLive ? (
                  <Loader2 className="h-4 w-4 text-[#007C8B] animate-spin shrink-0" />
                ) : searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="p-1 text-[#6E7D90] hover:text-[#0A2540]"
                    aria-label="Clear search input"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </form>

            <button
              type="button"
              onClick={() => setMobileSearchOpen(false)}
              className="text-xs font-semibold text-[#007C8B] px-1"
            >
              Cancel
            </button>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[#0A2540]/8 bg-white overflow-x-auto text-xs">
            <button
              type="button"
              onClick={() => setSearchTab('all')}
              className={`px-3 py-1 rounded-full font-semibold transition-colors shrink-0 ${
                searchTab === 'all'
                  ? 'bg-[#007C8B] text-white'
                  : 'bg-[#F4F7FA] text-[#4A5E75]'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setSearchTab('creators')}
              className={`px-3 py-1 rounded-full font-semibold transition-colors shrink-0 ${
                searchTab === 'creators'
                  ? 'bg-[#007C8B] text-white'
                  : 'bg-[#F4F7FA] text-[#4A5E75]'
              }`}
            >
              Creators ({previewCreators.length})
            </button>
            <button
              type="button"
              onClick={() => setSearchTab('articles')}
              className={`px-3 py-1 rounded-full font-semibold transition-colors shrink-0 ${
                searchTab === 'articles'
                  ? 'bg-[#007C8B] text-white'
                  : 'bg-[#F4F7FA] text-[#4A5E75]'
              }`}
            >
              Articles ({previewArticles.length})
            </button>
          </div>

          {/* Results List (Internal Scroll Only) */}
          <div
            ref={mobileSearchContainerRef}
            tabIndex={-1}
            className="flex-1 overflow-y-auto overscroll-contain p-3.5 space-y-4"
          >
            {/* Creators Results */}
            {(searchTab === 'all' || searchTab === 'creators') && previewCreators.length > 0 && (
              <div className="space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#007C8B] flex items-center justify-between">
                  <span>Matching Creators</span>
                  <span className="text-[10px] text-[#6E7D90]">Real Supabase Profiles</span>
                </div>
                <div className="space-y-1.5">
                  {previewCreators.map((c) => {
                    const cHandle = c.username || c.id;
                    const cName = c.display_name || c.username || 'Creator';
                    const cAvatar =
                      c.avatar_url && !c.avatar_url.includes('/brand/penora-avatar-') ? c.avatar_url : null;
                    return (
                      <a
                        key={c.id}
                        href={`/profile/${encodeURIComponent(cHandle)}`}
                        onClick={() => setMobileSearchOpen(false)}
                        className="flex items-center justify-between p-3 rounded-2xl bg-[#F8FAFC] border border-[#0A2540]/6 active:bg-[#EEFBFC] transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {cAvatar ? (
                            <img
                              src={cAvatar}
                              alt={cName}
                              className="h-10 w-10 rounded-full object-cover shrink-0 ring-2 ring-[#007C8B]/30"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-[#E5F7F8] text-[#007C8B] flex items-center justify-center font-bold text-sm shrink-0">
                              {cName.slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-[#0A2540] truncate">
                              {cName}
                            </div>
                            <div className="text-xs text-[#6E7D90] truncate">
                              @{c.username || 'creator'}
                            </div>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#007C8B]/10 text-[#007C8B] shrink-0">
                          Rep {c.reputation ?? 25}
                        </span>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Articles Results */}
            {(searchTab === 'all' || searchTab === 'articles') && previewArticles.length > 0 && (
              <div className="space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#007C8B]">
                  Matching Articles
                </div>
                <div className="space-y-1.5">
                  {previewArticles.map((a) => (
                    <a
                      key={a.id}
                      href={`/read?slug=${encodeURIComponent(a.slug)}`}
                      onClick={() => setMobileSearchOpen(false)}
                      className="block p-3 rounded-2xl bg-[#F8FAFC] border border-[#0A2540]/6 active:bg-[#EEFBFC] transition-colors"
                    >
                      <div className="text-sm font-bold text-[#0A2540] truncate">
                        {a.title}
                      </div>
                      <div className="text-xs text-[#52657C] line-clamp-1 mt-0.5">
                        {a.excerpt || a.content.slice(0, 100)}
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Empty or Initial Prompt */}
            {searchQuery.trim().length >= 2 &&
              previewCreators.length === 0 &&
              previewArticles.length === 0 &&
              !isSearchingLive && (
                <div className="p-8 rounded-2xl bg-[#F8FAFC] text-center space-y-2 border border-[#0A2540]/6">
                  <p className="text-sm font-bold text-[#0A2540]">
                    No results for &ldquo;{searchQuery}&rdquo;
                  </p>
                  <p className="text-xs text-[#6E7D90]">
                    Try searching by username (e.g. &ldquo;@fatima&rdquo;) or topic.
                  </p>
                </div>
              )}

            {/* Explore More CTA */}
            {searchQuery.trim().length >= 2 && (
              <a
                href={`/explore?q=${encodeURIComponent(searchQuery.trim())}`}
                onClick={() => setMobileSearchOpen(false)}
                className="w-full py-3 px-4 rounded-2xl bg-[#007C8B] text-white text-sm font-bold flex items-center justify-between shadow-xs"
              >
                <span>View Full Results in Explore</span>
                <ArrowRight className="h-4 w-4" />
              </a>
            )}

            {!searchQuery.trim() && (
              <div className="py-12 text-center text-xs text-[#6E7D90] space-y-1">
                <Search className="h-8 w-8 text-[#007C8B]/40 mx-auto mb-2" />
                <p className="font-semibold text-[#0A2540]">Search PENORA Creator Network</p>
                <p>Type a handle like @alice, a creator name, or an article keyword.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile Navigation Drawer */}
      <MobileNavigationDrawer
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        currentPath={currentPath}
        user={user}
        keyUser={keyUser}
        profile={profile}
        onOpenLogin={openLogin}
        onOpenRegister={openRegister}
        onLogout={handleLogout}
      />

      {/* Branded Authentication Modal */}
      <SpatialAuthModalV4
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authMode}
        initialWizardStep={authStep}
        presentation="centered-modal"
      />
    </>
  );
};
