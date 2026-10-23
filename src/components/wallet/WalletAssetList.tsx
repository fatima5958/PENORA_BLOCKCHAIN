import React from 'react';
import { Coins, Zap, DollarSign, Fuel, ArrowRight, ExternalLink } from 'lucide-react';
import type { WalletState } from '../../lib/wallet/types';
import type { WalletTab } from './MobileWalletOverview';

export interface WalletAssetListProps {
  state: WalletState;
  onNavigate?: (tab: WalletTab) => void;
}

export const WalletAssetList: React.FC<WalletAssetListProps> = ({ state, onNavigate }) => {
  const isConnectedAmoy = Boolean(
    state.address && state.isCorrectNetwork && state.status === 'connected'
  );

  const assets = [
    {
      symbol: 'PNR',
      name: 'Liquid PNR',
      caption: 'Transferable utility & reward token (18 dec)',
      value: state.balancePnr,
      icon: Coins,
      badgeClass: 'bg-[#007C8B]/12 text-[#007C8B] dark:bg-[#00E5F4]/15 dark:text-[#00E5F4]',
      emptyNote: 'No PNR balance yet — trade MockUSDT or earn from articles.',
      emptyActionLabel: 'Trade PNR',
      emptyActionHref: '/exchange/',
    },
    {
      symbol: 'PP',
      name: 'PENORA Power',
      caption: 'Staked curation & voting influence (1:1)',
      value: state.balancePp,
      icon: Zap,
      badgeClass: 'bg-amber-500/12 text-amber-700 dark:text-amber-300',
      emptyNote: 'No staked PENORA Power yet — stake PNR 1:1 to vote on stories.',
      emptyActionLabel: 'Power Up',
      emptyActionTab: 'power_system' as WalletTab,
    },
    {
      symbol: 'USDT',
      name: 'MockUSDT',
      caption: state.isUsdtConfigured
        ? `Test stablecoin (${state.usdtDecimals} dec)`
        : 'Token setup pending',
      value: state.balanceUsdt,
      icon: DollarSign,
      badgeClass: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
      emptyNote: '0 MockUSDT — needed to purchase PNR on the Exchange or P2P.',
      emptyActionLabel: 'P2P / Exchange',
      emptyActionHref: '/exchange/',
    },
    {
      symbol: 'POL',
      name: 'Test POL Gas',
      caption: 'Polygon Amoy network transaction fuel',
      value: state.balancePol,
      icon: Fuel,
      badgeClass: 'bg-indigo-500/12 text-indigo-700 dark:text-indigo-300',
      emptyNote: '0 Test POL — required to pay Polygon Amoy gas fees.',
      emptyActionLabel: 'Get Test POL',
      emptyActionExternal: 'https://faucet.polygon.technology/',
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
          const isZero =
            isConnectedAmoy &&
            item.value !== null &&
            !Number.isNaN(Number(item.value)) &&
            Number(item.value) === 0;
          const isUnavailable = isConnectedAmoy && item.value === null;
          const displayValue =
            item.value !== null ? item.value : isUnavailable ? 'Unavailable' : '—';

          return (
            <div key={item.symbol} className="py-3 first:pt-1 last:pb-1 space-y-1.5">
              <div className="flex items-center justify-between gap-3">
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
                      {isUnavailable ? 'Unavailable — could not verify on-chain' : item.caption}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0 max-w-[45%]">
                  <strong className="block text-sm font-bold font-mono tabular-nums text-[var(--wallet-text)] break-all">
                    {displayValue}
                  </strong>
                  <span className="text-[10px] font-mono text-[var(--wallet-muted)]">
                    {item.symbol}
                  </span>
                </div>
              </div>

              {isZero && (
                <div className="pl-12 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <span className="text-[var(--wallet-muted)]">{item.emptyNote}</span>
                  {item.emptyActionExternal ? (
                    <a
                      href={item.emptyActionExternal}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-[#007C8B] dark:text-[#00E5F4] hover:underline shrink-0"
                    >
                      <span>{item.emptyActionLabel}</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : item.emptyActionHref ? (
                    <a
                      href={item.emptyActionHref}
                      className="inline-flex items-center gap-1 font-semibold text-[#007C8B] dark:text-[#00E5F4] hover:underline shrink-0"
                    >
                      <span>{item.emptyActionLabel}</span>
                      <ArrowRight className="h-3 w-3" />
                    </a>
                  ) : item.emptyActionTab && onNavigate ? (
                    <button
                      type="button"
                      onClick={() => onNavigate(item.emptyActionTab!)}
                      className="inline-flex items-center gap-1 font-semibold text-[#007C8B] dark:text-[#00E5F4] hover:underline shrink-0"
                    >
                      <span>{item.emptyActionLabel}</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
