// src/tests/tokenomicsEmissionAndLiquidity.test.ts
import { describe, it, expect } from 'vitest';
import {
  TOTAL_FIXED_SUPPLY_PNR,
  SCHEDULED_CREATOR_POOL_PNR,
  PROTECTED_RESERVE_PNR,
  evaluateEmissionPolicy,
  projectCreatorGrowthScenarios,
} from '../lib/tokenomics/emissionPolicy';
import {
  evaluateLiquidityScenario,
  runLiquiditySimulationSuite,
  simulateAmmSell,
} from '../lib/tokenomics/liquiditySimulation';

describe('PENORA Tokenomics & Emission Sustainability Suite', () => {
  it('enforces total supply of 100M PNR, 30M scheduled creator pool, and 10M protected reserve', () => {
    expect(TOTAL_FIXED_SUPPLY_PNR).toBe(100_000_000n);
    expect(SCHEDULED_CREATOR_POOL_PNR).toBe(30_000_000n);
    expect(PROTECTED_RESERVE_PNR).toBe(10_000_000n);
  });

  it('keeps 10M protected reserve strictly locked and non-emitting', () => {
    const audit = evaluateEmissionPolicy({
      dailyCapWei: 10_000n * 10n ** 18n,
      fundedVaultBalanceWei: 500_000n * 10n ** 18n,
      totalPreviouslyReleasedWei: 1_000_000n * 10n ** 18n,
    });
    expect(audit.protectedReserveLocked).toBe(true);
    expect(audit.isSolvent).toBe(true);
    expect(audit.remainingScheduledBudgetPnr).toBe(29_000_000);
  });

  it('strictly throttles daily emission if requested cap exceeds funded vault balance', () => {
    const audit = evaluateEmissionPolicy({
      dailyCapWei: 100_000n * 10n ** 18n, // requests 100k
      fundedVaultBalanceWei: 25_000n * 10n ** 18n, // only 25k in vault
      totalPreviouslyReleasedWei: 0n,
    });
    // Must throttle down to 25k
    expect(audit.effectiveDailyBudgetPnr).toBe(25_000);
    expect(audit.warnings.length).toBeGreaterThan(0);
    expect(audit.warnings[0]).toContain('exceeds funded vault balance');
  });

  it('strictly prevents emissions beyond the 30M scheduled creator ceiling', () => {
    const audit = evaluateEmissionPolicy({
      dailyCapWei: 50_000n * 10n ** 18n,
      fundedVaultBalanceWei: 10_000_000n * 10n ** 18n,
      totalPreviouslyReleasedWei: 29_980_000n * 10n ** 18n, // Only 20k left of the 30M
    });
    expect(audit.effectiveDailyBudgetPnr).toBe(20_000); // Throttled to 20k
    expect(audit.remainingScheduledBudgetPnr).toBe(20_000);
  });

  it('calculates creator growth scenarios with PENORA dynamic dilution (fixed pool, dilution per post)', () => {
    const scenarios = projectCreatorGrowthScenarios(6_000_000); // 6M PNR / year -> 5 years runway
    expect(scenarios).toHaveLength(4);

    const [bootstrapped, moderate, highGrowth, viral] = scenarios;
    expect(bootstrapped.tierName).toBe('Bootstrapped');
    expect(bootstrapped.projectedRunwayYears).toBe(5);

    // Reward split must strictly equal 70% author, 20% curator, 10% reserve
    for (const s of scenarios) {
      const sum = s.avgAuthorRewardPerArticlePnr + s.avgCuratorRewardPerArticlePnr + s.avgReserveRetainedPerArticlePnr;
      const expectedTotalPerArticle = s.monthlyBudgetPnr / s.monthlyArticles;
      expect(Math.abs(sum - expectedTotalPerArticle)).toBeLessThan(0.001);
      expect(s.avgAuthorRewardPerArticlePnr).toBeCloseTo(expectedTotalPerArticle * 0.70, 3);
      expect(s.avgCuratorRewardPerArticlePnr).toBeCloseTo(expectedTotalPerArticle * 0.20, 3);
      expect(s.avgReserveRetainedPerArticlePnr).toBeCloseTo(expectedTotalPerArticle * 0.10, 3);
    }

    // High growth has higher article count, so lower average PNR per post (preserving overall solvency)
    expect(bootstrapped.avgAuthorRewardPerArticlePnr).toBeGreaterThan(moderate.avgAuthorRewardPerArticlePnr);
    expect(moderate.avgAuthorRewardPerArticlePnr).toBeGreaterThan(highGrowth.avgAuthorRewardPerArticlePnr);
    expect(highGrowth.avgAuthorRewardPerArticlePnr).toBeGreaterThan(viral.avgAuthorRewardPerArticlePnr);
  });
});

describe('PENORA Testnet Liquidity Modeling & AMM Simulation Suite', () => {
  it('correctly models constant-product AMM mechanics with 0.3% fee', () => {
    // 10,000 PNR and 100 USDT (Spot price = $0.01)
    const result = simulateAmmSell(10_000, 100, 100, 0.01);
    expect(result.grossUsdExpected).toBe(1.0); // 100 * 0.01
    // Net USDT received must be slightly less than $1 due to fee and slippage
    expect(result.netUsdReceived).toBeLessThan(1.0);
    expect(result.netUsdReceived).toBeGreaterThan(0.95);
    expect(result.slippagePercent).toBeGreaterThan(0);
    expect(result.slippagePercent).toBeLessThan(5);
    expect(result.exhaustionRisk).toBe('LOW');
  });

  it('detects severe slippage and critical exhaustion when selling large sizes into shallow pools', () => {
    // $50 pool = 5,000 PNR and 50 USDT
    // Creator sells 2,500 PNR (50% of the pool)
    const result = simulateAmmSell(5_000, 50, 2_500, 0.01);
    expect(result.grossUsdExpected).toBe(25.0);
    // In constant product, selling 50% of pool results in severe slippage
    expect(result.netUsdReceived).toBeLessThan(18.0);
    expect(result.slippagePercent).toBeGreaterThan(30);
    expect(result.exhaustionRisk).toBe('CRITICAL');
  });

  it('runs complete liquidity simulation across $50, $100, $250, $500 tiers', () => {
    const suite = runLiquiditySimulationSuite(0.01);
    expect(Object.keys(suite)).toEqual(['$50', '$100', '$250', '$500']);

    for (const [tier, model] of Object.entries(suite)) {
      expect(model.isSimulation).toBe(true);
      expect(model.disclaimer).toContain('Hypothetical simulation');
      expect(model.requiredFounderUsdt).toBe(model.usdtBudget);
      expect(model.requiredFounderPnr).toBe(model.usdtBudget / 0.01);
      expect(model.poolDepthConstantK).toBe(model.requiredFounderUsdt * model.requiredFounderPnr);
      expect(model.sellSimulations).toHaveLength(4); // 100, 500, 1000, 2500 PNR
    }

    // $500 pool has lower slippage for 500 PNR sale than $50 pool
    const sell500at50 = suite['$50'].sellSimulations.find(s => s.sellAmountPnr === 500)!;
    const sell500at500 = suite['$500'].sellSimulations.find(s => s.sellAmountPnr === 500)!;
    expect(sell500at500.slippagePercent).toBeLessThan(sell500at50.slippagePercent);
  });
});
