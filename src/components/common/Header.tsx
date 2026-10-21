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
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { SpatialAuthModalV4 } from '../design-v4/SpatialAuthModalV4';
import { PenoraLogo } from '../brand/PenoraLogo';
import { PenoraWriteIcon } from '../brand/PenoraWriteIcon';
import { penoraKeyAuth, type PenoraUser } from '../../lib/auth/penoraKeyAuth';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface HeaderProps {
  currentPath?: string;
}

/** Returns 1–2 uppercase initials from an email address. */
function emailInitials(email: string): string {
  const local = email.split('@')[0] ?? '';
  const parts = local.split(/[._-]/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return local.slice(0, 2).toUpperCase();
}

export const Header: React.FC<HeaderProps> = ({ currentPath = '/' }) => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [keyUser, setKeyUser] = useState<PenoraUser | null>(null);
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

    return () => {
      mounted = false;
      unsubscribeKeyAuth();
      subscription.unsubscribe();
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

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
      <header className="pn-header sticky top-0 z-40">
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
                <PenoraLogo variant="horizontal" size="xs" showTagline={false} className="scale-90 origin-left" />
              </span>
              <span className="hidden sm:inline-flex">
                <PenoraLogo variant="horizontal" size="sm" showTagline={true} />
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
                  placeholder="Search essays, creators, guilds, or topics..."
                  aria-label="Search essays, creators, guilds, or topics"
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
              title="Create an essay"
              className="pn-focus inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#007C8B]/20 bg-[#F4F7FA] shadow-sm transition-colors hover:bg-[#00E5F4]/10 hover:border-[#007C8B]/50"
            >
              <PenoraWriteIcon className="h-9 w-9" />
            </a>

            <div className="h-5 w-px bg-[#0A2540]/10 hidden sm:block mx-0.5" />

            {/* User Auth Section */}
            {authLoading ? (
              <div className="h-9 w-9 rounded-full bg-[#0A2540]/8 animate-pulse" />
            ) : keyUser ? (
              <div className="flex items-center gap-2">
                {/* Notifications */}
                <a
                  href="/notifications"
                  className="pn-icon-btn h-9 w-9 relative"
                  title="Notifications"
                >
                  <Bell className="h-4 w-4 text-[#0A2540]" />
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[#00E5F4] ring-2 ring-white" />
                </a>

                {/* Profile Avatar Pill */}
                <div className="relative" ref={profileDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setProfileDropdownOpen(v => !v)}
                    aria-expanded={profileDropdownOpen}
                    aria-haspopup="menu"
                    className="pn-focus flex items-center gap-2 p-1 pl-1 pr-3 rounded-full bg-white border border-[#0A2540]/10 hover:border-[#00B3C4]/50 shadow-2xs transition-all"
                  >
                    <div className="pn-avatar-initials h-7 w-7 text-[11px] bg-[#007C8B] text-white">
                      {keyUser.username.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-xs font-semibold text-[#0A2540] hidden sm:inline max-w-[120px] truncate">
                      @{keyUser.username}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#007C8B]/10 text-[#007C8B]">
                      {keyUser.keyRole}
                    </span>
                  </button>

                  {profileDropdownOpen && (
                    <div className="pn-dropdown absolute right-0 mt-2 w-64 p-2 text-xs z-50">
                      <div className="p-3 border-b border-[#0A2540]/8">
                        <div className="font-semibold text-[#0A2540] truncate">@{keyUser.username}</div>
                        <div className="text-[11px] text-[#007C8B] mt-1 flex items-center gap-1.5 font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>{keyUser.keyRole.toUpperCase()} KEY Authority</span>
                        </div>
                      </div>
                      <div className="py-1">
                        <a
                          href="/profile/me"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#0A2540] hover:bg-[#F4F7FA] transition-colors font-medium"
                        >
                          <User className="h-4 w-4 text-[#007C8B]" />
                          <span>My Creator Profile</span>
                        </a>
                        <a
                          href="/editor"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#0A2540] hover:bg-[#F4F7FA] transition-colors font-medium"
                        >
                          <PenLine className="h-4 w-4 text-[#007C8B]" />
                          <span>Write in Article Studio</span>
                        </a>
                      </div>
                      <div className="pt-1 border-t border-[#0A2540]/8">
                        <button
                          type="button"
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#D93838] hover:bg-[#D93838]/10 transition-colors font-medium text-left"
                        >
                          <LogOut className="h-4 w-4" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : user ? (
              <div className="flex items-center gap-2">
                {/* Notifications */}
                <a
                  href="/notifications"
                  className="pn-icon-btn h-9 w-9 relative"
                  title="Notifications"
                >
                  <Bell className="h-4 w-4 text-[#0A2540]" />
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[#00E5F4] ring-2 ring-white" />
                </a>

                {/* Profile Avatar Pill */}
                <div className="relative" ref={profileDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setProfileDropdownOpen(v => !v)}
                    aria-expanded={profileDropdownOpen}
                    aria-haspopup="menu"
                    className="pn-focus flex items-center gap-2 p-1 pl-1 pr-3 rounded-full bg-white border border-[#0A2540]/10 hover:border-[#00B3C4]/50 shadow-2xs transition-all"
                  >
                    <div className="pn-avatar-initials h-7 w-7 text-[11px]">
                      {emailInitials(user.email ?? '')}
                    </div>
                    <span className="text-xs font-semibold text-[#0A2540] hidden sm:inline max-w-[120px] truncate">
                      {user.email?.split('@')[0]}
                    </span>
                  </button>

                  {profileDropdownOpen && (
                    <div className="pn-dropdown absolute right-0 mt-2 w-64 p-2 text-xs z-50">
                      <div className="p-3 border-b border-[#0A2540]/8">
                        <div className="font-semibold text-[#0A2540] truncate">{user.email}</div>
                        <div className="text-[11px] text-[#4A5B70] mt-1 flex items-center gap-1.5">
                          {user.email_confirmed_at ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5 text-[#007C8B]" />
                              <span>Verified Creator Identity</span>
                            </>
                          ) : (
                            <span className="text-amber-700">⚠ Email confirmation pending</span>
                          )}
                        </div>
                      </div>
                      <div className="py-1">
                        <a
                          href="/profile/me"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#0A2540] hover:bg-[#F4F7FA] transition-colors font-medium"
                        >
                          <User className="h-4 w-4 text-[#007C8B]" />
                          <span>My Profile & Articles</span>
                        </a>
                        <a
                          href="/editor"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#0A2540] hover:bg-[#F4F7FA] transition-colors font-medium"
                        >
                          <PenLine className="h-4 w-4 text-[#007C8B]" />
                          <span>Write in Article Studio</span>
                        </a>
                      </div>
                      <div className="pt-1 border-t border-[#0A2540]/8">
                        <button
                          type="button"
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#D0384B] hover:bg-[#FDECEE] transition-colors text-left font-semibold"
                        >
                          <LogOut className="h-4 w-4" />
                          <span>Sign out</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Guest Controls */
              <div className="flex items-center gap-1.5 sm:gap-2">
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

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="pn-dropdown lg:hidden fixed inset-x-0 top-[68px] rounded-none border-x-0 p-4 space-y-2 z-40">
          <form onSubmit={handleSearchSubmit} className="mb-3">
            <div className="pn-search">
              <Search className="h-4 w-4 text-[#4A5B70]" />
              <input
                type="search"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search PENORA..."
              />
            </div>
          </form>
          <a href="/" className="pn-nav-item" aria-current={currentPath === '/' ? 'page' : undefined}>
            <Home className="h-4 w-4" /> Home Feed
          </a>
          <a href="/explore" className="pn-nav-item" aria-current={currentPath.startsWith('/explore') ? 'page' : undefined}>
            <Compass className="h-4 w-4" /> Explore Topics
          </a>
          <a href="/communities" className="pn-nav-item" aria-current={currentPath.startsWith('/communities') ? 'page' : undefined}>
            <Users className="h-4 w-4" /> Communities
          </a>
          <a href="/notifications" className="pn-nav-item" aria-current={currentPath.startsWith('/notifications') ? 'page' : undefined}>
            <Bell className="h-4 w-4" /> Notifications
          </a>
          <a href="/editor" className="pn-nav-item" aria-current={currentPath.startsWith('/editor') ? 'page' : undefined}>
            <PenLine className="h-4 w-4" /> Write Article
          </a>
          {(keyUser || user) ? (
            <a href="/profile/me" className="pn-nav-item" aria-current={currentPath.startsWith('/profile/me') ? 'page' : undefined}>
              <User className="h-4 w-4" /> My Profile (@{keyUser?.username || user?.email?.split('@')[0]})
            </a>
          ) : (
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#0A2540]/8">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  openLogin();
                }}
                className="pn-btn pn-btn-secondary pn-btn-sm justify-center"
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  openRegister();
                }}
                className="pn-btn pn-btn-brand pn-btn-sm justify-center"
              >
                Create Account
              </button>
            </div>
          )}
        </div>
      )}

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
