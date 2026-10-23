import React from 'react';
import {
  ShieldCheck,
  Wallet,
  Copy,
  Check,
  ExternalLink,
  AlertCircle,
  RefreshCw,
  Zap,
  TrendingDown,
  Award,
  ChevronRight,
  Coins,
} from 'lucide-react';
import { POLYGON_AMOY_CONFIG } from '../../lib/wallet/chain';
import type { WalletState } from '../../lib/wallet/types';
import type { WalletTab } from './MobileWalletOverview';

export interface WalletConnectionPanelProps {
  state: WalletState;
  copied: boolean;
  isProviderInstalled?: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onSwitchNetwork: () => void;
  onCopyAddress: () => void;
  onPowerUp: () => void;
  onPowerDown: () => void;
  onNavigate: (tab: WalletTab) => void;
}

export const WalletConnectionPanel: React.FC<WalletConnectionPanelProps> = ({
  state,
  copied,
  isProviderInstalled = true,
  onConnect,
  onDisconnect,
  onSwitchNetwork,
  onCopyAddress,
  onPowerUp,
  onPowerDown,
  onNavigate,
}) => {
  const shortAddress = state.address
    ? `${state.address.slice(0, 6)}…${state.address.slice(-4)}`
    : null;
  const isConnectedAmoy = Boolean(
    state.address && state.isCorrectNetwork && state.status === 'connected'
  );
  const canPower = Boolean(state.address && state.isCorrectNetwork && state.contractsDeployed);
  const manaPercent =
    state.votingManaPercent !== null ? Math.min(100, Math.max(0, state.votingManaPercent)) : 0;
  const isNoWalletDetected =
    !isProviderInstalled || Boolean(state.error?.toLowerCase().includes('not detected'));

  return (
    <aside className="wallet-connection-panel space-y-4" aria-label="Wallet status and curation power">
      {/* 1. Web3 EVM Connection & Gas Status */}
      <div className="rounded-2xl bg-[var(--wallet-surface)] border border-[var(--wallet-border)] p-4 sm:p-5 shadow-2xs space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-[var(--wallet-text)] flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#007C8B] dark:text-[#00E5F4]" />
            <span>Web3 Wallet Connection</span>
          </h2>
          <span
            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
              state.status === 'connected' && state.isCorrectNetwork
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                : state.status === 'wrong_network'
                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                : 'bg-[var(--wallet-inset)] text-[var(--wallet-muted)]'
            }`}
          >
            {state.status.replace('_', ' ')}
          </span>
        </div>

        {state.address ? (
          <div className="space-y-3">
            {/* Address Row */}
            <div className="p-3 rounded-xl bg-[var(--wallet-inset)] border border-[var(--wallet-border)] flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider font-semibold text-[var(--wallet-muted)]">
                  Connected Address
                </div>
                <div className="font-mono text-xs font-bold text-[var(--wallet-text)] truncate">
                  {shortAddress}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={onCopyAddress}
                  aria-label="Copy full address"
                  title="Copy full address"
                  className="p-2 rounded-lg hover:bg-[var(--wallet-surface)] text-[#007C8B] dark:text-[#00E5F4] transition-colors"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
                <a
                  href={`${POLYGON_AMOY_CONFIG.blockExplorers[0]}/address/${state.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="View on PolygonScan"
                  className="p-2 rounded-lg hover:bg-[var(--wallet-surface)] text-[var(--wallet-muted)] hover:text-[#007C8B] transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>

            {/* Network & Gas Status Row */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-[var(--wallet-inset)] border border-[var(--wallet-border)]">
                <span className="text-[10px] text-[var(--wallet-muted)] block">Network</span>
                <span className="font-semibold text-[var(--wallet-text)]">
                  {state.isCorrectNetwork ? 'Amoy (80002)' : `Chain ${state.chainId ?? '?'}`}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-[var(--wallet-inset)] border border-[var(--wallet-border)] min-w-0">
                <span className="text-[10px] text-[var(--wallet-muted)] block">Gas Balance</span>
                <span className="font-mono font-semibold text-[var(--wallet-text)] tabular-nums whitespace-nowrap">
                  {state.balancePol !== null
                    ? `${state.balancePol} POL`
                    : isConnectedAmoy
                    ? 'Unavailable'
                    : '— POL'}
                </span>
              </div>
            </div>

            {/* Wrong Network Warning */}
            {state.status === 'wrong_network' && (
              <div className="p-3 rounded-xl bg-amber-500/12 border border-amber-500/25 text-xs text-amber-900 dark:text-amber-200 space-y-2">
                <div className="flex items-center gap-1.5 font-semibold">
                  <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                  <span>Wrong Network Detected</span>
                </div>
                <button
                  type="button"
                  onClick={onSwitchNetwork}
                  className="w-full min-h-[38px] py-1.5 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-colors"
                >
                  Switch to Polygon Amoy
                </button>
              </div>
            )}

            <div className="flex items-center justify-between pt-0.5 text-xs">
              <a
                href="https://faucet.polygon.technology/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#007C8B] dark:text-[#00E5F4] hover:underline font-medium inline-flex items-center gap-1"
              >
                <span>Get Test POL Faucet</span>
                <ExternalLink className="h-3 w-3" />
              </a>
              <button
                type="button"
                onClick={onDisconnect}
                className="text-red-600 dark:text-red-400 hover:underline font-medium"
              >
                Disconnect
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-[var(--wallet-muted)] leading-relaxed">
              {isNoWalletDetected
                ? 'No browser wallet extension detected. Install MetaMask or open PENORA in a Web3-enabled browser to connect on Polygon Amoy.'
                : 'Connect MetaMask on Polygon Amoy to inspect token balances, send PNR or MockUSDT, and manage staked PENORA Power.'}
            </p>
            {state.error && (
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/25 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{state.error}</span>
              </div>
            )}
            <div className="space-y-2">
              <button
                type="button"
                onClick={onConnect}
                disabled={state.status === 'connecting'}
                className="w-full min-h-[42px] py-2.5 px-4 rounded-xl bg-[#007C8B] hover:bg-[#006673] text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
              >
                {state.status === 'connecting' ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Connecting…</span>
                  </>
                ) : (
                  <>
                    <Wallet className="h-3.5 w-3.5" />
                    <span>Connect Web3 Wallet</span>
                  </>
                )}
              </button>
              {isNoWalletDetected && (
                <a
                  href="https://metamask.io/download/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full min-h-[38px] py-2 px-3 rounded-xl bg-[var(--wallet-inset)] hover:border-[#007C8B]/40 border border-[var(--wallet-border)] text-xs font-semibold text-[var(--wallet-text)] inline-flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Install MetaMask Extension</span>
                  <ExternalLink className="h-3.5 w-3.5 text-[#007C8B] dark:text-[#00E5F4]" />
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. PENORA Power & Voting Mana Card */}
      <div className="rounded-2xl bg-[var(--wallet-surface)] border border-[var(--wallet-border)] p-4 sm:p-5 shadow-2xs space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-[#007C8B] dark:text-[#00E5F4]" />
            <h2 className="text-sm font-bold text-[var(--wallet-text)]">PENORA Power &amp; Mana</h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('power_system')}
            className="text-xs font-semibold text-[#007C8B] dark:text-[#00E5F4] hover:underline inline-flex items-center gap-0.5"
          >
            <span>Manage</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="p-3 rounded-xl bg-[var(--wallet-inset)] border border-[var(--wallet-border)] flex items-center justify-between">
          <span className="text-xs text-[var(--wallet-muted)]">Staked Power</span>
          <strong className="font-mono text-sm font-bold text-[var(--wallet-text)] tabular-nums">
            {state.balancePp !== null
              ? `${state.balancePp} PP`
              : isConnectedAmoy
              ? 'Unavailable'
              : '— PP'}
          </strong>
        </div>

        {/* Voting Mana Gauge */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--wallet-muted)]">Voting Mana</span>
            <span className="font-mono font-bold text-[#007C8B] dark:text-[#00E5F4]">
              {state.votingManaPercent !== null
                ? `${state.votingManaPercent.toFixed(1)}%`
                : isConnectedAmoy
                ? 'Unavailable'
                : '—'}
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-[var(--wallet-inset)] overflow-hidden">
            <div
              className="h-full bg-[#007C8B] dark:bg-[#00E5F4] rounded-full transition-all duration-300"
              style={{ width: `${manaPercent}%` }}
            />
          </div>
          <p className="text-[11px] text-[var(--wallet-muted)]">
            5-day linear regeneration · 1 PNR = 1 PP
          </p>
        </div>

        {/* Quick Power Up / Power Down Controls */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            disabled={!canPower}
            onClick={onPowerUp}
            className="min-h-[40px] px-3 py-2 rounded-xl bg-[var(--wallet-inset)] hover:border-[#007C8B]/40 border border-[var(--wallet-border)] text-xs font-semibold text-[var(--wallet-text)] inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-45"
          >
            <Zap className="h-3.5 w-3.5 text-[#007C8B] dark:text-[#00E5F4]" />
            <span>Power Up</span>
          </button>
          <button
            type="button"
            disabled={!canPower}
            onClick={onPowerDown}
            className="min-h-[40px] px-3 py-2 rounded-xl bg-[var(--wallet-inset)] hover:border-[#007C8B]/40 border border-[var(--wallet-border)] text-xs font-semibold text-[var(--wallet-text)] inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-45"
          >
            <TrendingDown className="h-3.5 w-3.5 text-amber-500" />
            <span>Power Down</span>
          </button>
        </div>
      </div>

      {/* 3. Creator Earnings & Exchange Shortcuts */}
      <div className="rounded-2xl bg-[var(--wallet-surface)] border border-[var(--wallet-border)] p-4 sm:p-5 shadow-2xs space-y-2.5">
        <button
          type="button"
          onClick={() => onNavigate('earnings')}
          className="w-full p-3 rounded-xl bg-[var(--wallet-inset)] hover:border-[#007C8B]/40 border border-[var(--wallet-border)] flex items-center justify-between gap-3 text-left transition-colors"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#007C8B]/12 text-[#007C8B] dark:text-[#00E5F4] flex items-center justify-center shrink-0">
              <Award className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-[var(--wallet-text)] truncate">
                Creator Rewards &amp; Claims
              </div>
              <div className="text-[11px] text-[var(--wallet-muted)] truncate">
                70% author / 20% curator payouts
              </div>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-[var(--wallet-muted)] shrink-0" />
        </button>

        <a
          href="/exchange/"
          className="w-full p-3 rounded-xl bg-[#0A2540] hover:bg-[#103152] text-white flex items-center justify-between gap-3 transition-colors"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-white/10 text-[#00E5F4] flex items-center justify-center shrink-0">
              <Coins className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold truncate">PENORA Exchange Desk</div>
              <div className="text-[11px] text-slate-300 truncate">
                Buy PNR with MockUSDT &amp; P2P Escrow
              </div>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-[#00E5F4] shrink-0" />
        </a>
      </div>
    </aside>
  );
};
