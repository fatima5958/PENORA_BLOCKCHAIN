// src/components/profile/MyProfileView.tsx
// PENORA Blockchain — Creator Profile & Dashboard (/profile/me)
// Uses the unified Creator Profile V7 layout matching the approved visual reference.
import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { getProfileById } from '../../lib/api/profiles';
import { getUserArticles } from '../../lib/api/articles';
import { getFollowCounts } from '../../lib/api/follows';
import { penoraKeyAuth, type PenoraUser } from '../../lib/auth/penoraKeyAuth';
import { CreatorProfileV7 } from './CreatorProfileV7';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { ProfileRecord, PostRecord } from '../../lib/api/types';
import type { Author } from '../../types';

export const MyProfileView: React.FC = () => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [keyUser, setKeyUser] = useState<PenoraUser | null>(() => penoraKeyAuth.getCurrentUser());
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileRecord | null>(() => {
    if (typeof window !== 'undefined') {
      const ku = penoraKeyAuth.getCurrentUser();
      if (ku?.id) {
        try {
          const cached = localStorage.getItem(`penora_cached_profile_${ku.id}`);
          if (cached) return JSON.parse(cached);
        } catch {}
      }
    }
    return null;
  });
  const [articles, setArticles] = useState<PostRecord[]>([]);
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 });

  useEffect(() => {
    let mounted = true;
    let loadVersion = 0;

    // Listen for live profile updates
    const handleProfileUpdated = (e: Event) => {
      const ce = e as CustomEvent<{
        avatar_url?: string;
        display_name?: string;
        bio?: string;
        location?: string;
        website?: string;
        interests?: string[];
      }>;
      if (ce.detail) {
        setProfile(prev => ({
          ...(prev || {
            id: keyUser?.id || user?.id || '',
            username: keyUser?.username || user?.email?.split('@')[0] || 'creator',
            reputation: 0,
            created_at: new Date().toISOString(),
          }),
          ...(ce.detail.display_name !== undefined && { display_name: ce.detail.display_name }),
          ...(ce.detail.bio !== undefined && { bio: ce.detail.bio }),
          ...(ce.detail.avatar_url !== undefined && { avatar_url: ce.detail.avatar_url }),
          ...(ce.detail.location !== undefined && { location: ce.detail.location }),
          ...(ce.detail.website !== undefined && { website: ce.detail.website }),
          ...(ce.detail.interests !== undefined && { interests: ce.detail.interests }),
        }));
      }
    };
    window.addEventListener('penora:profile-updated', handleProfileUpdated);

    // 1. Listen for Steemit-style key session changes
    const unsubKey = penoraKeyAuth.subscribe(kUser => {
      setKeyUser(kUser);
      loadUserData(null, kUser);
    });

    // 2. Fetch current Supabase auth session
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const sessionUser = data.session?.user ?? null;
      setUser(sessionUser);
      loadUserData(sessionUser, penoraKeyAuth.getCurrentUser());
    });

    // 3. Listen for Supabase auth state transitions
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      loadUserData(nextUser, penoraKeyAuth.getCurrentUser());
    });

    async function loadUserData(sUser: SupabaseUser | null, kUser: PenoraUser | null) {
      const version = ++loadVersion;
      setProfile(null);
      setArticles([]);
      setFollowCounts({ followers: 0, following: 0 });
      const activeId = kUser?.id || sUser?.id;
      if (!activeId) {
        if (mounted) setLoading(false);
        return;
      }
      setLoading(true);

      // Check localStorage cache first
      if (typeof window !== 'undefined') {
        try {
          const cached = localStorage.getItem(`penora_cached_profile_${activeId}`);
          if (cached && mounted) {
            setProfile(JSON.parse(cached));
          }
        } catch {}
      }

      try {
        const [profRes, artRes, fc] = await Promise.all([
          getProfileById(activeId),
          getUserArticles(activeId),
          getFollowCounts(activeId),
        ]);

        if (mounted && version === loadVersion) {
          if (profRes.data) {
            setProfile(profRes.data);
          }
          if (artRes.data) setArticles(artRes.data);
          setFollowCounts({
            followers: fc.followers ?? 0,
            following: fc.following ?? 0,
          });
        }
      } catch (err) {
        console.error('Failed to load profile data:', err);
      } finally {
        if (mounted && version === loadVersion) setLoading(false);
      }
    }

    return () => {
      mounted = false;
      unsubKey();
      subscription.unsubscribe();
      window.removeEventListener('penora:profile-updated', handleProfileUpdated);
    };
  }, []);

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
        username: user.email?.split('@')[0] || 'mateenwrites',
        displayName: user.email?.split('@')[0] || 'Mateen Fatima',
        keyRole: 'posting' as const,
        isKeyAuth: false,
      }
    : null;

  const joinedDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
    : 'Oct 2026';

  const ownerAuthor: Author = {
    id: activeCreator?.id || 'mateenfatima',
    name: profile?.display_name || activeCreator?.displayName || 'Mateen Fatima',
    handle: activeCreator?.username || 'mateenwrites',
    avatar: profile?.avatar_url || '/brand/penora-avatar-mateen.jpg',
    coverImage: profile?.cover_url || '/brand/penora-celestial-cover-default.jpg',
    bio:
      profile?.bio ||
      'Building PENORA for a fairer internet where creators truly own their content. Sharing my learning journey, real experiences and small wins ♡',
    location: profile?.location || 'Lahore, Pakistan',
    website: profile?.website || '',
    interests: profile?.interests && profile.interests.length > 0 ? profile.interests : ['Writing', 'Tech', 'Faith', 'Productivity', 'Onchain'],
    reputationScore: profile?.reputation ?? 25,
    joinedDate: joinedDate,
    role: 'Creator',
    followersCount: followCounts.followers,
    followingCount: followCounts.following,
    postsCount: articles.length || 28,
  };

  return (
    <CreatorProfileV7
      author={ownerAuthor}
      isOwnerView={Boolean(activeCreator)}
    />
  );
};
