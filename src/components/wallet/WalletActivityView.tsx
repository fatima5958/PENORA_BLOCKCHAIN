import React, { useState } from 'react';
import {
  Clock,
  RefreshCw,
  ArrowDownLeft,
  ArrowUpRight,
  ExternalLink,
  Info,
} from 'lucide-react';
import { historyLabel, historySign } from '../../lib/wallet/history';
import { POLYGON_AMOY_CONFIG } from '../../lib/wallet/chain';
import type { WalletTransaction } from '../../lib/wallet/types';

export interface WalletActivityViewProps {
  address: string | null;
  transactions: WalletTransaction[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

type FilterStatus = 'all' | 'confirmed' | 'pending' | 'failed';

export const WalletActivityView: React.FC<WalletActivityViewProps> = ({
  address,
  transactions,
  loading,
  error,
  onRefresh,
}) => {
  const [filter, setFilter] = useState<FilterStatus>('all');

  const filtered =
    filter === 'all'
      ? transactions
      : transactions.filter(tx => tx.status === filter);

  return (
    <section
      aria-label="Full transaction history"
      className="wallet-activity-view rounded-2xl bg-[var(--wallet-surface)] border border-[var(--wallet-border)] p-5 sm:p-6 shadow-2xs space-y-5"
    >
      {/* Header & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--wallet-border)]">
        <div>
          <h2 className="text-base font-bold text-[var(--wallet-text)] flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#007C8B] dark:text-[#00E5F4]" />
            <span>Transaction Activity</span>
          </h2>
          <p className="text-xs text-[var(--wallet-muted)] mt-0.5">
            On-chain PNR, MockUSDT, and PENORA Power staking events on Polygon Amoy
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-xl bg-[var(--wallet-inset)] p-1 border border-[var(--wallet-border)]">
            {(['all', 'confirmed', 'pending', 'failed'] as FilterStatus[]).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setFilter(s)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold capitalize transition-colors ${
                  filter === s
                    ? 'bg-[var(--wallet-surface)] text-[var(--wallet-text)] shadow-2xs'
                    : 'text-[var(--wallet-muted)] hover:text-[var(--wallet-text)]'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {address && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="min-h-[38px] px-3 py-1.5 rounded-xl border border-[var(--wallet-border)] text-[var(--wallet-text)] hover:border-[#007C8B]/40 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-3 rounded-xl bg-amber-500/12 border border-amber-500/25 text-amber-900 dark:text-amber-200 text-xs"
        >
          {error}
        </div>
      )}

      {filtered.length > 0 ? (
        <div className="space-y-2.5">
          {filtered.map(tx => {
            const isInbound = tx.type === 'deposit_usdt' || tx.type === 'transfer_in';
            return (
              <div
                key={tx.id}
                className="p-3.5 rounded-xl bg-[var(--wallet-inset)] border border-[var(--wallet-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isInbound
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                        : 'bg-[#007C8B]/15 text-[#007C8B] dark:text-[#00E5F4]'
                    }`}
                  >
                    {isInbound ? (
                      <ArrowDownLeft className="h-4 w-4" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4" />
                    )}
                  </span>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-xs text-[var(--wallet-text)]">
                        {historyLabel(tx)}
                      </span>
                      <span
                        className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                          tx.status === 'confirmed'
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                            : tx.status === 'pending'
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                            : 'bg-red-500/15 text-red-700 dark:text-red-300'
                        }`}
                      >
                        {tx.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-[var(--wallet-muted)] font-mono truncate">
                      {tx.hash.slice(0, 10)}…{tx.hash.slice(-8)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3">
                  <div className="text-right">
                    <div
                      className={`font-mono text-sm font-bold tabular-nums ${
                        isInbound
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-[var(--wallet-text)]'
                      }`}
                    >
                      {historySign(tx)}
                      {tx.amount} {tx.symbol}
                    </div>
                    <div className="text-[10px] text-[var(--wallet-muted)]">
                      {new Date(tx.timestamp).toLocaleString(undefined, {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </div>
                  </div>

                  {tx.explorerUrl && (
                    <a
                      href={tx.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg text-[var(--wallet-muted)] hover:text-[#007C8B] dark:hover:text-[#00E5F4] hover:bg-[var(--wallet-surface)] transition-colors"
                      title="View on PolygonScan"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-10 px-4 text-center rounded-xl border border-dashed border-[var(--wallet-border)] bg-[var(--wallet-inset)] space-y-2">
          <div className="h-9 w-9 mx-auto rounded-full bg-[#007C8B]/12 flex items-center justify-center text-[#007C8B] dark:text-[#00E5F4]">
            <Info className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-semibold text-[var(--wallet-text)]">
            {loading
              ? 'Loading recent activity…'
              : error
              ? 'On-chain history unavailable'
              : 'No matching transactions in recent query window'}
          </h3>
          <p className="text-xs text-[var(--wallet-muted)] max-w-md mx-auto">
            Verified transfers, deposits, and staking transactions on Polygon Amoy appear here. No simulated transactions are displayed.
          </p>
          <a
            href={POLYGON_AMOY_CONFIG.blockExplorers[0]}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-[#007C8B] dark:text-[#00E5F4] font-semibold hover:underline pt-1"
          >
            <span>Open PolygonScan Amoy Explorer</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}

      <div className="p-3 rounded-xl bg-[var(--wallet-inset)] border border-[var(--wallet-border)] text-[11px] text-[var(--wallet-muted)]">
        <strong>RPC Query Scope:</strong> Live event queries inspect the recent Polygon Amoy block window alongside locally recorded pending transactions.
      </div>
    </section>
  );
};
