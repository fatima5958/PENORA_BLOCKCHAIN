import React from 'react';
import {
  Wallet,
  Copy,
  Check,
  RefreshCw,
  ArrowUpRight,
  ArrowLeftRight,
  Zap,
} from 'lucide-react';
import type { WalletState } from '../../lib/wallet/types';

export interface WalletBalanceCardProps {
  state: WalletState;
  copied: boolean;
  onConnect: () => void;
  onSwitchNetwork: () => void;
  onCopyAddress: () => void;
  onRefresh: () => void;
  onPowerUp: () => void;
}

export const WalletBalanceCard: React.FC<WalletBalanceCardProps> = ({
  state,
  copied,
  onConnect,
  onSwitchNetwork,
  onCopyAddress,
  onRefresh,
  onPowerUp,
}) => {
  const hasAddress = Boolean(state.address);
  const canPower = hasAddress && state.isCorrectNetwork && state.contractsDeployed;
  const shortAddress = state.address
    ? `${state.address.slice(0, 6)}…${state.address.slice(-4)}`
    : '';

  return (
    <section
      aria-label="Primary PNR balance"
      className="wallet-balance-card rounded-2xl bg-[#0A2540] text-white p-5 sm:p-6 border border-[#00E5F4]/20 shadow-sm space-y-4"
    >
      {/* Top Row: Label + Testnet Badge */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">
          Available PNR
        </span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-white/10 text-[#00E5F4] border border-white/15">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              state.isCorrectNetwork ? 'bg-emerald-400' : 'bg-amber-400'
            }`}
          />
          Testnet · Amoy
        </span>
      </div>

      {/* Main Balance Amount */}
      <div className="space-y-1">
        <div className="flex items-baseline gap-2.5 flex-wrap">
          <strong className="text-3xl sm:text-4xl font-bold tracking-tight font-mono tabular-nums text-white break-all">
            {state.balancePnr ?? '—'}
          </strong>
          <span className="text-sm font-semibold text-[#00E5F4]">PNR</span>
        </div>
        <p className="text-xs text-slate-300">
          {hasAddress
            ? 'Liquid transferable test tokens · No monetary value'
            : 'Connect your wallet on Polygon Amoy to view balances'}
        </p>
      </div>

      {/* Bottom Bar: Connected Wallet Controls OR Connect CTA */}
      <div className="pt-3 border-t border-white/12 flex flex-wrap items-center justify-between gap-2">
        {hasAddress ? (
          <>
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={onCopyAddress}
                aria-label="Copy wallet address"
                className="inline-flex items-center gap-1.5 min-h-[38px] px-2.5 py-1 rounded-lg bg-white/8 hover:bg-white/15 text-xs font-mono text-slate-100 transition-colors"
              >
                <Wallet className="h-3.5 w-3.5 text-[#00E5F4]" />
                <span>{shortAddress}</span>
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-slate-300" />
                )}
              </button>
              <span
                role="status"
                className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${
                  copied
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : state.isCorrectNetwork
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : 'bg-amber-500/20 text-amber-300'
                }`}
              >
                {copied ? 'Copied' : state.isCorrectNetwork ? 'Connected' : 'Wrong network'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 ml-auto">
              <button
                type="button"
                disabled={!canPower}
                onClick={onPowerUp}
                className="inline-flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 rounded-lg bg-[#007C8B] hover:bg-[#008f9f] text-white text-xs font-semibold transition-colors disabled:opacity-45"
              >
                <Zap className="h-3.5 w-3.5 text-[#00E5F4]" />
                <span>Power Up</span>
              </button>
              <button
                type="button"
                onClick={onRefresh}
                aria-label="Refresh wallet balances"
                title="Refresh balances"
                className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white/8 hover:bg-white/15 text-slate-200 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={onConnect}
            disabled={state.status === 'connecting'}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#00E5F4] hover:bg-[#33ecfa] text-[#0A2540] font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
          >
            <Wallet className="h-4 w-4" />
            <span>{state.status === 'connecting' ? 'Connecting…' : 'Connect wallet'}</span>
            <ArrowUpRight className="h-4 w-4 ml-auto" />
          </button>
        )}

        {state.status === 'wrong_network' && (
          <button
            type="button"
            onClick={onSwitchNetwork}
            className="w-full min-h-[42px] mt-1 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#0A2540] font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
          >
            <span>Switch to Polygon Amoy (80002)</span>
            <ArrowLeftRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </section>
  );
};
