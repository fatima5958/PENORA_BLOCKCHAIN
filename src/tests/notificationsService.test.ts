// src/tests/notificationsService.test.ts
// PENORA Notifications Service Verification Suite

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  fetchUserNotifications,
  getReadNotificationIds,
  saveReadNotificationIds,
  dispatchNotificationUpdate,
} from '../lib/api/notifications';

describe('PENORA Notifications Service Suite', () => {
  const testUserId = '11111111-2222-3333-4444-555555555555';
  let memoryStore: Record<string, string> = {};

  beforeEach(() => {
    memoryStore = {};
    const mockStorage = {
      getItem: (k: string) => memoryStore[k] || null,
      setItem: (k: string, v: string) => {
        memoryStore[k] = String(v);
      },
      removeItem: (k: string) => {
        delete memoryStore[k];
      },
      clear: () => {
        memoryStore = {};
      },
    };

    const listeners: Record<string, Function[]> = {};
    const mockWindow = {
      localStorage: mockStorage,
      addEventListener: (type: string, fn: Function) => {
        if (!listeners[type]) listeners[type] = [];
        listeners[type].push(fn);
      },
      removeEventListener: (type: string, fn: Function) => {
        if (listeners[type]) {
          listeners[type] = listeners[type].filter((f) => f !== fn);
        }
      },
      dispatchEvent: (evt: any) => {
        const type = evt?.type || '';
        if (listeners[type]) {
          listeners[type].forEach((fn) => fn(evt));
        }
        return true;
      },
      CustomEvent: class CustomEvent {
        type: string;
        detail: any;
        constructor(type: string, params: any = {}) {
          this.type = type;
          this.detail = params.detail;
        }
      },
    };

    (global as any).window = mockWindow;
    (global as any).localStorage = mockStorage;
    (global as any).CustomEvent = mockWindow.CustomEvent;
  });

  afterEach(() => {
    delete (global as any).window;
    delete (global as any).localStorage;
    delete (global as any).CustomEvent;
  });

  it('safely rejects requests with missing or empty user IDs', async () => {
    const res = await fetchUserNotifications('');
    expect(res.error).toContain('User ID is required');
    expect(res.data).toEqual([]);
  });

  it('fetches notifications without failing on follows schema (handles follower_id without id column)', async () => {
    const res = await fetchUserNotifications(testUserId, 'testcreator');
    expect(res.error).toBeNull();
    expect(Array.isArray(res.data)).toBe(true);
  });

  it('persists read notifications correctly to localStorage and dispatches updates', () => {
    const readSet = new Set(['vote_123', 'comment_456']);
    const listener = vi.fn();

    (global as any).window.addEventListener('penora:notifications-updated', listener);
    saveReadNotificationIds(testUserId, readSet);

    const loaded = getReadNotificationIds(testUserId);
    expect(loaded.has('vote_123')).toBe(true);
    expect(loaded.has('comment_456')).toBe(true);
    expect(loaded.has('follow_789')).toBe(false);
    expect(listener).toHaveBeenCalled();

    (global as any).window.removeEventListener('penora:notifications-updated', listener);
  });

  it('merges local follows from localStorage ledger into user notifications', async () => {
    const followerId = '22222222-3333-4444-5555-666666666666';
    // followerId follows testUserId
    const followsLedger = {
      [followerId]: [testUserId],
    };
    (global as any).localStorage.setItem('penora_follows_ledger_v1', JSON.stringify(followsLedger));

    const res = await fetchUserNotifications(testUserId);
    expect(res.error).toBeNull();
    const followNotif = res.data.find((n) => n.id === `follow_${followerId}`);
    expect(followNotif).toBeDefined();
    expect(followNotif?.type).toBe('follow');
    expect(followNotif?.actor.id).toBe(followerId);
  });
});
