// src/lib/api/notifications.ts
// PENORA — Premium Notifications Service
import { supabase } from '../supabaseClient';

export type NotificationType = 'upvote' | 'comment' | 'follow' | 'mention' | 'reblog';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  actor: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
  };
  target?: {
    postId?: string;
    title?: string;
    slug?: string;
    commentId?: string;
    commentBody?: string;
  };
  createdAt: string;
  read: boolean;
  link: string;
}

const READ_NOTIFICATIONS_PREFIX = 'penora_read_notifications_v1_';

export function getReadNotificationIds(userId: string): Set<string> {
  if (typeof window === 'undefined' || !window.localStorage || !userId) return new Set();
  try {
    const raw = localStorage.getItem(`${READ_NOTIFICATIONS_PREFIX}${userId}`);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function saveReadNotificationIds(userId: string, readIds: Set<string>): void {
  if (typeof window === 'undefined' || !window.localStorage || !userId) return;
  try {
    localStorage.setItem(`${READ_NOTIFICATIONS_PREFIX}${userId}`, JSON.stringify(Array.from(readIds)));
  } catch {
    // Ignore storage errors
  }
}

export async function fetchUserNotifications(
  userId: string,
  username?: string
): Promise<{ data: NotificationItem[]; error: string | null }> {
  if (!userId) {
    return { data: [], error: 'User ID is required to load notifications' };
  }

  try {
    const readIds = getReadNotificationIds(userId);
    const notifications: NotificationItem[] = [];
    const actorIds = new Set<string>();

    // 1. Fetch user's published and draft posts to track votes and comments
    const { data: userPosts } = await supabase
      .from('posts')
      .select('id, title, slug')
      .eq('author_id', userId);

    const postMap = new Map<string, { id: string; title: string; slug: string }>();
    if (userPosts && userPosts.length > 0) {
      userPosts.forEach(p => postMap.set(p.id, p));
      const postIds = userPosts.map(p => p.id);

      // 2. Fetch upvotes on user's posts
      const { data: votes } = await supabase
        .from('votes')
        .select('id, voter_id, post_id, value, created_at')
        .in('post_id', postIds)
        .eq('value', 1);

      if (votes) {
        for (const vote of votes) {
          // Skip self-upvotes
          if (vote.voter_id === userId) continue;
          actorIds.add(vote.voter_id);
          const post = postMap.get(vote.post_id);
          const notifId = `vote_${vote.id}`;
          notifications.push({
            id: notifId,
            type: 'upvote',
            actor: {
              id: vote.voter_id,
              username: '',
              displayName: '',
            },
            target: {
              postId: vote.post_id,
              title: post?.title || 'your blog',
              slug: post?.slug || '',
            },
            createdAt: vote.created_at,
            read: readIds.has(notifId),
            link: post?.slug ? `/story/${post.slug}` : '/',
          });
        }
      }

      // 3. Fetch comments on user's posts
      const { data: comments } = await supabase
        .from('comments')
        .select('id, author_id, post_id, body, created_at')
        .in('post_id', postIds);

      if (comments) {
        for (const c of comments) {
          // Skip self-comments
          if (c.author_id === userId) continue;
          actorIds.add(c.author_id);
          const post = postMap.get(c.post_id);
          const notifId = `comment_${c.id}`;
          notifications.push({
            id: notifId,
            type: 'comment',
            actor: {
              id: c.author_id,
              username: '',
              displayName: '',
            },
            target: {
              postId: c.post_id,
              title: post?.title || 'your blog',
              slug: post?.slug || '',
              commentId: c.id,
              commentBody: c.body,
            },
            createdAt: c.created_at,
            read: readIds.has(notifId),
            link: post?.slug ? `/story/${post.slug}#responses` : '/',
          });
        }
      }
    }

    // 4. Fetch follows targeting this user
    const { data: follows } = await supabase
      .from('follows')
      .select('id, follower_id, created_at')
      .eq('followee_id', userId);

    if (follows) {
      for (const f of follows) {
        if (f.follower_id === userId) continue;
        actorIds.add(f.follower_id);
        const notifId = `follow_${f.id || f.follower_id}`;
        notifications.push({
          id: notifId,
          type: 'follow',
          actor: {
            id: f.follower_id,
            username: '',
            displayName: '',
          },
          createdAt: f.created_at || new Date().toISOString(),
          read: readIds.has(notifId),
          link: `/profile/${f.follower_id}`,
        });
      }
    }

    // 5. Fetch mentions in comments if username is available
    if (username) {
      const cleanU = username.trim().toLowerCase().replace(/^@/, '');
      const { data: mentions } = await supabase
        .from('comments')
        .select('id, author_id, post_id, body, created_at')
        .ilike('body', `%@${cleanU}%`)
        .limit(20);

      if (mentions) {
        for (const m of mentions) {
          if (m.author_id === userId) continue;
          actorIds.add(m.author_id);
          const notifId = `mention_${m.id}`;
          // Avoid duplicate if already included as comment on own post
          if (notifications.some(n => n.id === notifId)) continue;
          
          let slug = '';
          if (postMap.has(m.post_id)) {
            slug = postMap.get(m.post_id)!.slug;
          }

          notifications.push({
            id: notifId,
            type: 'mention',
            actor: {
              id: m.author_id,
              username: '',
              displayName: '',
            },
            target: {
              postId: m.post_id,
              commentId: m.id,
              commentBody: m.body,
            },
            createdAt: m.created_at,
            read: readIds.has(notifId),
            link: slug ? `/story/${slug}#responses` : '/',
          });
        }
      }
    }

    // 6. Hydrate actor profiles (username, display name, avatar)
    if (actorIds.size > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', Array.from(actorIds));

      if (profiles) {
        const profileMap = new Map(profiles.map(p => [p.id, p]));
        for (const notif of notifications) {
          const prof = profileMap.get(notif.actor.id);
          if (prof) {
            notif.actor.username = prof.username || prof.id.slice(0, 8);
            notif.actor.displayName = prof.display_name || prof.username || `@${prof.id.slice(0, 8)}`;
            notif.actor.avatarUrl = prof.avatar_url;
            if (notif.type === 'follow' && prof.username) {
              notif.link = `/profile/${prof.username}`;
            }
          } else {
            const shortId = notif.actor.id ? notif.actor.id.slice(0, 8) : 'unknown';
            notif.actor.username = shortId;
            notif.actor.displayName = `@${shortId}`;
          }
        }
      }
    }

    // 7. Sort by createdAt descending (newest first)
    notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return { data: notifications, error: null };
  } catch (err: any) {
    return { data: [], error: err.message || 'Failed to fetch notifications' };
  }
}
