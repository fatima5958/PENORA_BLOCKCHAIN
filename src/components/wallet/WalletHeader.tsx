import React from 'react';
import { Wallet, Moon, Sun, ArrowLeftRight, Check, Copy } from 'lucide-react';
import type { WalletState } from '../../lib/wallet/types';

export interface WalletHeaderProps {
  state: WalletState;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onConnect: () => void;
  onSwitchNetwork: () => void;
  onCopyAddress: () => void;
  copied: boolean;
}

export const WalletHeader: React.FC<WalletHeaderProps> = ({
  state,
  theme,
  onToggleTheme,
  onConnect,
  onSwitchNetwork,
  onCopyAddress,
  copied,
}) => {
  const shortAddress = state.address
    ? `${state.address.slice(0, 6)}…${state.address.slice(-4)}`
    : null;

  const statusDotClass =
    state.status === 'connected' && state.isCorrectNetwork
      ? 'bg-emerald-500'
      : state.status === 'wrong_network'
      ? 'bg-amber-500'
      : 'bg-slate-400';

  return (
    <header className="wallet-header flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--wallet-border)]">
      {/* Left: Wallet Title */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-[#0A2540] text-[#00E5F4] flex items-center justify-center shrink-0 shadow-2xs">
          <Wallet className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[var(--wallet-text)] truncate">
              PENORA Wallet
            </h1>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-[#007C8B]/12 text-[#007C8B] dark:bg-[#00E5F4]/15 dark:text-[#00E5F4] border border-[#007C8B]/20">
              Testnet
            </span>
          </div>
          <p className="text-xs text-[var(--wallet-muted)] hidden sm:block">
            Polygon Amoy (80002) · Non-custodial creator wallet
          </p>
        </div>
      </div>

      {/* Right: Network Indicator, Wallet Status & Theme Toggle */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Compact Network Badge */}
        <div
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[var(--wallet-surface)] border border-[var(--wallet-border)] text-xs font-medium text-[var(--wallet-text)]"
          title="Polygon Amoy Testnet (Chain ID 80002)"
        >
          <span className={`h-2 w-2 rounded-full shrink-0 ${statusDotClass}`} />
          <span className="hidden xs:inline">Polygon Amoy</span>
          <span className="xs:hidden">Amoy</span>
          <span className="text-[11px] font-mono text-[var(--wallet-muted)] hidden sm:inline">80002</span>
        </div>

        {/* Connected Address / Action Pill (Desktop & Tablet) */}
        {state.status === 'wrong_network' ? (
          <button
            type="button"
            onClick={onSwitchNetwork}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-semibold hover:bg-amber-500/25 transition-colors"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            <span>Switch to Amoy</span>
          </button>
        ) : shortAddress ? (
          <button
            type="button"
            onClick={onCopyAddress}
            aria-label="Copy connected wallet address"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] rounded-xl bg-[var(--wallet-surface)] border border-[var(--wallet-border)] text-xs font-mono font-medium text-[var(--wallet-text)] hover:border-[#007C8B]/40 transition-colors"
          >
            <span>{shortAddress}</span>
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-[var(--wallet-muted)]" />
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={onConnect}
            disabled={state.status === 'connecting'}
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 min-h-[38px] rounded-xl bg-[#007C8B] hover:bg-[#006673] text-white text-xs font-semibold transition-colors"
          >
            <Wallet className="h-3.5 w-3.5" />
            <span>{state.status === 'connecting' ? 'Connecting…' : 'Connect Wallet'}</span>
          </button>
        )}

        {/* Theme Toggle Button (44x44px accessible target) */}
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} wallet mode`}
          className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-[var(--wallet-surface)] border border-[var(--wallet-border)] text-[var(--wallet-text)] hover:border-[#007C8B]/40 transition-colors"
        >
          {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </button>
      </div>
    </header>
  );
};
