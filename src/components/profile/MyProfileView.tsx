// src/components/profile/MyProfileView.tsx
// PENORA Blockchain — Creator Profile & Dashboard (/profile/me)
// Aligned with the approved PENORA Blockchain Identity System.
import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { getProfileById, updateProfile } from '../../lib/api/profiles';
import { getUserArticles, deletePost } from '../../lib/api/articles';
import { getUserBookmarks } from '../../lib/api/bookmarks';
import { getFollowCounts } from '../../lib/api/follows';
import { SpatialAuthModalV4 } from '../design-v4/SpatialAuthModalV4';
import { PenoraEmblem, PenoraLogo } from '../brand/PenoraLogo';
import { penoraKeyAuth, type PenoraUser } from '../../lib/auth/penoraKeyAuth';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { ProfileRecord, PostRecord, BookmarkRecord } from '../../lib/api/types';
import {
  Mail,
  Calendar,
  ShieldCheck,
  Edit2,
  Check,
  BookOpen,
  Bookmark,
  Users,
  PenLine,
  ArrowRight,
  ExternalLink,
  LogIn,
  Trash2,
  Loader2,
  Key,
} from 'lucide-react';

function emailInitials(email: string): string {
  const local = email.split('@')[0] ?? '';
  const parts = local.split(/[._-]/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return local.slice(0, 2).toUpperCase();
}

export const MyProfileView: React.FC = () => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [keyUser, setKeyUser] = useState<PenoraUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [articles, setArticles] = useState<PostRecord[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkRecord[]>([]);
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 });
  const [activeTab, setActiveTab] = useState<'articles' | 'bookmarks'>('articles');
  const [isPendingMigration, setIsPendingMigration] = useState(false);

  // Auth modal for unauthenticated visitors
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Edit profile state
  const [isEditing, setIsEditing] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDeleteArticle = async (id: string, title: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${title}"?`)) {
      return;
    }
    setDeletingId(id);
    const res = await deletePost(id);
    setDeletingId(null);
    if (res.error) {
      alert(`Failed to delete essay: ${res.error}`);
    } else {
      setArticles(prev => prev.filter(a => a.id !== id));
    }
  };

  useEffect(() => {
    let mounted = true;

    const unsubscribeKeyAuth = penoraKeyAuth.subscribe(ku => {
      if (mounted) {
        setKeyUser(ku);
        if (ku) {
          setLoading(false);
          setEditDisplayName(ku.displayName);
        }
      }
    });

    const loadSessionData = (u: SupabaseUser | null) => {
      setUser(u);
      setLoading(false);
      if (!u) return;

      getProfileById(u.id).then(res => {
        if (res.isPendingMigration) {
          setIsPendingMigration(true);
        } else if (res.data) {
          setProfile(res.data);
          setEditDisplayName(res.data.display_name || '');
          setEditBio(res.data.bio || '');
        }
      });

      getUserArticles(u.id).then(res => {
        if (res.data) setArticles(res.data);
      });

      getUserBookmarks(u.id).then(res => {
        if (res.data) setBookmarks(res.data);
      });

      getFollowCounts(u.id).then(counts => {
        setFollowCounts(counts);
      });
    };

    supabase.auth.getSession().then(({ data }) => {
      loadSessionData(data.session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      loadSessionData(session?.user ?? null);
    });

    return () => {
      mounted = false;
      unsubscribeKeyAuth();
      subscription.unsubscribe();
    };
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeId = keyUser?.id || user?.id;
    if (!activeId) return;
    setSaveStatus('Saving…');

    const res = await updateProfile(activeId, {
      display_name: editDisplayName.trim(),
      bio: editBio.trim(),
    });

    if (res.isPendingMigration) {
      setProfile(prev => ({
        id: activeId,
        username: keyUser?.username || user?.email?.split('@')[0] || 'creator',
        display_name: editDisplayName.trim(),
        bio: editBio.trim(),
        avatar_url: prev?.avatar_url || null,
        reputation: prev?.reputation ?? 25,
        created_at: prev?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
      setSaveStatus('Profile updated locally! Remote profile table migration pending owner approval.');
      setIsEditing(false);
    } else if (res.error) {
      setSaveStatus(`Error: ${res.error}`);
    } else {
      if (res.data) setProfile(res.data);
      setSaveStatus('Profile updated!');
      setIsEditing(false);
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-[#4A5B70]">
          <PenoraEmblem size={44} className="pn-emblem-breathe" />
          <p className="text-xs font-medium">Loading creator profile…</p>
        </div>
      </div>
    );
  }

  const activeCreator = keyUser
    ? {
        id: keyUser.id,
        username: keyUser.username,
        displayName: keyUser.displayName || keyUser.username,
        keyRole: keyUser.keyRole,
        isKeyAuth: true,
      }
    : user
    ? {
        id: user.id,
        username: user.email?.split('@')[0] || 'creator',
        displayName: user.email?.split('@')[0] || 'creator',
        keyRole: 'posting' as const,
        isKeyAuth: false,
      }
    : null;

  // Unauthenticated state — branded Creator Identity Gate instead of jarring blank redirect
  if (!activeCreator) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="pn-card p-8 sm:p-10 text-center space-y-5 relative overflow-hidden">
          <div className="mx-auto w-fit">
            <PenoraLogo variant="stacked" size="md" showTagline={true} />
          </div>
          <div className="space-y-2 max-w-md mx-auto">
            <h1 className="pn-h1 text-2xl sm:text-3xl">Creator Identity & Dashboard</h1>
            <p className="text-xs sm:text-sm text-[#4A5B70] leading-relaxed">
              Sign in or create a PENORA account to manage your public creator profile, track your non-cash reputation score, and view your published essays and saved bookmarks.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setAuthMode('login');
                setAuthModalOpen(true);
              }}
              className="pn-btn pn-btn-brand"
            >
              <LogIn className="h-4 w-4" />
              <span>Sign In to My Profile</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('register');
                setAuthModalOpen(true);
              }}
              className="pn-btn pn-btn-secondary"
            >
              <span>Create Creator Account</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          <div className="pt-4 border-t border-[#0A2540]/8 text-xs text-[#6E7D90]">
            Want to preview a public creator profile?{' '}
            <a href="/profile/erostova" className="font-semibold text-[#007C8B] hover:underline">
              View @erostova’s profile →
            </a>
          </div>
        </div>

        <SpatialAuthModalV4
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          initialMode={authMode}
          presentation="centered-modal"
        />
      </div>
    );
  }

  const joinedDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
    : 'Recent Member';

  const avatarLetters = (activeCreator.displayName || activeCreator.username)
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      {/* Main Profile Header Card */}
      <div className="pn-card p-6 sm:p-8 relative overflow-hidden">
        {/* Top signature gradient hairline */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-1"
          style={{ background: 'var(--pn-gradient)' }}
        />

        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 relative z-10">
          {/* Avatar with Signature Teal Gradient Ring */}
          <div className="pn-avatar-ring flex-shrink-0">
            <div className="h-24 w-24 rounded-full bg-[#0A2540] text-white text-3xl font-bold flex items-center justify-center">
              {avatarLetters}
            </div>
          </div>

          {/* User Info */}
          <div className="flex-1 text-center sm:text-left min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <h1 className="pn-h1 text-2xl sm:text-3xl">
                    {profile?.display_name || activeCreator.displayName}
                  </h1>
                  <span className="pn-tag">Rep 25</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#007C8B]/10 text-[#007C8B] border border-[#007C8B]/20">
                    {activeCreator.keyRole} KEY
                  </span>
                </div>
                <p className="text-xs text-[#6E7D90] mt-0.5">@{activeCreator.username}</p>
              </div>

              <div className="flex items-center justify-center sm:justify-start gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(v => !v)}
                  className="pn-btn pn-btn-secondary pn-btn-sm"
                >
                  <Edit2 className="h-3.5 w-3.5 text-[#007C8B]" />
                  <span>{isEditing ? 'Cancel' : 'Edit Profile'}</span>
                </button>
                <a href="/editor" className="pn-btn pn-btn-primary pn-btn-sm">
                  <PenLine className="h-3.5 w-3.5 text-[#00E5F4]" />
                  <span>New Essay</span>
                </a>
              </div>
            </div>

            {/* Bio */}
            <p className="text-xs sm:text-sm text-[#4A5B70] leading-relaxed mt-3 max-w-xl">
              {profile?.bio ||
                'Creator on PENORA Blockchain. Publishing longform essays, curating domain guilds, and building verifiable creator reputation.'}
            </p>

            {/* Stats Row */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-5 pt-4 mt-4 border-t border-[#0A2540]/8 text-xs text-[#4A5B70]">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-[#007C8B]" />
                <span>
                  Reputation: <strong className="text-[#0A2540]">25</strong>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-[#007C8B]" />
                <span>
                  <strong className="text-[#0A2540]">{followCounts.followers}</strong> Followers
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-[#007C8B]" />
                <span>
                  Joined <strong className="text-[#0A2540]">{joinedDate}</strong>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Key className="h-4 w-4 text-[#007C8B]" />
                <span className="text-[#007C8B] font-semibold">
                  Key Authority Active
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Inline Profile Editing Form */}
        {isEditing && (
          <form onSubmit={handleSaveProfile} className="mt-6 pt-6 border-t border-[#0A2540]/10 space-y-4">
            <h3 className="pn-label">Edit Public Creator Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="pn-field-label">Display Name</label>
                <input
                  type="text"
                  value={editDisplayName}
                  onChange={e => setEditDisplayName(e.target.value)}
                  placeholder="Your display name"
                  className="pn-input"
                />
              </div>
              <div>
                <label className="pn-field-label">Short Bio</label>
                <input
                  type="text"
                  value={editBio}
                  onChange={e => setEditBio(e.target.value)}
                  placeholder="Tell readers about your focus..."
                  className="pn-input"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <button type="submit" className="pn-btn pn-btn-brand pn-btn-sm">
                <Check className="h-3.5 w-3.5" />
                <span>Save Changes</span>
              </button>
              {saveStatus && <span className="text-xs text-[#4A5B70]">{saveStatus}</span>}
            </div>
          </form>
        )}
      </div>

      {/* Tabs: Published Articles & Saved Bookmarks */}
      <div className="pn-tabs w-fit" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'articles'}
          onClick={() => setActiveTab('articles')}
          className="pn-tab flex items-center gap-2"
        >
          <BookOpen className="h-3.5 w-3.5" />
          <span>Published Essays ({articles.length})</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'bookmarks'}
          onClick={() => setActiveTab('bookmarks')}
          className="pn-tab flex items-center gap-2"
        >
          <Bookmark className="h-3.5 w-3.5" />
          <span>Saved Bookmarks ({bookmarks.length})</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'articles' ? (
        articles.length === 0 ? (
          <div className="pn-card p-8 text-center space-y-3">
            <div className="mx-auto w-fit">
              <PenoraLogo variant="app-icon" size="sm" />
            </div>
            <h3 className="pn-h2">No published essays yet</h3>
            <p className="text-xs text-[#4A5B70] max-w-sm mx-auto leading-relaxed">
              Publish your first longform essay in the PENORA Article Studio to begin building verifiable creator reputation.
            </p>
            <div className="pt-1">
              <a href="/editor" className="pn-btn pn-btn-brand pn-btn-sm">
                <span>Write Your First Essay</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {articles.map(article => (
              <div
                key={article.id}
                className="pn-card pn-card-interactive p-5 flex flex-col sm:flex-row items-start justify-between gap-4"
              >
                <div>
                  <div className="pn-meta uppercase tracking-wider mb-1">
                    {new Date(article.created_at).toLocaleDateString()} ·{' '}
                    {article.published ? 'Published' : 'Draft'}
                  </div>
                  <a href={`/story/${article.slug}`}>
                    <h3 className="pn-h2 hover:text-[#007C8B] transition-colors">{article.title}</h3>
                  </a>
                  <p className="text-xs text-[#4A5B70] mt-1 line-clamp-2">{article.excerpt}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <a
                    href={`/story/${article.slug}`}
                    className="pn-btn pn-btn-secondary pn-btn-sm"
                  >
                    <span>Read</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <button
                    type="button"
                    onClick={() => handleDeleteArticle(article.id, article.title)}
                    disabled={deletingId === article.id}
                    className="pn-btn pn-btn-secondary pn-btn-sm text-[#D93838] hover:bg-[#D93838]/10 hover:border-[#D93838]/30"
                    title="Delete essay"
                  >
                    {deletingId === article.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : bookmarks.length === 0 ? (
        <div className="pn-card p-8 text-center space-y-3">
          <Bookmark className="h-8 w-8 text-[#007C8B] mx-auto" />
          <h3 className="pn-h2">No saved bookmarks</h3>
          <p className="text-xs text-[#4A5B70] max-w-sm mx-auto leading-relaxed">
            Bookmark essays from the feed to curate your personal reading archive.
          </p>
          <div className="pt-1">
            <a href="/" className="pn-btn pn-btn-secondary pn-btn-sm">
              <span>Explore Home Feed</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {bookmarks.map(bm => (
            <div
              key={bm.post_id}
              className="pn-card pn-card-interactive p-5 flex items-center justify-between gap-4"
            >
              <div>
                <a href={`/story/${bm.post?.slug || bm.post_id}`}>
                  <h3 className="pn-h3 hover:text-[#007C8B] transition-colors">
                    {bm.post?.title || 'Saved Essay'}
                  </h3>
                </a>
                <p className="text-xs text-[#4A5B70] mt-0.5 line-clamp-1">{bm.post?.excerpt}</p>
              </div>
              <a
                href={`/story/${bm.post?.slug || bm.post_id}`}
                className="pn-btn pn-btn-secondary pn-btn-sm flex-shrink-0"
              >
                <span>Read</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          ))}
        </div>
      )}

      {isPendingMigration && (
        <div className="pn-alert pn-alert-info">
          <ShieldCheck className="h-4 w-4 text-[#007C8B] flex-shrink-0 mt-0.5" />
          <span>
            Authenticated via Supabase Auth. Remote profile and article tables are staged and ready for owner migration approval.
          </span>
        </div>
      )}
    </div>
  );
};
