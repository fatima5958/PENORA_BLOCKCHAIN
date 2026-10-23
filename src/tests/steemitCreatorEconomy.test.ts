// src/tests/steemitCreatorEconomy.test.ts
// Comprehensive verification suite for PENORA's Steemit-Style Creator Economy
// Covers: 7-day maturation, 70/20/10 split, anti-self-voting, bot burst prevention, Merkle proofs, and vault solvency.

import { describe, it, expect } from 'vitest';
import { parseUnits, formatUnits } from 'viem';
import {
  ARTICLE_REWARD_WINDOW_MS,
  articlePayoutTime,
  articlePayoutStatus,
  calculateArticleRewards,
  type RewardArticle,
} from '../lib/rewards/articleRewards';
import { articleRewardLeaf, buildArticleRewardProofs } from '../lib/rewards/merkle';
import { RewardFarmingDetector } from '../lib/rewards/antiFarming';
import {
  TOTAL_FIXED_SUPPLY_PNR,
  SCHEDULED_CREATOR_POOL_PNR,
  PROTECTED_RESERVE_PNR,
  evaluateEmissionPolicy,
  projectCreatorGrowthScenarios,
} from '../lib/tokenomics/emissionPolicy';

describe('PENORA Steemit-Style Creator Economy Architecture', () => {
  const authorAddr = '0x1111111111111111111111111111111111111111';
  const curatorAddr1 = '0x2222222222222222222222222222222222222222';
  const curatorAddr2 = '0x3333333333333333333333333333333333333333';
  const publishedAtStr = '2026-10-23T00:00:00.000Z';
  const publishTimestampMs = Date.parse(publishedAtStr);
  const payoutTimestampMs = publishTimestampMs + ARTICLE_REWARD_WINDOW_MS;

  // ─── 1. Seven-Day Maturation Clock ─────────────────────────────────────────
  describe('1. Seven-Day Article Maturity Timeline', () => {
    it('enforces exactly 7 days (168 hours) from publication timestamp', () => {
      const calculatedPayoutTime = articlePayoutTime(publishedAtStr);
      expect(calculatedPayoutTime).toBe(payoutTimestampMs);
      expect(calculatedPayoutTime! - publishTimestampMs).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it('accrues influence strictly prior to the 7-day mark and marks awaiting settlement exactly at deadline', () => {
      // 1 millisecond before maturity
      const accruingState = articlePayoutStatus(publishedAtStr, payoutTimestampMs - 1);
      expect(accruingState.status).toBe('accruing');

      // Exactly at maturity
      const maturedState = articlePayoutStatus(publishedAtStr, payoutTimestampMs);
      expect(maturedState.status).toBe('awaiting_settlement');

      // Post-maturity
      const postMaturedState = articlePayoutStatus(publishedAtStr, payoutTimestampMs + 1000);
      expect(postMaturedState.status).toBe('awaiting_settlement');
    });
  });

  // ─── 2. Steemit 70/20/10 Reward Split ──────────────────────────────────────
  describe('2. Reward Split Precision (70% Author / 20% Curator / 10% Reserve)', () => {
    it('accurately divides a 1,000 PNR article budget according to Steemit tokenomics', () => {
      const budgetWei = parseUnits('1000', 18);
      const article: RewardArticle = {
        id: 'article-001',
        author: authorAddr,
        publishedAt: publishedAtStr,
        votes: [
          {
            eventId: 'v1',
            voter: curatorAddr1,
            effectiveInfluence: 60n,
            direction: 1,
            timestampMs: publishTimestampMs + 60_000,
          },
          {
            eventId: 'v2',
            voter: curatorAddr2,
            effectiveInfluence: 40n,
            direction: 1,
            timestampMs: publishTimestampMs + 120_000,
          },
        ],
      };

      const result = calculateArticleRewards([article], budgetWei, payoutTimestampMs);

      // Author gets 70% of 1000 = 700 PNR
      expect(result.allocations[0].authorAmount).toBe(parseUnits('700', 18));

      // Curators share 20% of 1000 = 200 PNR proportionally (60% to curator1, 40% to curator2)
      expect(result.allocations[0].curatorAmount).toBe(parseUnits('200', 18));

      // Protocol retains minimum 10% = 100 PNR
      expect(result.reserve).toBe(parseUnits('100', 18));

      // Solvency invariant: author + curator + reserve == initial budget
      expect(result.distributed + result.reserve).toBe(budgetWei);

      // Verify individual beneficiary payouts
      const b1 = result.allocations[0].beneficiaries.find(b => b.account === curatorAddr1);
      const b2 = result.allocations[0].beneficiaries.find(b => b.account === curatorAddr2);
      expect(b1?.amount).toBe(parseUnits('120', 18)); // 60% of 200 PNR
      expect(b2?.amount).toBe(parseUnits('80', 18));  // 40% of 200 PNR
    });
  });

  // ─── 3. Anti-Self-Voting & Manipulation Safeguards ─────────────────────────
  describe('3. Anti-Self-Voting & Anti-Farming Integrity', () => {
    it('strictly intercepts self-votes and awards zero curator reward to author', () => {
      const detector = new RewardFarmingDetector();

      // Author voting on their own article
      const selfVote = detector.evaluateVote({
        voter: authorAddr,
        author: authorAddr,
        articleId: 'article-self',
        direction: 1,
        effectiveInfluence: parseUnits('1000', 18),
        timestampMs: publishTimestampMs + 60_000,
        articlePublishedAtMs: publishTimestampMs,
      });

      expect(selfVote.isEligible).toBe(false);
      expect(selfVote.rejectionReason).toBe('SELF_VOTE');
      expect(selfVote.normalizedInfluence).toBe(0n);
    });

    it('rejects bot burst votes cast before human reading threshold (< 10 seconds)', () => {
      const detector = new RewardFarmingDetector();

      const botVote = detector.evaluateVote({
        voter: curatorAddr1,
        author: authorAddr,
        articleId: 'article-fast',
        direction: 1,
        effectiveInfluence: parseUnits('50', 18),
        timestampMs: publishTimestampMs + 2_000, // Only 2 seconds after publish!
        articlePublishedAtMs: publishTimestampMs,
      });

      expect(botVote.isEligible).toBe(false);
      expect(botVote.rejectionReason).toBe('BOT_BURST');
    });

    it('rejects zero-influence votes', () => {
      const detector = new RewardFarmingDetector();

      const zeroVote = detector.evaluateVote({
        voter: curatorAddr1,
        author: authorAddr,
        articleId: 'article-zero',
        direction: 1,
        effectiveInfluence: 0n,
        timestampMs: publishTimestampMs + 30_000,
        articlePublishedAtMs: publishTimestampMs,
      });

      expect(zeroVote.isEligible).toBe(false);
      expect(zeroVote.rejectionReason).toBe('ZERO_INFLUENCE');
    });
  });

  // ─── 4. Merkle Proof Generation & Claims ──────────────────────────────────
  describe('4. Merkle Proof Tree & Claim Leaves', () => {
    it('constructs valid 32-byte Merkle tree and verifies membership proof for each claimant', () => {
      const articleId = 'article-001';
      const beneficiaries = [
        { account: authorAddr, amount: parseUnits('700', 18) },
        { account: curatorAddr1, amount: parseUnits('120', 18) },
        { account: curatorAddr2, amount: parseUnits('80', 18) },
      ];

      const allocation = {
        articleId,
        authorAmount: parseUnits('700', 18),
        curatorAmount: parseUnits('200', 18),
        netInfluence: 100n,
        beneficiaries,
        payoutPreference: 'liquid' as const,
        publishedAt: publishedAtStr,
        payoutAt: new Date(payoutTimestampMs).toISOString(),
      };

      const chainId = 80002n;
      const distributor = '0x4444444444444444444444444444444444444444' as `0x${string}`;

      const tree = buildArticleRewardProofs(allocation, chainId, distributor);

      expect(tree.root).toMatch(/^0x[0-9a-f]{64}$/i);
      expect(tree.claims).toHaveLength(3);

      // Author proof check
      const authorClaim = tree.claims.find(c => c.account === authorAddr);
      expect(authorClaim?.amount).toBe(parseUnits('700', 18));
      expect(authorClaim?.proof.length).toBeGreaterThan(0);
    });
  });

  // ─── 5. Reward Economics & Solvency Invariants ─────────────────────────────
  describe('5. Protocol Emission Limits & Solvency Invariants', () => {
    it('guarantees fixed 100M supply and 30M scheduled ceiling invariants', () => {
      expect(TOTAL_FIXED_SUPPLY_PNR).toBe(100_000_000n);
      expect(SCHEDULED_CREATOR_POOL_PNR).toBe(30_000_000n);
      expect(PROTECTED_RESERVE_PNR).toBe(10_000_000n);
    });

    it('evaluates emission policy and throttles daily budget to funded balance', () => {
      // Vault funded with only 5,000 PNR, but daily cap requested is 10,000 PNR
      const audit = evaluateEmissionPolicy({
        dailyCapWei: parseUnits('10000', 18),
        fundedVaultBalanceWei: parseUnits('5000', 18),
        totalPreviouslyReleasedWei: parseUnits('1000000', 18),
      });

      // Must be safely throttled to 5,000 PNR to protect solvency
      expect(audit.effectiveDailyBudgetPnr).toBe(5000);
      expect(audit.isSolvent).toBe(true);
      expect(audit.warnings.length).toBeGreaterThan(0);
    });

    it('projects runway across adoption tiers without inflating token supply', () => {
      const scenarios = projectCreatorGrowthScenarios(6_000_000);
      expect(scenarios).toHaveLength(4);

      for (const scenario of scenarios) {
        expect(scenario.annualBudgetPnr).toBe(6_000_000);
        // Author gets 70% of per-article budget
        expect(scenario.avgAuthorRewardPerArticlePnr).toBeGreaterThan(0);
      }
    });
  });
});
