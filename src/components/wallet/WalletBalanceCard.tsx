import React from 'react';
import {
  Wallet,
  Copy,
  Check,
  RefreshCw,
  ArrowUpRight,
  ArrowLeftRight,
  Zap,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import type { WalletState } from '../../lib/wallet/types';

export interface WalletBalanceCardProps {
  state: WalletState;
  copied: boolean;
  isProviderInstalled?: boolean;
  onConnect: () => void;
  onSwitchNetwork: () => void;
  onCopyAddress: () => void;
  onRefresh: () => void;
  onPowerUp: () => void;
}

export const WalletBalanceCard: React.FC<WalletBalanceCardProps> = ({
  state,
  copied,
  isProviderInstalled = true,
  onConnect,
  onSwitchNetwork,
  onCopyAddress,
  onRefresh,
  onPowerUp,
}) => {
  const hasAddress = Boolean(state.address);
  const isConnectedAmoy = hasAddress && state.isCorrectNetwork && state.status === 'connected';
  const canPower = hasAddress && state.isCorrectNetwork && state.contractsDeployed;
  const shortAddress = state.address
    ? `${state.address.slice(0, 6)}…${state.address.slice(-4)}`
    : '';

  const pnrDisplay =
    state.balancePnr !== null
      ? state.balancePnr
      : isConnectedAmoy
      ? 'Unavailable'
      : '—';

  const isNoWalletDetected =
    !isProviderInstalled || Boolean(state.error?.toLowerCase().includes('not detected'));

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
            {pnrDisplay}
          </strong>
          <span className="text-sm font-semibold text-[#00E5F4]">PNR</span>
        </div>
        <p className="text-xs text-slate-300">
          {isConnectedAmoy && state.balancePnr === null
            ? 'Balance unavailable — RPC or token contract could not be verified. Tap Refresh to retry.'
            : hasAddress
            ? 'Liquid transferable test tokens · No monetary value'
            : 'Connect your wallet on Polygon Amoy to view balances'}
        </p>
      </div>

      {/* Disconnected Error or Missing Provider Guidance */}
      {!hasAddress && state.error && (
        <div
          role="alert"
          className="p-3 rounded-xl bg-red-500/15 border border-red-400/30 text-xs text-red-100 flex items-start gap-2"
        >
          <AlertCircle className="h-4 w-4 text-red-300 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span>{state.error}</span>
            {isNoWalletDetected && (
              <div>
                <a
                  href="https://metamask.io/download/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-[#00E5F4] underline"
                >
                  <span>Install MetaMask Extension</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>
        </div>
      )}

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
          <div className="w-full flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <button
              type="button"
              onClick={onConnect}
              disabled={state.status === 'connecting'}
              className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-[#00E5F4] hover:bg-[#33ecfa] text-[#0A2540] font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
            >
              <Wallet className="h-4 w-4" />
              <span>{state.status === 'connecting' ? 'Connecting…' : 'Connect wallet'}</span>
              <ArrowUpRight className="h-4 w-4 ml-auto" />
            </button>
            {isNoWalletDetected && (
              <a
                href="https://metamask.io/download/"
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs inline-flex items-center justify-center gap-1.5 transition-colors border border-white/15"
              >
                <span>Install MetaMask</span>
                <ExternalLink className="h-3.5 w-3.5 text-[#00E5F4]" />
              </a>
            )}
          </div>
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
