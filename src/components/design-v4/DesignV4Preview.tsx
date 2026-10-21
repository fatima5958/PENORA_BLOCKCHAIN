// src/components/design-v4/DesignV4Preview.tsx
// PENORA — Premium Spatial Glass V4 Candidate
// Matches the visual reference while maintaining real Supabase authentication and interactive states.
import React, { useState, useEffect, useMemo } from 'react';
import {
  Home,
  Compass,
  Users,
  User as UserIcon,
  Bookmark,
  PenLine,
  Search,
  Bell,
  ChevronRight,
  ChevronDown,
  ArrowRight,
  ArrowUpRight,
  Heart,
  MessageCircle,
  Share2,
  MoreHorizontal,
  TrendingUp,
  Sparkles,
  LogOut,
  Menu,
  X,
  Check,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { SpatialAuthModalV4 } from './SpatialAuthModalV4';
import type { User as SupabaseUser } from '@supabase/supabase-js';

// ─── Reference-Matched Editorial Feed Data ─────────────────────────────────────
interface V4Article {
  id: string;
  slug: string;
  category: string;
  categoryGroup: 'For You' | 'Following' | 'Tech' | 'Design' | 'Lifestyle' | 'Business' | 'Creativity';
  readTime: string;
  title: string;
  excerpt: string;
  author: {
    name: string;
    handle: string;
    avatar: string;
    verified: boolean;
  };
  publishedAgo: string;
  likes: number;
  comments: number;
  thumbnail: string;
}

const INITIAL_ARTICLES: V4Article[] = [
  {
    id: 'calmer-internet',
    slug: 'the-architecture-of-spatial-interfaces',
    category: 'Lifestyle',
    categoryGroup: 'Lifestyle',
    readTime: '5 min read',
    title: 'A Calmer Internet Is a More Creative You',
    excerpt:
      'How intentional consumption, slower tools, and mindful communities can help you do your best work.',
    author: {
      name: 'Elena Park',
      handle: 'erostova',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80',
      verified: true,
    },
    publishedAgo: '2h ago',
    likes: 342,
    comments: 28,
    thumbnail:
      'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=640&q=80',
  },
  {
    id: 'small-ideas',
    slug: 'sustainable-curation-without-surveillance-algorithms',
    category: 'Creativity',
    categoryGroup: 'Creativity',
    readTime: '8 min read',
    title: 'Turning Small Ideas Into Big Opportunities',
    excerpt:
      'Why documenting your process, even the small wins, can compound into unexpected opportunities.',
    author: {
      name: 'Daniel Kim',
      handle: 'marcus_chen',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=160&q=80',
      verified: true,
    },
    publishedAgo: '5h ago',
    likes: 521,
    comments: 42,
    thumbnail:
      'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=640&q=80',
  },
  {
    id: 'minimal-creator-setup',
    slug: 'the-lost-art-of-typographic-rhythm',
    category: 'Productivity',
    categoryGroup: 'Tech',
    readTime: '6 min read',
    title: 'My Minimal Creator Setup (2024)',
    excerpt:
      'The tools, habits and environment that help me stay focused, creative and in control.',
    author: {
      name: 'Maya Chen',
      handle: 's_ross',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=160&q=80',
      verified: true,
    },
    publishedAgo: '1d ago',
    likes: 1200,
    comments: 96,
    thumbnail:
      'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=640&q=80',
  },
  {
    id: 'spatial-design-craft',
    slug: 'toward-a-sovereign-creator-commons',
    category: 'Design',
    categoryGroup: 'Design',
    readTime: '7 min read',
    title: 'Designing With Light, Glass, and Restraint',
    excerpt:
      'Moving beyond flat grids toward tactile, serene interfaces that respect human attention.',
    author: {
      name: 'Sora Nguyen',
      handle: 'tariq_m',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=160&q=80',
      verified: true,
    },
    publishedAgo: '2d ago',
    likes: 684,
    comments: 51,
    thumbnail:
      'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=640&q=80',
  },
];

const CATEGORY_TABS = [
  'For You',
  'Following',
  'Tech',
  'Design',
  'Lifestyle',
  'Business',
  'Creativity',
] as const;

const TRENDING_TOPICS = [
  { rank: 1, tag: '#AI', posts: '12.4K posts', tone: 'gold' as const },
  { rank: 2, tag: '#CreatorEconomy', posts: '8.1K posts', tone: 'silver' as const },
  { rank: 3, tag: '#DigitalWellbeing', posts: '6.3K posts', tone: 'bronze' as const },
  { rank: 4, tag: '#IndieCreators', posts: '5.9K posts', tone: 'neutral' as const },
  { rank: 5, tag: '#DesignInspo', posts: '5.1K posts', tone: 'neutral' as const },
];

const SUGGESTED_CREATORS = [
  {
    id: 'alex-rivera',
    name: 'Alex Rivera',
    handle: 'erostova',
    domains: 'Tech · Creativity',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&q=80',
  },
  {
    id: 'sora-nguyen',
    name: 'Sora Nguyen',
    handle: 's_ross',
    domains: 'Design · Lifestyle',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=160&q=80',
  },
  {
    id: 'marcus-lee',
    name: 'Marcus Lee',
    handle: 'marcus_chen',
    domains: 'Business · Mindset',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=160&q=80',
  },
];

function formatLikes(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function getInitials(email: string): string {
  const local = email.split('@')[0] || 'U';
  return local.slice(0, 2).toUpperCase();
}

export const DesignV4Preview: React.FC = () => {
  // Real Supabase auth state
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Navigation & UI state
  const [activeNav, setActiveNav] = useState<'Home' | 'Explore' | 'Communities' | 'Profile' | 'Bookmarks'>('Home');
  const [activeCategory, setActiveCategory] = useState<typeof CATEGORY_TABS[number]>('For You');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Interactive article states
  const [likedIds, setLikedIds] = useState<Record<string, boolean>>({});
  const [bookmarkedIds, setBookmarkedIds] = useState<Record<string, boolean>>({});
  const [followedIds, setFollowedIds] = useState<Record<string, boolean>>({});

  // Auth panel visibility:
  // By default on desktop we show the Floating Docked Auth Card on the bottom-left (matching the reference image)
  // AND allow opening it as a centered modal from the top bar.
  const [showDockedAuth, setShowDockedAuth] = useState(true);
  const [modalAuthOpen, setModalAuthOpen] = useState(false);
  const [modalAuthMode, setModalAuthMode] = useState<'register' | 'login'>('login');

  // Menus & responsive drawer
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setUser(data.session?.user ?? null);
        setAuthLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setUser(session?.user ?? null);
        setAuthLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => (prev === msg ? null : prev));
    }, 2600);
  };

  const toggleLike = (id: string) => {
    setLikedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleBookmark = (id: string) => {
    setBookmarkedIds(prev => {
      const next = !prev[id];
      triggerToast(next ? 'Saved to your Bookmarks' : 'Removed from Bookmarks');
      return { ...prev, [id]: next };
    });
  };

  const toggleFollow = (id: string, name: string) => {
    setFollowedIds(prev => {
      const next = !prev[id];
      triggerToast(next ? `Following ${name}` : `Unfollowed ${name}`);
      return { ...prev, [id]: next };
    });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUserMenuOpen(false);
    triggerToast('Signed out of PENORA');
  };

  // Filtered articles based on search, category tab, or Bookmark nav
  const visibleArticles = useMemo(() => {
    return INITIAL_ARTICLES.filter(article => {
      if (activeNav === 'Bookmarks' && !bookmarkedIds[article.id]) {
        return false;
      }
      if (activeCategory !== 'For You' && activeCategory !== 'Following') {
        if (
          article.category.toLowerCase() !== activeCategory.toLowerCase() &&
          article.categoryGroup.toLowerCase() !== activeCategory.toLowerCase()
        ) {
          return false;
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = article.title.toLowerCase().includes(q);
        const matchExcerpt = article.excerpt.toLowerCase().includes(q);
        const matchAuthor = article.author.name.toLowerCase().includes(q);
        const matchCat = article.category.toLowerCase().includes(q);
        if (!matchTitle && !matchExcerpt && !matchAuthor && !matchCat) return false;
      }
      return true;
    });
  }, [activeNav, activeCategory, searchQuery, bookmarkedIds]);

  const navItems = [
    { key: 'Home' as const, label: 'Home', icon: Home, href: '#feed' },
    { key: 'Explore' as const, label: 'Explore', icon: Compass, href: '/explore' },
    { key: 'Communities' as const, label: 'Communities', icon: Users, href: '/communities' },
    { key: 'Profile' as const, label: 'Profile', icon: UserIcon, href: user ? '/profile/me' : '/profile/erostova' },
    { key: 'Bookmarks' as const, label: 'Bookmarks', icon: Bookmark, href: '#bookmarks' },
  ];

  return (
    <div className="sg-ambient-canvas min-h-screen w-full relative overflow-x-hidden flex flex-col justify-between">
      {/* Subtle Architectural Mountain Vista Backdrop Layer */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 opacity-40"
        style={{
          backgroundImage:
            'url("https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=2000&q=80")',
          backgroundSize: 'cover',
          backgroundPosition: 'center 25%',
          filter: 'blur(26px) saturate(115%)',
          transform: 'scale(1.08)',
        }}
      />

      {/* Top Candidate Control Strip */}
      <div className="relative z-30 bg-[#1D2729]/90 backdrop-blur-md text-[#F8F9F8] px-4 sm:px-6 py-2 text-xs border-b border-white/15 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <span className="px-2.5 py-0.5 rounded-full bg-[#4D9F91] text-white text-[10px] font-bold uppercase tracking-wider">
            V4 Candidate
          </span>
          <span className="text-[#DDE5E5] hidden sm:inline">
            PENORA Spatial Glass Design System — Isolated candidate preview (not applied globally).
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowDockedAuth(v => !v)}
            className="sg-focus-ring px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-[#A7E8DF] text-[11px] font-medium transition-colors"
          >
            {showDockedAuth ? 'Hide Floating Auth Card' : 'Show Floating Auth Card'}
          </button>
          <a
            href="/design-lab"
            className="text-[#DDE5E5] hover:text-white underline text-[11px]"
          >
            Design Lab
          </a>
          <a
            href="/dev-progress"
            className="text-[#DDE5E5] hover:text-white underline text-[11px]"
          >
            Dev Progress
          </a>
        </div>
      </div>

      {/* Main Spatial Window Container */}
      <div className="relative z-10 w-full max-w-[1440px] mx-auto px-2 sm:px-5 lg:px-8 py-4 sm:py-6 flex-1">
        <div className="sg-window-shell rounded-[26px] sm:rounded-[34px] overflow-visible relative">
          {/* ─── TOP NAVIGATION SHELL ─────────────────────────────────────────── */}
          <header className="sg-topnav rounded-t-[26px] sm:rounded-t-[34px] px-4 sm:px-7 h-[72px] flex items-center justify-between gap-4">
            {/* Left: Brand Mark & Spaced Serif Wordmark */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(v => !v)}
                aria-label="Toggle navigation menu"
                className="lg:hidden sg-focus-ring p-2 rounded-xl bg-white/60 text-[#1D2729] hover:bg-white"
              >
                {mobileDrawerOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>

              <a href="/" className="sg-focus-ring flex items-center gap-3 group rounded-xl">
                <div className="h-9 w-9 rounded-full bg-[#1D2729] text-[#F8F9F8] flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                  {/* Organic leaf/flame droplet mark matching reference */}
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 2.5C12 2.5 6 8.2 6 13.5C6 16.8 8.7 19.5 12 19.5C15.3 19.5 18 16.8 18 13.5C18 8.2 12 2.5 12 2.5Z"
                      fill="currentColor"
                    />
                    <path
                      d="M12 7.5C10.5 10.5 10.2 13.2 12 16.5"
                      stroke="#1D2729"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <span
                  className="text-[19px] sm:text-[21px] font-bold tracking-[0.22em] text-[#1D2729] uppercase"
                  style={{ fontFamily: 'var(--sg-font-serif)' }}
                >
                  PENORA
                </span>
              </a>
            </div>

            {/* Center: Liquid-Glass Search Field with Aqua Wave Reflection */}
            <div className="flex-1 max-w-[540px] hidden md:block">
              <div className="sg-liquid-search rounded-full h-11 px-4 flex items-center gap-3 overflow-hidden">
                <Search className="h-4 w-4 text-[#1D2729]/65 flex-shrink-0 relative z-10" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search creators, topics, or ideas..."
                  aria-label="Search creators, topics, or ideas"
                  className="w-full bg-transparent text-[13px] text-[#1D2729] placeholder:text-[#61534D]/65 focus:outline-none relative z-10"
                />

                {/* Sculptural Liquid Wave Reflection SVG (matches reference center-right wave) */}
                <svg
                  aria-hidden="true"
                  className="pointer-events-none absolute right-14 top-0 h-full w-44 opacity-80"
                  viewBox="0 0 180 44"
                  fill="none"
                >
                  <path
                    d="M10 42C42 42 58 8 96 10C132 12 142 36 172 22"
                    stroke="url(#sgWaveGrad)"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                  <path
                    d="M28 44C60 40 74 16 110 18C140 20 152 38 176 30"
                    stroke="rgba(255,255,255,0.9)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <defs>
                    <linearGradient id="sgWaveGrad" x1="10" y1="22" x2="172" y2="22" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="rgba(255,255,255,0)" />
                      <stop offset="45%" stopColor="rgba(167,232,223,0.85)" />
                      <stop offset="75%" stopColor="rgba(77,159,145,0.55)" />
                      <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                    </linearGradient>
                  </defs>
                </svg>

                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="relative z-10 text-[11px] text-[#61534D] hover:text-[#1D2729] px-1.5"
                  >
                    Clear
                  </button>
                ) : null}

                <kbd className="relative z-10 hidden sm:inline-flex items-center gap-0.5 px-2.5 py-1 rounded-full bg-white/80 border border-white text-[11px] font-medium text-[#1D2729]/75 shadow-sm flex-shrink-0">
                  ⌘ K
                </kbd>
              </div>
            </div>

            {/* Right: Glossy Dark Write Button, Bell, User Avatar / Auth Controls */}
            <div className="flex items-center gap-3 sm:gap-4">
              <a
                href="/editor"
                className="sg-graphite-btn sg-focus-ring px-4 sm:px-5 py-2.5 rounded-full text-xs sm:text-[13px] font-medium flex items-center gap-2"
              >
                <PenLine className="h-3.5 w-3.5 text-[#A7E8DF]" />
                <span>Write</span>
              </a>

              <div className="h-5 w-px bg-[#1D2729]/15 hidden sm:block" />

              {/* Notifications */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setNotifOpen(v => !v);
                    setUserMenuOpen(false);
                  }}
                  aria-label="Notifications"
                  className="sg-focus-ring p-2 rounded-full hover:bg-white/60 text-[#1D2729] transition-colors relative"
                >
                  <Bell className="h-[18px] w-[18px]" />
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[#4D9F91] ring-2 ring-white" />
                </button>

                {notifOpen && (
                  <div className="sg-frosted-panel absolute right-0 mt-2 w-72 rounded-2xl p-3 text-xs z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#1D2729]/10">
                      <span className="font-semibold text-[#1D2729]">Notifications</span>
                      <a href="/notifications" className="text-[11px] text-[#367B6F] font-medium hover:underline">
                        View all
                      </a>
                    </div>
                    <div className="space-y-2 text-[#61534D]">
                      <div className="p-2 rounded-xl bg-white/60">
                        <strong className="text-[#1D2729]">Elena Park</strong> published a new blog in{' '}
                        <span className="text-[#367B6F] font-medium">Lifestyle</span>.
                      </div>
                      <div className="p-2 rounded-xl bg-white/60">
                        <strong className="text-[#1D2729]">Alex Rivera</strong> bookmarked your story.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Authenticated User or Guest Avatar */}
              {authLoading ? (
                <div className="h-9 w-9 rounded-full bg-white/60 animate-pulse" />
              ) : user ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setUserMenuOpen(v => !v);
                      setNotifOpen(false);
                    }}
                    className="sg-focus-ring flex items-center gap-2 p-0.5 pr-2 rounded-full bg-white/65 hover:bg-white/90 border border-white transition-all shadow-sm"
                  >
                    <div className="h-8 w-8 rounded-full bg-[#367B6F] text-white text-xs font-bold flex items-center justify-center">
                      {getInitials(user.email || 'U')}
                    </div>
                    <span className="text-xs font-semibold text-[#1D2729] hidden xl:inline max-w-[110px] truncate">
                      {user.email}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 text-[#61534D]" />
                  </button>

                  {userMenuOpen && (
                    <div className="sg-frosted-panel absolute right-0 mt-2 w-60 rounded-2xl p-2 text-xs z-50 animate-in fade-in zoom-in-95 duration-150">
                      <div className="p-2.5 border-b border-[#1D2729]/10">
                        <div className="font-semibold text-[#1D2729] truncate">{user.email}</div>
                        <div className="text-[10.5px] text-[#367B6F] mt-0.5">
                          {user.email_confirmed_at ? '✓ Verified Creator' : '⚠ Pending email confirmation'}
                        </div>
                      </div>
                      <div className="py-1">
                        <a
                          href="/profile/me"
                          className="flex items-center gap-2 px-3 py-2 rounded-xl text-[#1D2729] hover:bg-white/70 transition-colors"
                        >
                          <UserIcon className="h-4 w-4 text-[#61534D]" />
                          <span>My Profile</span>
                        </a>
                        <a
                          href="/editor"
                          className="flex items-center gap-2 px-3 py-2 rounded-xl text-[#1D2729] hover:bg-white/70 transition-colors"
                        >
                          <PenLine className="h-4 w-4 text-[#61534D]" />
                          <span>Write Article</span>
                        </a>
                      </div>
                      <div className="pt-1 border-t border-[#1D2729]/10">
                        <button
                          type="button"
                          onClick={handleSignOut}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-red-700 hover:bg-red-50/80 transition-colors font-medium"
                        >
                          <LogOut className="h-4 w-4" />
                          <span>Sign out</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setModalAuthMode('login');
                      setModalAuthOpen(true);
                    }}
                    className="sg-focus-ring flex items-center gap-2 p-0.5 pr-2.5 rounded-full bg-white/70 hover:bg-white border border-white transition-all shadow-sm"
                    title="Sign in or Create account"
                  >
                    <img
                      src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80"
                      alt="Creator profile preview"
                      className="h-8 w-8 rounded-full object-cover ring-1 ring-white"
                    />
                    <span className="text-xs font-semibold text-[#1D2729] hidden sm:inline">Sign In</span>
                    <ChevronDown className="h-3.5 w-3.5 text-[#61534D]" />
                  </button>
                </div>
              )}
            </div>
          </header>

          {/* Mobile Search Bar */}
          <div className="md:hidden px-4 py-2.5 border-b border-white/50 bg-white/30">
            <div className="sg-liquid-search rounded-full h-10 px-3.5 flex items-center gap-2.5">
              <Search className="h-4 w-4 text-[#1D2729]/65" />
              <input
                type="search"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search creators, topics, or ideas..."
                className="w-full bg-transparent text-xs text-[#1D2729] placeholder:text-[#61534D]/65 focus:outline-none"
              />
            </div>
          </div>

          {/* Mobile Drawer Navigation */}
          {mobileDrawerOpen && (
            <div className="lg:hidden p-4 border-b border-white/60 bg-white/80 backdrop-blur-xl space-y-2 animate-in slide-in-from-top-2 duration-150">
              {navItems.map(item => {
                const Icon = item.icon;
                const isActive = activeNav === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setActiveNav(item.key);
                      setMobileDrawerOpen(false);
                      if (item.href.startsWith('/')) window.location.href = item.href;
                    }}
                    className={`w-full flex items-center justify-between px-4 py-2.5 rounded-2xl text-sm font-medium ${
                      isActive ? 'sg-active-pill text-[#1D2729] font-semibold' : 'text-[#61534D] hover:bg-white/60'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </span>
                    {isActive && <ChevronRight className="h-4 w-4 text-[#4D9F91]" />}
                  </button>
                );
              })}
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMobileDrawerOpen(false);
                    setModalAuthMode('register');
                    setModalAuthOpen(true);
                  }}
                  className="sg-jade-btn flex-1 py-2.5 rounded-full text-xs font-semibold text-center"
                >
                  {user ? 'Account Settings' : 'Sign In / Create Account'}
                </button>
              </div>
            </div>
          )}

          {/* ─── THREE-COLUMN SPATIAL BODY ────────────────────────────────────── */}
          <div className="p-4 sm:p-6 lg:p-7 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* ─── LEFT SIDEBAR COLUMN (3 cols on lg) ───────────────────────── */}
            <aside className="hidden lg:flex lg:col-span-3 xl:col-span-2 flex-col gap-5 relative">
              {/* Floating Frosted Navigation Card */}
              <nav
                aria-label="Primary Navigation"
                className="sg-frosted-panel rounded-[26px] p-3.5 flex flex-col gap-1.5"
              >
                {navItems.map(item => {
                  const Icon = item.icon;
                  const isActive = activeNav === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        if (item.key === 'Explore' || item.key === 'Communities' || item.key === 'Profile') {
                          window.location.href = item.href;
                        } else {
                          setActiveNav(item.key);
                        }
                      }}
                      className={`sg-focus-ring w-full flex items-center justify-between px-4 py-3 rounded-2xl text-[14px] transition-all ${
                        isActive
                          ? 'sg-active-pill text-[#1D2729] font-semibold'
                          : 'text-[#1D2729]/80 hover:bg-white/55 hover:text-[#1D2729] font-medium'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <Icon
                          className={`h-[18px] w-[18px] ${
                            isActive ? 'text-[#1D2729] fill-[#1D2729]/10' : 'text-[#61534D]'
                          }`}
                        />
                        <span>{item.label}</span>
                      </span>
                      {isActive && <ChevronRight className="h-4 w-4 text-[#4D9F91]" />}
                    </button>
                  );
                })}

                <div className="pt-2 mt-1">
                  <a
                    href="/editor"
                    className="sg-graphite-btn sg-focus-ring w-full py-3 px-4 rounded-full text-[13.5px] font-medium flex items-center justify-center gap-2"
                  >
                    <PenLine className="h-4 w-4 text-[#A7E8DF]" />
                    <span>Write</span>
                  </a>
                </div>
              </nav>

              {/* Floating Sculpted Liquid-Glass Auth Panel (Matches Reference Bottom-Left Overlay) */}
              {showDockedAuth && (
                <div className="relative z-20 -mx-2 xl:-ml-4 transition-all">
                  <SpatialAuthModalV4
                    isOpen={true}
                    onClose={() => setShowDockedAuth(false)}
                    initialMode="register"
                    presentation="floating-dock"
                    onAuthSuccess={() => triggerToast('Authenticated with Supabase')}
                  />
                </div>
              )}
            </aside>

            {/* ─── MAIN CONTENT COLUMN (9 cols on lg, 7 cols on xl) ─────────── */}
            <main className="lg:col-span-9 xl:col-span-7 flex flex-col gap-5 min-w-0">
              {/* Cinematic Hero Banner */}
              <section
                aria-label="Featured platform introduction"
                className="relative rounded-[26px] overflow-hidden min-h-[260px] sm:min-h-[295px] flex items-center shadow-lg border border-white/80"
              >
                {/* Serene architectural / mountain vista image */}
                <img
                  src="https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1400&q=85"
                  alt="Serene mountain lake vista"
                  className="absolute inset-0 w-full h-full object-cover object-center"
                />
                {/* Editorial dark-to-transparent gradient for high contrast */}
                <div
                  aria-hidden="true"
                  className="absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(95deg, rgba(20, 28, 30, 0.84) 0%, rgba(25, 35, 37, 0.62) 52%, rgba(29, 39, 41, 0.18) 100%)',
                  }}
                />

                <div className="relative z-10 p-6 sm:p-9 max-w-lg text-white space-y-3.5">
                  <div className="text-[10.5px] sm:text-[11px] font-semibold uppercase tracking-[0.24em] text-[#D9B88C]">
                    CREATE &nbsp;·&nbsp; SHARE &nbsp;·&nbsp; BELONG
                  </div>
                  <h1
                    className="text-3xl sm:text-[42px] font-bold leading-[1.12] tracking-tight text-[#F8F9F8]"
                    style={{ fontFamily: 'var(--sg-font-serif)' }}
                  >
                    Ideas find
                    <br />
                    better places here.
                  </h1>
                  <p className="text-xs sm:text-[13.5px] text-[#F5F1EC]/90 leading-relaxed max-w-md">
                    PENORA is a home for writers, creators and curious minds to share stories, ideas and what's next.
                  </p>
                  <div className="pt-1.5">
                    <a
                      href="/editor"
                      className="sg-focus-ring inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/90 hover:bg-white text-[#1D2729] text-xs sm:text-[13px] font-semibold transition-all shadow-[0_0_24px_rgba(167,232,223,0.45)]"
                    >
                      <span>Start Writing</span>
                      <ArrowRight className="h-3.5 w-3.5 text-[#367B6F]" />
                    </a>
                  </div>
                </div>
              </section>

              {/* Category Filter Tabs */}
              <div className="flex items-center justify-between gap-2 border-b border-[#1D2729]/10 pb-2 overflow-x-auto no-scrollbar">
                <div role="tablist" aria-label="Article categories" className="flex items-center gap-1.5 sm:gap-2">
                  {CATEGORY_TABS.map(tab => {
                    const isActive = activeCategory === tab && activeNav !== 'Bookmarks';
                    return (
                      <button
                        key={tab}
                        role="tab"
                        aria-selected={isActive}
                        type="button"
                        onClick={() => {
                          setActiveNav('Home');
                          setActiveCategory(tab);
                          setSelectedTag(null);
                        }}
                        className={`sg-focus-ring relative px-4 py-2 rounded-full text-xs sm:text-[13px] whitespace-nowrap transition-all ${
                          isActive
                            ? 'bg-white/90 text-[#1D2729] font-semibold shadow-sm'
                            : 'text-[#61534D] hover:text-[#1D2729] hover:bg-white/45 font-medium'
                        }`}
                      >
                        <span>{tab}</span>
                        {isActive && (
                          <span
                            aria-hidden="true"
                            className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-full bg-[#4D9F91] shadow-[0_0_8px_#4D9F91]"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>

                {selectedTag && (
                  <button
                    type="button"
                    onClick={() => setSelectedTag(null)}
                    className="text-[11px] px-2.5 py-1 rounded-full bg-[#4D9F91]/15 text-[#367B6F] font-semibold flex items-center gap-1 flex-shrink-0"
                  >
                    <span>Topic: {selectedTag}</span>
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Editorial Article Feed Cards */}
              <div id="feed" className="space-y-4">
                {visibleArticles.length === 0 ? (
                  <div className="sg-ceramic-card rounded-[24px] p-10 text-center space-y-2">
                    <p
                      className="text-lg font-bold text-[#1D2729]"
                      style={{ fontFamily: 'var(--sg-font-serif)' }}
                    >
                      {activeNav === 'Bookmarks'
                        ? 'No bookmarked stories yet'
                        : 'No stories match your current filter'}
                    </p>
                    <p className="text-xs text-[#61534D]">
                      {activeNav === 'Bookmarks'
                        ? 'Click the bookmark icon on any article card to save it for calm reading.'
                        : 'Try clearing your search query or switching back to the For You tab.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveNav('Home');
                        setActiveCategory('For You');
                        setSearchQuery('');
                      }}
                      className="mt-2 px-4 py-2 rounded-full bg-[#1D2729] text-white text-xs font-medium"
                    >
                      Reset Feed
                    </button>
                  </div>
                ) : (
                  visibleArticles.map(article => {
                    const isLiked = !!likedIds[article.id];
                    const isBookmarked = !!bookmarkedIds[article.id];
                    const displayLikes = article.likes + (isLiked ? 1 : 0);

                    return (
                      <article
                        key={article.id}
                        className="sg-ceramic-card rounded-[22px] p-3.5 sm:p-4 flex flex-col sm:flex-row gap-4 sm:gap-5 items-stretch"
                      >
                        {/* Editorial Thumbnail */}
                        <a
                          href={`/story/${article.slug}`}
                          className="sg-focus-ring sm:w-[210px] md:w-[225px] h-[160px] sm:h-[138px] rounded-[16px] overflow-hidden flex-shrink-0 relative group"
                        >
                          <img
                            src={article.thumbnail}
                            alt={article.title}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        </a>

                        {/* Card Content */}
                        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                          <div>
                            {/* Top Meta Row: Category Pill + Read Time + Bookmark */}
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <div className="flex items-center gap-2 text-[11.5px] text-[#61534D]">
                                <span className="px-2.5 py-0.5 rounded-md bg-[#A7E8DF]/45 text-[#275950] font-semibold">
                                  {article.category}
                                </span>
                                <span>·</span>
                                <span>{article.readTime}</span>
                              </div>

                              <button
                                type="button"
                                onClick={() => toggleBookmark(article.id)}
                                aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark story'}
                                className={`sg-focus-ring p-1.5 rounded-lg transition-colors ${
                                  isBookmarked
                                    ? 'text-[#367B6F] bg-[#A7E8DF]/35'
                                    : 'text-[#61534D]/70 hover:text-[#1D2729] hover:bg-black/5'
                                }`}
                              >
                                <Bookmark className={`h-4 w-4 ${isBookmarked ? 'fill-current' : ''}`} />
                              </button>
                            </div>

                            {/* Headline */}
                            <a href={`/story/${article.slug}`} className="sg-focus-ring block group">
                              <h2
                                className="text-[18px] sm:text-[20px] font-bold text-[#1D2729] group-hover:text-[#367B6F] transition-colors leading-snug tracking-tight"
                                style={{ fontFamily: 'var(--sg-font-serif)' }}
                              >
                                {article.title}
                              </h2>
                            </a>

                            {/* Excerpt */}
                            <p className="text-xs sm:text-[13px] text-[#61534D] leading-relaxed mt-1 line-clamp-2">
                              {article.excerpt}
                            </p>
                          </div>

                          {/* Bottom Author & Engagement Row */}
                          <div className="flex items-center justify-between gap-2 pt-3 mt-2 border-t border-[#1D2729]/5">
                            <a
                              href={`/profile/${article.author.handle}`}
                              className="sg-focus-ring flex items-center gap-2 group"
                            >
                              <img
                                src={article.author.avatar}
                                alt={article.author.name}
                                loading="lazy"
                                className="h-6 w-6 rounded-full object-cover ring-1 ring-white"
                              />
                              <span className="text-xs font-semibold text-[#1D2729] group-hover:underline">
                                {article.author.name}
                              </span>
                              {article.author.verified && (
                                <span
                                  title="Verified Creator"
                                  className="h-3.5 w-3.5 rounded-full bg-[#4D9F91] text-white inline-flex items-center justify-center"
                                >
                                  <Check className="h-2.5 w-2.5 stroke-[3]" />
                                </span>
                              )}
                              <span className="text-[11px] text-[#61534D]/75">{article.publishedAgo}</span>
                            </a>

                            {/* Engagement Actions */}
                            <div className="flex items-center gap-3 text-xs text-[#61534D]">
                              <button
                                type="button"
                                onClick={() => toggleLike(article.id)}
                                aria-label="Like story"
                                className={`sg-focus-ring flex items-center gap-1 transition-colors ${
                                  isLiked ? 'text-rose-600 font-semibold' : 'hover:text-[#1D2729]'
                                }`}
                              >
                                <Heart className={`h-3.5 w-3.5 ${isLiked ? 'fill-current' : ''}`} />
                                <span>{formatLikes(displayLikes)}</span>
                              </button>

                              <a
                                href={`/story/${article.slug}#comments`}
                                className="sg-focus-ring flex items-center gap-1 hover:text-[#1D2729] transition-colors"
                              >
                                <MessageCircle className="h-3.5 w-3.5" />
                                <span>{article.comments}</span>
                              </a>

                              <button
                                type="button"
                                onClick={() => triggerToast(`Link copied for "${article.title}"`)}
                                aria-label="Share story"
                                className="sg-focus-ring hover:text-[#1D2729] transition-colors"
                              >
                                <Share2 className="h-3.5 w-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => triggerToast('More options (Preview)')}
                                aria-label="More options"
                                className="sg-focus-ring hover:text-[#1D2729] transition-colors"
                              >
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </main>

            {/* ─── RIGHT SIDEBAR COLUMN (3 cols on xl, full below on lg) ───── */}
            <aside className="lg:col-span-12 xl:col-span-3 grid grid-cols-1 md:grid-cols-3 xl:grid-cols-1 gap-5">
              {/* 1. Trending Now Card */}
              <section
                aria-label="Trending topics"
                className="sg-frosted-panel rounded-[24px] p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-[#1D2729]" />
                      <h2 className="text-[15px] font-bold text-[#1D2729]">Trending Now</h2>
                    </div>
                    <a
                      href="/explore"
                      className="text-xs text-[#61534D] hover:text-[#1D2729] underline font-medium"
                    >
                      See all
                    </a>
                  </div>

                  <div className="space-y-3">
                    {TRENDING_TOPICS.map(item => {
                      const badgeStyle =
                        item.tone === 'gold'
                          ? 'bg-[#D9B88C]/55 text-[#5C4322]'
                          : item.tone === 'silver'
                          ? 'bg-[#DDE5E5] text-[#1D2729]'
                          : item.tone === 'bronze'
                          ? 'bg-[#D9B88C]/35 text-[#61534D]'
                          : 'bg-white/75 text-[#61534D]';

                      return (
                        <div
                          key={item.tag}
                          onClick={() => {
                            setSelectedTag(item.tag);
                            triggerToast(`Viewing topic ${item.tag}`);
                          }}
                          className="flex items-center justify-between gap-3 py-1 px-1.5 rounded-xl hover:bg-white/50 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              className={`h-7 w-7 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 ${badgeStyle}`}
                            >
                              {item.rank}
                            </span>
                            <div className="min-w-0">
                              <div className="text-[13px] font-bold text-[#1D2729] truncate">{item.tag}</div>
                              <div className="text-[11px] text-[#61534D] flex items-center gap-1">
                                <span>{item.posts}</span>
                                <ArrowUpRight className="h-3 w-3 text-[#4D9F91]" />
                              </div>
                            </div>
                          </div>
                          <MoreHorizontal className="h-4 w-4 text-[#61534D]/60 flex-shrink-0" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>

              {/* 2. Suggested Creators Card */}
              <section
                aria-label="Suggested creators"
                className="sg-frosted-panel rounded-[24px] p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-[#1D2729]" />
                      <h2 className="text-[15px] font-bold text-[#1D2729]">Suggested Creators</h2>
                    </div>
                    <a
                      href="/communities"
                      className="text-xs text-[#61534D] hover:text-[#1D2729] underline font-medium"
                    >
                      See all
                    </a>
                  </div>

                  <div className="space-y-3.5">
                    {SUGGESTED_CREATORS.map(creator => {
                      const isFollowing = !!followedIds[creator.id];
                      return (
                        <div key={creator.id} className="flex items-center justify-between gap-2.5">
                          <a
                            href={`/profile/${creator.handle}`}
                            className="flex items-center gap-2.5 min-w-0 group"
                          >
                            <img
                              src={creator.avatar}
                              alt={creator.name}
                              loading="lazy"
                              className="h-10 w-10 rounded-full object-cover ring-2 ring-white flex-shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1">
                                <span className="text-[13px] font-bold text-[#1D2729] group-hover:underline truncate">
                                  {creator.name}
                                </span>
                                <span className="h-3.5 w-3.5 rounded-full bg-[#3B82F6] text-white inline-flex items-center justify-center flex-shrink-0">
                                  <Check className="h-2.5 w-2.5 stroke-[3]" />
                                </span>
                              </div>
                              <div className="text-[11px] text-[#61534D] truncate">{creator.domains}</div>
                            </div>
                          </a>

                          <button
                            type="button"
                            onClick={() => toggleFollow(creator.id, creator.name)}
                            className={`sg-focus-ring px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all flex-shrink-0 ${
                              isFollowing
                                ? 'bg-[#4D9F91] text-white shadow-sm'
                                : 'bg-white/85 hover:bg-white text-[#1D2729] border border-white shadow-sm'
                            }`}
                          >
                            {isFollowing ? 'Following' : 'Follow'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>

              {/* 3. Featured Editorial Card ("The Creator's Playbook") */}
              <section
                aria-label="Featured guide"
                className="relative rounded-[24px] overflow-hidden min-h-[195px] p-5 flex flex-col justify-between text-white shadow-lg border border-white/75 group"
              >
                <img
                  src="https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80"
                  alt="Curved architectural pavilion at dusk"
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(20, 26, 28, 0.88) 0%, rgba(29, 39, 41, 0.68) 55%, rgba(29, 39, 41, 0.35) 100%)',
                  }}
                />

                <div className="relative z-10">
                  <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#D9B88C] text-[#1D2729] text-[10px] font-bold uppercase tracking-wider">
                    FEATURED
                  </span>
                  <h3
                    className="text-xl font-bold text-white mt-2.5 leading-snug"
                    style={{ fontFamily: 'var(--sg-font-serif)' }}
                  >
                    The Creator's
                    <br />
                    Playbook
                  </h3>
                  <p className="text-[11.5px] text-[#F5F1EC]/85 leading-relaxed mt-1.5 pr-10">
                    Actionable insights, honest stories and tools to help you build a more intentional creative life.
                  </p>
                </div>

                <div className="relative z-10 flex justify-end mt-2">
                  <a
                    href="/story/toward-a-sovereign-creator-commons"
                    aria-label="Read The Creator's Playbook"
                    className="sg-focus-ring h-9 w-9 rounded-full bg-white/90 hover:bg-white text-[#1D2729] flex items-center justify-center shadow-md transition-transform group-hover:translate-x-0.5"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              </section>
            </aside>
          </div>
        </div>
      </div>

      {/* Mobile Auth Card Preview Section (visible on mobile/tablet where left sidebar is collapsed) */}
      {showDockedAuth && (
        <div className="lg:hidden px-4 pb-8 flex justify-center relative z-10">
          <SpatialAuthModalV4
            isOpen={true}
            onClose={() => setShowDockedAuth(false)}
            initialMode="register"
            presentation="floating-dock"
            onAuthSuccess={() => triggerToast('Authenticated with Supabase')}
          />
        </div>
      )}

      {/* Centered Auth Modal (when triggered from Top Bar Sign In) */}
      <SpatialAuthModalV4
        isOpen={modalAuthOpen}
        onClose={() => setModalAuthOpen(false)}
        initialMode={modalAuthMode}
        presentation="centered-modal"
        onAuthSuccess={() => {
          setModalAuthOpen(false);
          triggerToast('Authenticated with Supabase');
        }}
      />

      {/* Interactive Feedback Toast */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-full bg-[#1D2729] text-[#F8F9F8] text-xs font-medium shadow-xl border border-white/20 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <Sparkles className="h-3.5 w-3.5 text-[#A7E8DF]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
