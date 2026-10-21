// src/components/communities/CommunitiesView.tsx
// PENORA Blockchain Brand Suite & UI/UX System
// Wired to real Supabase Auth and Communities API.
import React, { useState, useEffect, useRef } from 'react';
import type { Community, Article, Topic } from '../../types';
import {
  Users,
  Search,
  BookOpen,
  Plus,
  Check,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { getCommunities, joinCommunity, leaveCommunity, isCommunityMember } from '../../lib/api/communities';
import { SpatialAuthModalV4 } from '../design-v4/SpatialAuthModalV4';
import { penoraKeyAuth, type PenoraUser } from '../../lib/auth/penoraKeyAuth';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { CommunityRecord } from '../../lib/api/types';

interface CommunitiesViewProps {
  communities: Community[];
  articles: Article[];
  topics: Topic[];
}

export const CommunitiesView: React.FC<CommunitiesViewProps> = ({
  communities: fallbackCommunities,
}) => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [keyUser, setKeyUser] = useState<PenoraUser | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [communities, setCommunities] = useState<Community[]>(fallbackCommunities);
  const [joinedMap, setJoinedMap] = useState<Record<string, boolean>>({});
  const [membershipError, setMembershipError] = useState<string | null>(null);
  const pendingJoins = useRef(new Set<string>());
  const identity = useRef<string | undefined>(undefined);
  identity.current = keyUser?.id || user?.id;

  useEffect(() => {
    const unsubKey = penoraKeyAuth.subscribe(ku => setKeyUser(ku));
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    // Hydrate real communities from Supabase
    getCommunities().then(res => {
      if (res.data && res.data.length > 0) {
        const mapped: Community[] = res.data.map((c: CommunityRecord) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description || '',
          avatar: c.avatar_url || '',
          subscriberCount: 0,
          activePostsCount: 0,
          isSubscribed: false,
        }));
        setCommunities(mapped);
      }
    });

    return () => {
      unsubKey();
      subscription.unsubscribe();
    };
  }, []);

  // Hydrate join status for current user
  useEffect(() => {
    let active = true;
    setJoinedMap({});
    setMembershipError(null);
    const activeUserId = keyUser?.id || user?.id;
    if (!activeUserId) return;

    communities.forEach(c => {
      isCommunityMember(activeUserId, c.id).then(joined => {
        if (active && joined) {
          setJoinedMap(prev => ({ ...prev, [c.id]: true }));
        }
      });
    });
    return () => { active = false; };
  }, [keyUser, user, communities]);

  const handleToggleJoin = async (communityId: string) => {
    const activeUserId = keyUser?.id || user?.id;
    if (!activeUserId) {
      setAuthModalOpen(true);
      return;
    }
    const operation = `${activeUserId}:${communityId}`;
    if (pendingJoins.current.has(operation)) return;
    pendingJoins.current.add(operation);
    setMembershipError(null);

    const isJoined = Boolean(joinedMap[communityId]);
    setJoinedMap(prev => ({ ...prev, [communityId]: !isJoined }));

    try {
      const result = isJoined ? await leaveCommunity(activeUserId, communityId) : await joinCommunity(activeUserId, communityId);
      if (identity.current !== activeUserId) return;
      if (!result.success) {
        setJoinedMap(prev => ({ ...prev, [communityId]: isJoined }));
        setMembershipError(result.error || 'Membership could not be saved. Please retry.');
      }
    } catch {
      if (identity.current === activeUserId) {
        setJoinedMap(prev => ({ ...prev, [communityId]: isJoined }));
        setMembershipError('Membership could not be saved. Please retry.');
      }
    } finally { pendingJoins.current.delete(operation); }
  };

  const filtered = communities.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-10">
      {membershipError && <p role="alert" className="text-sm text-red-700 p-3 rounded-xl bg-red-50">{membershipError}</p>}
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <span className="pn-tag">
          Creator Guilds & Circles
        </span>
        <h1 className="font-display text-3xl sm:text-5xl font-bold text-[#0A2540] tracking-tight">
          Communities on PENORA
        </h1>
        <p className="text-xs sm:text-sm text-[#4A5E75] leading-relaxed">
          Self-governing publishing circles. Join communities to discover focused perspectives and contribute to collective curation.
        </p>

        {/* Search */}
        <div className="pt-4 max-w-md mx-auto">
          <div className="pn-search rounded-full h-11 px-4 flex items-center gap-3">
            <Search className="h-4 w-4 text-[#4A5E75] flex-shrink-0" />
            <input
              type="search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search guilds by name or topic..."
              className="w-full bg-transparent text-xs text-[#0A2540] placeholder:text-[#7B8FA6] focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(community => {
          const isJoined = joinedMap[community.id];

          return (
            <div
              key={community.id}
              className="pn-card pn-card-interactive p-6 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <img
                    src={community.avatar}
                    alt={community.name}
                    className="h-12 w-12 rounded-2xl object-cover ring-2 ring-white shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => handleToggleJoin(community.id)}
                    className={`pn-btn px-3.5 py-1.5 rounded-full text-xs ${
                      isJoined
                        ? 'pn-btn-secondary'
                        : 'pn-btn-brand'
                    }`}
                  >
                    {isJoined ? 'Joined' : '+ Join Guild'}
                  </button>
                </div>

                <h3 className="font-display text-lg font-bold text-[#0A2540] mb-1.5 leading-snug">
                  {community.name}
                </h3>
                <p className="text-xs text-[#4A5E75] leading-relaxed line-clamp-3 mb-6">
                  {community.description}
                </p>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[#0A2540]/8 text-xs text-[#4A5E75]">
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-[#007C8B]" />
                  <span>{community.subscriberCount.toLocaleString()} members</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5 text-[#007C8B]" />
                  <span>{community.activePostsCount} blogs</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Auth Modal */}
      <SpatialAuthModalV4
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode="login"
        presentation="centered-modal"
      />
    </div>
  );
};
