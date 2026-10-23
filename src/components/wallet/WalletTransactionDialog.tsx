import React, { useEffect } from 'react';
import {
  X,
  Send,
  Zap,
  TrendingDown,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Lock,
  ExternalLink,
  Clock,
} from 'lucide-react';
import { isSpendableAmount, previewPowerDown } from '../../lib/wallet/amount';
import {
  createTxLifecycleState,
  type WalletTxLifecycleState,
} from '../../lib/wallet/txLifecycle';
import type { CreatorRecipient } from '../../lib/wallet/creatorRecipient';
import type { WalletState, UsdtGasEstimate } from '../../lib/wallet/types';

export function TransactionLifecycleStatusBanner({
  lifecycle,
}: {
  lifecycle: WalletTxLifecycleState;
}) {
  if (lifecycle.status === 'idle') return null;

  const isFailed = lifecycle.status === 'failed';
  const isConfirmed = lifecycle.status === 'confirmed';
  const isUnknown = lifecycle.status === 'unknown';

  const toneClass = isFailed
    ? 'bg-red-500/12 border-red-500/25 text-red-700 dark:text-red-300'
    : isConfirmed
    ? 'bg-emerald-500/12 border-emerald-500/25 text-emerald-800 dark:text-emerald-200'
    : isUnknown
    ? 'bg-amber-500/12 border-amber-500/25 text-amber-900 dark:text-amber-200'
    : 'bg-[#007C8B]/10 border-[#007C8B]/25 text-[var(--wallet-text)]';

  return (
    <div
      role={isFailed ? 'alert' : 'status'}
      className={`p-3 rounded-xl border text-xs space-y-1.5 ${toneClass}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-bold">
          {isFailed ? (
            <AlertCircle className="h-4 w-4 shrink-0" />
          ) : isConfirmed ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : isUnknown ? (
            <Clock className="h-4 w-4 shrink-0 text-amber-500" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin text-[#007C8B] dark:text-[#00E5F4]" />
          )}
          <span>{lifecycle.label}</span>
        </div>

        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10">
          {lifecycle.status.replace('_', ' ')}
        </span>
      </div>

      <p className="text-[11px] leading-relaxed break-words">{lifecycle.description}</p>

      {lifecycle.hash && (
        <div className="pt-1 flex items-center justify-between gap-2 text-[11px] font-mono">
          <span className="truncate">
            Tx: {lifecycle.hash.slice(0, 10)}…{lifecycle.hash.slice(-8)}
          </span>
          {lifecycle.explorerUrl && (
            <a
              href={lifecycle.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-sans font-semibold text-[#007C8B] dark:text-[#00E5F4] hover:underline shrink-0"
            >
              <span>PolygonScan</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export interface SendConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  asset: 'USDT' | 'PNR';
  tokenDecimals: number;
  sendAmount: string;
  sendRecipient: string;
  creatorRecipient: CreatorRecipient | null;
  gasEstimate: UsdtGasEstimate | null;
  sendLoading: boolean;
  sendError: string | null;
  txLifecycle?: WalletTxLifecycleState;
  onConfirm: () => void;
}

export const SendConfirmDialog: React.FC<SendConfirmDialogProps> = ({
  open,
  onClose,
  asset,
  tokenDecimals,
  sendAmount,
  sendRecipient,
  creatorRecipient,
  gasEstimate,
  sendLoading,
  sendError,
  txLifecycle,
  onConfirm,
}) => {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !sendLoading) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, sendLoading, onClose]);

  if (!open) return null;

  const effectiveLifecycle: WalletTxLifecycleState =
    txLifecycle && txLifecycle.status !== 'idle'
      ? txLifecycle
      : sendError
      ? createTxLifecycleState('failed', { error: sendError })
      : sendLoading
      ? createTxLifecycleState('awaiting_approval', {
          description: 'Approve the transfer signature in MetaMask and wait for on-chain receipt…',
        })
      : createTxLifecycleState('idle');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Confirm token transfer"
      className="fixed inset-0 z-50 bg-[#0A2540]/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={e => {
        if (e.target === e.currentTarget && !sendLoading) onClose();
      }}
    >
      <div className="bg-[var(--wallet-surface)] rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 max-w-md w-full border border-[var(--wallet-border)] shadow-2xl space-y-4 relative">
        <button
          type="button"
          aria-label="Close transfer review"
          disabled={sendLoading}
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-xl flex items-center justify-center text-[var(--wallet-muted)] hover:text-[var(--wallet-text)] hover:bg-[var(--wallet-inset)] transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2.5 pr-8">
          <span className="w-10 h-10 rounded-xl bg-[#0A2540] text-[#00E5F4] flex items-center justify-center shrink-0">
            <Send className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-base font-bold text-[var(--wallet-text)]">Confirm Transfer</h3>
            <p className="text-xs text-[var(--wallet-muted)]">
              Review recipient, network, and fee before signing
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[var(--wallet-inset)] border border-[var(--wallet-border)] space-y-2.5 text-xs">
          <div className="flex justify-between items-center pb-2 border-b border-[var(--wallet-border)]">
            <span className="text-[var(--wallet-muted)]">Token</span>
            <span className="font-bold text-[var(--wallet-text)]">
              {asset} (ERC-20, {tokenDecimals} dec)
            </span>
          </div>
          <div className="flex justify-between items-center pb-2 border-b border-[var(--wallet-border)]">
            <span className="text-[var(--wallet-muted)]">Network</span>
            <span className="font-bold text-[var(--wallet-text)]">Polygon Amoy (80002)</span>
          </div>
          <div className="flex justify-between items-center pb-2 border-b border-[var(--wallet-border)]">
            <span className="text-[var(--wallet-muted)]">Amount</span>
            <span className="font-mono font-bold text-sm text-[#007C8B] dark:text-[#00E5F4]">
              {sendAmount} {asset}
            </span>
          </div>
          <div className="space-y-1 pb-2 border-b border-[var(--wallet-border)]">
            <span className="text-[var(--wallet-muted)] block">Recipient</span>
            {creatorRecipient && (
              <span className="block text-xs font-semibold text-[var(--wallet-text)]">
                {creatorRecipient.displayName} (@{creatorRecipient.username})
              </span>
            )}
            <span className="font-mono text-[11px] font-semibold text-[var(--wallet-text)] break-all block">
              {sendRecipient}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[var(--wallet-muted)]">Estimated Gas Fee</span>
            <span className="font-mono font-semibold text-[var(--wallet-text)]">
              {gasEstimate
                ? `~${parseFloat(gasEstimate.estimatedCostPol).toFixed(6)} POL`
                : 'Dynamic'}
            </span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-900 dark:text-amber-200 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <span>
            On-chain transfers are irreversible. Confirm the recipient address before signing in MetaMask.
          </span>
        </div>

        <TransactionLifecycleStatusBanner lifecycle={effectiveLifecycle} />

        <button
          type="button"
          onClick={onConfirm}
          disabled={sendLoading}
          className="w-full min-h-[46px] py-3 px-4 rounded-xl bg-[#007C8B] hover:bg-[#006673] disabled:bg-[var(--wallet-inset)] disabled:text-[var(--wallet-muted)] text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
        >
          {sendLoading ? (
            <>
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              <span>{effectiveLifecycle.label} — Waiting for Receipt…</span>
            </>
          ) : (
            <>
              <Lock className="h-3.5 w-3.5" />
              <span>Confirm &amp; Sign in MetaMask</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export interface PowerModalProps {
  mode: 'up' | 'down';
  open: boolean;
  onClose: () => void;
  state: WalletState;
  amount: string;
  onAmountChange: (amount: string) => void;
  actionLoading: boolean;
  actionError: string | null;
  actionSuccess: string | null;
  txLifecycle?: WalletTxLifecycleState;
  onConfirm: () => void;
}

export const PowerTransactionDialog: React.FC<PowerModalProps> = ({
  mode,
  open,
  onClose,
  state,
  amount,
  onAmountChange,
  actionLoading,
  actionError,
  actionSuccess,
  txLifecycle,
  onConfirm,
}) => {
  const isUp = mode === 'up';
  const availableBalance = isUp ? state.balancePnr : state.balancePp;
  const symbol = isUp ? 'PNR' : 'PP';
  const canConfirm = !actionLoading && isSpendableAmount(amount, availableBalance, 18);
  const schedulePreview = !isUp ? previewPowerDown(amount) : null;

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !actionLoading) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, actionLoading, onClose]);

  if (!open) return null;

  const effectiveLifecycle: WalletTxLifecycleState =
    txLifecycle && txLifecycle.status !== 'idle'
      ? txLifecycle
      : actionError
      ? createTxLifecycleState('failed', { error: actionError })
      : actionSuccess
      ? createTxLifecycleState('confirmed', { description: actionSuccess })
      : actionLoading
      ? createTxLifecycleState('awaiting_approval', {
          description: isUp
            ? 'Approve PNR allowance (if required) and confirm Power Up in MetaMask…'
            : 'Confirm the 13-week Power Down schedule in MetaMask…',
        })
      : createTxLifecycleState('idle');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isUp ? 'Power Up PNR' : 'Power Down PP'}
      className="fixed inset-0 z-50 bg-[#0A2540]/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={e => {
        if (e.target === e.currentTarget && !actionLoading) onClose();
      }}
    >
      <div className="bg-[var(--wallet-surface)] rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 max-w-md w-full border border-[var(--wallet-border)] shadow-2xl space-y-4 relative">
        <button
          type="button"
          aria-label={isUp ? 'Close Power Up' : 'Close Power Down'}
          disabled={actionLoading}
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-xl flex items-center justify-center text-[var(--wallet-muted)] hover:text-[var(--wallet-text)] hover:bg-[var(--wallet-inset)] transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2.5 pr-8">
          <span
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isUp ? 'bg-[#0A2540] text-[#00E5F4]' : 'bg-amber-500 text-white'
            }`}
          >
            {isUp ? <Zap className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
          </span>
          <div>
            <h3 className="text-base font-bold text-[var(--wallet-text)]">
              {isUp ? 'Power Up PNR' : 'Power Down PP'}
            </h3>
            <p className="text-xs text-[var(--wallet-muted)]">
              {isUp
                ? 'Convert liquid PNR into staked PENORA Power (1:1)'
                : '13-week linear withdrawal schedule (1/13th every 7 days)'}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <label
              htmlFor="power-modal-amount"
              className="font-semibold text-[var(--wallet-text)]"
            >
              {isUp ? 'Amount to Stake (PNR)' : 'Amount to Withdraw (PP)'}
            </label>
            <button
              type="button"
              disabled={!availableBalance || actionLoading}
              onClick={() => {
                if (availableBalance) onAmountChange(availableBalance);
              }}
              className="text-[11px] font-semibold text-[#007C8B] dark:text-[#00E5F4] hover:underline"
            >
              Max: {availableBalance ?? '—'} {symbol}
            </button>
          </div>

          <div className="relative">
            <input
              id="power-modal-amount"
              type="text"
              inputMode="decimal"
              placeholder="0.0"
              value={amount}
              disabled={actionLoading}
              onChange={e => onAmountChange(e.target.value)}
              className="w-full min-h-[44px] py-2.5 px-3.5 pr-14 rounded-xl border border-[var(--wallet-border)] bg-[var(--wallet-inset)] focus:border-[#007C8B] text-sm font-mono tabular-nums"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-[var(--wallet-muted)]">
              {symbol}
            </span>
          </div>

          {isUp && (
            <p className="text-[11px] text-[var(--wallet-muted)]">
              Note: Staking PNR requires ERC-20 token approval (if allowance is insufficient) followed by the Power Up transaction.
            </p>
          )}

          {!isUp && schedulePreview && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-900 dark:text-amber-200 space-y-1">
              <div>
                Estimated Weekly Installment: <strong className="font-mono">{schedulePreview.weekly} PNR</strong>
              </div>
              <div>
                Final Installment: <strong className="font-mono">{schedulePreview.final} PNR</strong> (includes remainder)
              </div>
              <div>
                First Installment Unlocks: <strong>7 days from confirmation</strong>
              </div>
            </div>
          )}
        </div>

        <TransactionLifecycleStatusBanner lifecycle={effectiveLifecycle} />

        <button
          type="button"
          onClick={onConfirm}
          disabled={!canConfirm}
          className={`w-full min-h-[46px] py-3 px-4 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-colors ${
            !canConfirm
              ? 'bg-[var(--wallet-inset)] text-[var(--wallet-muted)] cursor-not-allowed'
              : isUp
              ? 'bg-[#007C8B] hover:bg-[#006673] text-white'
              : 'bg-amber-600 hover:bg-amber-700 text-white'
          }`}
        >
          {actionLoading ? (
            <>
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              <span>{isUp ? 'Processing Power Up…' : 'Submitting Schedule…'}</span>
            </>
          ) : isUp ? (
            <>
              <Zap className="h-3.5 w-3.5" />
              <span>Confirm Power Up</span>
            </>
          ) : (
            <>
              <TrendingDown className="h-3.5 w-3.5" />
              <span>Start 13-Week Power Down</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
