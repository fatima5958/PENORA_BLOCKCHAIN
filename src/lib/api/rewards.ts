// src/lib/api/rewards.ts
// PENORA Blockchain — Financially Honest Reward Display Service
// Phase 5: "Votes are not dollars. Never calculate earnings using fake formulas."
// Provides verified reward calculations when onchain contracts and token pricing are live,
// and strictly honest fallback indicators when pricing is inactive.

export interface RewardEstimate {
  isTokenLive: boolean;
  voteCount: number;
  eligibleTokenAmount: number | null;
  verifiedTokenPriceUsd: number | null;
  estimatedUsd: number | null;
  displayUsd: string;
  badgeLabel: string;
  tooltip: string;
}

/**
 * Global constant reflecting current onchain reward network status.
 * Set to true only when smart contract token rewards and live verified price oracle feeds exist.
 */
export const IS_PENORA_TOKEN_LIVE = false;

/**
 * Computes the honest reward display state for an article or comment.
 * If live onchain contracts and price feeds are active, computes:
 *   estimated USD = eligible token reward × verified USD token price
 * If inactive, returns "$—" with an honest explanatory tooltip.
 */
export function getArticleRewardState(votesCount: number, eligibleTokens: number = 0): RewardEstimate {
  const safeVotes = Math.max(0, votesCount || 0);

  if (!IS_PENORA_TOKEN_LIVE) {
    return {
      isTokenLive: false,
      voteCount: safeVotes,
      eligibleTokenAmount: null,
      verifiedTokenPriceUsd: null,
      estimatedUsd: null,
      displayUsd: '$—',
      badgeLabel: `▲ ${safeVotes} votes · $—`,
      tooltip: "USD rewards will appear when PENORA's token rewards and verified pricing are live.",
    };
  }

  // Future onchain branch (once token contract and oracle feed are deployed):
  const mockPrice = 0.00;
  const estimated = eligibleTokens * mockPrice;
  return {
    isTokenLive: true,
    voteCount: safeVotes,
    eligibleTokenAmount: eligibleTokens,
    verifiedTokenPriceUsd: mockPrice,
    estimatedUsd: estimated,
    displayUsd: `$${estimated.toFixed(2)}`,
    badgeLabel: `▲ ${safeVotes} votes · $${estimated.toFixed(2)}`,
    tooltip: `Eligible token payout: ${eligibleTokens} PENORA @ $${mockPrice} USD`,
  };
}
