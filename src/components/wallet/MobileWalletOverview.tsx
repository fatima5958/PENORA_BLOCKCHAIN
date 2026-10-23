import { useState } from 'react';
import {
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  ArrowLeftRight,
  MoreHorizontal,
  ChevronRight,
  ChevronDown,
  Wallet,
  Zap,
  Coins,
  RefreshCw,
  Copy,
  Moon,
  Sun,
  ExternalLink,
} from 'lucide-react';
import { historyLabel, historySign } from '../../lib/wallet/history';
import type { WalletState, WalletTransaction } from '../../lib/wallet/types';

export type WalletTab =
  | 'overview'
  | 'deposit'
  | 'send'
  | 'receive'
  | 'history'
  | 'power_system'
  | 'delegation'
  | 'earnings'
  | 'trade_pnr'
  | 'details';

export function MobileWalletHeader({
  theme,
  onToggleTheme,
}: {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}) {
  return (
    <header className="wallet-phone-heading">
      <div>
        <span className="wallet-phone-eyebrow">PENORA · MY WALLET</span>
        <h1>PENORA Wallet</h1>
      </div>
      <button
        type="button"
        aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} wallet mode`}
        onClick={onToggleTheme}
      >
        {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
      </button>
      <p className="wallet-phone-notice">
        <span />
        Polygon Amoy Testnet (80002) · Test tokens carry no monetary value.
      </p>
    </header>
  );
}

export function MobileWalletNavigation({
  activeTab,
  onNavigate,
}: {
  activeTab: WalletTab;
  onNavigate: (tab: WalletTab) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const main = [
    { id: 'overview', label: 'Overview' },
    { id: 'history', label: 'Activity' },
    { id: 'earnings', label: 'Earnings' },
    { id: 'power_system', label: 'Power' },
  ] as const;
  const extra = [
    { id: 'send', label: 'Send / Withdraw' },
    { id: 'receive', label: 'Receive' },
    { id: 'deposit', label: 'Deposit' },
    { id: 'trade_pnr', label: 'Trade PNR' },
    { id: 'delegation', label: 'Delegation' },
    { id: 'details', label: 'Wallet details & guides' },
  ] as const;
  const navigate = (tab: WalletTab) => {
    setExpanded(false);
    onNavigate(tab);
  };
  return (
    <div className="wallet-phone-navigation">
      <nav aria-label="Wallet sections">
        {main.map(tab => (
          <button
            key={tab.id}
            type="button"
            aria-current={activeTab === tab.id ? 'page' : undefined}
            onClick={() => navigate(tab.id)}
          >
            {tab.label}
          </button>
        ))}
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls="wallet-more-options"
          className={extra.some(tab => tab.id === activeTab) ? 'is-selected' : ''}
          onClick={() => setExpanded(value => !value)}
        >
          More
          <ChevronDown size={13} />
        </button>
      </nav>
      {expanded && (
        <div id="wallet-more-options" className="wallet-phone-more">
          {extra.map(tab => (
            <button
              key={tab.id}
              type="button"
              aria-current={activeTab === tab.id ? 'page' : undefined}
              onClick={() => navigate(tab.id)}
            >
              {tab.label}
              <ChevronRight size={14} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface Props {
  state: WalletState;
  onNavigate: (tab: WalletTab) => void;
  onConnect: () => void;
  onSwitchNetwork: () => void;
  onCopyAddress: () => void;
  onRefresh: () => void;
  copied: boolean;
  onPowerUp: () => void;
  onPowerDown: () => void;
  transactions?: WalletTransaction[];
  historyLoading?: boolean;
  historyError?: string | null;
}

export function MobileWalletOverview({
  state,
  onNavigate,
  onConnect,
  onSwitchNetwork,
  onCopyAddress,
  onRefresh,
  copied,
  onPowerUp,
  onPowerDown,
  transactions = [],
  historyLoading = false,
  historyError = null,
}: Props) {
  const hasAddress = Boolean(state.address);
  const isConnectedAmoy = hasAddress && state.isCorrectNetwork && state.status === 'connected';
  const canPower = hasAddress && state.isCorrectNetwork && state.contractsDeployed;
  const address = state.address
    ? `${state.address.slice(0, 6)}…${state.address.slice(-4)}`
    : '';

  const pnrBalanceDisplay =
    state.balancePnr !== null ? state.balancePnr : isConnectedAmoy ? 'Unavailable' : '—';

  const assets = [
    {
      symbol: 'PNR',
      name: 'Liquid PNR',
      value: state.balancePnr,
      caption: 'Transferable utility token',
      zeroCaption: 'No PNR yet — tap Trade to buy PNR',
      icon: <Coins size={17} />,
    },
    {
      symbol: 'PP',
      name: 'PENORA Power',
      value: state.balancePp,
      caption: 'Staked curation influence',
      zeroCaption: 'No staked PP — tap Power Up to stake',
      icon: <Zap size={17} />,
    },
    {
      symbol: 'USDT',
      name: 'MockUSDT',
      value: state.balanceUsdt,
      caption: state.isUsdtConfigured ? 'Testnet stablecoin' : 'Token setup pending',
      zeroCaption: '0 USDT — needed to buy PNR on Exchange',
      icon: <span>$</span>,
    },
    {
      symbol: 'POL',
      name: 'Test POL Gas',
      value: state.balancePol,
      caption: 'Polygon Amoy network fuel',
      zeroCaption: '0 POL — required for Amoy gas fees',
      icon: <Coins size={17} />,
    },
  ];

  const recentTxs = transactions.slice(0, 3);

  return (
    <div className="wallet-phone-overview">
      {/* B. Main Balance Card */}
      <section className="wallet-phone-balance" aria-label="PNR balance">
        <div className="wallet-phone-balance-top">
          <span>AVAILABLE PNR</span>
          <span className="wallet-phone-network">
            <i />
            TESTNET · AMOY
          </span>
        </div>
        <div className="wallet-phone-amount">
          <strong>{pnrBalanceDisplay}</strong>
          <span>PNR</span>
        </div>
        <p>
          {isConnectedAmoy && state.balancePnr === null
            ? 'Balance unavailable — tap Refresh to retry'
            : hasAddress
            ? 'Liquid test tokens · No monetary value'
            : 'Connect your wallet to view balances'}
        </p>
        {!hasAddress && state.error && (
          <p role="alert" className="wallet-phone-error">
            {state.error}
          </p>
        )}
        {hasAddress ? (
          <div className="wallet-phone-address">
            <button
              type="button"
              onClick={onCopyAddress}
              aria-label="Copy wallet address"
            >
              <Wallet size={13} />
              {address}
              <Copy size={12} />
            </button>
            <span role="status">
              {copied
                ? 'Copied'
                : state.isCorrectNetwork
                ? 'Connected'
                : 'Wrong network'}
            </span>
            <button
              type="button"
              onClick={onRefresh}
              aria-label="Refresh wallet balances"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="wallet-phone-connect"
            onClick={onConnect}
            disabled={state.status === 'connecting'}
          >
            <Wallet size={15} />
            {state.status === 'connecting' ? 'Connecting…' : 'Connect wallet'}
            <ArrowUpRight size={16} />
          </button>
        )}
        {state.status === 'wrong_network' && (
          <button
            type="button"
            className="wallet-phone-connect"
            onClick={onSwitchNetwork}
          >
            Switch to Polygon Amoy
            <ArrowLeftRight size={15} />
          </button>
        )}
      </section>

      {/* C. Four Quick Actions: Send, Receive, Trade, More */}
      <div className="wallet-phone-actions" aria-label="Quick wallet actions">
        {[
          { id: 'send', label: 'Send', icon: ArrowUpRight },
          { id: 'receive', label: 'Receive', icon: ArrowDownLeft },
          { id: 'trade_pnr', label: 'Trade', icon: ArrowLeftRight },
          { id: 'details', label: 'More', icon: MoreHorizontal },
        ].map(action => (
          <button
            key={action.id}
            type="button"
            onClick={() => onNavigate(action.id as WalletTab)}
          >
            <span>
              <action.icon size={20} strokeWidth={1.8} />
            </span>
            {action.label}
          </button>
        ))}
      </div>

      {/* D. Your Assets */}
      <section className="wallet-phone-assets" aria-label="Your wallet assets">
        <div className="wallet-phone-section-title">
          <h2>Your assets</h2>
          <span>TESTNET</span>
        </div>
        {assets.map(item => {
          const isZero =
            isConnectedAmoy &&
            item.value !== null &&
            !Number.isNaN(Number(item.value)) &&
            Number(item.value) === 0;
          const isUnavailable = isConnectedAmoy && item.value === null;
          const displayVal =
            item.value !== null ? item.value : isUnavailable ? 'Unavailable' : '—';
          const captionText = isUnavailable
            ? 'Unavailable — tap Refresh to retry'
            : isZero
            ? item.zeroCaption
            : item.caption;
          return (
            <div key={item.symbol} className="wallet-phone-asset">
              <div className={`wallet-phone-token token-${item.symbol.toLowerCase()}`}>
                {item.icon}
              </div>
              <div>
                <h3>{item.name}</h3>
                <p>{captionText}</p>
              </div>
              <div className="wallet-phone-asset-value">
                <strong>{displayVal}</strong>
                <span>{item.symbol}</span>
              </div>
            </div>
          );
        })}
      </section>

      {/* E. Recent Activity (Up to 3 transactions + View all) */}
      <section className="wallet-phone-activity" aria-label="Recent activity">
        <div className="wallet-phone-section-title">
          <h2>Recent activity</h2>
          <button
            type="button"
            className="wallet-phone-viewall"
            onClick={() => onNavigate('history')}
          >
            View all
            <ChevronRight size={14} />
          </button>
        </div>
        {historyLoading ? (
          <p className="wallet-phone-empty">Loading recent activity…</p>
        ) : recentTxs.length > 0 ? (
          <div className="wallet-phone-tx-list">
            {recentTxs.map(tx => (
              <div key={tx.id} className="wallet-phone-tx">
                <div>
                  <div className="wallet-phone-tx-title">
                    <strong>{historyLabel(tx)}</strong>
                    <span className={`tx-badge tx-${tx.status}`}>{tx.status}</span>
                  </div>
                  <p>
                    {tx.hash.slice(0, 8)}…{tx.hash.slice(-6)}
                  </p>
                </div>
                <div className="wallet-phone-tx-right">
                  <strong>
                    {historySign(tx)}
                    {tx.amount} {tx.symbol}
                  </strong>
                  {tx.explorerUrl && (
                    <a
                      href={tx.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="View on explorer"
                    >
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : historyError ? (
          <p className="wallet-phone-empty">Unavailable: {historyError}</p>
        ) : (
          <p className="wallet-phone-empty">
            {hasAddress
              ? 'No recent transactions in query window.'
              : 'Connect your wallet on Amoy to view activity.'}
          </p>
        )}
      </section>

      {/* F. Compact Power Quick Card */}
      <section className="wallet-phone-power" aria-label="Power actions">
        <div>
          <span className="wallet-phone-power-icon">
            <Zap size={18} />
          </span>
          <div>
            <h2>PENORA Power Staking</h2>
            <p>1 PNR = 1 PP · Manage curation influence</p>
          </div>
        </div>
        <div className="wallet-phone-power-actions">
          <button type="button" disabled={!canPower} onClick={onPowerUp}>
            Power Up
            <Plus size={14} />
          </button>
          <button type="button" disabled={!canPower} onClick={onPowerDown}>
            Power Down
            <ArrowDownLeft size={14} />
          </button>
        </div>
        {!canPower && (
          <p className="wallet-phone-power-help">
            {!hasAddress
              ? 'Connect on Amoy to manage Power.'
              : !state.isCorrectNetwork
              ? 'Switch to Amoy to manage Power.'
              : 'Staking contract setup is pending.'}
          </p>
        )}
      </section>

      <button
        type="button"
        className="wallet-phone-details"
        onClick={() => onNavigate('details')}
      >
        <span>Deposit, delegation, wallet verification &amp; guides</span>
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
