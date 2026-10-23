// src/lib/tokenomics/liquiditySimulation.ts
// PENORA Testnet Liquidity Modeling & AMM Constant-Product (x * y = k) Simulation
// STRICT COMPLIANCE: Testnet simulation only. All prices and projections are hypothetical.

export const AMM_FEE_BPS = 30n; // Standard 0.3% Uniswap v2 fee
export const BPS_DENOMINATOR = 10_000n;

export interface LiquidityScenarioConfig {
  usdtBudget: number;       // e.g. 50, 100, 250, 500 USD
  initialPnrPriceUsd: number; // e.g. 0.01 USD / PNR
}

export interface CreatorSellSimulation {
  sellAmountPnr: number;
  grossUsdExpected: number;  // At pre-trade spot price
  netUsdReceived: number;    // After AMM constant product curve & 0.3% fee
  effectivePriceUsd: number; // netUsdReceived / sellAmountPnr
  slippagePercent: number;   // (grossUsdExpected - netUsdReceived) / grossUsdExpected * 100
  newSpotPriceUsd: number;   // y' / x'
  priceImpactPercent: number;
  exhaustionRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface LiquidityModelResult {
  isSimulation: true;
  disclaimer: string;
  usdtBudget: number;
  initialPriceUsd: number;
  requiredFounderUsdt: number;
  requiredFounderPnr: number;
  initialPnrReserve: number;
  initialUsdtReserve: number;
  poolDepthConstantK: number;
  sellSimulations: CreatorSellSimulation[];
  riskSummary: string;
}

/**
 * Executes constant product AMM sell calculation:
 * (x + dx * (1 - fee)) * (y - dy) = k
 * dy = y * dx * (1 - fee) / (x + dx * (1 - fee))
 */
export function simulateAmmSell(
  xReserve: number, // PNR in pool
  yReserve: number, // USDT in pool
  sellPnr: number,
  initialSpotPrice: number
): CreatorSellSimulation {
  const feeMultiplier = 0.997; // 1 - 0.003
  const effectiveDx = sellPnr * feeMultiplier;
  const newX = xReserve + effectiveDx;
  const newY = (xReserve * yReserve) / newX;
  const dyUsdt = yReserve - newY;

  const grossExpected = sellPnr * initialSpotPrice;
  const effectivePrice = sellPnr > 0 ? dyUsdt / sellPnr : initialSpotPrice;
  const slippagePercent = grossExpected > 0 ? Math.max(0, ((grossExpected - dyUsdt) / grossExpected) * 100) : 0;
  const newSpotPrice = newY / (xReserve + sellPnr);
  const priceImpactPercent = initialSpotPrice > 0 ? Math.max(0, ((initialSpotPrice - newSpotPrice) / initialSpotPrice) * 100) : 0;

  // Determine exhaustion risk based on % of pool USDT drained
  const drainRatio = dyUsdt / yReserve;
  let exhaustionRisk: CreatorSellSimulation['exhaustionRisk'] = 'LOW';
  if (drainRatio >= 0.30 || slippagePercent >= 30) {
    exhaustionRisk = 'CRITICAL';
  } else if (drainRatio >= 0.20 || slippagePercent >= 15) {
    exhaustionRisk = 'HIGH';
  } else if (drainRatio >= 0.08 || slippagePercent >= 5) {
    exhaustionRisk = 'MEDIUM';
  }

  return {
    sellAmountPnr: sellPnr,
    grossUsdExpected: Number(grossExpected.toFixed(4)),
    netUsdReceived: Number(dyUsdt.toFixed(4)),
    effectivePriceUsd: Number(effectivePrice.toFixed(6)),
    slippagePercent: Number(slippagePercent.toFixed(2)),
    newSpotPriceUsd: Number(newSpotPrice.toFixed(6)),
    priceImpactPercent: Number(priceImpactPercent.toFixed(2)),
    exhaustionRisk,
  };
}

/**
 * Evaluates a liquidity scenario ($50, $100, $250, $500) against creator withdrawal sizes.
 */
export function evaluateLiquidityScenario(
  config: LiquidityScenarioConfig,
  creatorWithdrawalTiers: number[] = [100, 500, 1000, 2500]
): LiquidityModelResult {
  const initialUsdtReserve = config.usdtBudget;
  const initialPnrReserve = config.usdtBudget / config.initialPnrPriceUsd;
  const poolDepthConstantK = initialPnrReserve * initialUsdtReserve;

  const sellSimulations = creatorWithdrawalTiers.map(sellPnr =>
    simulateAmmSell(initialPnrReserve, initialUsdtReserve, sellPnr, config.initialPnrPriceUsd)
  );

  let riskSummary = 'Manageable liquidity depth for micro-redemptions.';
  if (config.usdtBudget <= 100) {
    riskSummary = 'High slippage and extreme price sensitivity; modest creator sales (>500 PNR) create severe price collapse.';
  } else if (config.usdtBudget <= 250) {
    riskSummary = 'Moderate stability for smaller payouts (<1000 PNR); larger withdrawals cause double-digit slippage.';
  } else {
    riskSummary = 'Best starter testnet depth; absorbs standard creator claims (<1000 PNR) with single-digit slippage.';
  }

  return {
    isSimulation: true,
    disclaimer: 'Hypothetical simulation for testnet analysis only. Not financial advice or token price guarantee.',
    usdtBudget: config.usdtBudget,
    initialPriceUsd: config.initialPnrPriceUsd,
    requiredFounderUsdt: initialUsdtReserve,
    requiredFounderPnr: initialPnrReserve,
    initialPnrReserve,
    initialUsdtReserve,
    poolDepthConstantK,
    sellSimulations,
    riskSummary,
  };
}

/**
 * Runs the complete standard liquidity simulation suite across $50, $100, $250, $500 tiers.
 */
export function runLiquiditySimulationSuite(initialPriceUsd = 0.01): Record<string, LiquidityModelResult> {
  const tiers = [50, 100, 250, 500];
  const results: Record<string, LiquidityModelResult> = {};
  for (const budget of tiers) {
    results[`$${budget}`] = evaluateLiquidityScenario({
      usdtBudget: budget,
      initialPnrPriceUsd: initialPriceUsd,
    });
  }
  return results;
}
