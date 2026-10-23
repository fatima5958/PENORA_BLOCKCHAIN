import React from 'react';
import {
  Zap,
  TrendingDown,
  Clock,
  Calendar,
  Coins,
  CheckCircle2,
  ArrowRightLeft,
} from 'lucide-react';
import { PowerDelegationCard } from './PowerDelegationCard';
import type { WalletState } from '../../lib/wallet/types';

export interface WalletPowerViewProps {
  state: WalletState;
  actionLoading: boolean;
  onPowerUp: () => void;
  onPowerDown: () => void;
  onClaimInstallments: () => void;
  onCancelPowerDown: () => void;
  onRefreshWallet: () => void;
}

export const WalletPowerView: React.FC<WalletPowerViewProps> = ({
  state,
  actionLoading,
  onPowerUp,
  onPowerDown,
  onClaimInstallments,
  onCancelPowerDown,
  onRefreshWallet,
}) => {
  const canPower = Boolean(state.address && state.isCorrectNetwork && state.contractsDeployed);
  const manaPercent =
    state.votingManaPercent !== null ? Math.min(100, Math.max(0, state.votingManaPercent)) : 0;

  return (
    <div className="space-y-5">
      {/* 1. Primary Power Summary & Actions */}
      <section
        aria-label="PENORA Power staking"
        className="rounded-2xl bg-[var(--wallet-surface)] border border-[var(--wallet-border)] p-5 sm:p-6 shadow-2xs space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[var(--wallet-border)]">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-[#0A2540] text-[#00E5F4] flex items-center justify-center shrink-0">
              <Zap className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[var(--wallet-text)]">
                PENORA Power (PP) &amp; Staking
              </h2>
              <p className="text-xs text-[var(--wallet-muted)]">
                1 PNR = 1 PP · Non-custodial curation influence on Polygon Amoy
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!canPower}
              onClick={onPowerUp}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-[#007C8B] hover:bg-[#006673] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-45"
            >
              <Zap className="h-4 w-4 text-[#00E5F4]" />
              <span>Power Up</span>
            </button>
            <button
              type="button"
              disabled={!canPower}
              onClick={onPowerDown}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-[var(--wallet-inset)] hover:border-amber-500/40 border border-[var(--wallet-border)] text-[var(--wallet-text)] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-45"
            >
              <TrendingDown className="h-4 w-4 text-amber-500" />
              <span>Power Down</span>
            </button>
          </div>
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-4 rounded-xl bg-[var(--wallet-inset)] border border-[var(--wallet-border)] space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--wallet-muted)]">
              Staked PENORA Power
            </span>
            <div className="text-2xl font-bold font-mono tabular-nums text-[var(--wallet-text)]">
              {state.balancePp ? `${state.balancePp} PP` : '— PP'}
            </div>
            <span className="text-[11px] text-[var(--wallet-muted)]">Locked 1:1 in Power Escrow</span>
          </div>

          <div className="p-4 rounded-xl bg-[var(--wallet-inset)] border border-[var(--wallet-border)] space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--wallet-muted)]">
              Available Liquid PNR
            </span>
            <div className="text-2xl font-bold font-mono tabular-nums text-[var(--wallet-text)]">
              {state.balancePnr ? `${state.balancePnr} PNR` : '— PNR'}
            </div>
            <span className="text-[11px] text-[var(--wallet-muted)]">Ready for instant Power Up</span>
          </div>

          <div className="p-4 rounded-xl bg-[var(--wallet-inset)] border border-[var(--wallet-border)] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--wallet-muted)]">
                Voting Mana
              </span>
              <span className="font-mono text-sm font-bold text-[#007C8B] dark:text-[#00E5F4]">
                {state.votingManaPercent !== null ? `${state.votingManaPercent.toFixed(1)}%` : '—'}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-[var(--wallet-surface)] overflow-hidden">
              <div
                className="h-full bg-[#007C8B] dark:bg-[#00E5F4] rounded-full transition-all"
                style={{ width: `${manaPercent}%` }}
              />
            </div>
            <span className="text-[11px] text-[var(--wallet-muted)] block">
              5-day linear recovery (2% per 100% vote)
            </span>
          </div>
        </div>

        {/* 13-Week Power Down Schedule */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-[var(--wallet-text)] flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#007C8B] dark:text-[#00E5F4]" />
              <span>13-Week Power Down Schedule</span>
            </h3>
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#007C8B]/12 text-[#007C8B] dark:text-[#00E5F4]">
              Permissionless Escrow
            </span>
          </div>

          {state.powerDownSchedule && state.powerDownSchedule.active ? (
            <div className="p-4 rounded-xl bg-[var(--wallet-inset)] border border-[var(--wallet-border)] space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="text-[11px] text-[var(--wallet-muted)] block">Total Withdrawal</span>
                  <span className="font-mono text-sm font-bold text-[var(--wallet-text)]">
                    {state.powerDownSchedule.totalAmount} PNR
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-[var(--wallet-muted)] block">Weekly Installment</span>
                  <span className="font-mono text-sm font-bold text-[#007C8B] dark:text-[#00E5F4]">
                    {state.powerDownSchedule.weeklyInstallment} PNR
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-[var(--wallet-muted)] block">Claimed Progress</span>
                  <span className="font-mono text-sm font-bold text-[var(--wallet-text)]">
                    {state.powerDownSchedule.weeksClaimed} / 13 Weeks
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-[var(--wallet-muted)] block">Claimable Now</span>
                  <span className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    {state.powerDownSchedule.claimableAmount} PNR
                  </span>
                </div>
              </div>

              <p className="text-xs text-[var(--wallet-muted)]">
                Next installment unlocks:{' '}
                {new Date(state.powerDownSchedule.nextUnlockTimestamp * 1000).toLocaleString()}
              </p>

              <div className="w-full h-2 rounded-full bg-[var(--wallet-surface)] overflow-hidden">
                <div
                  className="h-full bg-[#007C8B] dark:bg-[#00E5F4] rounded-full transition-all"
                  style={{ width: `${(state.powerDownSchedule.weeksClaimed / 13) * 100}%` }}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClaimInstallments}
                  disabled={
                    actionLoading || parseFloat(state.powerDownSchedule.claimableAmount) <= 0
                  }
                  className="min-h-[40px] py-2 px-4 rounded-xl bg-[#007C8B] hover:bg-[#006673] disabled:bg-[var(--wallet-surface)] disabled:text-[var(--wallet-muted)] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                >
                  <Coins className="h-3.5 w-3.5" />
                  <span>Claim Matured Installments</span>
                </button>

                <button
                  type="button"
                  onClick={onCancelPowerDown}
                  disabled={actionLoading}
                  className="min-h-[40px] py-2 px-3.5 rounded-xl bg-amber-500/12 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 text-xs font-semibold transition-colors"
                >
                  Cancel Remaining Schedule (Restore PP)
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-[var(--wallet-inset)] border border-[var(--wallet-border)] space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--wallet-text)]">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>
                  {state.contractsDeployed
                    ? 'No active Power Down schedule'
                    : 'Power Down status unavailable'}
                </span>
              </div>
              <p className="text-xs text-[var(--wallet-muted)] leading-relaxed">
                Power Down reserves requested PP immediately and unlocks 1/13th every 7 days over 13 weeks. The final installment resolves any rounding remainder.
              </p>
            </div>
          )}
        </div>

        {/* Concise Rules Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="p-3.5 rounded-xl bg-[var(--wallet-inset)] border border-[var(--wallet-border)] space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--wallet-text)]">
              <Zap className="h-3.5 w-3.5 text-[#007C8B] dark:text-[#00E5F4]" />
              <span>Instant Power Up</span>
            </div>
            <p className="text-[11px] text-[var(--wallet-muted)]">
              Convert liquid PNR into staked PP immediately (1 PNR = 1 PP) with zero protocol fee.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[var(--wallet-inset)] border border-[var(--wallet-border)] space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--wallet-text)]">
              <Calendar className="h-3.5 w-3.5 text-amber-500" />
              <span>13-Week Vesting</span>
            </div>
            <p className="text-[11px] text-[var(--wallet-muted)]">
              Unstaked PP unlocks in 13 weekly installments starting 7 days after initiation.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[var(--wallet-inset)] border border-[var(--wallet-border)] space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--wallet-text)]">
              <ArrowRightLeft className="h-3.5 w-3.5 text-[#007C8B] dark:text-[#00E5F4]" />
              <span>Revocable Delegation</span>
            </div>
            <p className="text-[11px] text-[var(--wallet-muted)]">
              Delegate voting weight to creators below while keeping 100% token ownership in escrow.
            </p>
          </div>
        </div>
      </section>

      {/* 2. Power Delegation Section */}
      <PowerDelegationCard userAddress={state.address} onRefreshWallet={onRefreshWallet} />
    </div>
  );
};
