// src/components/wallet/RewardEconomicsPanel.tsx
// PENORA Creator Reward Economics & Protocol Runway Architecture
// Admin & Analytical view for protocol sustainability, runway projection, and anti-farming detection.

import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  Lock,
  Layers,
  PieChart,
  Calendar,
  Users,
  Activity,
  CheckCircle2,
  ExternalLink,
  Info,
} from 'lucide-react';
import {
  TOTAL_FIXED_SUPPLY_PNR,
  SCHEDULED_CREATOR_POOL_PNR,
  PROTECTED_RESERVE_PNR,
  ECOSYSTEM_TREASURY_PNR,
  SPLIT_PERCENTAGES,
  evaluateEmissionPolicy,
  projectCreatorGrowthScenarios,
  type CreatorGrowthProjection,
} from '../../lib/tokenomics/emissionPolicy';

interface RewardEconomicsPanelProps {
  vaultBalancePnr?: number;
  totalReleasedPnr?: number;
  dailyCapPnr?: number;
}

export function RewardEconomicsPanel({
  vaultBalancePnr = 30_000_000,
  totalReleasedPnr = 0,
  dailyCapPnr = 16_438, // ~6M PNR / 365 days
}: RewardEconomicsPanelProps) {
  const [selectedTier, setSelectedTier] = useState<CreatorGrowthProjection['tierName']>('Moderate');

  const audit = useMemo(() => {
    return evaluateEmissionPolicy({
      dailyCapWei: BigInt(dailyCapPnr) * 10n ** 18n,
      fundedVaultBalanceWei: BigInt(vaultBalancePnr) * 10n ** 18n,
      totalPreviouslyReleasedWei: BigInt(totalReleasedPnr) * 10n ** 18n,
    });
  }, [vaultBalancePnr, totalReleasedPnr, dailyCapPnr]);

  const scenarios = useMemo(() => projectCreatorGrowthScenarios(6_000_000), []);
  const activeScenario = scenarios.find(s => s.tierName === selectedTier) || scenarios[1];

  const scheduledCeilingNumber = Number(SCHEDULED_CREATOR_POOL_PNR);
  const remainingBudgetNumber = audit.remainingScheduledBudgetPnr;
  const percentEmitted = ((scheduledCeilingNumber - remainingBudgetNumber) / scheduledCeilingNumber) * 100;

  return (
    <div className="space-y-6">
      {/* Protocol Solvency Status Header */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-[#0A2540] via-[#0E3558] to-[#0A2540] text-white border border-white/10 shadow-lg space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-mono tracking-widest text-[#00E5F4] font-bold">
              PENORA TOKENOMICS &amp; REWARD RUNWAY
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-semibold flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              <span>100M Fixed PNR Cap</span>
            </span>
          </div>
          <span className="text-xs text-white/70 font-mono">
            Polygon Amoy (80002) Verified State
          </span>
        </div>
        <h3 className="text-lg font-serif font-bold text-white">Creator Reward Economics &amp; Solvency</h3>
        <p className="text-xs text-white/80 max-w-2xl leading-relaxed">
          PENORA strictly prevents inflation. The 100,000,000 PNR supply is immutable. Creator rewards are funded exclusively from the 30M scheduled creator pool with a 10M protected longevity reserve.
        </p>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-[var(--wallet-surface)] border border-[#007C8B]/15 space-y-1">
          <span className="text-[10px] uppercase font-bold text-[var(--wallet-muted)] flex items-center gap-1">
            <Layers className="h-3 w-3 text-[#007C8B]" />
            Funded Vault Allocation
          </span>
          <div className="font-mono text-xl font-bold text-[var(--wallet-text)]">
            {audit.fundedBalancePnr.toLocaleString()}
            <span className="text-xs font-normal text-[var(--wallet-muted)] ml-1">PNR</span>
          </div>
          <span className="text-[10px] text-[var(--wallet-muted)] block">Liquid in PenoraRewardVault</span>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--wallet-surface)] border border-[#007C8B]/15 space-y-1">
          <span className="text-[10px] uppercase font-bold text-[var(--wallet-muted)] flex items-center gap-1">
            <Lock className="h-3 w-3 text-amber-600 dark:text-amber-400" />
            Protected Reserve
          </span>
          <div className="font-mono text-xl font-bold text-amber-600 dark:text-amber-400">
            10,000,000
            <span className="text-xs font-normal text-[var(--wallet-muted)] ml-1">PNR</span>
          </div>
          <span className="text-[10px] text-[var(--wallet-muted)] block">Timelocked protocol reserve</span>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--wallet-surface)] border border-[#007C8B]/15 space-y-1">
          <span className="text-[10px] uppercase font-bold text-[var(--wallet-muted)] flex items-center gap-1">
            <Calendar className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
            Estimated Runway
          </span>
          <div className="font-mono text-xl font-bold text-emerald-600 dark:text-emerald-400">
            ~{(audit.runwayDaysAtCap / 365).toFixed(1)}
            <span className="text-xs font-normal text-[var(--wallet-muted)] ml-1">Years</span>
          </div>
          <span className="text-[10px] text-[var(--wallet-muted)] block">{audit.runwayDaysAtCap.toLocaleString()} daily cycles at cap</span>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--wallet-surface)] border border-[#007C8B]/15 space-y-1">
          <span className="text-[10px] uppercase font-bold text-[var(--wallet-muted)] flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-cyan-600 dark:text-cyan-400" />
            Daily Safe Emission Cap
          </span>
          <div className="font-mono text-xl font-bold text-cyan-600 dark:text-cyan-400">
            {audit.effectiveDailyBudgetPnr.toLocaleString()}
            <span className="text-xs font-normal text-[var(--wallet-muted)] ml-1">PNR / day</span>
          </div>
          <span className="text-[10px] text-[var(--wallet-muted)] block">Strictly throttled to solvency</span>
        </div>
      </div>

      {/* Reward Distribution Split: 70% Author / 20% Curator / 10% Reserve */}
      <div className="p-5 rounded-3xl bg-[var(--wallet-surface)] border border-[#007C8B]/15 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-serif text-sm font-bold text-[var(--wallet-text)] flex items-center gap-2">
            <PieChart className="h-4 w-4 text-[#007C8B]" />
            <span>PENORA Reward Allocation Ratio</span>
          </h4>
          <span className="text-[11px] font-mono text-[var(--wallet-muted)]">
            Enforced by `PenoraArticleRewards.sol`
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-2xl bg-[var(--wallet-inset)] border border-[#007C8B]/20 space-y-1">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-[var(--wallet-text)]">Content Author</span>
              <span className="font-mono font-bold text-[#007C8B]">70%</span>
            </div>
            <p className="text-[11px] text-[var(--wallet-muted)]">
              Directly delivered to the verified creator upon completion of the 7-day maturity period.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-[var(--wallet-inset)] border border-cyan-500/20 space-y-1">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-[var(--wallet-text)]">Organic Curators</span>
              <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">20%</span>
            </div>
            <p className="text-[11px] text-[var(--wallet-muted)]">
              Distributed to upvoters proportionally weighted by PENORA Power and early curation timing.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-[var(--wallet-inset)] border border-amber-500/20 space-y-1">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-[var(--wallet-text)]">Protocol Reserve</span>
              <span className="font-mono font-bold text-amber-600 dark:text-amber-400">10%</span>
            </div>
            <p className="text-[11px] text-[var(--wallet-muted)]">
              Retained in reward vault to protect against rounding dust and replenish long-term runway.
            </p>
          </div>
        </div>
      </div>

      {/* Anti-Farming & Integrity Protection Monitor */}
      <div className="p-5 rounded-3xl bg-[var(--wallet-surface)] border border-[#007C8B]/15 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-serif text-sm font-bold text-[var(--wallet-text)] flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>Anti-Farming &amp; Manipulation Safeguards</span>
          </h4>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">
            Active in Protocol
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-2xl bg-[var(--wallet-inset)] space-y-1">
            <span className="font-semibold text-[var(--wallet-text)] block">1. Self-Vote Neutralization</span>
            <p className="text-[11px] text-[var(--wallet-muted)]">
              Authors voting on their own articles are strictly filtered out with 0 curation share and 0 reward inflation.
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-[var(--wallet-inset)] space-y-1">
            <span className="font-semibold text-[var(--wallet-text)] block">2. Human Reading Threshold</span>
            <p className="text-[11px] text-[var(--wallet-muted)]">
              Votes cast &lt; 10 seconds post-publish are identified as automated bot scraping and disqualified.
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-[var(--wallet-inset)] space-y-1">
            <span className="font-semibold text-[var(--wallet-text)] block">3. Velocity &amp; Ring Filters</span>
            <p className="text-[11px] text-[var(--wallet-muted)]">
              Burst limits (&gt; 20 votes/minute) and circular vote-swapping rings are automatically throttled.
            </p>
          </div>
        </div>
      </div>

      {/* Adoption Tier Runway Projections */}
      <div className="p-5 rounded-3xl bg-[var(--wallet-surface)] border border-[#007C8B]/15 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="font-serif text-sm font-bold text-[var(--wallet-text)] flex items-center gap-2">
              <Activity className="h-4 w-4 text-[#007C8B]" />
              <span>Dynamic Pool Dilution Modeling (PENORA Protocol)</span>
            </h4>
            <p className="text-xs text-[var(--wallet-muted)]">
              Simulated projections based on a fixed 6M PNR/year emission rate divided among active creators.
            </p>
          </div>

          <div className="flex items-center gap-1 bg-[var(--wallet-inset)] p-1 rounded-xl">
            {scenarios.map(s => (
              <button
                key={s.tierName}
                type="button"
                onClick={() => setSelectedTier(s.tierName)}
                className={`py-1 px-2.5 rounded-lg text-xs font-medium transition-all ${
                  selectedTier === s.tierName
                    ? 'bg-[#007C8B] text-white shadow-sm'
                    : 'text-[var(--wallet-muted)] hover:text-[var(--wallet-text)]'
                }`}
              >
                {s.tierName}
              </button>
            ))}
          </div>
        </div>

        {/* Selected Scenario Details */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-[var(--wallet-inset)] text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-[var(--wallet-muted)] block">Active Creators</span>
            <span className="font-mono text-base font-bold text-[var(--wallet-text)]">
              {activeScenario.activeCreators.toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-[var(--wallet-muted)] block">Monthly Articles</span>
            <span className="font-mono text-base font-bold text-[var(--wallet-text)]">
              {activeScenario.monthlyArticles.toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-[var(--wallet-muted)] block">Avg Author / Article</span>
            <span className="font-mono text-base font-bold text-[#007C8B]">
              {activeScenario.avgAuthorRewardPerArticlePnr.toFixed(2)} PNR
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-[var(--wallet-muted)] block">Projected Runway</span>
            <span className="font-mono text-base font-bold text-emerald-600 dark:text-emerald-400">
              {activeScenario.projectedRunwayYears.toFixed(1)} Years
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
