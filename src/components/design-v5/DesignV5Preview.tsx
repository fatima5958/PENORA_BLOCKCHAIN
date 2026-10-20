// src/components/design-v5/DesignV5Preview.tsx
// PENORA V5 — Clean Spatial Glass + Balanced Motion
// Formula: 85% Clean Editorial Functionality + 15% Spatial-Glass Polish
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Home,
  Compass,
  Users,
  UserCheck,
  Bookmark,
  User as UserIcon,
  PenLine,
  Search,
  Bell,
  ChevronUp,
  ChevronDown,
  MessageSquare,
  Share2,
  Check,
  Sparkles,
  LogOut,
  Menu,
  X,
  SlidersHorizontal,
  TrendingUp,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { SpatialAuthModalV5 } from './SpatialAuthModalV5';
import type { User as SupabaseUser } from '@supabase/supabase-js';

// ─── Sample Editorial Feed Data (Clearly isolated from Supabase production data) ─
interface V5Article {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: 'Technology' | 'Design' | 'Culture' | 'Productivity';
  community: {
    name: string;
    slug: string;
  };
  author: {
    name: string;
    handle: string;
    reputation: number;
    avatar: string;
    verified: boolean;
    isFollowedByDefault?: boolean;
  };
  publishedAgo: string;
  readTime: string;
  votes: number;
  comments: number;
  curationPoints: number;
  thumbnail?: string;
}

const SAMPLE_ARTICLES: V5Article[] = [
  {
    id: 'v5-calmer-internet',
    slug: 'the-architecture-of-spatial-interfaces',
    title: 'A Calmer Internet Is a More Creative You',
    excerpt:
      'Why stepping away from algorithmic feeds toward intentional, community-curated publishing restores deep focus and long-form craft.',
    category: 'Culture',
    community: { name: 'Creator Commons', slug: 'creator-commons' },
    author: {
      name: 'Elena Park',
      handle: 'erostova',
      reputation: 74,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80',
      verified: true,
      isFollowedByDefault: true,
    },
    publishedAgo: '2h ago',
    readTime: '5 min read',
    votes: 148,
    comments: 28,
    curationPoints: 42,
    thumbnail: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=520&q=80',
  },
  {
    id: 'v5-spatial-restraint',
    slug: 'the-lost-art-of-typographic-rhythm',
    title: 'Designing With Restraint: When Spatial Glass Serves the Reader',
    excerpt:
      'Translucent surfaces and subtle elevation should frame typography and hierarchy—never compete with the words on the page.',
    category: 'Design',
    community: { name: 'Editorial Craft', slug: 'editorial-craft' },
    author: {
      name: 'Sora Nguyen',
      handle: 's_ross',
      reputation: 71,
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=160&q=80',
      verified: true,
      isFollowedByDefault: true,
    },
    publishedAgo: '5h ago',
    readTime: '7 min read',
    votes: 219,
    comments: 41,
    curationPoints: 64,
    thumbnail: 'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?auto=format&fit=crop&w=520&q=80',
  },
  {
    id: 'v5-reputation-economics',
    slug: 'sustainable-curation-without-surveillance-algorithms',
    title: 'Reputation Without Speculation: Building Trust in Open Publishing',
    excerpt:
      'How non-monetary curation scores and transparent community moderation reward thoughtful contributors over clickbait.',
    category: 'Technology',
    community: { name: 'Open Protocols', slug: 'open-protocols' },
    author: {
      name: 'Daniel Kim',
      handle: 'marcus_chen',
      reputation: 76,
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=160&q=80',
      verified: true,
      isFollowedByDefault: false,
    },
    publishedAgo: '9h ago',
    readTime: '8 min read',
    votes: 312,
    comments: 53,
    curationPoints: 88,
    thumbnail: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=520&q=80',
  },
  {
    id: 'v5-minimal-workflow',
    slug: 'toward-a-sovereign-creator-commons',
    title: 'My Minimal Writing & Research Setup for Long-Form Essays',
    excerpt:
      'A practical look at the plain-text notes, reading queues, and distraction-free habits that sustain a weekly publishing cadence.',
    category: 'Productivity',
    community: { name: 'Spatial Computing', slug: 'spatial-alliance' },
    author: {
      name: 'Maya Chen',
      handle: 'tariq_m',
      reputation: 69,
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=160&q=80',
      verified: true,
      isFollowedByDefault: false,
    },
    publishedAgo: '1d ago',
    readTime: '6 min read',
    votes: 184,
    comments: 34,
    curationPoints: 51,
    thumbnail: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=520&q=80',
  },
];

const CATEGORIES = ['For You', 'Following', 'Technology', 'Design', 'Culture', 'Productivity'] as const;

const TRENDING_TOPICS = [
  { rank: 1, tag: '#EditorialCraft', posts: '4.2K stories' },
  { rank: 2, tag: '#CreatorCommons', posts: '3.8K stories' },
  { rank: 3, tag: '#SpatialDesign', posts: '2.9K stories' },
  { rank: 4, tag: '#DigitalWellbeing', posts: '2.4K stories' },
  { rank: 5, tag: '#OpenProtocols', posts: '1.9K stories' },
];

const SUGGESTED_CREATORS = [
  {
    id: 'alex-rivera',
    name: 'Alex Rivera',
    handle: 'erostova',
    reputation: 78,
    bio: 'Systems architecture & calm technology',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&q=80',
  },
  {
    id: 'sora-nguyen',
    name: 'Sora Nguyen',
    handle: 's_ross',
    reputation: 71,
    bio: 'Editorial typography & design systems',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=160&q=80',
  },
  {
    id: 'marcus-lee',
    name: 'Marcus Lee',
    handle: 'marcus_chen',
    reputation: 75,
    bio: 'Independent publishing economics',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=160&q=80',
  },
];

const DISCOVER_COMMUNITIES = [
  { id: 'c-editorial', slug: 'editorial-craft', name: 'Art of Typographic Craft', members: '2.8K' },
  { id: 'c-commons', slug: 'creator-commons', name: 'Creator Commons & Curation', members: '3.9K' },
  { id: 'c-spatial', slug: 'spatial-alliance', name: 'Spatial Computing Alliance', members: '4.8K' },
];

function getInitials(email: string): string {
  const local = email.split('@')[0] || 'U';
  return local.slice(0, 2).toUpperCase();
}

export const DesignV5Preview: React.FC = () => {
  // Real Supabase auth state
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Navigation & Feed state
  const [activeNav, setActiveNav] = useState<
    'Home' | 'Explore' | 'Following' | 'Communities' | 'Bookmarks' | 'Profile'
  >('Home');
  const [activeCategory, setActiveCategory] = useState<typeof CATEGORIES[number]>('For You');
  const [sortBy, setSortBy] = useState<'trending' | 'latest'>('trending');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [isSimulatingSkeleton, setIsSimulatingSkeleton] = useState(false);

  // Local preview engagement state (explicitly labeled as local preview until DB migration)
  const [upvotedIds, setUpvotedIds] = useState<Record<string, boolean>>({});
  const [bookmarkedIds, setBookmarkedIds] = useState<Record<string, boolean>>({});
  const [followedCreators, setFollowedCreators] = useState<Record<string, boolean>>({});
  const [joinedCommunities, setJoinedCommunities] = useState<Record<string, boolean>>({
    'c-editorial': true,
  });

  // Modals & Dropdowns
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Subscribe to real Supabase session
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

  // Keyboard shortcut Cmd/Ctrl + K focuses search
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast(prev => (prev === msg ? null : prev));
    }, 2400);
  };

  const triggerSkeletonDemo = () => {
    setIsSimulatingSkeleton(true);
    setTimeout(() => setIsSimulatingSkeleton(false), 1100);
  };

  const handleToggleVote = (id: string) => {
    setUpvotedIds(prev => {
      const next = !prev[id];
      showToast(next ? 'Upvoted (Preview state)' : 'Vote removed');
      return { ...prev, [id]: next };
    });
  };

  const handleToggleBookmark = (id: string) => {
    setBookmarkedIds(prev => {
      const next = !prev[id];
      showToast(next ? 'Saved to Bookmarks' : 'Removed from Bookmarks');
      return { ...prev, [id]: next };
    });
  };

  const handleToggleFollow = (id: string, name: string) => {
    setFollowedCreators(prev => {
      const next = !prev[id];
      showToast(next ? `Following ${name}` : `Unfollowed ${name}`);
      return { ...prev, [id]: next };
    });
  };

  const handleToggleCommunity = (id: string, name: string) => {
    setJoinedCommunities(prev => {
      const next = !prev[id];
      showToast(next ? `Joined ${name}` : `Left ${name}`);
      return { ...prev, [id]: next };
    });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUserDropdownOpen(false);
    showToast('Signed out of PENORA');
  };

  // Filtered & sorted articles
  const filteredArticles = useMemo(() => {
    const list = SAMPLE_ARTICLES.filter(article => {
      if (activeNav === 'Bookmarks' && !bookmarkedIds[article.id]) return false;
      if (
        (activeNav === 'Following' || activeCategory === 'Following') &&
        !article.author.isFollowedByDefault &&
        !followedCreators[article.author.handle]
      ) {
        return false;
      }
      if (
        activeCategory !== 'For You' &&
        activeCategory !== 'Following' &&
        article.category !== activeCategory
      ) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          article.title.toLowerCase().includes(q) ||
          article.excerpt.toLowerCase().includes(q) ||
          article.author.name.toLowerCase().includes(q) ||
          article.community.name.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });

    if (sortBy === 'trending') {
      return [...list].sort((a, b) => b.votes - a.votes);
    }
    return list;
  }, [activeNav, activeCategory, searchQuery, sortBy, bookmarkedIds, followedCreators]);

  const leftNavItems = [
    { key: 'Home' as const, label: 'Home', icon: Home, route: null },
    { key: 'Explore' as const, label: 'Explore', icon: Compass, route: '/explore' },
    { key: 'Following' as const, label: 'Following', icon: UserCheck, route: null },
    { key: 'Communities' as const, label: 'Communities', icon: Users, route: '/communities' },
    { key: 'Bookmarks' as const, label: 'Bookmarks', icon: Bookmark, route: null },
    {
      key: 'Profile' as const,
      label: 'Profile',
      icon: UserIcon,
      route: user ? '/profile/me' : null,
    },
  ];

  const handleNavClick = (item: typeof leftNavItems[number]) => {
    if (item.key === 'Profile' && !user) {
      setAuthModalMode('login');
      setAuthModalOpen(true);
      return;
    }
    if (item.route) {
      window.location.href = item.route;
      return;
    }
    setActiveNav(item.key);
    if (item.key === 'Following') {
      setActiveCategory('Following');
    } else if (item.key === 'Home') {
      setActiveCategory('For You');
    }
    setMobileMenuOpen(false);
  };

  return (
    <div className="v5-page min-h-screen flex flex-col">
      {/* Discrete Top Candidate Notice Bar */}
      <div className="bg-[#1D2729] text-[#F7F6F2] px-4 py-1.5 text-[11px] border-b border-white/10">
        <div className="max-w-[1280px] mx-auto flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-[#3F8E80] text-white text-[10px] font-semibold uppercase tracking-wider">
              V5 Candidate
            </span>
            <span className="text-[#DDE5E5]">
              Clean Spatial Glass + Balanced Motion (85% Editorial UI / 15% Spatial Glass)
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={triggerSkeletonDemo}
              className="v5-focus text-[#A7E8DF] hover:underline"
            >
              Preview Skeleton Shimmer (1.5s)
            </button>
            <span className="text-white/25">|</span>
            <a href="/design-v4" className="text-[#DDE5E5] hover:text-white underline">
              Compare V4
            </a>
            <a href="/design-lab" className="text-[#DDE5E5] hover:text-white underline">
              Design Lab
            </a>
            <a href="/dev-progress" className="text-[#DDE5E5] hover:text-white underline">
              Dev Progress
            </a>
          </div>
        </div>
      </div>

      {/* ─── SLIM STICKY SPATIAL-GLASS HEADER ───────────────────────────────── */}
      <header className="v5-sticky-header sticky top-0 z-30 h-16 px-4 sm:px-6">
        <div className="max-w-[1280px] mx-auto h-full flex items-center justify-between gap-4">
          {/* Left: Mobile Menu Trigger + PENORA Brand */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(v => !v)}
              aria-label="Toggle navigation"
              className="lg:hidden v5-focus p-2 rounded-xl text-[#1D2729] hover:bg-black/5"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            <a href="/" className="v5-focus flex items-center gap-2.5 rounded-lg py-1">
              <div className="h-8 w-8 rounded-full bg-[#1D2729] text-[#F8F9F8] flex items-center justify-center shadow-sm">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
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
                className="text-[18px] font-bold tracking-[0.18em] text-[#1D2729]"
                style={{ fontFamily: 'var(--v5-font-serif)' }}
              >
                PENORA
              </span>
            </a>
          </div>

          {/* Center: Clean Liquid-Glass Search Input (focus reflection only, no wave clutter) */}
          <div className="flex-1 max-w-[460px] hidden md:block">
            <div className="v5-search-shell h-10 px-3.5 flex items-center gap-2.5">
              <Search className="h-4 w-4 text-[#5F554F] flex-shrink-0" />
              <input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search essays, creators, or communities..."
                aria-label="Search essays, creators, or communities"
                className="w-full bg-transparent text-xs text-[#1D2729] placeholder:text-[#8C827A] focus:outline-none"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-[11px] text-[#5F554F] hover:text-[#1D2729] px-1"
                >
                  Clear
                </button>
              ) : (
                <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md bg-[#F7F6F2] border border-[#1D2729]/10 text-[10px] font-medium text-[#5F554F]">
                  ⌘K
                </kbd>
              )}
            </div>
          </div>

          {/* Right: Write CTA, Notifications, Auth Controls */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <a
              href="/editor"
              className="v5-btn-graphite v5-focus px-4 py-2 rounded-full text-xs font-medium flex items-center gap-1.5"
            >
              <PenLine className="h-3.5 w-3.5 text-[#A7E8DF]" />
              <span>Write</span>
            </a>

            {/* Notifications Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotifDropdownOpen(v => !v);
                  setUserDropdownOpen(false);
                }}
                aria-label="Notifications"
                className="v5-focus p-2 rounded-full text-[#1D2729] hover:bg-black/5 transition-colors relative"
              >
                <Bell className="h-[18px] w-[18px]" />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[#3F8E80] ring-2 ring-[#F7F6F2]" />
              </button>

              {notifDropdownOpen && (
                <div className="v5-glass-dropdown absolute right-0 mt-2 w-72 p-3 text-xs z-50">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#1D2729]/8">
                    <span className="font-semibold text-[#1D2729]">Notifications</span>
                    <a
                      href="/notifications"
                      className="text-[11px] text-[#2E6F64] font-medium hover:underline"
                    >
                      All activity
                    </a>
                  </div>
                  <div className="space-y-1.5 text-[#5F554F]">
                    <div className="p-2 rounded-xl hover:bg-black/[0.03] transition-colors">
                      <strong className="text-[#1D2729]">Elena Park</strong> published in{' '}
                      <span className="text-[#2E6F64] font-medium">Creator Commons</span>.
                    </div>
                    <div className="p-2 rounded-xl hover:bg-black/[0.03] transition-colors">
                      <strong className="text-[#1D2729]">Sora Nguyen</strong> upvoted your essay.
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="h-4 w-px bg-[#1D2729]/12 hidden sm:block" />

            {/* User Session or Sign In / Sign Up */}
            {authLoading ? (
              <div className="h-8 w-20 v5-skeleton rounded-full" />
            ) : user ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setUserDropdownOpen(v => !v);
                    setNotifDropdownOpen(false);
                  }}
                  className="v5-btn-secondary v5-focus flex items-center gap-2 p-1 pr-2.5 rounded-full text-xs"
                >
                  <div className="h-6 w-6 rounded-full bg-[#2E6F64] text-white text-[10px] font-bold flex items-center justify-center">
                    {getInitials(user.email || 'U')}
                  </div>
                  <span className="font-medium text-[#1D2729] hidden sm:inline max-w-[115px] truncate">
                    {user.email}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-[#5F554F]" />
                </button>

                {userDropdownOpen && (
                  <div className="v5-glass-dropdown absolute right-0 mt-2 w-56 p-1.5 text-xs z-50">
                    <div className="px-3 py-2.5 border-b border-[#1D2729]/8">
                      <div className="font-semibold text-[#1D2729] truncate">{user.email}</div>
                      <div className="text-[10.5px] text-[#2E6F64] mt-0.5">
                        {user.email_confirmed_at ? '✓ Verified account' : '⚠ Unconfirmed email'}
                      </div>
                    </div>
                    <div className="py-1">
                      <a
                        href="/profile/me"
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-[#1D2729] hover:bg-black/[0.04]"
                      >
                        <UserIcon className="h-4 w-4 text-[#5F554F]" />
                        <span>My Profile</span>
                      </a>
                      <a
                        href="/editor"
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-[#1D2729] hover:bg-black/[0.04]"
                      >
                        <PenLine className="h-4 w-4 text-[#5F554F]" />
                        <span>Drafts & Editor</span>
                      </a>
                    </div>
                    <div className="pt-1 border-t border-[#1D2729]/8">
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-red-700 hover:bg-red-50 font-medium text-left"
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
                    setAuthModalMode('login');
                    setAuthModalOpen(true);
                  }}
                  className="v5-focus px-3 py-1.5 rounded-full text-xs font-medium text-[#1D2729] hover:bg-black/5 transition-colors"
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthModalMode('register');
                    setAuthModalOpen(true);
                  }}
                  className="v5-btn-jade v5-focus px-3.5 py-1.5 rounded-full text-xs font-medium hidden sm:inline-flex"
                >
                  Create account
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Search Bar */}
      <div className="md:hidden px-4 py-2.5 border-b border-[#1D2729]/8 bg-[#F7F6F2]">
        <div className="v5-search-shell h-9 px-3 flex items-center gap-2">
          <Search className="h-3.5 w-3.5 text-[#5F554F]" />
          <input
            type="search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search essays, creators, or communities..."
            className="w-full bg-transparent text-xs text-[#1D2729] placeholder:text-[#8C827A] focus:outline-none"
          />
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-b border-[#1D2729]/10 bg-white/95 backdrop-blur-md px-4 py-3 space-y-1">
          {leftNavItems.map(item => {
            const Icon = item.icon;
            const isActive = activeNav === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleNavClick(item)}
                className={`v5-nav-item w-full flex items-center gap-3 px-3.5 py-2.5 text-xs ${
                  isActive ? 'v5-nav-item-active' : ''
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ─── THREE-COLUMN STEEMIT-INSPIRED EDITORIAL LAYOUT ────────────────── */}
      <div className="max-w-[1280px] w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ─── LEFT COLUMN: Clean Unboxed Navigation (2 cols on lg) ──────── */}
        <aside className="hidden lg:block lg:col-span-2 sticky top-24">
          <nav aria-label="Main Navigation" className="space-y-1">
            {leftNavItems.map(item => {
              const Icon = item.icon;
              const isActive = activeNav === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleNavClick(item)}
                  className={`v5-nav-item v5-focus w-full flex items-center gap-3 px-3.5 py-2.5 text-[13.5px] text-left ${
                    isActive ? 'v5-nav-item-active' : ''
                  }`}
                >
                  <Icon
                    className={`h-[17px] w-[17px] flex-shrink-0 ${
                      isActive ? 'text-[#2E6F64]' : 'text-[#5F554F]'
                    }`}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Thin Divider + Subscribed Communities List */}
          <div className="my-5 border-t border-[#1D2729]/8" />

          <div className="px-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8C827A] mb-2.5">
              Communities
            </div>
            <ul className="space-y-1.5 text-xs">
              {DISCOVER_COMMUNITIES.map(comm => (
                <li key={comm.id}>
                  <a
                    href="/communities"
                    className="v5-focus flex items-center justify-between py-1.5 px-2 rounded-lg text-[#5F554F] hover:text-[#1D2729] hover:bg-white/60 transition-colors"
                  >
                    <span className="truncate">c/{comm.slug}</span>
                    <span className="text-[10.5px] text-[#8C827A]">{comm.members}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* ─── CENTER COLUMN: Primary Article Feed (10 cols on lg, 7 on xl) ─ */}
        <main className="lg:col-span-10 xl:col-span-7 min-w-0">
          {/* Category Tabs & Sort Header */}
          <div className="flex items-center justify-between gap-4 border-b border-[#1D2729]/10 pb-0 mb-5">
            <div
              role="tablist"
              aria-label="Feed categories"
              className="flex items-center gap-5 overflow-x-auto no-scrollbar"
            >
              {CATEGORIES.map(category => {
                const isActive = activeCategory === category && activeNav !== 'Bookmarks';
                return (
                  <button
                    key={category}
                    role="tab"
                    aria-selected={isActive}
                    type="button"
                    onClick={() => {
                      setActiveNav(category === 'Following' ? 'Following' : 'Home');
                      setActiveCategory(category);
                      setSelectedTopic(null);
                    }}
                    className={`v5-tab v5-focus pb-3 text-[13.5px] whitespace-nowrap ${
                      isActive ? 'v5-tab-active' : ''
                    }`}
                  >
                    <span>{category}</span>
                    {isActive && <span className="v5-tab-indicator" />}
                  </button>
                );
              })}
            </div>

            {/* Sort Control */}
            <div className="hidden sm:flex items-center gap-1.5 pb-2.5 flex-shrink-0">
              <SlidersHorizontal className="h-3.5 w-3.5 text-[#8C827A]" />
              <select
                aria-label="Sort articles"
                value={sortBy}
                onChange={e => setSortBy(e.target.value as 'trending' | 'latest')}
                className="v5-focus bg-transparent text-xs font-medium text-[#5F554F] hover:text-[#1D2729] cursor-pointer focus:outline-none"
              >
                <option value="trending">Trending</option>
                <option value="latest">Latest</option>
              </select>
            </div>
          </div>

          {/* Active Topic Filter Pill */}
          {selectedTopic && (
            <div className="mb-4 flex items-center justify-between px-3.5 py-2 rounded-xl bg-white border border-[#1D2729]/10 text-xs">
              <span>
                Filtering by topic: <strong className="text-[#2E6F64]">{selectedTopic}</strong>
              </span>
              <button
                type="button"
                onClick={() => setSelectedTopic(null)}
                className="text-[#5F554F] hover:text-[#1D2729] font-medium"
              >
                Clear
              </button>
            </div>
          )}

          {/* Skeleton Loading Demo State (1.5s gentle shimmer) */}
          {isSimulatingSkeleton ? (
            <div className="space-y-3.5" aria-busy="true" aria-label="Loading articles">
              {[1, 2, 3].map(n => (
                <div key={n} className="v5-article-card p-5 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-6 w-6 rounded-full v5-skeleton" />
                    <div className="h-3 w-32 v5-skeleton" />
                    <div className="h-3 w-20 v5-skeleton" />
                  </div>
                  <div className="flex gap-5 justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="h-5 w-3/4 v5-skeleton" />
                      <div className="h-3.5 w-full v5-skeleton" />
                      <div className="h-3.5 w-5/6 v5-skeleton" />
                    </div>
                    <div className="w-[140px] h-[96px] rounded-xl v5-skeleton flex-shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredArticles.length === 0 ? (
            <div className="v5-article-card p-10 text-center space-y-2">
              <h2
                className="text-lg font-bold text-[#1D2729]"
                style={{ fontFamily: 'var(--v5-font-serif)' }}
              >
                {activeNav === 'Bookmarks'
                  ? 'Your reading list is empty'
                  : 'No articles match this filter'}
              </h2>
              <p className="text-xs text-[#5F554F] max-w-sm mx-auto leading-relaxed">
                {activeNav === 'Bookmarks'
                  ? 'Bookmark essays as you browse to save them here for distraction-free reading.'
                  : 'Try switching back to For You or clearing your search query.'}
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveNav('Home');
                    setActiveCategory('For You');
                    setSearchQuery('');
                    setSelectedTopic(null);
                  }}
                  className="v5-btn-secondary px-4 py-2 rounded-full text-xs font-medium"
                >
                  Show all stories
                </button>
              </div>
            </div>
          ) : (
            /* Content-First Article Feed List */
            <div className="space-y-3.5">
              {filteredArticles.map(article => {
                const isUpvoted = !!upvotedIds[article.id];
                const isBookmarked = !!bookmarkedIds[article.id];
                const voteCount = article.votes + (isUpvoted ? 1 : 0);

                return (
                  <article key={article.id} className="v5-article-card p-4 sm:p-5">
                    {/* 1. Author & Community Metadata Header */}
                    <div className="flex items-center justify-between gap-2 text-xs text-[#5F554F] mb-2.5 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        <a
                          href={`/profile/${article.author.handle}`}
                          className="v5-focus flex items-center gap-2 group min-w-0"
                        >
                          <img
                            src={article.author.avatar}
                            alt={article.author.name}
                            loading="lazy"
                            className="h-6 w-6 rounded-full object-cover ring-1 ring-black/5 flex-shrink-0"
                          />
                          <span className="font-semibold text-[#1D2729] group-hover:underline truncate">
                            {article.author.name}
                          </span>
                        </a>

                        {article.author.verified && (
                          <span
                            title="Verified Creator"
                            className="h-3.5 w-3.5 rounded-full bg-[#3F8E80] text-white inline-flex items-center justify-center flex-shrink-0"
                          >
                            <Check className="h-2.5 w-2.5 stroke-[3]" />
                          </span>
                        )}

                        {/* Steemit-inspired Reputation Score Pill */}
                        <span
                          title="Creator Reputation Score"
                          className="px-1.5 py-0.5 rounded bg-[#EFECE6] text-[#5F554F] font-mono text-[10.5px] font-semibold"
                        >
                          ({article.author.reputation})
                        </span>

                        <span className="text-[#8C827A]">in</span>
                        <a
                          href="/communities"
                          className="v5-focus font-medium text-[#2E6F64] hover:underline truncate"
                        >
                          {article.community.name}
                        </a>
                      </div>

                      <div className="flex items-center gap-1.5 text-[11.5px] text-[#8C827A] flex-shrink-0">
                        <span>{article.publishedAgo}</span>
                        <span>·</span>
                        <span>{article.readTime}</span>
                      </div>
                    </div>

                    {/* 2. Main Editorial Content + Thumbnail */}
                    <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <a href={`/story/${article.slug}`} className="v5-focus block group">
                          <h2
                            className="text-[19px] sm:text-[21px] font-bold text-[#1D2729] group-hover:text-[#2E6F64] transition-colors leading-[1.32] tracking-tight"
                            style={{ fontFamily: 'var(--v5-font-serif)' }}
                          >
                            {article.title}
                          </h2>
                        </a>

                        <p className="text-[13.5px] text-[#5F554F] leading-[1.62] mt-1.5 line-clamp-2">
                          {article.excerpt}
                        </p>
                      </div>

                      {article.thumbnail && (
                        <a
                          href={`/story/${article.slug}`}
                          className="v5-focus w-full sm:w-[148px] h-[160px] sm:h-[102px] rounded-xl overflow-hidden flex-shrink-0 bg-[#EFECE6]"
                        >
                          <img
                            src={article.thumbnail}
                            alt={article.title}
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                        </a>
                      )}
                    </div>

                    {/* 3. Footer Engagement & Curation Bar */}
                    <div className="flex items-center justify-between gap-2 pt-3.5 mt-3.5 border-t border-[#1D2729]/6 text-xs text-[#5F554F]">
                      <div className="flex items-center gap-2 sm:gap-3">
                        {/* Upvote Button (160ms max 1.05 scale) */}
                        <button
                          type="button"
                          onClick={() => handleToggleVote(article.id)}
                          aria-pressed={isUpvoted}
                          className={`v5-action-pill v5-focus inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium ${
                            isUpvoted
                              ? 'v5-action-pill-active font-semibold'
                              : 'bg-[#F7F6F2] border-[#1D2729]/10 text-[#1D2729] hover:border-[#1D2729]/25'
                          }`}
                        >
                          <ChevronUp className="h-3.5 w-3.5 stroke-[2.5]" />
                          <span>{voteCount}</span>
                        </button>

                        {/* Comments */}
                        <a
                          href={`/story/${article.slug}#comments`}
                          className="v5-action-pill v5-focus inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full hover:bg-[#F7F6F2] text-[#5F554F] hover:text-[#1D2729]"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          <span>{article.comments}</span>
                        </a>

                        {/* Non-cash Curation Points */}
                        <span
                          title="Community curation points (non-monetary recognition)"
                          className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#EFECE6]/80 text-[#5F554F] text-[11px] font-medium"
                        >
                          <Sparkles className="h-3 w-3 text-[#3F8E80]" />
                          <span>+{article.curationPoints} pts</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-md bg-[#F7F6F2] text-[#5F554F] text-[11px] font-medium hidden sm:inline">
                          {article.category}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleToggleBookmark(article.id)}
                          aria-label={isBookmarked ? 'Remove bookmark' : 'Save bookmark'}
                          className={`v5-action-pill v5-focus p-1.5 rounded-lg border ${
                            isBookmarked
                              ? 'v5-action-pill-active'
                              : 'border-transparent text-[#5F554F] hover:text-[#1D2729] hover:bg-[#F7F6F2]'
                          }`}
                        >
                          <Bookmark className={`h-4 w-4 ${isBookmarked ? 'fill-current' : ''}`} />
                        </button>

                        <button
                          type="button"
                          onClick={() => showToast(`Copied link to "${article.title}"`)}
                          aria-label="Share article"
                          className="v5-action-pill v5-focus p-1.5 rounded-lg text-[#5F554F] hover:text-[#1D2729] hover:bg-[#F7F6F2]"
                        >
                          <Share2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </main>

        {/* ─── RIGHT COLUMN: Clean Discovery Panel (3 cols on xl, hidden on tablet) ─ */}
        <aside className="hidden xl:block xl:col-span-3 sticky top-24 space-y-6">
          {/* 1. Trending Topics (Separated by clean dividers, not heavy boxes) */}
          <section aria-label="Trending Topics">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-[#2E6F64]" />
                <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-[#1D2729]">
                  Trending Topics
                </h2>
              </div>
              <a href="/explore" className="text-[11px] text-[#2E6F64] hover:underline font-medium">
                Explore
              </a>
            </div>

            <div className="divide-y divide-[#1D2729]/8 border-t border-b border-[#1D2729]/8">
              {TRENDING_TOPICS.map(topic => (
                <button
                  key={topic.tag}
                  type="button"
                  onClick={() => setSelectedTopic(topic.tag)}
                  className="v5-focus w-full py-2.5 px-1.5 flex items-center justify-between text-left hover:bg-white/60 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-xs font-mono font-semibold text-[#8C827A] w-4">
                      0{topic.rank}
                    </span>
                    <span className="text-xs font-semibold text-[#1D2729] truncate">
                      {topic.tag}
                    </span>
                  </div>
                  <span className="text-[11px] text-[#8C827A] flex-shrink-0">{topic.posts}</span>
                </button>
              ))}
            </div>
          </section>

          {/* 2. Creator Recommendations */}
          <section aria-label="Recommended Creators">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-[#1D2729]">
                Writers to Follow
              </h2>
              <a
                href="/explore"
                className="text-[11px] text-[#2E6F64] hover:underline font-medium"
              >
                View all
              </a>
            </div>

            <div className="space-y-3">
              {SUGGESTED_CREATORS.map(creator => {
                const isFollowing = !!followedCreators[creator.id];
                return (
                  <div
                    key={creator.id}
                    className="flex items-center justify-between gap-2.5 py-1"
                  >
                    <a
                      href={`/profile/${creator.handle}`}
                      className="v5-focus flex items-center gap-2.5 min-w-0 group"
                    >
                      <img
                        src={creator.avatar}
                        alt={creator.name}
                        loading="lazy"
                        className="h-9 w-9 rounded-full object-cover ring-1 ring-black/5 flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-semibold text-[#1D2729] group-hover:underline truncate">
                            {creator.name}
                          </span>
                          <span className="text-[10px] font-mono text-[#8C827A]">
                            ({creator.reputation})
                          </span>
                        </div>
                        <div className="text-[11px] text-[#5F554F] truncate">{creator.bio}</div>
                      </div>
                    </a>

                    <button
                      type="button"
                      onClick={() => handleToggleFollow(creator.id, creator.name)}
                      className={`v5-focus px-3 py-1 rounded-full text-[11px] font-semibold flex-shrink-0 ${
                        isFollowing ? 'v5-btn-jade' : 'v5-btn-secondary'
                      }`}
                    >
                      {isFollowing ? 'Following' : 'Follow'}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 3. Active Communities */}
          <section aria-label="Communities">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-[#1D2729]">
                Active Communities
              </h2>
              <a
                href="/communities"
                className="text-[11px] text-[#2E6F64] hover:underline font-medium"
              >
                Directory
              </a>
            </div>

            <div className="space-y-2.5">
              {DISCOVER_COMMUNITIES.map(comm => {
                const isJoined = !!joinedCommunities[comm.id];
                return (
                  <div
                    key={comm.id}
                    className="p-3 rounded-xl bg-white/75 border border-[#1D2729]/8 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <a
                        href="/communities"
                        className="v5-focus text-xs font-semibold text-[#1D2729] hover:text-[#2E6F64] truncate block"
                      >
                        {comm.name}
                      </a>
                      <span className="text-[11px] text-[#8C827A]">{comm.members} members</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleCommunity(comm.id, comm.name)}
                      className={`v5-focus px-2.5 py-1 rounded-lg text-[11px] font-semibold flex-shrink-0 ${
                        isJoined
                          ? 'bg-[#EFECE6] text-[#1D2729]'
                          : 'v5-btn-secondary'
                      }`}
                    >
                      {isJoined ? 'Joined' : 'Join'}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Compact Footer Metadata */}
          <footer className="pt-3 border-t border-[#1D2729]/8 text-[11px] text-[#8C827A] space-y-1">
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              <a href="/roadmap" className="hover:text-[#1D2729]">
                Roadmap & Safety
              </a>
              <a href="/communities" className="hover:text-[#1D2729]">
                Curation Rules
              </a>
              <a href="/dev-progress" className="hover:text-[#1D2729]">
                System Status
              </a>
            </div>
            <p>PENORA V5 Candidate · Sample feed preview</p>
          </footer>
        </aside>
      </div>

      {/* Clean Spatial Glass Authentication Modal (Opens on demand, never blocks feed by default) */}
      <SpatialAuthModalV5
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
        onSuccess={() => showToast('Authenticated with Supabase')}
      />

      {/* Subtle Feedback Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 px-3.5 py-2 rounded-xl bg-[#1D2729] text-[#F8F9F8] text-xs font-medium shadow-lg border border-white/15 flex items-center gap-2"
        >
          <Sparkles className="h-3.5 w-3.5 text-[#A7E8DF]" />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
};
