// src/components/common/MobileBottomNav.tsx
// PENORA — Native Mobile Bottom Navigation Dock
// Faithfully matches Reference Images 1 & 2:
// - Dark navy foundation (#0A2540 / #06182C) with subtle cyan border
// - 5 symmetric grid items: Home, Explore, Write (elevated center cyan action), Wallet, Profile
// - Safe-area support for iOS Home indicator and Android gesture pills
// - Clear active states with bright cyan highlight
import React, { useState, useEffect } from 'react';
import { Home, Compass, PenLine, Wallet, User as UserIcon } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { penoraKeyAuth, type PenoraUser } from '../../lib/auth/penoraKeyAuth';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface MobileBottomNavProps {
  currentPath?: string;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ currentPath = '/' }) => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [keyUser, setKeyUser] = useState<PenoraUser | null>(null);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setUser(data.session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setUser(session?.user ?? null);
    });

    const unsubKey = penoraKeyAuth.subscribe((ku) => {
      if (mounted) setKeyUser(ku);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      unsubKey();
    };
  }, []);

  const activeUser = keyUser || user;

  const isHome = currentPath === '/' || currentPath === '/feed';
  const isExplore = currentPath.startsWith('/explore') || currentPath.startsWith('/communities');
  const isEditor = currentPath.startsWith('/editor');
  const isWallet = currentPath.startsWith('/wallet');
  const isProfile = currentPath.startsWith('/profile');

  if (isEditor) {
    return null;
  }

  const handleProfileClick = (e: React.MouseEvent) => {
    if (!activeUser) {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('penora:open-auth', { detail: { mode: 'login' } }));
      setTimeout(() => {
        if (!document.querySelector('[role="dialog"]')) {
          window.location.href = '/profile/me';
        }
      }, 100);
    }
  };

  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-[#06182C] border-t border-[#00E5F4]/20 shadow-[0_-8px_32px_rgba(6,24,44,0.6)] pb-[max(0.6rem,env(safe-area-inset-bottom,0px))] pt-1 px-2"
    >
      <div className="grid grid-cols-5 items-center w-full max-w-md mx-auto">
        {/* 1. Home */}
        <a
          href="/"
          aria-label="Home Feed"
          aria-current={isHome ? 'page' : undefined}
          className={`flex flex-col items-center justify-center py-1 transition-colors ${
            isHome ? 'text-[#00E5F4]' : 'text-[#7D93AA] hover:text-white'
          }`}
        >
          <Home className={`h-5 w-5 ${isHome ? 'stroke-[2.5]' : ''}`} />
          <span className="text-[10px] font-medium tracking-tight mt-1">Home</span>
        </a>

        {/* 2. Explore */}
        <a
          href="/explore"
          aria-label="Explore Topics"
          aria-current={isExplore ? 'page' : undefined}
          className={`flex flex-col items-center justify-center py-1 transition-colors ${
            isExplore ? 'text-[#00E5F4]' : 'text-[#7D93AA] hover:text-white'
          }`}
        >
          <Compass className={`h-5 w-5 ${isExplore ? 'stroke-[2.5]' : ''}`} />
          <span className="text-[10px] font-medium tracking-tight mt-1">Explore</span>
        </a>

        {/* 3. Write (Elevated Center Cyan Action matching Reference) */}
        <a
          href="/editor"
          aria-label="Write a Blog"
          aria-current={isEditor ? 'page' : undefined}
          className="relative -top-3.5 flex flex-col items-center justify-center group focus:outline-none"
        >
          <div
            className={`h-11 w-11 rounded-2xl flex items-center justify-center shadow-lg transition-transform active:scale-95 bg-[#00E5F4] text-[#0A2540] shadow-[0_4px_16px_rgba(0,229,244,0.4)] ${
              isEditor ? 'ring-4 ring-[#00E5F4]/30 scale-105' : 'group-hover:scale-105'
            }`}
          >
            <PenLine className="h-5 w-5 stroke-[2.4]" />
          </div>
          <span className="text-[10px] font-bold text-[#E2F1F8] tracking-tight mt-0.5">
            Write
          </span>
        </a>

        {/* 4. Wallet */}
        <a
          href="/wallet"
          aria-label="Wallet & Rewards"
          aria-current={isWallet ? 'page' : undefined}
          className={`flex flex-col items-center justify-center py-1 transition-colors ${
            isWallet ? 'text-[#00E5F4]' : 'text-[#7D93AA] hover:text-white'
          }`}
        >
          <Wallet className={`h-5 w-5 ${isWallet ? 'stroke-[2.5]' : ''}`} />
          <span className="text-[10px] font-medium tracking-tight mt-1">Wallet</span>
        </a>

        {/* 5. Profile */}
        <a
          href="/profile/me"
          onClick={handleProfileClick}
          aria-label={activeUser ? 'My Profile' : 'Sign In / Profile'}
          aria-current={isProfile ? 'page' : undefined}
          className={`flex flex-col items-center justify-center py-1 transition-colors ${
            isProfile ? 'text-[#00E5F4]' : 'text-[#7D93AA] hover:text-white'
          }`}
        >
          <UserIcon className={`h-5 w-5 ${isProfile ? 'stroke-[2.5]' : ''}`} />
          <span className="text-[10px] font-medium tracking-tight mt-1">
            {activeUser ? 'Profile' : 'Profile'}
          </span>
        </a>
      </div>
    </nav>
  );
};
