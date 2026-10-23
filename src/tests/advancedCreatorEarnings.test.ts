// src/tests/advancedCreatorEarnings.test.ts
// Phase 14: Advanced Steemit-Style Creator Earnings Suite
// Tests: Post Payout Preferences (Liquid, Power Up, Declined), Beneficiary Splitting, and Comment Rewards Gate

import { describe, it, expect } from 'vitest';
import { parseUnits } from 'viem';
import {
  ARTICLE_REWARD_WINDOW_MS,
  calculateArticleRewards,
  calculateCommentRewards,
  validateBeneficiaries,
  COMMENT_REWARDS_FUNDING_APPROVED,
  type RewardArticle,
  type RewardComment,
} from '../lib/rewards/articleRewards';

describe('PENORA Phase 14: Advanced Creator Earnings Architecture', () => {
  const author = '0x1111111111111111111111111111111111111111';
  const collaboratorA = '0x2222222222222222222222222222222222222222';
  const collaboratorB = '0x3333333333333333333333333333333333333333';
  const curator = '0x4444444444444444444444444444444444444444';
  const publishedAt = '2026-10-23T00:00:00.000Z';
  const publishMs = Date.parse(publishedAt);
  const payoutMs = publishMs + ARTICLE_REWARD_WINDOW_MS;
  const budget = parseUnits('1000', 18); // 1,000 PNR (Author share = 700 PNR, Curator share = 200 PNR, Reserve = 100 PNR)

  const baseVotes = [
    {
      eventId: 'ev-1',
      voter: curator,
      direction: 1 as const,
      effectiveInfluence: 100n,
      timestampMs: publishMs + 60_000,
    },
  ];

  // ─── 1. POST PAYOUT PREFERENCES ──────────────────────────────────────────
  describe('1. Post Payout Preferences', () => {
    it('Option A: Liquid PNR (default) allocates 700 PNR to author as liquid transferable tokens', () => {
      const article: RewardArticle = {
        id: 'article-liquid-01',
        author,
        publishedAt,
        votes: baseVotes,
        payoutPreference: 'liquid',
      };

      const result = calculateArticleRewards([article], budget, payoutMs);
      expect(result.allocations[0].authorAmount).toBe(parseUnits('700', 18));
      expect(result.allocations[0].curatorAmount).toBe(parseUnits('200', 18));
      expect(result.allocations[0].payoutPreference).toBe('liquid');
      expect(result.reserve).toBe(parseUnits('100', 18));
    });

    it('Option B: 100% Power Up marks allocation for auto-staking into PENORA Power', () => {
      const article: RewardArticle = {
        id: 'article-powerup-01',
        author,
        publishedAt,
        votes: baseVotes,
        payoutPreference: 'power_up',
      };

      const result = calculateArticleRewards([article], budget, payoutMs);
      expect(result.allocations[0].authorAmount).toBe(parseUnits('700', 18));
      expect(result.allocations[0].payoutPreference).toBe('power_up');
      expect(result.distributed).toBe(parseUnits('900', 18));
      expect(result.reserve).toBe(parseUnits('100', 18));
    });

    it('Option C: Declined Rewards zeroes author share and preserves it in reserve while curators still get paid', () => {
      const article: RewardArticle = {
        id: 'article-declined-01',
        author,
        publishedAt,
        votes: baseVotes,
        payoutPreference: 'declined',
      };

      const result = calculateArticleRewards([article], budget, payoutMs);
      // Author declined: author receives 0 PNR
      expect(result.allocations[0].authorAmount).toBe(0n);
      // Curator still receives full 200 PNR curation share
      expect(result.allocations[0].curatorAmount).toBe(parseUnits('200', 18));
      // Author 700 PNR allocation remains in the sovereign reserve (100 base reserve + 700 declined = 800 reserve)
      expect(result.distributed).toBe(parseUnits('200', 18));
      expect(result.reserve).toBe(parseUnits('800', 18));
      // Author is not in beneficiaries claim list
      expect(result.allocations[0].beneficiaries.some((b) => b.account === author)).toBe(false);
      // Curator is present in beneficiaries claim list
      expect(result.allocations[0].beneficiaries.some((b) => b.account === curator)).toBe(true);
    });
  });

  // ─── 2. REWARD BENEFICIARY SPLITTING ──────────────────────────────────────
  describe('2. Reward Beneficiary Splitting', () => {
    it('validates beneficiary settings and rejects invalid weights or exceeding 100%', () => {
      // Rejects duplicate beneficiary
      expect(() =>
        validateBeneficiaries([
          { account: collaboratorA, weightBps: 1000 },
          { account: collaboratorA, weightBps: 1000 },
        ])
      ).toThrow('Duplicate beneficiary');

      // Rejects negative or zero weights
      expect(() =>
        validateBeneficiaries([{ account: collaboratorA, weightBps: 0 }])
      ).toThrow('between 1 and 10000 bps');

      // Rejects total exceeding 100% (10,000 bps)
      expect(() =>
        validateBeneficiaries([
          { account: collaboratorA, weightBps: 6000 },
          { account: collaboratorB, weightBps: 5000 },
        ])
      ).toThrow('exceeds 100%');
    });

    it('accurately splits author share with 80% Author / 10% Collab A / 10% Collab B', () => {
      // Author gross = 700 PNR
      // Collab A: 10% of author share = 70 PNR
      // Collab B: 10% of author share = 70 PNR
      // Author net: 80% of author share = 560 PNR
      // Curator: 200 PNR
      const article: RewardArticle = {
        id: 'article-beneficiaries-01',
        author,
        publishedAt,
        votes: baseVotes,
        rewardBeneficiaries: [
          { account: collaboratorA, weightBps: 1000 }, // 10%
          { account: collaboratorB, weightBps: 1000 }, // 10%
        ],
      };

      const result = calculateArticleRewards([article], budget, payoutMs);
      const alloc = result.allocations[0];

      expect(alloc.authorAmount).toBe(parseUnits('560', 18));
      expect(alloc.curatorAmount).toBe(parseUnits('200', 18));

      const bA = alloc.beneficiaries.find((b) => b.account === collaboratorA);
      const bB = alloc.beneficiaries.find((b) => b.account === collaboratorB);
      const bAuthor = alloc.beneficiaries.find((b) => b.account === author);
      const bCurator = alloc.beneficiaries.find((b) => b.account === curator);

      expect(bA?.amount).toBe(parseUnits('70', 18));
      expect(bB?.amount).toBe(parseUnits('70', 18));
      expect(bAuthor?.amount).toBe(parseUnits('560', 18));
      expect(bCurator?.amount).toBe(parseUnits('200', 18));

      // Total distributed must strictly equal 900 PNR with 100 PNR reserve
      expect(result.distributed).toBe(parseUnits('900', 18));
      expect(result.reserve).toBe(parseUnits('100', 18));
    });
  });

  // ─── 3. COMMENT AND REPLY REWARDS GATE ────────────────────────────────────
  describe('3. Comment & Reply Rewards Funding Gate', () => {
    const comment1: RewardComment = {
      id: 'comment-001',
      articleId: 'article-liquid-01',
      author: collaboratorA,
      publishedAt,
      votes: [
        {
          eventId: 'cv-1',
          voter: author,
          direction: 1,
          effectiveInfluence: 50n,
          timestampMs: publishMs + 60_000,
        },
      ],
    };

    it('remains strictly disabled with zero funding by default until founder/governance authorization', () => {
      expect(COMMENT_REWARDS_FUNDING_APPROVED).toBe(false);

      const result = calculateCommentRewards([comment1], parseUnits('100', 18), payoutMs);
      expect(result.isGated).toBe(true);
      expect(result.budget).toBe(0n);
      expect(result.distributed).toBe(0n);
      expect(result.allocations[0].amount).toBe(0n);
    });

    it('settles comment rewards accurately when explicit simulated funding is enabled in test environment', () => {
      const commentBudget = parseUnits('50', 18);
      const result = calculateCommentRewards([comment1], commentBudget, payoutMs, { allowFunding: true });

      expect(result.isGated).toBe(false);
      expect(result.budget).toBe(commentBudget);
      expect(result.distributed).toBe(commentBudget);
      expect(result.allocations[0].amount).toBe(commentBudget);
      expect(result.allocations[0].netInfluence).toBe(50n);
    });
  });
});
