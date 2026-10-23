import React from 'react';
import { Home, Compass, Users, Bookmark, Wallet, User, PenLine, ChevronRight, ArrowLeftRight, UserCheck, Trophy, BarChart3, Sparkles } from 'lucide-react';

type SidebarPage = 'Home' | 'Following' | 'Explore' | 'Creators' | 'Communities' | 'Challenges' | 'Analytics' | 'Bookmarks' | 'Wallet' | 'Profile' | 'Exchange';
const links = [
  { key: 'Home', label: 'Home Feed', icon: Home, href: '/' },
  { key: 'Following', label: 'Following Feed', icon: UserCheck, href: '/following' },
  { key: 'Explore', label: 'Explore Topics', icon: Compass, href: '/explore' },
  { key: 'Creators', label: 'Creator Discovery', icon: Sparkles, href: '/creators' },
  { key: 'Communities', label: 'Communities', icon: Users, href: '/communities' },
  { key: 'Challenges', label: 'Writing Prompts', icon: Trophy, href: '/challenges' },
  { key: 'Analytics', label: 'Creator Analytics', icon: BarChart3, href: '/analytics' },
  { key: 'Bookmarks', label: 'Saved Bookmarks', icon: Bookmark, href: '/?view=bookmarks' },
  { key: 'Wallet', label: 'Wallet & Rewards', icon: Wallet, href: '/wallet' },
  { key: 'Exchange', label: 'Exchange', icon: ArrowLeftRight, href: '/exchange' },
  { key: 'Profile', label: 'My Profile', icon: User, href: '/profile/me' },
] as const;

export function CreatorSidebar({ activePage }: { activePage?: SidebarPage }) {
  return (
    <div className="space-y-4">
      <div className="pn-panel p-3">
        <nav className="space-y-1" aria-label="Primary navigation">
          {links.map(({ key, label, icon: Icon, href }) => (
            <a key={key} href={href} aria-current={activePage === key ? 'page' : undefined}
              className={'pn-nav-item w-full justify-between text-left ' + (activePage === key ? 'active' : '')}>
              <span className="flex items-center gap-3"><Icon className="h-4 w-4 shrink-0" aria-hidden="true" /><span>{label}</span></span>
              {activePage === key && <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
            </a>
          ))}
        </nav>
      </div>
      <a href="/editor" className="block rounded-2xl border border-[#007C8B]/15 bg-gradient-to-br from-white to-[#EBF7F9] p-4 shadow-sm transition-colors hover:border-[#007C8B]/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#007C8B]">
        <span className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#007C8B]/10 text-[#007C8B]"><PenLine className="h-4 w-4" aria-hidden="true" /></span>
        <span className="block font-serif text-base font-semibold text-[#0A2540]">Your next story starts here</span>
        <span className="mt-1 block text-xs leading-relaxed text-[#52657C]">Share an idea. Connect with your readers.</span>
        <span className="mt-3 flex items-center gap-2 text-xs font-semibold text-[#007C8B]">Create a blog <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /></span>
      </a>
    </div>
  );
}
