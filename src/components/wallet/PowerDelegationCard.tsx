// src/components/wallet/PowerDelegationCard.tsx
// Steemit-Style PENORA Power Delegation Interface
// Display: My Total Power, Available Power, Delegated Out, Received Power, Effective Power, Active Delegations, History

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  ShieldCheck,
  ArrowRightLeft,
  Zap,
  Info,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Edit2,
  PlusCircle,
  ExternalLink,
  Lock,
} from 'lucide-react';
import { isAddress, zeroAddress } from 'viem';
import {
  fetchUserDelegationOverview,
  executeDelegatePower,
  executeRevokeDelegation,
  type UserDelegationOverview,
} from '../../lib/contracts/delegationClient';
import { PENORA_CONTRACT_ADDRESSES, isConfiguredAddress } from '../../lib/wallet/contracts';

interface PowerDelegationCardProps {
  userAddress?: string | null;
  onRefreshWallet?: () => void;
}

export const PowerDelegationCard: React.FC<PowerDelegationCardProps> = ({
  userAddress,
  onRefreshWallet,
}) => {
  const [overview, setOverview] = useState<UserDelegationOverview>({
    isConfigured: false,
    totalPowerPnr: 0,
    availableToDelegatePnr: 0,
    delegatedOutPnr: 0,
    receivedPowerPnr: 0,
    effectiveVotingPowerPnr: 0,
    activeDelegations: [],
    receivedDelegations: [],
    history: [],
  });

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Form states
  const [recipient, setRecipient] = useState('');
  const [delegateAmount, setDelegateAmount] = useState('');
  const [showDelegateModal, setShowDelegateModal] = useState(false);

  const delegationContractAddress = (PENORA_CONTRACT_ADDRESSES as any).POWER_DELEGATION;
  const isContractLive = isConfiguredAddress(delegationContractAddress);

  const loadData = useCallback(async () => {
    if (!userAddress) return;
    setLoading(true);
    try {
      const data = await fetchUserDelegationOverview(userAddress);
      setOverview(data);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }, [userAddress]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelegateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);

    if (!userAddress) {
      setActionError('Connect your EVM wallet to delegate PENORA Power.');
      return;
    }

    if (!isAddress(recipient) || recipient.toLowerCase() === zeroAddress) {
      setActionError('Please enter a valid 42-character Polygon/EVM recipient address.');
      return;
    }

    if (recipient.toLowerCase() === userAddress.toLowerCase()) {
      setActionError('Self-delegation is prohibited. You already hold 100% of your own voting power.');
      return;
    }

    const amountNum = parseFloat(delegateAmount);
    if (!amountNum || amountNum <= 0 || isNaN(amountNum)) {
      setActionError('Please specify a positive PNR amount to delegate.');
      return;
    }

    if (amountNum > overview.availableToDelegatePnr && overview.isConfigured) {
      setActionError(`Amount exceeds your available unencumbered power (${overview.availableToDelegatePnr.toLocaleString()} PP).`);
      return;
    }

    setSubmitting(true);
    setStatusMessage('Preparing power delegation transaction...');

    try {
      const res = await executeDelegatePower({
        delegatee: recipient,
        amountPnr: delegateAmount,
        onProgress: (msg) => setStatusMessage(msg),
      });

      if (res.success) {
        setActionSuccess(`Successfully delegated ${delegateAmount} PP to ${recipient.slice(0, 6)}...${recipient.slice(-4)}!`);
        setDelegateAmount('');
        setRecipient('');
        setShowDelegateModal(false);
        await loadData();
        onRefreshWallet?.();
      } else {
        setActionError(res.error || 'Delegation failed.');
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Delegation transaction failed.');
    } finally {
      setSubmitting(false);
      setStatusMessage(null);
    }
  };

  const handleRevoke = async (delegatee: string) => {
    if (!confirm(`Are you sure you want to revoke delegation to ${delegatee}? Full voting influence will be restored to your account.`)) {
      return;
    }

    setSubmitting(true);
    setActionError(null);
    setStatusMessage('Submitting on-chain revocation...');

    try {
      const res = await executeRevokeDelegation({
        delegatee,
        onProgress: (msg) => setStatusMessage(msg),
      });

      if (res.success) {
        setActionSuccess(`Delegation to ${delegatee.slice(0, 6)}...${delegatee.slice(-4)} successfully revoked!`);
        await loadData();
        onRefreshWallet?.();
      } else {
        setActionError(res.error || 'Revocation failed.');
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Revocation transaction failed.');
    } finally {
      setSubmitting(false);
      setStatusMessage(null);
    }
  };

  return (
    <div className="bg-[var(--wallet-surface)] backdrop-blur-md rounded-3xl p-6 sm:p-7 border border-[#007C8B]/20 shadow-sm space-y-6">
      {/* ─── HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-[#007C8B]/10 text-[#007C8B]">
            <ArrowRightLeft className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-serif text-base font-bold text-[var(--wallet-text)]">
              Steemit-Style PENORA Power Delegation
            </h3>
            <p className="text-xs text-[var(--wallet-muted)]">
              Loan curation influence to other creators without transferring token custody. 100% revocable.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowDelegateModal(true)}
          className="inline-flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-gradient-to-r from-[#007C8B] via-[#00B3C4] to-[#00E5F4] text-white text-xs font-bold hover:brightness-110 active:scale-[0.98] transition-all shadow-sm"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Delegate Power</span>
        </button>
      </div>

      {/* ─── METRICS ROW ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {/* Total Power */}
        <div className="p-3.5 rounded-2xl bg-[var(--wallet-inset)] border border-black/5 dark:border-white/5 space-y-1">
          <div className="text-[11px] text-[var(--wallet-muted)] flex items-center gap-1">
            <Lock className="h-3 w-3 text-[#007C8B]" />
            <span>My Staked Power</span>
          </div>
          <div className="font-mono text-base font-bold text-[var(--wallet-text)]">
            {overview.totalPowerPnr.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-[var(--wallet-muted)]">PP in Escrow</span>
        </div>

        {/* Available to Delegate */}
        <div className="p-3.5 rounded-2xl bg-[var(--wallet-inset)] border border-black/5 dark:border-white/5 space-y-1">
          <div className="text-[11px] text-[var(--wallet-muted)] flex items-center gap-1">
            <Zap className="h-3 w-3 text-[#00E5F4]" />
            <span>Available</span>
          </div>
          <div className="font-mono text-base font-bold text-[#007C8B] dark:text-[#00E5F4]">
            {overview.availableToDelegatePnr.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-[var(--wallet-muted)]">Eligible to loan</span>
        </div>

        {/* Delegated Out */}
        <div className="p-3.5 rounded-2xl bg-[var(--wallet-inset)] border border-black/5 dark:border-white/5 space-y-1">
          <div className="text-[11px] text-[var(--wallet-muted)] flex items-center gap-1">
            <ArrowRightLeft className="h-3 w-3 text-amber-500" />
            <span>Delegated Out</span>
          </div>
          <div className="font-mono text-base font-bold text-amber-600 dark:text-amber-400">
            {overview.delegatedOutPnr.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-[var(--wallet-muted)]">Active loans</span>
        </div>

        {/* Received Power */}
        <div className="p-3.5 rounded-2xl bg-[var(--wallet-inset)] border border-black/5 dark:border-white/5 space-y-1">
          <div className="text-[11px] text-[var(--wallet-muted)] flex items-center gap-1">
            <Users className="h-3 w-3 text-emerald-500" />
            <span>Received Power</span>
          </div>
          <div className="font-mono text-base font-bold text-emerald-600 dark:text-emerald-400">
            +{overview.receivedPowerPnr.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-[var(--wallet-muted)]">Loaned to you</span>
        </div>

        {/* Effective Voting Power */}
        <div className="col-span-2 sm:col-span-1 p-3.5 rounded-2xl bg-gradient-to-br from-[#007C8B]/10 to-[#00E5F4]/10 border border-[#007C8B]/30 space-y-1">
          <div className="text-[11px] text-[#006573] dark:text-[#00E5F4] flex items-center gap-1 font-semibold">
            <ShieldCheck className="h-3 w-3" />
            <span>Effective Power</span>
          </div>
          <div className="font-mono text-base font-extrabold text-[#007C8B] dark:text-[#00E5F4]">
            {overview.effectiveVotingPowerPnr.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-[var(--wallet-muted)]">Current vote weight</span>
        </div>
      </div>

      {/* Explanatory Banner */}
      <div className="p-4 rounded-2xl bg-[#EEFBFC]/80 dark:bg-[#007C8B]/10 border border-[#007C8B]/20 text-xs text-[#006573] dark:text-[#00E5F4] leading-relaxed flex items-start gap-2.5">
        <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <div>
          <strong>Steemit Invariant Protection:</strong> Delegated PENORA Power remains in your escrow contract. The recipient receives temporary voting mana only. Recipients cannot re-delegate received power, and you can revoke delegations at any time to recover full voting influence.
        </div>
      </div>

      {/* Notification Banners */}
      {statusMessage && (
        <div className="p-3 rounded-2xl bg-[#EEFBFC] dark:bg-[#007C8B]/20 border border-[#007C8B]/30 text-xs text-[#006573] dark:text-[#00E5F4] text-center animate-pulse">
          {statusMessage}
        </div>
      )}

      {actionError && (
        <div className="p-3 rounded-2xl bg-[#FFF0F0] dark:bg-[#D93838]/20 border border-[#D93838]/30 text-xs text-[#D93838] dark:text-[#FF8080] flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {actionSuccess && (
        <div className="p-3 rounded-2xl bg-[#F0FDF4] dark:bg-emerald-950/30 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* ─── ACTIVE DELEGATIONS SECTION ──────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--wallet-muted)]">
            Active Outgoing Delegations ({overview.activeDelegations.length})
          </h4>
          {!isContractLive && (
            <span className="text-[11px] text-amber-600 dark:text-amber-400 font-mono">
              [Testnet Smart Contract Deployment Pending]
            </span>
          )}
        </div>

        {overview.activeDelegations.length === 0 ? (
          <div className="p-6 rounded-2xl bg-[var(--wallet-inset)] border border-dashed border-black/10 dark:border-white/10 text-center space-y-1 text-xs text-[var(--wallet-muted)]">
            <p>You have not delegated voting power to any creators yet.</p>
            <p className="text-[11px]">Empower emerging writers by lending a portion of your curation weight.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {overview.activeDelegations.map((item) => (
              <div
                key={item.delegatee}
                className="p-3.5 rounded-2xl bg-[var(--wallet-inset)] border border-black/5 dark:border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="font-mono font-semibold text-[var(--wallet-text)] flex items-center gap-1.5">
                    <span>{item.delegatee.slice(0, 8)}...{item.delegatee.slice(-6)}</span>
                    <a
                      href={`https://amoy.polygonscan.com/address/${item.delegatee}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--wallet-muted)] hover:text-[#007C8B]"
                      title="View on Polygonscan"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <span className="text-[11px] text-[var(--wallet-muted)]">
                    Delegated on {new Date(item.timestamp * 1000).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-[#007C8B] dark:text-[#00E5F4]">
                    {item.amountPnr} PP
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRevoke(item.delegatee)}
                    disabled={submitting}
                    className="p-1.5 rounded-lg text-[var(--wallet-muted)] hover:text-[#D93838] hover:bg-[#D93838]/10 transition-colors"
                    title="Revoke Delegation"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── DELEGATE MODAL ──────────────────────────────────────────────── */}
      {showDelegateModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0A2540]/60 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div className="bg-[var(--wallet-surface)] rounded-3xl p-6 w-full max-w-md shadow-2xl border border-[#007C8B]/20 space-y-5 text-[var(--wallet-text)] relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-[#007C8B]/10 text-[#007C8B]">
                  <ArrowRightLeft className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-serif text-base font-bold">Delegate PENORA Power</h3>
                  <p className="text-xs text-[var(--wallet-muted)]">Loan temporary voting influence</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDelegateModal(false)}
                className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-[var(--wallet-muted)]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleDelegateSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--wallet-muted)] mb-1">
                  Recipient EVM Address
                </label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value.trim())}
                  required
                  className="w-full py-2.5 px-3.5 rounded-xl bg-[var(--wallet-inset)] border border-black/10 dark:border-white/10 font-mono focus:border-[#007C8B] outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-[var(--wallet-muted)]">
                    Amount to Delegate (PP)
                  </label>
                  <span className="text-[10px] text-[var(--wallet-muted)]">
                    Available: {overview.availableToDelegatePnr.toLocaleString()} PP
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={delegateAmount}
                    onChange={(e) => setDelegateAmount(e.target.value)}
                    required
                    className="w-full py-2.5 px-3.5 pr-16 rounded-xl bg-[var(--wallet-inset)] border border-black/10 dark:border-white/10 font-mono text-sm focus:border-[#007C8B] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setDelegateAmount(overview.availableToDelegatePnr.toString())}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-md bg-[#007C8B]/10 text-[#007C8B] text-[10px] font-bold hover:bg-[#007C8B]/20"
                  >
                    MAX
                  </button>
                </div>
              </div>

              {/* Quick Percentage Chips */}
              <div className="flex gap-1.5 pt-1">
                {[0.25, 0.5, 0.75, 1.0].map((ratio) => (
                  <button
                    key={ratio}
                    type="button"
                    onClick={() => setDelegateAmount((overview.availableToDelegatePnr * ratio).toFixed(2))}
                    className="flex-1 py-1 rounded-lg bg-[var(--wallet-inset)] border border-black/5 dark:border-white/5 text-[10px] font-mono hover:bg-[#007C8B]/10 hover:text-[#007C8B]"
                  >
                    {ratio * 100}%
                  </button>
                ))}
              </div>

              <div className="p-3 rounded-xl bg-[#EEFBFC]/60 dark:bg-[#007C8B]/10 border border-[#007C8B]/20 text-[11px] text-[#006573] dark:text-[#00E5F4] leading-relaxed">
                Tokens remain safely deposited in your escrow contract. You can revoke this delegation at any time.
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDelegateModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-black/10 dark:border-white/10 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#007C8B] to-[#00E5F4] text-white font-bold hover:brightness-110 shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Confirming...' : 'Sign & Delegate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
