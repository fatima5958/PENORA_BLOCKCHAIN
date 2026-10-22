// src/components/notifications/NotificationsView.tsx
// PENORA — Premium Notifications Center
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Bell,
  CheckCheck,
  RotateCw,
  Heart,
  MessageCircle,
  UserPlus,
  AtSign,
  ArrowRight,
  ExternalLink,
  ShieldAlert,
  Sparkles,
  Check,
  Filter,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { penoraKeyAuth, type PenoraUser } from '../../lib/auth/penoraKeyAuth';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import {
  fetchUserNotifications,
  getReadNotificationIds,
  saveReadNotificationIds,
  type NotificationItem,
  type NotificationType,
} from '../../lib/api/notifications';

function formatRelativeTime(dateString: string): string {
  try {
    const now = Date.now();
    const then = new Date(dateString).getTime();
    const diffSec = Math.floor((now - then) / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h ago`;
    const diffDays = Math.floor(diffHour / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(dateString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return 'Recently';
  }
}

function getTimeGroup(dateString: string): string {
  try {
    const now = new Date();
    const then = new Date(dateString);
    const diffMs = now.getTime() - then.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0 && now.getDate() === then.getDate()) return 'Today';
    if (diffDays <= 1) return 'Yesterday';
    if (diffDays <= 7) return 'This Week';
    return 'Older';
  } catch {
    return 'Earlier';
  }
}

export const NotificationsView: React.FC = () => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [keyUser, setKeyUser] = useState<PenoraUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterMode, setFilterMode] = useState<'all' | 'unread'>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | NotificationType>('all');

  const activeUserId = user?.id || keyUser?.id || null;
  const activeUsername = keyUser?.username || user?.email?.split('@')[0] || '';

  // Listen to auth
  useEffect(() => {
    let mounted = true;
    const unsubKey = penoraKeyAuth.subscribe(ku => {
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

    return () => {
      mounted = false;
      unsubKey();
      subscription.unsubscribe();
    };
  }, []);

  // Fetch notifications
  const loadNotifications = useCallback(async (isRefresh = false) => {
    if (!activeUserId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    const res = await fetchUserNotifications(activeUserId, activeUsername);
    if (res.error) {
      setError(res.error);
    } else {
      setNotifications(res.data);
    }

    setLoading(false);
    setRefreshing(false);
  }, [activeUserId, activeUsername]);

  useEffect(() => {
    if (!authLoading && activeUserId) {
      loadNotifications();
    } else if (!authLoading && !activeUserId) {
      setLoading(false);
    }
  }, [authLoading, activeUserId, loadNotifications]);

  // Read status handlers
  const markAsRead = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!activeUserId) return;

    setNotifications(prev => {
      const updated = prev.map(n => (n.id === id ? { ...n, read: true } : n));
      const readSet = getReadNotificationIds(activeUserId);
      readSet.add(id);
      saveReadNotificationIds(activeUserId, readSet);
      return updated;
    });
  };

  const toggleReadStatus = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeUserId) return;

    setNotifications(prev => {
      const target = prev.find(n => n.id === id);
      if (!target) return prev;
      const nextRead = !target.read;
      const readSet = getReadNotificationIds(activeUserId);
      if (nextRead) readSet.add(id);
      else readSet.delete(id);
      saveReadNotificationIds(activeUserId, readSet);

      return prev.map(n => (n.id === id ? { ...n, read: nextRead } : n));
    });
  };

  const markAllAsRead = () => {
    if (!activeUserId || notifications.length === 0) return;
    const readSet = getReadNotificationIds(activeUserId);
    notifications.forEach(n => readSet.add(n.id));
    saveReadNotificationIds(activeUserId, readSet);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleOpenAuth = () => {
    window.dispatchEvent(new CustomEvent('penora:open-auth', { detail: { mode: 'login' } }));
  };

  // Filtered counts
  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.read).length;
  }, [notifications]);

  // Filtered notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter(item => {
      if (filterMode === 'unread' && item.read) return false;
      if (categoryFilter !== 'all' && item.type !== categoryFilter) return false;
      return true;
    });
  }, [notifications, filterMode, categoryFilter]);

  // Grouped by time
  const groupedNotifications = useMemo(() => {
    const groups: Record<string, NotificationItem[]> = {
      Today: [],
      Yesterday: [],
      'This Week': [],
      Older: [],
    };

    filteredNotifications.forEach(item => {
      const grp = getTimeGroup(item.createdAt);
      if (!groups[grp]) groups[grp] = [];
      groups[grp].push(item);
    });

    return Object.entries(groups).filter(([_, items]) => items.length > 0);
  }, [filteredNotifications]);

  // Type-specific icon and accent styling
  const renderTypeBadge = (type: NotificationType) => {
    switch (type) {
      case 'upvote':
        return (
          <span className="h-8 w-8 rounded-full flex items-center justify-center bg-rose-500/10 text-rose-500 border border-rose-500/20 shrink-0">
            <Heart className="h-4 w-4 fill-rose-500" />
          </span>
        );
      case 'comment':
        return (
          <span className="h-8 w-8 rounded-full flex items-center justify-center bg-[#007C8B]/10 text-[#007C8B] border border-[#007C8B]/20 shrink-0">
            <MessageCircle className="h-4 w-4" />
          </span>
        );
      case 'follow':
        return (
          <span className="h-8 w-8 rounded-full flex items-center justify-center bg-[#00E5F4]/15 text-[#007C8B] border border-[#00E5F4]/30 shrink-0">
            <UserPlus className="h-4 w-4" />
          </span>
        );
      case 'mention':
        return (
          <span className="h-8 w-8 rounded-full flex items-center justify-center bg-amber-500/10 text-amber-600 border border-amber-500/20 shrink-0">
            <AtSign className="h-4 w-4" />
          </span>
        );
      default:
        return (
          <span className="h-8 w-8 rounded-full flex items-center justify-center bg-[#0A2540]/10 text-[#0A2540] shrink-0">
            <Bell className="h-4 w-4" />
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* ─── 1. TOP HEADER & CONTROLS ────────────────────────────────────── */}
      <div className="pn-panel p-4 sm:p-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center justify-between sm:justify-start gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#007C8B]/10 text-[#007C8B] border border-[#007C8B]/20">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-base sm:text-lg font-bold text-[#0A2540]">
                Notifications
              </h1>
              <p className="text-[11px] text-[#52657C] hidden sm:block">
                Peer interactions, upvotes, responses, and follows
              </p>
            </div>
          </div>

          {unreadCount > 0 ? (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#00E5F4]/20 text-[#007C8B] border border-[#00E5F4]/40 animate-pulse">
              {unreadCount} unread
            </span>
          ) : (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#0A2540]/5 text-[#52657C]">
              All caught up
            </span>
          )}
        </div>

        {/* Global Actions */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => loadNotifications(true)}
            disabled={refreshing || loading}
            className="pn-btn pn-btn-secondary pn-btn-sm h-8 px-2.5"
            title="Refresh notifications"
          >
            <RotateCw className={`h-3.5 w-3.5 text-[#52657C] ${refreshing ? 'animate-spin text-[#007C8B]' : ''}`} />
            <span className="hidden sm:inline text-xs">Refresh</span>
          </button>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllAsRead}
              className="pn-btn pn-btn-secondary pn-btn-sm h-8 px-3 text-xs font-medium text-[#007C8B] hover:text-[#0A2540]"
              title="Mark all notifications as read"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              <span>Mark all read</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── 2. FILTERS BAR ──────────────────────────────────────────────── */}
      {activeUserId && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-white/70 backdrop-blur-md p-2 rounded-2xl border border-[#0A2540]/8">
          {/* Segmented Filter: All vs Unread */}
          <div className="flex items-center p-1 rounded-xl bg-[#F0F5F8] border border-[#0A2540]/5 text-xs font-medium w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`flex-1 sm:flex-initial px-3 py-1 rounded-lg transition-colors ${
                filterMode === 'all'
                  ? 'bg-white text-[#0A2540] font-bold shadow-xs'
                  : 'text-[#52657C] hover:text-[#0A2540]'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('unread')}
              className={`flex-1 sm:flex-initial px-3 py-1 rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                filterMode === 'unread'
                  ? 'bg-white text-[#007C8B] font-bold shadow-xs'
                  : 'text-[#52657C] hover:text-[#0A2540]'
              }`}
            >
              <span>Unread</span>
              {unreadCount > 0 && (
                <span className="h-4 min-w-4 px-1 rounded-full text-[10px] font-bold bg-[#00E5F4] text-[#0A2540] flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>

          {/* Type Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {(['all', 'upvote', 'comment', 'follow'] as const).map(cat => {
              const label =
                cat === 'all'
                  ? 'All Types'
                  : cat === 'upvote'
                  ? 'Upvotes'
                  : cat === 'comment'
                  ? 'Comments'
                  : 'Follows';
              const active = categoryFilter === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    active
                      ? 'bg-[#007C8B] text-white shadow-xs'
                      : 'bg-transparent text-[#52657C] hover:text-[#0A2540] hover:bg-black/5'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── 3. CONTENT AREA ─────────────────────────────────────────────── */}
      {!activeUserId && !authLoading ? (
        /* Guest State */
        <div className="pn-card p-8 sm:p-12 text-center space-y-4">
          <div className="h-14 w-14 rounded-2xl bg-[#00E5F4]/15 text-[#007C8B] flex items-center justify-center mx-auto border border-[#007C8B]/20">
            <Bell className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <h2 className="font-serif text-lg sm:text-xl font-bold text-[#0A2540]">
              Sign in to see your notifications
            </h2>
            <p className="text-xs sm:text-sm text-[#52657C] max-w-md mx-auto leading-relaxed">
              Log in with your PENORA Private Posting Key or account email to track upvotes, comments, mentions, and new followers in real time.
            </p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={handleOpenAuth}
              className="pn-btn pn-btn-brand pn-btn-md sm:px-6"
            >
              <span>Sign In with Private Key</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : loading ? (
        /* Loading Skeleton */
        <div className="space-y-3">
          {[1, 2, 3, 4].map(idx => (
            <div key={idx} className="pn-card p-4 flex items-center gap-3.5 animate-pulse">
              <div className="h-10 w-10 rounded-full bg-[#0A2540]/10 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 bg-[#0A2540]/10 rounded-md w-3/4" />
                <div className="h-3 bg-[#0A2540]/6 rounded-md w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        /* Error State */
        <div className="pn-alert pn-alert-error">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <div className="flex-1 text-xs">{error}</div>
          <button
            type="button"
            onClick={() => loadNotifications(true)}
            className="pn-btn pn-btn-secondary pn-btn-sm text-xs"
          >
            Retry
          </button>
        </div>
      ) : filteredNotifications.length === 0 ? (
        /* Empty State */
        <div className="pn-card p-10 text-center space-y-3">
          <div className="h-12 w-12 rounded-2xl bg-[#00E5F4]/15 text-[#007C8B] flex items-center justify-center mx-auto border border-[#007C8B]/20">
            <Sparkles className="h-6 w-6" />
          </div>
          <h2 className="font-serif text-base sm:text-lg font-bold text-[#0A2540]">
            {filterMode === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          </h2>
          <p className="text-xs sm:text-sm text-[#52657C] max-w-sm mx-auto leading-relaxed">
            {filterMode === 'unread'
              ? 'You have viewed all recent activity on your blogs and creator profile.'
              : 'When creators upvote your blogs, leave perspectives, or follow your publications, alerts will appear here.'}
          </p>
          <div className="pt-2 flex items-center justify-center gap-3 flex-wrap">
            {filterMode === 'unread' ? (
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className="pn-btn pn-btn-secondary pn-btn-sm"
              >
                View all past notifications
              </button>
            ) : (
              <>
                <a href="/" className="pn-btn pn-btn-secondary pn-btn-sm">
                  <span>Explore Feed</span>
                </a>
                <a href="/editor" className="pn-btn pn-btn-brand pn-btn-sm">
                  <span>Write a Blog</span>
                  <ArrowRight className="h-3 w-3" />
                </a>
              </>
            )}
          </div>
        </div>
      ) : (
        /* Grouped Notification Feed */
        <div className="space-y-6">
          {groupedNotifications.map(([groupName, items]) => (
            <section key={groupName} className="space-y-2.5">
              <div className="flex items-center gap-2 px-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#52657C]">
                  {groupName}
                </span>
                <div className="h-px flex-1 bg-[#0A2540]/8" />
              </div>

              <div className="space-y-2">
                {items.map(item => {
                  const initial = (item.actor.displayName || item.actor.username || 'P')[0].toUpperCase();
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        markAsRead(item.id);
                        if (item.link) window.location.href = item.link;
                      }}
                      className={`pn-card p-3.5 sm:p-4 transition-all duration-200 cursor-pointer flex items-start gap-3 sm:gap-3.5 group relative hover:border-[#007C8B]/40 hover:shadow-sm ${
                        !item.read
                          ? 'bg-gradient-to-r from-white via-white to-[#00E5F4]/5 border-[#007C8B]/25'
                          : 'bg-white/80'
                      }`}
                    >
                      {/* Unread Accent Indicator */}
                      {!item.read && (
                        <span
                          className="absolute left-1.5 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-[#00E5F4] shadow-[0_0_8px_#00E5F4]"
                          title="Unread notification"
                        />
                      )}

                      {/* Left: Type Badge & Actor Avatar */}
                      <div className="relative shrink-0 ml-1">
                        {item.actor.avatarUrl ? (
                          <img
                            src={item.actor.avatarUrl}
                            alt={item.actor.displayName}
                            className="h-10 w-10 rounded-full object-cover border border-[#0A2540]/10"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#0A2540] to-[#007C8B] text-white font-bold text-xs flex items-center justify-center shadow-xs">
                            {initial}
                          </div>
                        )}
                        <div className="absolute -bottom-1 -right-1 scale-75 origin-bottom-right">
                          {renderTypeBadge(item.type)}
                        </div>
                      </div>

                      {/* Center: Notification Description */}
                      <div className="flex-1 min-w-0 pr-1">
                        <div className="text-xs sm:text-sm text-[#0A2540] leading-snug">
                          <a
                            href={`/profile/${item.actor.username}`}
                            onClick={e => e.stopPropagation()}
                            className="font-bold hover:text-[#007C8B] hover:underline"
                          >
                            {item.actor.displayName}
                          </a>{' '}
                          <span className="text-[#52657C]">@{item.actor.username}</span>{' '}
                          {item.type === 'upvote' && (
                            <span>
                              upvoted your blog{' '}
                              <strong className="font-semibold text-[#0A2540]">
                                &ldquo;{item.target?.title || 'your blog'}&rdquo;
                              </strong>
                            </span>
                          )}
                          {item.type === 'comment' && (
                            <span>
                              commented on{' '}
                              <strong className="font-semibold text-[#0A2540]">
                                &ldquo;{item.target?.title || 'your blog'}&rdquo;
                              </strong>
                            </span>
                          )}
                          {item.type === 'follow' && (
                            <span>started following your publications.</span>
                          )}
                          {item.type === 'mention' && (
                            <span>mentioned you in a perspective response.</span>
                          )}
                        </div>

                        {/* Optional Comment excerpt preview */}
                        {item.target?.commentBody && (
                          <div className="mt-1.5 p-2 rounded-xl bg-[#F4F7FA] text-xs text-[#4A5B70] italic line-clamp-2 border border-[#0A2540]/5">
                            &ldquo;{item.target.commentBody}&rdquo;
                          </div>
                        )}

                        <div className="mt-1 flex items-center gap-2 text-[11px] text-[#52657C]">
                          <span>{formatRelativeTime(item.createdAt)}</span>
                          <span>·</span>
                          <span className="text-[#007C8B] group-hover:underline flex items-center gap-0.5">
                            <span>Open</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </span>
                        </div>
                      </div>

                      {/* Right: Quick Read/Unread Toggle */}
                      <button
                        type="button"
                        onClick={e => toggleReadStatus(item.id, e)}
                        className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                          item.read
                            ? 'text-[#A0AEC0] hover:text-[#007C8B] hover:bg-[#F0F5F8]'
                            : 'text-[#007C8B] hover:text-[#0A2540] hover:bg-[#E0FAFC]'
                        }`}
                        title={item.read ? 'Mark as unread' : 'Mark as read'}
                        aria-label={item.read ? 'Mark as unread' : 'Mark as read'}
                      >
                        <Check className={`h-3.5 w-3.5 ${item.read ? 'opacity-40' : 'stroke-[2.5]'}`} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
