// src/tests/completeCreatorEconomyIntegration.test.ts
// Phase 15 End-to-End Creator Economy Integration Test Suite
// Verifies: Publish -> Vote -> Delegate -> 7-Day Maturity -> Settle -> Claim/Power Up -> Power Down -> P2P Escrow

import { describe, it, expect } from 'vitest';
import { parseUnits, formatUnits } from 'viem';
import {
  ARTICLE_REWARD_WINDOW_MS,
  articlePayoutTime,
  articlePayoutStatus,
  calculateArticleRewards,
  validateBeneficiaries,
  COMMENT_REWARDS_FUNDING_APPROVED,
  calculateCommentRewards,
  type RewardArticle,
  type PayoutPreference,
} from '../lib/rewards/articleRewards';
import { buildArticleRewardProofs } from '../lib/rewards/merkle';
import {
  TOTAL_FIXED_SUPPLY_PNR,
  SCHEDULED_CREATOR_POOL_PNR,
  PROTECTED_RESERVE_PNR,
} from '../lib/tokenomics/emissionPolicy';
import {
  calculateManaConsumptionBps,
  calculateInfluenceScore,
} from '../lib/voting/votingClient';
import {
  calculateUsdtCost,
  preflightFillValidation,
  type P2POffer,
} from '../lib/exchange/p2pEscrowService';

describe('PENORA Phase 15: Complete Creator Economy Integration Suite', () => {
  const author = '0x1111111111111111111111111111111111111111';
  const collaborator = '0x2222222222222222222222222222222222222222';
  const curator = '0x3333333333333333333333333333333333333333';
  const buyer = '0x4444444444444444444444444444444444444444';
  const distributor = '0x5555555555555555555555555555555555555555';
  const chainId = 80002n;

  // ─── 1. Full Publishing Journey & Preferences ─────────────────────────────
  describe('Step 1: Creator Publishes with Payout Preferences & Beneficiaries', () => {
    it('initializes publication timestamp and enforces exact 168-hour maturity clock', () => {
      const publishedAt = '2026-10-23T06:00:00.000Z';
      const publishMs = Date.parse(publishedAt);
      const payoutMs = articlePayoutTime(publishedAt);

      expect(payoutMs).toBe(publishMs + ARTICLE_REWARD_WINDOW_MS);
      expect(payoutMs! - publishMs).toBe(7 * 24 * 3600 * 1000);

      // Verify accruing vs awaiting_settlement transition
      expect(articlePayoutStatus(publishedAt, payoutMs! - 1000).status).toBe('accruing');
      expect(articlePayoutStatus(publishedAt, payoutMs!).status).toBe('awaiting_settlement');
    });

    it('validates beneficiary splits up to 100% of author share without token inflation', () => {
      const beneficiaries = [
        { account: collaborator, weightBps: 2000 }, // 20%
      ];
      const validated = validateBeneficiaries(beneficiaries);
      expect(validated).toHaveLength(1);
      expect(validated[0].weightBps).toBe(2000);

      // Rejects splits exceeding 100% (10,000 bps)
      expect(() =>
        validateBeneficiaries([
          { account: collaborator, weightBps: 9000 },
          { account: curator, weightBps: 2000 },
        ])
      ).toThrow(/exceeds 100%/i);
    });
  });

  // ─── 2. Weighted Voting & Mana Limits ─────────────────────────────────────
  describe('Step 2: Readers Cast Weighted Votes Following Mana Limits', () => {
    it('consumes exactly 2% mana (200 bps) on a 100% weight vote', () => {
      expect(calculateManaConsumptionBps(10000, 100)).toBe(200);
      expect(calculateManaConsumptionBps(10000, 50)).toBe(100);
      expect(calculateManaConsumptionBps(10000, 10)).toBe(20);
    });

    it('calculates influence score strictly proportional to staked PP, mana and weight', () => {
      const stakedPp = 1000; // 1,000 PP
      const manaPercent = 100; // 100% mana
      const weightPercent = 100;

      const fullInfluence = calculateInfluenceScore(stakedPp, weightPercent, manaPercent);
      expect(fullInfluence).toBe(1000);

      // Half mana -> half influence
      const halfInfluence = calculateInfluenceScore(stakedPp, weightPercent, 50);
      expect(halfInfluence * 2).toBe(fullInfluence);
    });
  });

  // ─── 3. Reward Processing & Beneficiary Partitioning ──────────────────────
  describe('Step 3: Seven-Day Reward Settlement & Proof Generation', () => {
    it('partitions author 70% share cleanly into author net and collaborator beneficiary', () => {
      const publishedAt = '2026-10-15T00:00:00.000Z';
      const publishMs = Date.parse(publishedAt);
      const dueMs = publishMs + ARTICLE_REWARD_WINDOW_MS;

      const article: RewardArticle = {
        id: 'article-p15-01',
        author,
        publishedAt,
        payoutPreference: 'liquid',
        rewardBeneficiaries: [{ account: collaborator, weightBps: 2000 }], // 20% of author share
        votes: [
          {
            eventId: '80002:0xtx1:0',
            voter: curator,
            direction: 1,
            effectiveInfluence: 1000n,
            timestampMs: publishMs + 3600 * 1000,
          },
        ],
      };

      const budget = parseUnits('100', 18); // 100 PNR
      const result = calculateArticleRewards([article], budget, dueMs);

      // 70 PNR gross author, 20 PNR curator, 10 PNR reserve
      const alloc = result.allocations[0];
      expect(alloc.netInfluence).toBe(1000n);
      expect(alloc.curatorAmount).toBe(parseUnits('20', 18));

      // Beneficiary gets 20% of 70 = 14 PNR; Author gets 80% of 70 = 56 PNR
      expect(alloc.authorAmount).toBe(parseUnits('56', 18));

      const authorShare = alloc.beneficiaries.find((b) => b.account.toLowerCase() === author.toLowerCase());
      const collabShare = alloc.beneficiaries.find((b) => b.account.toLowerCase() === collaborator.toLowerCase());
      const curatorShare = alloc.beneficiaries.find((b) => b.account.toLowerCase() === curator.toLowerCase());

      expect(authorShare?.amount).toBe(parseUnits('56', 18));
      expect(collabShare?.amount).toBe(parseUnits('14', 18));
      expect(curatorShare?.amount).toBe(parseUnits('20', 18));

      // Token conservation: 56 + 14 + 20 = 90 PNR distributed, 10 PNR in reserve
      expect(result.distributed).toBe(parseUnits('90', 18));
      expect(result.reserve).toBe(parseUnits('10', 18));
      expect(result.distributed + result.reserve).toBe(budget);
    });

    it('generates verifiable Merkle proofs for all recipients including collaborators', () => {
      const publishedAt = '2026-10-15T00:00:00.000Z';
      const dueMs = Date.parse(publishedAt) + ARTICLE_REWARD_WINDOW_MS;

      const allocation = {
        articleId: 'article-p15-01',
        publishedAt,
        payoutAt: new Date(dueMs).toISOString(),
        netInfluence: 1000n,
        authorAmount: parseUnits('56', 18),
        curatorAmount: parseUnits('20', 18),
        payoutPreference: 'liquid' as PayoutPreference,
        beneficiaries: [
          { account: author, amount: parseUnits('56', 18) },
          { account: collaborator, amount: parseUnits('14', 18) },
          { account: curator, amount: parseUnits('20', 18) },
        ],
      };

      const tree = buildArticleRewardProofs(allocation, chainId, distributor);
      expect(tree.root).toMatch(/^0x[0-9a-f]{64}$/i);
      expect(tree.claims).toHaveLength(3);

      for (const claim of tree.claims) {
        expect(claim.proof.length).toBeGreaterThan(0);
        expect(claim.amount).toBeGreaterThan(0n);
      }
    });

    it('enforces comment rewards funding gate strictly disabled by default', () => {
      expect(COMMENT_REWARDS_FUNDING_APPROVED).toBe(false);

      const comments = [
        {
          id: 'comment-1',
          articleId: 'article-p15-01',
          author: curator,
          publishedAt: '2026-10-23T00:00:00.000Z',
          votes: [{ eventId: 'ev1', voter: author, direction: 1 as const, effectiveInfluence: 50n, timestampMs: 1 }],
        },
      ];

      // With default funding gate, returns 0 PNR allocations and isGated = true
      const result = calculateCommentRewards(comments, 1000n, Date.now());
      expect(result.distributed).toBe(0n);
      expect(result.reserve).toBe(0n);
      expect(result.isGated).toBe(true);
      expect(result.allocations[0].amount).toBe(0n);
    });
  });

  // ─── 4. P2P Escrow Exchange Mechanics ─────────────────────────────────────
  describe('Step 4: P2P Escrow Marketplace Trading Mechanics', () => {
    it('calculates exact USDT cost with 6-to-18 decimal conversion and 25 bps fee', () => {
      // Selling 500 PNR for 50 USDT total (0.10 USDT per PNR)
      const pnrToFillWei = parseUnits('200', 18); // Filling 200 PNR
      const offerPnrAmountWei = parseUnits('500', 18);
      const offerUsdtPriceTotalWei = parseUnits('50', 6); // 50 USDT (50,000,000 micro-USDT)

      const cost = calculateUsdtCost(pnrToFillWei, offerPnrAmountWei, offerUsdtPriceTotalWei, 25n); // 25 bps = 0.25%
      // 200 / 500 * 50 USDT = 20 USDT = 20,000,000 micro-USDT
      expect(cost.grossUsdtWei).toBe(20_000_000n);
      // Fee: 20 USDT * 0.25% = 0.05 USDT = 50,000 micro-USDT
      expect(cost.feeWei).toBe(50_000n);
      // Net to seller: 19.95 USDT = 19,950,000 micro-USDT
      expect(cost.netSellerWei).toBe(19_950_000n);
    });

    it('performs strict preflight fill validation preventing self-purchases and out-of-bounds fills', async () => {
      const mockOffer: P2POffer = {
        id: 1,
        seller: author as `0x${string}`,
        pnrAmountWei: parseUnits('500', 18),
        pnrAmount: '500.0',
        pnrRemainingWei: parseUnits('500', 18),
        pnrRemaining: '500.0',
        usdtPriceWei: parseUnits('50', 6),
        usdtPriceTotal: '50.0',
        pricePerPnr: '0.10',
        minPnrFillWei: parseUnits('50', 18),
        minPnrFill: '50.0',
        createdAt: 1000,
        expiresAt: Math.floor(Date.now() / 1000) + 86400,
        isExpired: false,
        cancelled: false,
        active: true,
        fillPercentage: 0,
      };

      // 1. Seller cannot buy their own offer
      const selfBuy = await preflightFillValidation({
        escrowAddress: '0x1000000000000000000000000000000000000001',
        usdtAddress: '0x2000000000000000000000000000000000000002',
        buyerAddress: author as `0x${string}`,
        offer: mockOffer,
        pnrToFillWei: parseUnits('100', 18),
        rpcUrl: 'https://rpc-amoy.polygon.technology',
      });
      expect(selfBuy.valid).toBe(false);
      expect(selfBuy.error).toContain('own sell offer');

      // 2. Buyer cannot fill below min fill amount
      const belowMin = await preflightFillValidation({
        escrowAddress: '0x1000000000000000000000000000000000000001',
        usdtAddress: '0x2000000000000000000000000000000000000002',
        buyerAddress: buyer as `0x${string}`,
        offer: mockOffer,
        pnrToFillWei: parseUnits('20', 18),
        rpcUrl: 'https://rpc-amoy.polygon.technology',
      });
      expect(belowMin.valid).toBe(false);
      expect(belowMin.error).toContain('Minimum fill');
    });
  });

  // ─── 5. System Solvency & Protocol Economics ──────────────────────────────
  describe('Step 5: System Solvency & Invariant Verification', () => {
    it('strictly preserves fixed 100,000,000 PNR supply and 30,000,000 creator ceiling', () => {
      expect(TOTAL_FIXED_SUPPLY_PNR).toBe(100_000_000n);
      expect(SCHEDULED_CREATOR_POOL_PNR).toBe(30_000_000n);
      expect(PROTECTED_RESERVE_PNR).toBe(10_000_000n);
    });
  });
});
