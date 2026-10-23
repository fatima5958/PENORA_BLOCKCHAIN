// src/tests/tokenEconomyAndUtility.test.ts
import { describe, it, expect } from 'vitest';
import { RewardFarmingDetector } from '../lib/rewards/antiFarming';
import { processCreatorBoost, MIN_BOOST_PNR, MAX_BOOST_PNR } from '../lib/tokenomics/creatorBoost';
import { evaluateCommunityBenefits } from '../lib/tokenomics/communityBenefits';

describe('PENORA Token Economy & Anti-Farming Suite', () => {
  it('strictly rejects self-votes from reward calculation', () => {
    const detector = new RewardFarmingDetector();
    const result = detector.evaluateVote({
      voter: '0x1111111111111111111111111111111111111111',
      author: '0x1111111111111111111111111111111111111111',
      articleId: 'art-1',
      direction: 1,
      effectiveInfluence: 10_000n,
      timestampMs: 100_000,
      articlePublishedAtMs: 50_000,
    });

    expect(result.isEligible).toBe(false);
    expect(result.rejectionReason).toBe('SELF_VOTE');
    expect(result.normalizedInfluence).toBe(0n);
  });

  it('rejects votes with zero staked voting power', () => {
    const detector = new RewardFarmingDetector();
    const result = detector.evaluateVote({
      voter: '0x2222222222222222222222222222222222222222',
      author: '0x1111111111111111111111111111111111111111',
      articleId: 'art-1',
      direction: 1,
      effectiveInfluence: 0n,
      timestampMs: 100_000,
      articlePublishedAtMs: 50_000,
    });

    expect(result.isEligible).toBe(false);
    expect(result.rejectionReason).toBe('ZERO_INFLUENCE');
  });

  it('flags bot burst votes cast < 10 seconds after article publication', () => {
    const detector = new RewardFarmingDetector();
    const result = detector.evaluateVote({
      voter: '0x2222222222222222222222222222222222222222',
      author: '0x1111111111111111111111111111111111111111',
      articleId: 'art-1',
      direction: 1,
      effectiveInfluence: 10_000n,
      timestampMs: 55_000, // 5 seconds after publish
      articlePublishedAtMs: 50_000,
    });

    expect(result.isEligible).toBe(false);
    expect(result.rejectionReason).toBe('BOT_BURST');
  });

  it('accepts legitimate human curation votes cast after reading threshold', () => {
    const detector = new RewardFarmingDetector();
    const result = detector.evaluateVote({
      voter: '0x2222222222222222222222222222222222222222',
      author: '0x1111111111111111111111111111111111111111',
      articleId: 'art-1',
      direction: 1,
      effectiveInfluence: 15_000n,
      timestampMs: 120_000, // 70 seconds after publish
      articlePublishedAtMs: 50_000,
    });

    expect(result.isEligible).toBe(true);
    expect(result.normalizedInfluence).toBe(15_000n);
  });
});

describe('PENORA Creator Boost & Promotion Suite', () => {
  it('enforces min/max boost parameters and word count limits', () => {
    // Under minimum
    expect(processCreatorBoost({
      articleId: 'a1', creatorWallet: '0x1', boostAmountPnr: MIN_BOOST_PNR - 1, articleWordCount: 150
    }).accepted).toBe(false);

    // Over maximum
    expect(processCreatorBoost({
      articleId: 'a1', creatorWallet: '0x1', boostAmountPnr: MAX_BOOST_PNR + 1, articleWordCount: 150
    }).accepted).toBe(false);

    // Low word count
    expect(processCreatorBoost({
      articleId: 'a1', creatorWallet: '0x1', boostAmountPnr: 20, articleWordCount: 40
    }).accepted).toBe(false);
  });

  it('strictly preserves organic reward independence when article is boosted', () => {
    const result = processCreatorBoost({
      articleId: 'a1', creatorWallet: '0x1', boostAmountPnr: 25, articleWordCount: 200
    });

    expect(result.accepted).toBe(true);
    expect(result.displayBadge.label).toBe('Promoted with PNR');
    // SECURITY INVARIANT: Paid boosts CANNOT alter organic voting reward calculation
    expect(result.organicRewardsModified).toBe(false);
  });
});

describe('PENORA Community Benefits Suite', () => {
  it('guarantees free browsing for 0 PP members and rewards higher PP stakes with cosmetic tiers', () => {
    const freeUser = evaluateCommunityBenefits(0);
    expect(freeUser.isFreeAccessGuaranteed).toBe(true);
    expect(freeUser.currentTier).toBeNull();
    expect(freeUser.nextTier?.tierName).toBe('Supporter');

    const supporter = evaluateCommunityBenefits(60);
    expect(supporter.currentTier?.tierName).toBe('Supporter');
    expect(supporter.nextTier?.tierName).toBe('Patron');

    const pillar = evaluateCommunityBenefits(1500);
    expect(pillar.currentTier?.tierName).toBe('Pillar');
    expect(pillar.nextTier).toBeNull();
  });
});
