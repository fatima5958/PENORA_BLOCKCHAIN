// src/lib/tokenomics/communityBenefits.ts
// PENORA Community Benefits — PNR Utility Module
// Provides community-level staking recognition without paywalling ordinary readers.

export interface CommunityStakingTier {
  tierName: 'Supporter' | 'Patron' | 'Pillar';
  minStakedPp: number;
  badgeTitle: string;
  benefits: string[];
}

export const COMMUNITY_TIERS: CommunityStakingTier[] = [
  {
    tierName: 'Supporter',
    minStakedPp: 50,
    badgeTitle: 'Community Supporter',
    benefits: ['Cosmetic member flair', 'Community forum upvote weight multiplier (internal display)'],
  },
  {
    tierName: 'Patron',
    minStakedPp: 250,
    badgeTitle: 'Community Patron',
    benefits: ['Patron badge in community feed', 'Access to community creator AMA channels'],
  },
  {
    tierName: 'Pillar',
    minStakedPp: 1000,
    badgeTitle: 'Community Pillar',
    benefits: ['Pillar highlight on community page', 'Advisory vote on community curation themes'],
  },
];

export interface MemberBenefitCheck {
  isFreeAccessGuaranteed: true;
  currentTier: CommunityStakingTier | null;
  nextTier: CommunityStakingTier | null;
  ppNeededForNextTier: number;
}

/**
 * Evaluates member community standing based on non-custodial staked PENORA Power.
 * Guarantees that free browsing and standard publishing are ALWAYS preserved.
 */
export function evaluateCommunityBenefits(userStakedPp: number): MemberBenefitCheck {
  let currentTier: CommunityStakingTier | null = null;
  let nextTier: CommunityStakingTier | null = COMMUNITY_TIERS[0];

  for (let i = 0; i < COMMUNITY_TIERS.length; i++) {
    if (userStakedPp >= COMMUNITY_TIERS[i].minStakedPp) {
      currentTier = COMMUNITY_TIERS[i];
      nextTier = COMMUNITY_TIERS[i + 1] ?? null;
    }
  }

  const ppNeeded = nextTier ? Math.max(0, nextTier.minStakedPp - userStakedPp) : 0;

  return {
    isFreeAccessGuaranteed: true,
    currentTier,
    nextTier,
    ppNeededForNextTier: ppNeeded,
  };
}
