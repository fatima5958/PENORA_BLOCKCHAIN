// src/components/common/Header.tsx
// PENORA Blockchain — Global Top Navigation Header
// Integrates the approved PENORA Blockchain Horizontal Logo Lockup,
// refined search bar, branded pen shortcut, and live session state.
import React, { useState, useEffect, useRef } from 'react';
import {
  PenLine,
  Search,
  Bell,
  LogOut,
  User,
  Menu,
  X,
  Compass,
  Users,
  Home,
  CheckCircle2,
  ArrowRight,
  ChevronDown,
  Edit3,
  Wallet,
  Settings,
  ArrowLeftRight,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useLiveProfile } from '../../lib/hooks/useLiveProfile';
import type { ProfileRecord } from '../../lib/api/types';
import { SpatialAuthModalV4 } from '../design-v4/SpatialAuthModalV4';
import { PenoraLogo } from '../brand/PenoraLogo';
import { PenoraWriteIcon } from '../brand/PenoraWriteIcon';
import { MobileNavigationDrawer } from './MobileNavigationDrawer';
import { penoraKeyAuth, type PenoraUser } from '../../lib/auth/penoraKeyAuth';
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
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setUser(session?.user ?? null);
        setAuthLoading(false);
      }
    });

    // Keyboard shortcut '/' to focus search
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    const onOpenAuth = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.mode === 'register') setAuthMode('register');
      else setAuthMode('login');
      setAuthModalOpen(true);
    };
    window.addEventListener('penora:open-auth', onOpenAuth);

    return () => {
      mounted = false;
      unsubscribeKeyAuth();
      subscription.unsubscribe();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('penora:open-auth', onOpenAuth);
    };
  }, []);

  useEffect(() => setAvatarImageError(false), [profile?.avatar_url, keyUser?.id, user?.id]);

  const activeUser = keyUser || user;

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

  const avatarUrl = profile?.avatar_url && !profile.avatar_url.includes('/brand/penora-avatar-')
    ? profile.avatar_url : null;

  const handleLogout = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setProfileDropdownOpen(false);
    penoraKeyAuth.logout();
    setKeyUser(null);
    setUser(null);
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore
    }
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  const openLogin = () => {
    setAuthMode('login');
    setAuthModalOpen(true);
  };

  const openRegister = () => {
    setAuthMode('register');
    setAuthModalOpen(true);
  };

  // Close dropdown or mobile menu when clicking outside or pressing Escape
  useEffect(() => {
    if (!profileDropdownOpen && !mobileMenuOpen) return;
    const closeOnOutside = (e: MouseEvent) => {
      if (
        profileDropdownRef.current &&
        !profileDropdownRef.current.contains(e.target as Node)
      ) {
        setProfileDropdownOpen(false);
      }
    };
    const closeOnEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setProfileDropdownOpen(false);
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', closeOnOutside);
    window.addEventListener('keydown', closeOnEsc);
    return () => {
      document.removeEventListener('mousedown', closeOnOutside);
      window.removeEventListener('keydown', closeOnEsc);
    };
  }, [profileDropdownOpen, mobileMenuOpen]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/explore?q=${encodeURIComponent(searchQuery.trim())}`;
    }
  };

  return (
    <>
      <header className={`pn-header sticky top-0 z-40 ${(currentPath === '/' || currentPath === '/feed') ? 'pn-feed-header' : ''}`}>
        <div className="max-w-[1400px] mx-auto px-3 sm:px-6 lg:px-8 h-full flex items-center justify-between gap-2 sm:gap-4">
          {/* Left: Mobile Drawer Button + Official PENORA Horizontal Logo Lockup */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(v => !v)}
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

          {/* Center: Refined PENORA Search Bar */}
          <div className="flex-1 max-w-[480px] hidden md:block">
            <form onSubmit={handleSearchSubmit}>
              <div className="pn-search">
                <Search className="h-4 w-4 text-[#4A5B70] flex-shrink-0" />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search blogs, creators, guilds, or topics..."
                  aria-label="Search blogs, creators, guilds, or topics"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
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
          </div>

          {/* Right: Article Studio shortcut & Auth Controls */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Icon-only pen shortcut, styled after the official PENORA emblem. */}
            <a
              href="/editor"
              aria-label="Open Article Studio"
              title="Create a blog"
              className="pn-focus inline-flex h-8 w-8 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl border border-[#007C8B]/20 bg-[#F4F7FA] shadow-sm transition-colors hover:bg-[#00E5F4]/10 hover:border-[#007C8B]/50"
            >
              <PenoraWriteIcon className="h-6 w-6 sm:h-9 sm:w-9" />
            </a>

            <div className="h-5 w-px bg-[#0A2540]/10 hidden sm:block mx-0.5" />

            {/* User Auth Section */}
            {authLoading ? (
              <div className="h-9 w-9 rounded-full bg-[#0A2540]/8 animate-pulse" />
            ) : activeUser ? (
              <div className="flex items-center gap-1.5 sm:gap-2">
                {/* Mobile Search Button (Reference Image 2) */}
                <a
                  href="/explore"
                  className="pn-icon-btn h-8 w-8 sm:hidden"
                  aria-label="Search topics and creators"
                  title="Search"
                >
                  <Search className="h-4 w-4 text-[#0A2540]" />
                </a>

                {/* Notifications */}
                <a
                  href="/notifications"
                  className="pn-icon-btn h-9 w-9 relative"
                  title="Notifications"
                >
                  <Bell className="h-4 w-4 text-[#0A2540]" />
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[#00E5F4] ring-2 ring-white" />
                </a>

                {/* Profile Avatar Button: ONLY Circular Profile Picture (with initials fallback) */}
                <div className="relative" ref={profileDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setProfileDropdownOpen(v => !v)}
                    aria-expanded={profileDropdownOpen}
                    aria-haspopup="menu"
                    aria-label={`Open account menu for @${displayUsername}`}
                    className="pn-focus p-0.5 rounded-full bg-white border border-[#0A2540]/12 hover:border-[#00E5F4] hover:shadow-[0_0_12px_rgba(0,229,244,0.35)] shadow-2xs transition-all cursor-pointer flex items-center justify-center"
                  >
                    {/* Circular Avatar with Fallback Initials */}
                    {avatarUrl && !avatarImageError ? (
                      <img
                        src={avatarUrl}
                        alt={`@${displayUsername}`}
                        onError={() => setAvatarImageError(true)}
                        className="h-8 w-8 rounded-full object-cover ring-1 ring-[#007C8B]/25 flex-shrink-0 bg-white"
                      />
                    ) : (
                      <div className="pn-avatar-initials h-8 w-8 text-xs bg-[#007C8B] text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                        {getInitials(displayName || displayUsername)}
                      </div>
                    )}
                  </button>

                  {/* Polished Profile Dropdown */}
                  {profileDropdownOpen && (
                    <div
                      role="menu"
                      aria-orientation="vertical"
                      className="pn-dropdown absolute right-0 mt-2 w-64 p-2 text-xs z-50 bg-white rounded-2xl border border-[#007C8B]/15 shadow-xl animate-fade-in"
                    >
                      {/* User Identity Header Card */}
                      <div className="p-3 border-b border-[#0A2540]/8 flex items-center gap-2.5">
                        {avatarUrl && !avatarImageError ? (
                          <img
                            src={avatarUrl}
                            alt={`@${displayUsername}`}
                            onError={() => setAvatarImageError(true)}
                            className="h-9 w-9 rounded-full object-cover ring-1 ring-[#007C8B]/25 flex-shrink-0 bg-white"
                          />
                        ) : (
                          <div className="pn-avatar-initials h-9 w-9 text-xs bg-[#007C8B] text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                            {getInitials(displayName || displayUsername)}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-[#0A2540] truncate text-xs leading-snug">
                            {displayName}
                          </div>
                          <div className="text-[11px] text-[#4A5B70] truncate leading-tight">
                            @{displayUsername}
                          </div>
                        </div>
                      </div>

                      {/* Dropdown Menu Options */}
                      <div className="py-1.5 space-y-0.5">
                        {/* 1. My Profile */}
                        <a
                          href="/profile/me"
                          role="menuitem"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#0A2540] hover:bg-[#F4F7FA] hover:text-[#007C8B] transition-colors font-medium"
                        >
                          <User className="h-4 w-4 text-[#007C8B]" />
                          <span>My Profile</span>
                        </a>

                        {/* 2. Edit Profile */}
                        <a
                          href="/profile/me?edit=true"
                          role="menuitem"
                          onClick={(e) => {
                            setProfileDropdownOpen(false);
                            if (typeof window !== 'undefined' && window.location.pathname.startsWith('/profile/me')) {
                              e.preventDefault();
                              window.dispatchEvent(new CustomEvent('penora:open-edit-profile'));
                            }
                          }}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#0A2540] hover:bg-[#F4F7FA] hover:text-[#007C8B] transition-colors font-medium"
                        >
                          <Edit3 className="h-4 w-4 text-[#007C8B]" />
                          <span>Edit Profile</span>
                        </a>

                        {/* 3. Wallet (Hybrid V1) */}
                        <a
                          href="/wallet"
                          role="menuitem"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="flex items-center justify-between px-3 py-2 rounded-xl text-[#0A2540] hover:bg-[#F4F7FA] hover:text-[#007C8B] transition-colors font-medium"
                        >
                          <div className="flex items-center gap-2.5">
                            <Wallet className="h-4 w-4 text-[#007C8B]" />
                            <span>Wallet</span>
                          </div>
                          <span className="text-[9px] font-bold uppercase tracking-wider text-[#007C8B] bg-[#00E5F4]/15 px-2 py-0.5 rounded-full">
                            Hybrid V1
                          </span>
                        </a>

                        <a href="/exchange/" role="menuitem" onClick={() => setProfileDropdownOpen(false)} className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#0A2540] hover:bg-[#F4F7FA] hover:text-[#007C8B] font-medium"><ArrowLeftRight className="h-4 w-4 text-[#007C8B]"/><span>Exchange · Buy PNR</span></a>
                        {/* 4. Settings */}
                        <a
                          href="/profile/me?tab=about"
                          role="menuitem"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#0A2540] hover:bg-[#F4F7FA] hover:text-[#007C8B] transition-colors font-medium"
                        >
                          <Settings className="h-4 w-4 text-[#007C8B]" />
                          <span>Settings</span>
                        </a>
                      </div>

                      {/* 5. Sign Out */}
                      <div className="pt-1 border-t border-[#0A2540]/8">
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
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Guest Controls */
              <div className="flex items-center gap-1.5 sm:gap-2">
                <a
                  href="/explore"
                  className="pn-icon-btn h-8 w-8 sm:hidden"
                  aria-label="Search topics and creators"
                  title="Search"
                >
                  <Search className="h-4 w-4 text-[#0A2540]" />
                </a>
                <button
                  type="button"
                  onClick={openLogin}
                  style={{ display: undefined }}
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
