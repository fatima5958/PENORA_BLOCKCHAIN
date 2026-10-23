import React from 'react';
import { Coins, Zap, DollarSign, Fuel } from 'lucide-react';
import type { WalletState } from '../../lib/wallet/types';

export interface WalletAssetListProps {
  state: WalletState;
}

export const WalletAssetList: React.FC<WalletAssetListProps> = ({ state }) => {
  const assets = [
    {
      symbol: 'PNR',
      name: 'Liquid PNR',
      caption: 'Transferable utility & reward token (18 dec)',
      value: state.balancePnr,
      icon: Coins,
      badgeClass: 'bg-[#007C8B]/12 text-[#007C8B] dark:bg-[#00E5F4]/15 dark:text-[#00E5F4]',
    },
    {
      symbol: 'PP',
      name: 'PENORA Power',
      caption: 'Staked curation & voting influence (1:1)',
      value: state.balancePp,
      icon: Zap,
      badgeClass: 'bg-amber-500/12 text-amber-700 dark:text-amber-300',
    },
    {
      symbol: 'USDT',
      name: 'MockUSDT',
      caption: state.isUsdtConfigured ? `Test stablecoin (${state.usdtDecimals} dec)` : 'Token setup pending',
      value: state.balanceUsdt,
      icon: DollarSign,
      badgeClass: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
    },
    {
      symbol: 'POL',
      name: 'Test POL Gas',
      caption: 'Polygon Amoy network transaction fuel',
      value: state.balancePol,
      icon: Fuel,
      badgeClass: 'bg-indigo-500/12 text-indigo-700 dark:text-indigo-300',
    },
  ];

  return (
    <section
      aria-label="Your assets"
      className="wallet-asset-list rounded-2xl bg-[var(--wallet-surface)] border border-[var(--wallet-border)] p-4 sm:p-5 shadow-2xs space-y-3"
    >
      <div className="flex items-center justify-between gap-2 pb-1">
        <h2 className="text-sm font-bold text-[var(--wallet-text)] tracking-tight">
          Your Assets
        </h2>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--wallet-muted)]">
          Testnet Balances
        </span>
      </div>

      <div className="divide-y divide-[var(--wallet-border)]">
        {assets.map(item => {
          const Icon = item.icon;
          return (
            <div
              key={item.symbol}
              className="py-3 first:pt-1 last:pb-1 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${item.badgeClass}`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs sm:text-sm font-semibold text-[var(--wallet-text)] truncate">
                      {item.name}
                    </h3>
                    <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-[var(--wallet-inset)] text-[var(--wallet-muted)]">
                      {item.symbol}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--wallet-muted)] truncate">
                    {item.caption}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0 max-w-[45%]">
                <strong className="block text-sm font-bold font-mono tabular-nums text-[var(--wallet-text)] break-all">
                  {item.value ?? '—'}
                </strong>
                <span className="text-[10px] font-mono text-[var(--wallet-muted)]">
                  {item.symbol}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
