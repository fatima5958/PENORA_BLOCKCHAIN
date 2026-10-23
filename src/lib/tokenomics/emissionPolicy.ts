// src/lib/tokenomics/emissionPolicy.ts
// PENORA Tokenomics & Creator Reward Sustainability Architecture
// Enforces non-inflationary 100M PNR token cap and scheduled creator emission bounds.

export const TOTAL_FIXED_SUPPLY_PNR = 100_000_000n;
export const SCHEDULED_CREATOR_POOL_PNR = 30_000_000n; // 30M PNR over 5-year creator distribution
export const PROTECTED_RESERVE_PNR = 10_000_000n;      // 10M PNR timelocked longevity reserve
export const ECOSYSTEM_TREASURY_PNR = 60_000_000n;     // 60M PNR retained for development & operations

export const SPLIT_PERCENTAGES = {
  author: 70,   // 70% to verified content creator
  curator: 20,  // 20% to non-self upvoters weighted by voting influence
  reserve: 10,  // 10% retained for pool longevity and dust
} as const;

export interface EmissionPolicyConfig {
  /** Maximum PNR allocated per calendar day in 18-decimal base units */
  dailyCapWei: bigint;
  /** Actual verified PNR currently deposited in the reward vault/distributor */
  fundedVaultBalanceWei: bigint;
  /** Cumulative PNR already settled and paid out historically */
  totalPreviouslyReleasedWei: bigint;
}

export interface EmissionPolicyAudit {
  isSolvent: boolean;
  dailyCapPnr: number;
  fundedBalancePnr: number;
  previouslyReleasedPnr: number;
  remainingScheduledBudgetPnr: number;
  effectiveDailyBudgetWei: bigint;
  effectiveDailyBudgetPnr: number;
  runwayDaysAtCap: number;
  protectedReserveLocked: boolean;
  warnings: string[];
}

/**
 * Validates and calculates the safe, non-inflationary emission bounds.
 * Invariant: Daily budget CANNOT exceed available funded vault balance
 * and cumulative releases CANNOT exceed the 30M scheduled ceiling.
 */
export function evaluateEmissionPolicy(config: EmissionPolicyConfig): EmissionPolicyAudit {
  const warnings: string[] = [];
  const scheduledBudgetWei = SCHEDULED_CREATOR_POOL_PNR * 10n ** 18n;
  const released = config.totalPreviouslyReleasedWei;
  const funded = config.fundedVaultBalanceWei;

  if (released > scheduledBudgetWei) {
    warnings.push('CRITICAL: Total historical releases exceed the 30M scheduled ceiling.');
  }

  const remainingScheduledWei = scheduledBudgetWei > released ? scheduledBudgetWei - released : 0n;

  // The maximum permitted release for the day is capped by funded balance and remaining scheduled ceiling
  let safeDailyWei = config.dailyCapWei;
  if (safeDailyWei > funded) {
    warnings.push(`Daily cap (${Number(safeDailyWei / 10n ** 18n)} PNR) exceeds funded vault balance (${Number(funded / 10n ** 18n)} PNR). Throttled to funded balance.`);
    safeDailyWei = funded;
  }
  if (safeDailyWei > remainingScheduledWei) {
    warnings.push(`Daily cap exceeds remaining 30M scheduled ceiling (${Number(remainingScheduledWei / 10n ** 18n)} PNR). Throttled to remaining ceiling.`);
    safeDailyWei = remainingScheduledWei;
  }

  const isSolvent = funded >= safeDailyWei && released + safeDailyWei <= scheduledBudgetWei;
  const runwayDaysAtCap = safeDailyWei > 0n ? Number(funded / safeDailyWei) : 0;

  return {
    isSolvent,
    dailyCapPnr: Number(config.dailyCapWei / 10n ** 18n),
    fundedBalancePnr: Number(funded / 10n ** 18n),
    previouslyReleasedPnr: Number(released / 10n ** 18n),
    remainingScheduledBudgetPnr: Number(remainingScheduledWei / 10n ** 18n),
    effectiveDailyBudgetWei: safeDailyWei,
    effectiveDailyBudgetPnr: Number(safeDailyWei / 10n ** 18n),
    runwayDaysAtCap,
    protectedReserveLocked: true, // 10M reserve is strictly non-emitting
    warnings,
  };
}

export interface CreatorGrowthProjection {
  tierName: 'Bootstrapped' | 'Moderate' | 'High Growth' | 'Viral Scale';
  activeCreators: number;
  monthlyArticles: number;
  monthlyBudgetPnr: number;
  annualBudgetPnr: number;
  avgAuthorRewardPerArticlePnr: number;
  avgCuratorRewardPerArticlePnr: number;
  avgReserveRetainedPerArticlePnr: number;
  projectedRunwayYears: number;
}

/**
 * Projects creator reward sustainability under variable adoption tiers.
 * Models Steemit-style dynamic pool dilution: reward pools distribute fixed
 * budget proportionally to influence, ensuring token sustainability regardless of post volume.
 */
export function projectCreatorGrowthScenarios(annualBudgetPnr = 6_000_000): CreatorGrowthProjection[] {
  const monthlyBudgetPnr = annualBudgetPnr / 12;
  const totalRemainingScheduled = 30_000_000;
  const projectedRunwayYears = totalRemainingScheduled / annualBudgetPnr;

  const scenarios: Array<{ tierName: CreatorGrowthProjection['tierName']; activeCreators: number; monthlyArticles: number }> = [
    { tierName: 'Bootstrapped', activeCreators: 50, monthlyArticles: 200 },
    { tierName: 'Moderate', activeCreators: 500, monthlyArticles: 3_000 },
    { tierName: 'High Growth', activeCreators: 5_000, monthlyArticles: 50_000 },
    { tierName: 'Viral Scale', activeCreators: 25_000, monthlyArticles: 300_000 },
  ];

  return scenarios.map(s => {
    const totalArticleBudget = s.monthlyArticles > 0 ? monthlyBudgetPnr / s.monthlyArticles : 0;
    return {
      tierName: s.tierName,
      activeCreators: s.activeCreators,
      monthlyArticles: s.monthlyArticles,
      monthlyBudgetPnr,
      annualBudgetPnr,
      avgAuthorRewardPerArticlePnr: totalArticleBudget * 0.70,
      avgCuratorRewardPerArticlePnr: totalArticleBudget * 0.20,
      avgReserveRetainedPerArticlePnr: totalArticleBudget * 0.10,
      projectedRunwayYears,
    };
  });
}
