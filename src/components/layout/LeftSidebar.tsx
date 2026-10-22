import React from 'react';
import { Compass, Newspaper, Users, UserCheck, User, Bell, ChevronRight, PlusCircle, Shield, ArrowLeftRight } from 'lucide-react';
import type { Community } from '../../types';

interface LeftSidebarProps {
  currentTab?: string;
  onSelectTab?: (tab: string) => void;
  communities?: Community[];
  currentUserHandle?: string;
  onOpenAuth?: () => void;
  isLoggedIn?: boolean;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  currentTab = 'trending',
  onSelectTab,
  communities = [],
  currentUserHandle = 'mateenfatima',
  onOpenAuth,
  isLoggedIn = false,
}) => {
  const mainNav = [
    { id: 'explore', label: 'Explore', icon: Compass, href: '/' },
    { id: 'all', label: 'All Posts', icon: Newspaper, href: '/?tab=all' },
    { id: 'exchange', label: 'Exchange', icon: ArrowLeftRight, href: '/exchange/' },
    { id: 'communities', label: 'Communities', icon: Users, href: '/communities' },
    { id: 'following', label: 'My Friends', icon: UserCheck, href: '/?tab=following', authRequired: true },
    { id: 'profile', label: 'My Profile', icon: User, href: `/profile/${currentUserHandle}`, authRequired: true },
    { id: 'notifications', label: 'Notifications', icon: Bell, href: '/notifications', authRequired: true },
  ];

  const handleNavClick = (e: React.MouseEvent, item: typeof mainNav[0]) => {
    if (item.authRequired && !isLoggedIn && onOpenAuth) {
      e.preventDefault();
      onOpenAuth();
      return;
    }
    if (onSelectTab && (item.id === 'explore' || item.id === 'all' || item.id === 'following')) {
      e.preventDefault();
      onSelectTab(item.id);
    }
  };

  return (
    <aside className="w-full space-y-6">
      {/* Primary Navigation Card */}
      <div className="rounded-2xl bg-white/85 backdrop-blur-md border border-white/90 p-3 shadow-spatial-sm">
        <nav aria-label="Sidebar Navigation" className="space-y-1">
          {mainNav.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <a
                key={item.id}
                href={item.href}
                onClick={(e) => handleNavClick(e, item)}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 group ${
                  isActive
                    ? 'bg-penora-mint-light text-penora-mint border-l-4 border-penora-mint shadow-sm'
                    : 'text-penora-cocoa hover:bg-penora-cocoa/5 hover:text-penora-coral'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`h-4 w-4 transition-colors ${
                      isActive ? 'text-penora-mint stroke-[2.2]' : 'text-penora-cocoa-muted group-hover:text-penora-coral'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.id === 'notifications' && isLoggedIn && (
                  <span className="h-2 w-2 rounded-full bg-penora-coral" />
                )}
              </a>
            );
          })}
        </nav>
      </div>

      {/* Subscribed Communities (Matching Screenshot 3 "My Subscriptions") */}
      <div className="rounded-2xl bg-white/85 backdrop-blur-md border border-white/90 p-4 shadow-spatial-sm">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-penora-cocoa">
            <Users className="h-3.5 w-3.5 text-penora-mint" />
            <span>My Subscriptions</span>
          </div>
          <a
            href="/communities"
            className="text-[11px] font-semibold text-penora-mint hover:text-penora-mint-hover transition-colors"
          >
            Explore
          </a>
        </div>

        <div className="space-y-1">
          {communities.slice(0, 5).map((comm) => (
            <a
              key={comm.id}
              href={`/communities#${comm.slug}`}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs text-penora-cocoa hover:bg-penora-cocoa/5 transition-colors group"
            >
              <img
                src={comm.avatar}
                alt={comm.name}
                className="h-5 w-5 rounded-md object-cover ring-1 ring-penora-cocoa/10 flex-shrink-0"
              />
              <span className="truncate font-medium group-hover:text-penora-coral transition-colors">
                {comm.name}
              </span>
            </a>
          ))}
        </div>

        <div className="pt-3 mt-3 border-t border-penora-cocoa/8">
          <a
            href="/communities"
            className="flex items-center gap-1.5 text-[11px] font-semibold text-penora-cocoa-muted hover:text-penora-mint transition-colors px-1"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span>Discover more communities</span>
          </a>
        </div>
      </div>

      {/* Safety & Protocol Badge */}
      <div className="p-3.5 rounded-2xl bg-penora-peach-light/30 border border-penora-peach/30 text-[11px] text-penora-cocoa space-y-1">
        <div className="flex items-center gap-1.5 font-bold text-penora-coral">
          <Shield className="h-3.5 w-3.5" />
          <span>Non-Cash Reputation</span>
        </div>
        <p className="text-penora-cocoa-muted text-[10px] leading-relaxed">
          PENORA uses merit-weighted peer curation. Points are non-monetary editorial rankings.
        </p>
      </div>
    </aside>
  );
};
