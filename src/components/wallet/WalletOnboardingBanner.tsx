import React from 'react';
import {
  HelpCircle,
  X,
  CheckCircle2,
  Coins,
  Zap,
  DollarSign,
  Fuel,
  ExternalLink,
  ArrowRight,
  Wallet,
} from 'lucide-react';
import type { WalletState } from '../../lib/wallet/types';
import type { WalletTab } from './MobileWalletOverview';

export interface WalletOnboardingBannerProps {
  state: WalletState;
  dismissed: boolean;
  onDismiss: () => void;
  onReopen: () => void;
  onConnect: () => void;
  onSwitchNetwork: () => void;
  onNavigate: (tab: WalletTab) => void;
}

export const WalletOnboardingBanner: React.FC<WalletOnboardingBannerProps> = ({
  state,
  dismissed,
  onDismiss,
  onReopen,
  onConnect,
  onSwitchNetwork,
  onNavigate,
}) => {
  const isConnectedAmoy = Boolean(state.address && state.isCorrectNetwork);
  const hasPol = state.balancePol !== null && Number(state.balancePol) > 0;
  const hasUsdt = state.balanceUsdt !== null && Number(state.balanceUsdt) > 0;
  const hasPnr = state.balancePnr !== null && Number(state.balancePnr) > 0;

  if (dismissed) {
    return (
      <div className="wallet-onboarding-collapsed flex items-center justify-end">
        <button
          type="button"
          onClick={onReopen}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-xl bg-[var(--wallet-surface)] border border-[var(--wallet-border)] text-xs font-medium text-[var(--wallet-muted)] hover:text-[var(--wallet-text)] hover:border-[#007C8B]/40 transition-colors"
        >
          <HelpCircle className="h-3.5 w-3.5 text-[#007C8B] dark:text-[#00E5F4]" />
          <span>Wallet Guide &amp; Token Help</span>
        </button>
      </div>
    );
  }

  const tokenExplainers = [
    {
      symbol: 'PNR',
      title: 'PNR — Test Token',
      desc: "PENORA's liquid test token for creator rewards and transfers.",
      icon: Coins,
      color: 'text-[#007C8B] dark:text-[#00E5F4] bg-[#007C8B]/12',
    },
    {
      symbol: 'PP',
      title: 'PENORA Power',
      desc: 'Staked PNR (1:1) for platform participation and article voting.',
      icon: Zap,
      color: 'text-amber-600 dark:text-amber-400 bg-amber-500/12',
    },
    {
      symbol: 'USDT',
      title: 'MockUSDT',
      desc: 'Test stablecoin used to buy or sell PNR on the Exchange and P2P.',
      icon: DollarSign,
      color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/12',
    },
    {
      symbol: 'POL',
      title: 'Test POL',
      desc: 'Required to pay Polygon Amoy testnet gas fees for transactions.',
      icon: Fuel,
      color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/12',
    },
  ];

  return (
    <section
      aria-label="Beginner wallet guide"
      className="wallet-onboarding-banner rounded-2xl bg-[var(--wallet-surface)] border border-[var(--wallet-border)] p-4 sm:p-5 shadow-2xs space-y-4"
    >
      {/* Top Row: Title + Dismiss */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-xl bg-[#007C8B]/12 text-[#007C8B] dark:text-[#00E5F4] flex items-center justify-center shrink-0">
            <HelpCircle className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-xs sm:text-sm font-bold text-[var(--wallet-text)]">
              Getting Started with PENORA Wallet
            </h2>
            <p className="text-[11px] text-[var(--wallet-muted)]">
              Connect Wallet → Get Test Tokens → Trade PNR → View Balance (Testnet only · no monetary value)
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss beginner wallet guide"
          className="inline-flex items-center gap-1 px-2.5 py-1 min-h-[36px] rounded-lg text-xs font-medium text-[var(--wallet-muted)] hover:text-[var(--wallet-text)] hover:bg-[var(--wallet-inset)] transition-colors shrink-0"
        >
          <span>Dismiss</span>
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* 4-Step Journey Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
        {/* Step 1: Connect Wallet */}
        <div className="p-3 rounded-xl bg-[var(--wallet-inset)] border border-[var(--wallet-border)] flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between gap-1.5">
            <span className="font-bold text-[var(--wallet-text)]">1. Connect Wallet</span>
            {isConnectedAmoy ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300">
                Required
              </span>
            )}
          </div>
          <p className="text-[11px] text-[var(--wallet-muted)]">
            {isConnectedAmoy
              ? 'Connected on Polygon Amoy (80002).'
              : state.status === 'wrong_network'
              ? 'Switch your wallet to Polygon Amoy (80002).'
              : 'Connect MetaMask or a browser wallet.'}
          </p>
          {!state.address ? (
            <button
              type="button"
              onClick={onConnect}
              className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[#007C8B] dark:text-[#00E5F4] hover:underline"
            >
              <Wallet className="h-3 w-3" />
              <span>Connect now</span>
            </button>
          ) : !state.isCorrectNetwork ? (
            <button
              type="button"
              onClick={onSwitchNetwork}
              className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:underline"
            >
              <span>Switch to Polygon Amoy</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          ) : null}
        </div>

        {/* Step 2: Get Test Tokens */}
        <div className="p-3 rounded-xl bg-[var(--wallet-inset)] border border-[var(--wallet-border)] flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between gap-1.5">
            <span className="font-bold text-[var(--wallet-text)]">2. Get Test Tokens</span>
            {hasPol ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-[var(--wallet-surface)] text-[var(--wallet-muted)]">
                Gas Fuel
              </span>
            )}
          </div>
          <p className="text-[11px] text-[var(--wallet-muted)]">
            {hasPol
              ? `Test POL ready (${state.balancePol} POL).`
              : 'Claim free Test POL from the Polygon Amoy faucet for gas.'}
          </p>
          <a
            href="https://faucet.polygon.technology/"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[#007C8B] dark:text-[#00E5F4] hover:underline"
          >
            <span>Polygon Amoy Faucet</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {/* Step 3: Trade PNR */}
        <div className="p-3 rounded-xl bg-[var(--wallet-inset)] border border-[var(--wallet-border)] flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between gap-1.5">
            <span className="font-bold text-[var(--wallet-text)]">3. Trade PNR</span>
            {hasPnr || hasUsdt ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-[var(--wallet-surface)] text-[var(--wallet-muted)]">
                Exchange
              </span>
            )}
          </div>
          <p className="text-[11px] text-[var(--wallet-muted)]">
            Swap MockUSDT for PNR on the Exchange Desk or P2P Marketplace.
          </p>
          <a
            href="/exchange/"
            className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[#007C8B] dark:text-[#00E5F4] hover:underline"
          >
            <span>Open PNR Exchange</span>
            <ArrowRight className="h-3 w-3" />
          </a>
        </div>

        {/* Step 4: View Balance & Participate */}
        <div className="p-3 rounded-xl bg-[var(--wallet-inset)] border border-[var(--wallet-border)] flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between gap-1.5">
            <span className="font-bold text-[var(--wallet-text)]">4. View &amp; Stake</span>
            {hasPnr ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-[var(--wallet-surface)] text-[var(--wallet-muted)]">
                Power
              </span>
            )}
          </div>
          <p className="text-[11px] text-[var(--wallet-muted)]">
            Send PNR to creators or Power Up into PP for voting influence.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('power_system')}
            className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[#007C8B] dark:text-[#00E5F4] hover:underline text-left"
          >
            <span>Manage PENORA Power</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* 4 Token Quick Definitions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1 border-t border-[var(--wallet-border)]">
        {tokenExplainers.map(item => {
          const Icon = item.icon;
          return (
            <div key={item.symbol} className="flex items-start gap-2.5 p-2 rounded-xl">
              <span
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${item.color}`}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0">
                <div className="text-xs font-bold text-[var(--wallet-text)]">{item.title}</div>
                <p className="text-[11px] text-[var(--wallet-muted)] leading-snug">{item.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
