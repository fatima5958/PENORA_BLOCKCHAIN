// src/lib/tokenomics/creatorBoost.ts
// PENORA Creator Boost — PNR Utility Module
// Provides transparent, self-funded article promotion with strict separation from organic reward pools.

export const MIN_BOOST_PNR = 5;
export const MAX_BOOST_PNR = 50;
export const BOOST_COOLDOWN_HOURS = 24;

export interface CreatorBoostRequest {
  articleId: string;
  creatorWallet: string;
  boostAmountPnr: number;
  articleWordCount: number;
  lastBoostTimestampMs?: number;
  nowMs?: number;
}

export interface CreatorBoostResult {
  accepted: boolean;
  error?: string;
  promotedUntilMs?: number;
  displayBadge: {
    label: string;
    tooltip: string;
  };
  /**
   * CRITICAL SECURITY INVARIANT:
   * Boosted visibility NEVER modifies organic reward eligibility or voting influence.
   */
  organicRewardsModified: false;
}

/**
 * Validates and processes a Creator Boost request.
 * Enforces spending caps, cooldowns, and anti-spam limits.
 */
export function processCreatorBoost(req: CreatorBoostRequest): CreatorBoostResult {
  const now = req.nowMs ?? Date.now();

  if (req.boostAmountPnr < MIN_BOOST_PNR) {
    return {
      accepted: false,
      error: `Minimum boost amount is ${MIN_BOOST_PNR} PNR.`,
      displayBadge: { label: '', tooltip: '' },
      organicRewardsModified: false,
    };
  }

  if (req.boostAmountPnr > MAX_BOOST_PNR) {
    return {
      accepted: false,
      error: `Maximum single boost limit is ${MAX_BOOST_PNR} PNR to prevent pay-to-win dominance.`,
      displayBadge: { label: '', tooltip: '' },
      organicRewardsModified: false,
    };
  }

  if (req.articleWordCount < 80) {
    return {
      accepted: false,
      error: 'Articles must contain at least 80 words to prevent low-effort spam boosts.',
      displayBadge: { label: '', tooltip: '' },
      organicRewardsModified: false,
    };
  }

  if (req.lastBoostTimestampMs) {
    const elapsedHours = (now - req.lastBoostTimestampMs) / (3600 * 1000);
    if (elapsedHours < BOOST_COOLDOWN_HOURS) {
      const remainingHours = Math.ceil(BOOST_COOLDOWN_HOURS - elapsedHours);
      return {
        accepted: false,
        error: `Article is currently boosted. Cooldown active for ${remainingHours} more hours.`,
        displayBadge: { label: '', tooltip: '' },
        organicRewardsModified: false,
      };
    }
  }

  // 1 PNR = 1 hour of featured visibility (up to 48 hours)
  const durationHours = Math.min(48, Math.floor(req.boostAmountPnr * 0.96));
  const promotedUntilMs = now + durationHours * 3600 * 1000;

  return {
    accepted: true,
    promotedUntilMs,
    displayBadge: {
      label: 'Promoted with PNR',
      tooltip: 'This article was promoted by the author using PNR tokens for increased visibility. Organic voting rewards and Merkle settlements remain 100% independent.',
    },
    organicRewardsModified: false,
  };
}
