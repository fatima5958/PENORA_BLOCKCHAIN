import { useState } from 'react';
import { ArrowUpRight, ArrowDownLeft, Plus, ArrowLeftRight, ChevronRight, ChevronDown, Wallet, Zap, Coins, RefreshCw, Copy, Moon, Sun } from 'lucide-react';
import { PenoraEmblem } from '../brand/PenoraLogo';
import type { WalletState } from '../../lib/wallet/types';

export type WalletTab = 'overview' | 'deposit' | 'send' | 'receive' | 'history' | 'power_system' | 'delegation' | 'earnings' | 'trade_pnr' | 'details';

export function MobileWalletHeader({ theme, onToggleTheme }: { theme: 'light' | 'dark'; onToggleTheme: () => void }) {
  return <header className="wallet-phone-heading">
    <div><span className="wallet-phone-eyebrow">PENORA / WALLET</span><h1>Your creative capital.</h1></div>
    <button type="button" aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} wallet mode`} onClick={onToggleTheme}>{theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}</button>
    <p className="wallet-phone-notice"><span />Amoy testnet · Test tokens have no monetary value.</p>
  </header>;
}

export function MobileWalletNavigation({ activeTab, onNavigate }: { activeTab: WalletTab; onNavigate: (tab: WalletTab) => void }) {
  const [expanded, setExpanded] = useState(false);
  const main = [{ id: 'overview', label: 'Overview' }, { id: 'earnings', label: 'Earnings' }, { id: 'power_system', label: 'Power' }, { id: 'history', label: 'Activity' }] as const;
  const extra = [{ id: 'send', label: 'Send / Withdraw' }, { id: 'receive', label: 'Receive' }, { id: 'deposit', label: 'Deposit' }, { id: 'delegation', label: 'Delegation' }, { id: 'trade_pnr', label: 'Trade PNR' }, { id: 'details', label: 'Wallet details & guides' }] as const;
  const navigate = (tab: WalletTab) => { setExpanded(false); onNavigate(tab); };
  return <div className="wallet-phone-navigation">
    <nav aria-label="Wallet sections">{main.map(tab => <button key={tab.id} type="button" aria-current={activeTab === tab.id ? 'page' : undefined} onClick={() => navigate(tab.id)}>{tab.label}</button>)}
      <button type="button" aria-expanded={expanded} aria-controls="wallet-more-options" className={extra.some(tab => tab.id === activeTab) ? 'is-selected' : ''} onClick={() => setExpanded(value => !value)}>More<ChevronDown size={13} /></button>
    </nav>
    {expanded && <div id="wallet-more-options" className="wallet-phone-more">{extra.map(tab => <button key={tab.id} type="button" aria-current={activeTab === tab.id ? 'page' : undefined} onClick={() => navigate(tab.id)}>{tab.label}<ChevronRight size={14} /></button>)}</div>}
  </div>;
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
}

export function MobileWalletOverview({ state, onNavigate, onConnect, onSwitchNetwork, onCopyAddress, onRefresh, copied, onPowerUp, onPowerDown }: Props) {
  const hasAddress = Boolean(state.address);
  const canPower = hasAddress && state.isCorrectNetwork && state.contractsDeployed;
  const address = state.address ? `${state.address.slice(0, 6)}…${state.address.slice(-4)}` : '';
  const assets = [
    { symbol: 'USDT', name: 'Test USDT', value: state.balanceUsdt, caption: state.isUsdtConfigured ? 'Liquid balance' : 'Token setup pending', icon: <span>$</span> },
    { symbol: 'PP', name: 'PENORA Power', value: state.balancePp, caption: 'Your curation influence', icon: <Zap size={17} /> },
    { symbol: 'POL', name: 'Network gas', value: state.balancePol, caption: 'Polygon Amoy fees', icon: <Coins size={17} /> },
  ];
  return <div className="wallet-phone-overview">
    <section className="wallet-phone-balance" aria-label="PNR balance">
      <div className="wallet-phone-watermark" aria-hidden="true"><PenoraEmblem size={180} theme="dark" /></div>
      <div className="wallet-phone-balance-top"><span>AVAILABLE PNR</span><span className="wallet-phone-network"><i />AMOY</span></div>
      <div className="wallet-phone-amount"><strong>{state.balancePnr ?? '—'}</strong><span>PNR</span></div>
      <p>{hasAddress ? 'Your liquid test tokens' : 'Connect your wallet to view balances'}</p>
      {hasAddress ? <div className="wallet-phone-address">
        <button type="button" onClick={onCopyAddress} aria-label="Copy wallet address"><Wallet size={13} />{address}<Copy size={12} /></button>
        <span role="status">{copied ? 'Copied' : state.isCorrectNetwork ? 'Connected' : 'Wrong network'}</span>
        <button type="button" onClick={onRefresh} aria-label="Refresh wallet balances"><RefreshCw size={14} /></button>
      </div> : <button type="button" className="wallet-phone-connect" onClick={onConnect} disabled={state.status === 'connecting'}><Wallet size={15} />{state.status === 'connecting' ? 'Connecting…' : 'Connect wallet'}<ArrowUpRight size={16} /></button>}
      {state.status === 'wrong_network' && <button type="button" className="wallet-phone-connect" onClick={onSwitchNetwork}>Switch to Polygon Amoy<ArrowLeftRight size={15} /></button>}
    </section>
    <div className="wallet-phone-actions" aria-label="Quick wallet actions">
      {[{ id: 'send', label: 'Send', icon: ArrowUpRight }, { id: 'receive', label: 'Receive', icon: ArrowDownLeft }, { id: 'deposit', label: 'Deposit', icon: Plus }, { id: 'trade_pnr', label: 'Trade', icon: ArrowLeftRight }].map(action => <button key={action.id} type="button" onClick={() => onNavigate(action.id as WalletTab)}><span><action.icon size={21} strokeWidth={1.7} /></span>{action.label}</button>)}
    </div>
    <section className="wallet-phone-assets" aria-label="Other wallet assets">
      <div className="wallet-phone-section-title"><h2>Your assets</h2><span>TESTNET</span></div>
      {assets.map(item => <div key={item.symbol} className="wallet-phone-asset"><div className={`wallet-phone-token token-${item.symbol.toLowerCase()}`}>{item.icon}</div><div><h3>{item.name}</h3><p>{item.caption}</p></div><div className="wallet-phone-asset-value"><strong>{item.value ?? '—'}</strong><span>{item.symbol}</span></div></div>)}
    </section>
    <section className="wallet-phone-power" aria-label="Power actions">
      <div><span className="wallet-phone-power-icon"><Zap size={18} /></span><div><h2>Put your PNR to work.</h2><p>Power up your curation influence.</p></div></div>
      <div className="wallet-phone-power-actions"><button type="button" disabled={!canPower} onClick={onPowerUp}>Power Up<Plus size={14} /></button><button type="button" disabled={!canPower} onClick={onPowerDown}>Power Down<ArrowDownLeft size={14} /></button></div>
      {!canPower && <p className="wallet-phone-power-help">{!hasAddress ? 'Connect on Amoy to manage Power.' : !state.isCorrectNetwork ? 'Switch to Amoy to manage Power.' : 'Staking contract setup is pending.'}</p>}
    </section>
    <button type="button" className="wallet-phone-details" onClick={() => onNavigate('details')}><span>Connections, schedules & wallet guide</span><ChevronRight size={16} /></button>
  </div>;
}
