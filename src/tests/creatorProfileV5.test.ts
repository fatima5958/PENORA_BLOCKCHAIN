// src/tests/creatorProfileV5.test.ts
// ============================================================================
// PENORA CREATOR PROFILE V5 TEST SUITE 💎
// Premium Design + Real Supabase Data + Financially Honest Blockchain Rewards
// ============================================================================
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { updateProfile, getProfileById } from '../lib/api/profiles';
import { validateImageFile, uploadCreatorMedia, MAX_IMAGE_FILE_SIZE_BYTES } from '../lib/api/storage';
import { getArticleRewardState, IS_PENORA_TOKEN_LIVE } from '../lib/api/rewards';
import { getUserComments } from '../lib/api/comments';
import { penoraKeyAuth } from '../lib/auth/penoraKeyAuth';
import { authBroker } from '../lib/auth/authBroker';

describe('PENORA Creator Profile V5 Suite', () => {
  const testUser = 'tester_v5_creator';
  const testEmail = 'tester_v5@penora.test';
  const testUserId = '00000000-0000-4000-8000-000000000002';
  let keys: ReturnType<typeof penoraKeyAuth.generateKeys>;

  beforeEach(() => {
    penoraKeyAuth.logout();
    authBroker.deleteAccount(testUser);

    keys = penoraKeyAuth.generateKeys();
    authBroker.registerHydratedAccount({
      userId: testUserId,
      username: testUser,
      displayName: 'Creator V5 Tester',
      email: testEmail,
      authorities: {
        owner_public_key: keys.owner.publicKeyPen,
        active_public_key: keys.active.publicKeyPen,
        posting_public_key: keys.posting.publicKeyPen,
        memo_public_key: keys.memo.publicKeyPen,
      },
    });
  });

  afterEach(() => {
    penoraKeyAuth.logout();
    authBroker.deleteAccount(testUser);
  });

  // PHASE 3 & STORAGE TESTS
  describe('Storage & Media Validation', () => {
    it('1. accepts valid JPEG, PNG, and WebP files under 5MB', () => {
      const mockJpeg = new File(['valid-image-bytes'], 'banner.jpg', { type: 'image/jpeg' });
      const res = validateImageFile(mockJpeg);
      expect(res.valid).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it('2. rejects unsupported MIME types', () => {
      const mockExe = new File(['malicious'], 'avatar.exe', { type: 'application/x-msdownload' });
      const res = validateImageFile(mockExe);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/invalid file type/i);
    });

    it('3. rejects files exceeding 5.0 MB maximum size', () => {
      // Create a dummy oversized file definition
      const largeFile = new File(['oversized'], 'huge.png', { type: 'image/png' });
      Object.defineProperty(largeFile, 'size', { value: MAX_IMAGE_FILE_SIZE_BYTES + 1024 });

      const res = validateImageFile(largeFile);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/exceeds maximum allowed limit/i);
    });

    it('4. blocks unauthenticated storage upload attempts', async () => {
      const mockFile = new File(['image-bytes'], 'avatar.png', { type: 'image/png' });
      const res = await uploadCreatorMedia(mockFile, 'avatar');
      expect(res.publicUrl).toBeNull();
      expect(res.error).toMatch(/authentication required/i);
    });
  });

  // PHASE 2 & 10 PROFILE METADATA & INTEGRATION TESTS
  describe('Profile Metadata V5 Fields', () => {
    it('5. rejects location exceeding 50 characters', async () => {
      await penoraKeyAuth.loginWithPrivateKey(testUser, keys.active.privateKeyWif);
      const longLocation = 'L'.repeat(51);

      const res = await updateProfile(testUserId, {
        location: longLocation,
      });

      expect(res.data).toBeNull();
      expect(res.error).toMatch(/location cannot exceed 50 characters/i);
    });

    it('6. rejects invalid website URL format', async () => {
      await penoraKeyAuth.loginWithPrivateKey(testUser, keys.active.privateKeyWif);

      const res = await updateProfile(testUserId, {
        website: 'not-a-valid-url',
      });

      expect(res.data).toBeNull();
      expect(res.error).toMatch(/valid website URL|http/i);
    });

    it('7. rejects interest tags exceeding limit of 10', async () => {
      await penoraKeyAuth.loginWithPrivateKey(testUser, keys.active.privateKeyWif);
      const elevenTags = Array.from({ length: 11 }, (_, i) => `Tag${i}`);

      const res = await updateProfile(testUserId, {
        interests: elevenTags,
      });

      expect(res.data).toBeNull();
      expect(res.error).toMatch(/maximum 10 interest tags/i);
    });

    it('8. accepts valid location, website, and interest tags', async () => {
      await penoraKeyAuth.loginWithPrivateKey(testUser, keys.active.privateKeyWif);

      const res = await updateProfile(testUserId, {
        display_name: 'Verified Creator',
        bio: 'Decentralized researcher',
        location: 'Lahore, Pakistan',
        website: 'https://penora.io',
        interests: ['Writing', 'Tech', 'Faith', 'Productivity', 'Onchain'],
      });

      // Should either save to Supabase or handle pending migration gracefully without crashing
      expect(res.error === null || res.isPendingMigration === true).toBe(true);
    });
  });

  // PHASE 5: REAL VOTING & BLOCKCHAIN REWARD HONESTY
  describe('Financially Honest Reward Calculation', () => {
    it('9. verifies tokens are not live and USD reward displays honest "$—"', () => {
      expect(IS_PENORA_TOKEN_LIVE).toBe(false);

      const rewardState0 = getArticleRewardState(0);
      expect(rewardState0.displayUsd).toBe('$—');
      expect(rewardState0.badgeLabel).toBe('▲ 0 votes · $—');
      expect(rewardState0.tooltip).toContain("USD rewards will appear when PENORA's token rewards and verified pricing are live.");

      const rewardState42 = getArticleRewardState(42);
      expect(rewardState42.displayUsd).toBe('$—');
      expect(rewardState42.badgeLabel).toBe('▲ 42 votes · $—');
    });

    it('10. never uses arbitrary formulas like 1 vote = $1 or reputation = dollars', () => {
      const reward = getArticleRewardState(100);
      expect(reward.estimatedUsd).toBeNull();
      expect(reward.displayUsd).not.toBe('$100');
      expect(reward.displayUsd).not.toBe('$100.00');
      expect(reward.displayUsd).toBe('$—');
    });
  });

  // PHASE 4: CREATOR PROFILE TABS & REPLIES
  describe('Creator Profile Tabs & Data', () => {
    it('11. fetches creator comments for the Replies tab safely without crashing', async () => {
      const repliesRes = await getUserComments(testUserId);
      expect(Array.isArray(repliesRes.data)).toBe(true);
      expect(repliesRes.error).toBeNull();
    });
  });
});
