import React from 'react';
import {
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  ExternalLink,
  ChevronRight,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { historyLabel, historySign } from '../../lib/wallet/history';
import type { WalletTransaction } from '../../lib/wallet/types';

export interface WalletActivityPreviewProps {
  transactions: WalletTransaction[];
  loading: boolean;
  error: string | null;
  hasAddress: boolean;
  onViewAll: () => void;
}

export const WalletActivityPreview: React.FC<WalletActivityPreviewProps> = ({
  transactions,
  loading,
  error,
  hasAddress,
  onViewAll,
}) => {
  const recent = transactions.slice(0, 3);

  const statusBadge = (status: WalletTransaction['status']) => {
    if (status === 'confirmed') {
      return (
        <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
          Confirmed
        </span>
      );
    }
    if (status === 'pending') {
      return (
        <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300">
          Pending
        </span>
      );
    }
    return (
      <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-red-500/15 text-red-700 dark:text-red-300">
        Failed
      </span>
    );
  };

  return (
    <section
      aria-label="Recent activity"
      className="wallet-activity-preview rounded-2xl bg-[var(--wallet-surface)] border border-[var(--wallet-border)] p-4 sm:p-5 shadow-2xs space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-[#007C8B] dark:text-[#00E5F4]" />
          <h2 className="text-sm font-bold text-[var(--wallet-text)] tracking-tight">
            Recent Activity
          </h2>
        </div>
        <button
          type="button"
          onClick={onViewAll}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#007C8B] dark:text-[#00E5F4] hover:underline min-h-[36px] px-1"
        >
          <span>View all</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {loading ? (
        <div className="py-6 flex items-center justify-center gap-2 text-xs text-[var(--wallet-muted)]">
          <RefreshCw className="h-4 w-4 animate-spin text-[#007C8B]" />
          <span>Loading recent on-chain activity…</span>
        </div>
      ) : recent.length > 0 ? (
        <div className="divide-y divide-[var(--wallet-border)]">
          {recent.map(tx => {
            const isInbound = tx.type === 'deposit_usdt' || tx.type === 'transfer_in';
            return (
              <div
                key={tx.id}
                className="py-2.5 first:pt-1 last:pb-1 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      isInbound
                        ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
                        : 'bg-[#007C8B]/12 text-[#007C8B] dark:text-[#00E5F4]'
                    }`}
                  >
                    {isInbound ? (
                      <ArrowDownLeft className="h-4 w-4" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold text-[var(--wallet-text)] truncate">
                        {historyLabel(tx)}
                      </span>
                      {statusBadge(tx.status)}
                    </div>
                    <div className="text-[11px] font-mono text-[var(--wallet-muted)] truncate">
                      {tx.hash.slice(0, 8)}…{tx.hash.slice(-6)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <div
                      className={`text-xs font-bold font-mono tabular-nums ${
                        isInbound
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-[var(--wallet-text)]'
                      }`}
                    >
                      {historySign(tx)}
                      {tx.amount} {tx.symbol}
                    </div>
                    <div className="text-[10px] text-[var(--wallet-muted)]">
                      {new Date(tx.timestamp).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </div>
                  </div>
                  {tx.explorerUrl && (
                    <a
                      href={tx.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="View transaction on PolygonScan"
                      className="p-1.5 rounded-lg text-[var(--wallet-muted)] hover:text-[#007C8B] dark:hover:text-[#00E5F4]"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : error ? (
        <div
          role="status"
          className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Unavailable: {error}</span>
        </div>
      ) : (
        <div className="py-5 px-3 text-center rounded-xl bg-[var(--wallet-inset)] text-xs text-[var(--wallet-muted)]">
          {hasAddress
            ? 'No recent transactions in the current query window.'
            : 'Connect your wallet on Polygon Amoy to view your recent transactions.'}
        </div>
      )}
    </section>
  );
};
