import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ArrowUpRight,
  ArrowDown,
  ArrowRight,
  ArrowLeft,
  Check,
  ChevronDown,
  Wallet,
  ShieldCheck,
  RefreshCw,
  Layers3,
  Activity,
  ExternalLink,
  Lock,
  AlertCircle,
  Clock,
  Sparkles,
  TrendingUp,
  History,
  SlidersHorizontal,
} from 'lucide-react';
import { formatUnits, parseUnits, type Address } from 'viem';
import { penoraWalletService, INITIAL_WALLET_STATE } from '../../lib/wallet/walletService';
import {
  exchangeConfigured,
  exchangeAddress,
  readMarket,
  getBuyQuote,
  buyPnr,
  pendingBuy,
  reconcileBuy,
  readExchangeAdmin,
  setExchangeRate,
  setExchangePaused,
  getUserUsdtAllowance,
  estimateBuyGas,
  watchExchangeRate,
  watchExchangePurchases,
  fetchRateHistory,
  isFounderWallet,
  type MarketSnapshot,
  type BuyQuote,
  type ExchangeAdminState,
  type RateHistoryItem,
} from '../../lib/exchange/exchangeService';
import '../../styles/exchange.css';
import { P2PMarketplaceView } from './P2PMarketplaceView';
import { ActiveKeyWalletEntry, activeKeyWalletEnabled } from '../wallet/ActiveKeyWalletEntry';

const compact = (raw: bigint, decimals = 18) =>
  Number(formatUnits(raw, decimals)).toLocaleString('en-US', { maximumFractionDigits: 6 });
const short = (value: string) => `${value.slice(0, 6)}…${value.slice(-4)}`;

/**
 * Phase 23 Compliant Real-Time Price & Liquidity Engine Display.
 * Strictly adheres to requirement:
 * "Do not generate fake historical candles or invented percentage changes.
 * Show:
 * - Current owner-set rate
 * - Last updated
 * - Available PNR inventory
 * - Clear explanation that market trading price discovery is not active
 * P2P sellers must retain their independent offer prices."
 */
function ExchangeRateEngineCard({
  market,
  lastSyncedAt,
  rateHistory,
  refreshing,
  onRefresh,
}: {
  market: MarketSnapshot | null;
  lastSyncedAt: string | null;
  rateHistory: RateHistoryItem[];
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const rateNum = market && market.rate > 0n ? Number(formatUnits(market.rate, 18)) : 0;
  const pnrPriceUsdt = rateNum > 0 ? (1 / rateNum).toFixed(6) : '0';

  return (
    <section className="ex-panel" aria-label="Real-time PNR rate and liquidity engine">
      {/* Top Header Bar */}
      <div className="ex-panel-head flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="ex-dot" />
          <span className="text-xs font-semibold text-white">Rate &amp; Liquidity Engine</span>
          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Polygon Amoy Verified
          </span>
        </div>
        <div className="flex items-center gap-2">
          {lastSyncedAt && (
            <span className="text-[10px] text-[var(--ex-muted)] font-mono hidden sm:inline">
              Synced {lastSyncedAt}
            </span>
          )}
          <button
            type="button"
            className="ex-icon-button"
            aria-label="Refresh exchange rate and inventory"
            disabled={refreshing}
            onClick={onRefresh}
            title="Refresh on-chain rate"
          >
            <RefreshCw size={14} className={refreshing ? 'ex-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Main Rate Hero Display */}
      <div className="p-5 sm:p-6 space-y-4">
        <div className="space-y-1">
          <div className="flex items-baseline gap-3 flex-wrap">
            <strong className="text-3xl sm:text-4xl font-bold font-mono tracking-tight text-white tabular-nums">
              {market ? `${compact(market.rate)} PNR` : '—'}
            </strong>
            <span className="text-sm font-semibold text-[#00E5F4]">/ 1 MockUSDT</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--ex-muted)] flex-wrap pt-0.5">
            <span className="text-emerald-300 font-mono font-semibold tabular-nums">
              1 PNR = {pnrPriceUsdt} MockUSDT
            </span>
            <span>•</span>
            <span className="text-[11px] font-medium text-amber-300/90 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              Owner-set TESTNET rate — not a live market price
            </span>
          </div>
        </div>

        {/* 3 Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="p-3.5 rounded-xl bg-[#0c171d] border border-white/5 space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-[var(--ex-muted)] block">
              Desk PNR Inventory
            </span>
            <strong className="text-base font-bold text-white font-mono tabular-nums block">
              {market ? `${compact(market.inventory)} PNR` : '—'}
            </strong>
            <span className="text-[11px] text-emerald-400 block">Available on-chain</span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0c171d] border border-white/5 space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-[var(--ex-muted)] block">
              Pricing Model
            </span>
            <strong className="text-sm font-semibold text-white block">
              Owner-Administered
            </strong>
            <span className="text-[11px] text-[var(--ex-muted)] block">
              Fixed rate via <code className="text-[#00E5F4]">setRate()</code>
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0c171d] border border-white/5 space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-[var(--ex-muted)] block">
              Desk Status
            </span>
            <div className="flex items-center gap-1.5 pt-0.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  !market
                    ? 'bg-slate-400'
                    : market.paused
                    ? 'bg-amber-400'
                    : market.inventory === 0n
                    ? 'bg-red-400'
                    : 'bg-emerald-400'
                }`}
              />
              <strong className="text-sm font-semibold text-white">
                {!market
                  ? 'Connecting…'
                  : market.paused
                  ? 'Paused by Owner'
                  : market.inventory === 0n
                  ? 'Inventory Depleted'
                  : 'Active & Purchasing'}
              </strong>
            </div>
            <span className="text-[11px] text-[var(--ex-muted)] block">
              Slippage: 0.5% max
            </span>
          </div>
        </div>

        {/* Honest Market Notice Banner */}
        <div className="p-3.5 rounded-xl bg-[#0c171d] border border-white/8 text-xs text-[var(--ex-muted)] space-y-1.5 leading-relaxed">
          <div className="flex items-center gap-2 text-white font-semibold text-[11px]">
            <ShieldCheck className="h-3.5 w-3.5 text-[#00E5F4]" />
            <span>Honest Market Transparency</span>
          </div>
          <p className="text-[11px]">
            Market trading price discovery is not active on Polygon Amoy testnet. This desk functions as an inventory-backed direct exchange where test rates are established on-chain by the platform owner.
          </p>
          <p className="text-[11px] text-slate-400">
            For peer-to-peer negotiated pricing, visit the <strong>P2P Marketplace</strong> where creators set their own independent asking prices.
          </p>
        </div>

        {/* Rate Change Audit Trail Section */}
        <div className="pt-2 border-t border-white/5">
          <div className="flex items-center justify-between text-xs pb-2">
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="text-[#00E5F4] hover:underline font-semibold inline-flex items-center gap-1"
            >
              <History size={13} />
              <span>{showHistory ? 'Hide Rate History' : 'View On-Chain Rate History'}</span>
              <ChevronDown
                size={13}
                className={`transition-transform duration-200 ${showHistory ? 'rotate-180' : ''}`}
              />
            </button>
            <span className="text-[10px] font-mono text-[var(--ex-muted)]">
              {rateHistory.length > 0
                ? `${rateHistory.length} event${rateHistory.length > 1 ? 's' : ''} recorded`
                : 'Genesis Rate Active'}
            </span>
          </div>

          {showHistory && (
            <div className="mt-2 space-y-2">
              {rateHistory.length > 0 ? (
                <div className="divide-y divide-white/5 rounded-xl bg-[#0c171d] border border-white/5 p-3 text-xs font-mono">
                  {rateHistory.map((item, idx) => (
                    <div
                      key={item.txHash || idx}
                      className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="text-white font-semibold">
                          Rate: {item.newRateFormatted} PNR / USDT ({item.equivalentPricePerPnr} USDT/PNR)
                        </div>
                        <div className="text-[10px] text-[var(--ex-muted)]">
                          Block #{item.blockNumber.toString()} · Previous: {formatUnits(item.previousRate, 18)} PNR
                        </div>
                      </div>
                      {item.txHash && (
                        <a
                          href={`https://amoy.polygonscan.com/tx/${item.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#00E5F4] hover:underline text-[11px] inline-flex items-center gap-1 font-sans shrink-0"
                        >
                          <span>Explorer</span>
                          <ExternalLink size={11} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-[#0c171d] border border-white/5 text-[11px] text-[var(--ex-muted)]">
                  Genesis rate initialized at {market ? `${compact(market.rate)} PNR` : '5 PNR'} per 1 MockUSDT. No subsequent rate changes have been submitted to this contract yet.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function ExchangeView() {
  const [wallet, setWallet] = useState(INITIAL_WALLET_STATE);
  const [market, setMarket] = useState<MarketSnapshot | null>(null);
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState<BuyQuote | null>(null);
  const [review, setReview] = useState<BuyQuote | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [hash, setHash] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [tab, setTab] = useState<'activity' | 'details'>('activity');
  const [refreshing, setRefreshing] = useState(false);
  const [tradingMode, setTradingMode] = useState<'desk' | 'p2p'>('desk');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [userAllowance, setUserAllowance] = useState<bigint>(0n);
  const [gasEstimatePol, setGasEstimatePol] = useState<string | null>(null);
  const [rateHistory, setRateHistory] = useState<RateHistoryItem[]>([]);

  // Owner administration state
  const [admin, setAdmin] = useState<ExchangeAdminState | null>(null);
  const [newRateInput, setNewRateInput] = useState('');
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminMessage, setAdminMessage] = useState('');

  const latestMarket = useRef<MarketSnapshot | null>(null);
  const marketRequest = useRef(0);
  const context = useRef(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const active = useRef(true);
  const configured = exchangeConfigured();
  const connectWallet = () => {
    if (activeKeyWalletEnabled) {
      document.getElementById('penora-active-key-wallet')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      void penoraWalletService.connect();
    }
  };

  // 1. Subscribe to Wallet Service
  useEffect(() => {
    active.current = true;
    const unsubscribe = penoraWalletService.subscribe(setWallet);
    setPending(!!pendingBuy());
    setHash(pendingBuy()?.hash ?? null);
    return () => {
      active.current = false;
      context.current++;
      unsubscribe();
    };
  }, []);

  // 2. Clear transient quote state on account/chain changes
  useEffect(() => {
    context.current++;
    setQuote(null);
    setReview(null);
    setMessage('');
    setGasEstimatePol(null);
  }, [wallet.address, wallet.chainId]);

  // 3. Modal lifecycle sync
  useEffect(() => {
    if (review && !dialog.current?.open) dialog.current?.showModal();
    else if (!review && dialog.current?.open) dialog.current.close();
  }, [review]);

  // 4. Primary Market Data Refresh
  const refresh = useCallback(async () => {
    const requestId = ++marketRequest.current;
    setRefreshing(true);
    try {
      const result = await readMarket();
      if (!active.current || requestId !== marketRequest.current) return;
      const previous = latestMarket.current;
      if (previous && (previous.rate !== result.rate || previous.paused !== result.paused)) {
        // Never leave a reviewed quote open after an external owner rate/pause change.
        setQuote(null);
        setReview(null);
        setMessage('Exchange rate or availability updated on-chain. Requesting fresh quote…');
      }
      latestMarket.current = result;
      setMarket(result);
      setLastSyncedAt(new Date().toLocaleTimeString());
    } catch (error) {
      if (active.current && requestId === marketRequest.current) {
        latestMarket.current = null;
        setMarket(null);
        setQuote(null);
        setReview(null);
        setLastSyncedAt(null);
        setMessage(error instanceof Error ? error.message : 'Market data unavailable.');
      }
    } finally {
      if (active.current && requestId === marketRequest.current) setRefreshing(false);
    }
  }, []);

  // 5. Admin & Allowance Refresh
  const refreshAdminAndAllowance = useCallback(async () => {
    if (!configured) return;
    try {
      const [res, allow, history] = await Promise.all([
        readExchangeAdmin(wallet.address || undefined),
        wallet.address ? getUserUsdtAllowance(wallet.address as Address) : 0n,
        fetchRateHistory(),
      ]);
      if (active.current) {
        setAdmin(res);
        setUserAllowance(allow);
        setRateHistory(history);
      }
    } catch {
      if (active.current) {
        setAdmin(null);
      }
    }
  }, [configured, wallet.address]);

  // 6. Reactive Event Subscriptions & Background Visibility Polling
  useEffect(() => {
    if (!configured) return;
    void refresh();
    void refreshAdminAndAllowance();

    // Subscribe to live on-chain RateUpdated & Purchased events
    const unwatchRate = watchExchangeRate((newRate) => {
      if (!active.current) return;
      void refresh();
      void refreshAdminAndAllowance();
      setMessage(`Live on-chain rate updated: ${formatUnits(newRate, 18)} PNR / USDT.`);
    });

    const unwatchPurchased = watchExchangePurchases((buyer, usdtIn, pnrOut) => {
      if (!active.current) return;
      void refresh();
      if (wallet.address && buyer.toLowerCase() === wallet.address.toLowerCase()) {
        void penoraWalletService.refreshBalance(wallet.address as `0x${string}`);
      }
    });

    // Periodic RPC polling fallback (15s) when visible; paused when backgrounded
    const syncVisibleMarket = () => {
      if (document.visibilityState === 'hidden') return;
      void refresh();
      void refreshAdminAndAllowance();
    };

    const timer = window.setInterval(syncVisibleMarket, 15_000);
    window.addEventListener('focus', syncVisibleMarket);
    document.addEventListener('visibilitychange', syncVisibleMarket);

    return () => {
      unwatchRate();
      unwatchPurchased();
      window.clearInterval(timer);
      window.removeEventListener('focus', syncVisibleMarket);
      document.removeEventListener('visibilitychange', syncVisibleMarket);
      marketRequest.current++;
    };
  }, [configured, refresh, refreshAdminAndAllowance, wallet.address]);

  const action = async (task: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await task();
    } catch (error) {
      if (active.current) setMessage(error instanceof Error ? error.message : 'The request could not be completed.');
    } finally {
      if (active.current) {
        setBusy(false);
        setPending(!!pendingBuy());
        const transaction = pendingBuy();
        if (transaction) setHash(transaction.hash);
      }
    }
  };

  // 7. Request Quote & Estimate Gas
  const requestQuote = () =>
    action(async () => {
      const version = context.current;
      setMessage('Reading live on-chain quote…');
      const result = await getBuyQuote(amount);
      if (version !== context.current) return;
      setQuote(result);
      setMarket(result.market);

      // Estimate gas if wallet is connected
      if (wallet.address) {
        const gasEst = await estimateBuyGas(result, wallet.address as Address);
        if (gasEst) setGasEstimatePol(gasEst.estimatedGasPol);
      }

      setMessage('Quote calculated. Review transaction details before signing.');
      setReview(result);
    });

  // 8. Execute Purchase Flow (Approval + Buy + Receipt Verification)
  const purchase = () =>
    action(async () => {
      if (!review || !wallet.address) return;
      const version = context.current;
      const result = await buyPnr(review, wallet.address as Address, (text) => {
        if (active.current && version === context.current) {
          setMessage(text);
          const transaction = pendingBuy();
          if (transaction) {
            setHash(transaction.hash);
            setPending(true);
          }
        }
      });
      if (!active.current || version !== context.current) return;
      setReview(null);
      if (result?.hash) setHash(result.hash);
      setMessage(
        result?.status === 'confirmed' && result.stage === 'buy'
          ? `Purchase confirmed! ${formatUnits(result.amount!, 18)} PNR delivered to ${short(wallet.address)}.`
          : result?.status === 'pending'
          ? 'Transaction pending on Amoy. Click "Check transaction status" to verify receipt.'
          : 'The transaction failed or was cancelled.'
      );
      setQuote(null);
      setAmount('');
      void refresh();
      void refreshAdminAndAllowance();
      if (wallet.address) void penoraWalletService.refreshBalance(wallet.address as `0x${string}`);
    });

  // 9. Reconcile Pending Transaction
  const check = () =>
    action(async () => {
      setMessage('Checking transaction receipt on Polygon Amoy…');
      const previous = pendingBuy();
      const result = await reconcileBuy();
      if (!active.current) return;
      setHash(result?.hash ?? null);
      setMessage(
        result?.status === 'pending'
          ? 'Transaction is still pending on Amoy. No purchase is confirmed yet.'
          : result?.status === 'confirmed' && result.stage === 'buy'
          ? `Confirmed! ${formatUnits(result.amount!, 18)} PNR delivered to ${short(previous!.account)}.`
          : result?.status === 'confirmed'
          ? 'USDT approval confirmed on Polygon Amoy. You can now submit your purchase.'
          : 'Transaction failed or was cancelled.'
      );
      void refresh();
      void refreshAdminAndAllowance();
      if (wallet.address) void penoraWalletService.refreshBalance(wallet.address as `0x${string}`);
    });

  const setFraction = (percent: number) => {
    if (wallet.balanceUsdt === null) return;
    try {
      const raw = parseUnits(wallet.balanceUsdt, 6);
      setAmount(formatUnits((raw * BigInt(percent)) / 100n, 6));
      setQuote(null);
    } catch {
      setMessage('Refresh your USDT balance first.');
    }
  };

  // 10. Founder Admin Rate Control
  const handleUpdateRate = async () => {
    if (!wallet.address || !newRateInput || adminBusy) return;
    try {
      const rateWei = parseUnits(newRateInput.trim(), 18);
      if (rateWei <= 0n) throw new Error('Rate must be greater than zero.');
      setAdminBusy(true);
      setAdminMessage('Requesting founder signature in MetaMask for setRate()…');
      const res = await setExchangeRate(rateWei, wallet.address as `0x${string}`);
      setAdminMessage(
        `Rate updated on-chain! Tx: ${short(res.hash)}. New rate: ${formatUnits(res.newRate, 18)} PNR/USDT.`
      );
      setNewRateInput('');
      await refresh();
      await refreshAdminAndAllowance();
    } catch (err: any) {
      setAdminMessage(err?.message || 'Rate update failed or was rejected.');
    } finally {
      setAdminBusy(false);
    }
  };

  const togglePause = async () => {
    if (!wallet.address || !admin || adminBusy) return;
    try {
      setAdminBusy(true);
      setAdminMessage(`Please confirm ${admin.paused ? 'unpausing' : 'pausing'} in your wallet…`);
      const nextPaused = !admin.paused;
      const res = await setExchangePaused(nextPaused, wallet.address as `0x${string}`);
      setAdminMessage(`Exchange ${res.paused ? 'paused' : 'unpaused'} on-chain! Tx: ${short(res.hash)}.`);
      await refresh();
      await refreshAdminAndAllowance();
    } catch (err: any) {
      setAdminMessage(err?.message || 'Action failed or was rejected.');
    } finally {
      setAdminBusy(false);
    }
  };

  const isOwnerOrFounder = Boolean(admin?.isOwner || isFounderWallet(wallet.address));

  return (
    <div className="ex-shell">
      <div className="ex-wrap">
        {/* Topline Navigation */}
        {activeKeyWalletEnabled && <ActiveKeyWalletEntry compact />}
        <nav className="ex-topline" aria-label="Exchange navigation">
          <a href="/wallet/">
            <ArrowLeft size={14} /> Back to wallet
          </a>
          <span className="ex-network">
            <span className="ex-dot" /> Polygon Amoy <span className="ex-testnet">TESTNET</span>
          </span>
        </nav>

        {/* Page Heading */}
        <header className="ex-heading">
          <div>
            <div className="ex-eyebrow">PENORA / BLOCKCHAIN CREATOR ECONOMY</div>
            <h1>
              Instant Exchange
              <br className="ex-mobile-break" /> &amp; Real-Time Rate<span>.</span>
            </h1>
            <p>Exchange MockUSDT for liquid PNR backed by verified smart contracts on Polygon Amoy.</p>
          </div>
          <div className="ex-heading-actions">
            <a href="/wallet/" className="ex-wallet-link">
              <Wallet size={16} /> My wallet <ArrowUpRight size={14} />
            </a>
            <span className="ex-outline-label">EXCHANGE / PHASE 23</span>
          </div>
        </header>

        {/* Mode Selector: Instant Desk vs P2P Marketplace */}
        <div className="flex items-center gap-2 my-4">
          <button
            type="button"
            onClick={() => setTradingMode('desk')}
            className={`py-2 px-4 rounded-xl text-xs font-semibold transition-all ${
              tradingMode === 'desk'
                ? 'bg-gradient-to-r from-[#007C8B] via-[#00B3C4] to-[#00E5F4] text-white shadow-sm'
                : 'bg-[#122129] text-white/70 hover:text-white border border-white/10'
            }`}
          >
            Instant Purchase Desk
          </button>
          <button
            type="button"
            onClick={() => setTradingMode('p2p')}
            className={`py-2 px-4 rounded-xl text-xs font-semibold transition-all ${
              tradingMode === 'p2p'
                ? 'bg-gradient-to-r from-[#007C8B] via-[#00B3C4] to-[#00E5F4] text-white shadow-sm'
                : 'bg-[#122129] text-white/70 hover:text-white border border-white/10'
            }`}
          >
            P2P Marketplace
          </button>
        </div>

        {tradingMode === 'p2p' ? (
          <P2PMarketplaceView onBackToDesk={() => setTradingMode('desk')} />
        ) : (
          <>
            <div className="ex-status-strip">
              <span>
                <ShieldCheck size={15} />{' '}
                {configured ? 'Onchain quotes · inventory-backed' : 'Market preview · trading not activated'}
              </span>
              <span>Amoy test tokens only. No mainnet deposits.</span>
            </div>

            {/* Quick Pair Summary Bar */}
            <section className="ex-market-bar" aria-label="PNR market summary">
              <div className="ex-pair">
                <div className="ex-token-mark">
                  P<span>↗</span>
                </div>
                <div>
                  <h2>
                    PNR <span>/ USDT</span> <ChevronDown size={14} />
                  </h2>
                  <p>
                    PENORA Token <span>•</span> Purchase desk
                  </p>
                </div>
              </div>

              <div className="ex-spot">
                <strong>{market ? `${compact(market.rate)} PNR` : '—'}</strong>
                <span>
                  {market && market.rate > 0n
                    ? `Per 1 test USDT · 1 PNR = ${(1 / Number(formatUnits(market.rate, 18))).toFixed(4)} MockUSDT`
                    : market
                    ? 'Per 1 test USDT · owner-set'
                    : 'Price awaiting activation'}
                </span>
                {market && lastSyncedAt && (
                  <span className="ex-rate-synced text-[10px] text-emerald-400">
                    On-chain rate · Synced {lastSyncedAt}
                  </span>
                )}
              </div>

              <div className="ex-market-stat">
                <span>Available liquidity</span>
                <strong>{market ? `${compact(market.inventory)} PNR` : '—'}</strong>
              </div>

              <div className="ex-market-stat">
                <span>Execution</span>
                <strong>
                  Onchain <span className="ex-dot" />
                </strong>
              </div>

              <button
                type="button"
                className="ex-icon-button"
                aria-label="Refresh exchange market"
                disabled={!configured || refreshing}
                onClick={() => void refresh()}
              >
                <RefreshCw size={16} className={refreshing ? 'ex-spin' : ''} />
              </button>
            </section>

            {/* Founder / Owner Administration Panel */}
            {isOwnerOrFounder && (
              <section
                className="ex-panel mt-4 p-5 border border-[#00B3C4]/30 rounded-xl bg-[#122129] space-y-4"
                aria-label="Exchange Owner Administration"
              >
                <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[#00B3C4]/15 text-[#00E5F4]">
                      <ShieldCheck size={18} />
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-white flex items-center gap-2">
                        Founder &amp; Owner Administration
                        <span className="text-[9px] uppercase font-mono px-2 py-0.5 rounded bg-[#00B3C4]/20 text-[#00E5F4] border border-[#00B3C4]/30">
                          Founder Authorized
                        </span>
                      </h3>
                      <p className="text-[11px] text-[var(--ex-muted)]">
                        Administer desk inventory, pause state, and on-chain rate on Polygon Amoy
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {admin && (
                      <button
                        type="button"
                        disabled={adminBusy}
                        onClick={() => void togglePause()}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                          admin.paused
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                            : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                        }`}
                      >
                        {admin.paused ? 'Unpause Trading' : 'Pause Trading'}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={adminBusy}
                      onClick={() => void refreshAdminAndAllowance()}
                      className="ex-icon-button"
                      title="Refresh Desk State"
                    >
                      <RefreshCw size={14} className={adminBusy ? 'ex-spin' : ''} />
                    </button>
                  </div>
                </div>

                {admin && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded-lg bg-[#0c171d] border border-white/5">
                      <span className="text-[10px] uppercase tracking-wider text-[var(--ex-muted)] block mb-1">
                        Current Desk Rate
                      </span>
                      <strong className="text-sm font-semibold text-white block">
                        {admin.rateFormatted} PNR / USDT
                      </strong>
                      <span className="text-[11px] text-[#00E5F4]">
                        Equivalent: {admin.equivalentPricePerPnr} USDT / PNR
                      </span>
                    </div>
                    <div className="p-3 rounded-lg bg-[#0c171d] border border-white/5">
                      <span className="text-[10px] uppercase tracking-wider text-[var(--ex-muted)] block mb-1">
                        PNR Inventory Held
                      </span>
                      <strong className="text-sm font-semibold text-emerald-300 block font-mono">
                        {compact(admin.pnrInventory)} PNR
                      </strong>
                      <span className="text-[11px] text-[var(--ex-muted)]">Available for purchases</span>
                    </div>
                    <div className="p-3 rounded-lg bg-[#0c171d] border border-white/5">
                      <span className="text-[10px] uppercase tracking-wider text-[var(--ex-muted)] block mb-1">
                        Collected USDT Proceeds
                      </span>
                      <strong className="text-sm font-semibold text-amber-200 block font-mono">
                        {admin.usdtBalanceFormatted} USDT
                      </strong>
                      <span className="text-[11px] text-[var(--ex-muted)]">In contract vault</span>
                    </div>
                  </div>
                )}

                {/* 7-Step Admin Rate Update Form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleUpdateRate();
                  }}
                  className="p-4 rounded-xl bg-[#0c171d] border border-white/5 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-white">Administer PNR Testnet Rate (setRate)</h4>
                    <span className="text-[10px] font-mono text-[#00E5F4]">Target: Amoy (80002)</span>
                  </div>
                  <p className="text-[11px] text-[var(--ex-muted)] leading-relaxed">
                    Set whole PNR units per 1 MockUSDT. Target: <strong className="text-white">5 PNR/USDT</strong> corresponds to <strong className="text-white">0.20 MockUSDT per PNR</strong>.
                    Requires explicit founder signature in MetaMask.
                  </p>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        placeholder="e.g. 5"
                        value={newRateInput}
                        onChange={(e) => setNewRateInput(e.target.value)}
                        disabled={adminBusy}
                        className="w-full bg-[#122129] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#00B3C4]"
                      />
                      {newRateInput && !isNaN(Number(newRateInput)) && Number(newRateInput) > 0 && (
                        <span className="absolute right-3 top-2 text-[11px] text-[#00E5F4] font-mono">
                          = {(1 / Number(newRateInput)).toFixed(6)} USDT / PNR
                        </span>
                      )}
                    </div>
                    <button
                      type="submit"
                      disabled={adminBusy || !newRateInput || isNaN(Number(newRateInput)) || Number(newRateInput) <= 0}
                      className="px-4 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-[#007C8B] via-[#00B3C4] to-[#00E5F4] text-white disabled:opacity-40 hover:opacity-90 transition-opacity whitespace-nowrap"
                    >
                      {adminBusy ? 'Signing in wallet…' : 'Sign & Update Rate (setRate)'}
                    </button>
                  </div>

                  {adminMessage && (
                    <div className="mt-2.5 p-2 rounded bg-white/5 text-[11px] text-amber-200 border border-white/10">
                      {adminMessage}
                    </div>
                  )}
                </form>
              </section>
            )}

            {/* Main Two-Column Terminal */}
            <div className="ex-terminal">
              {/* Left Column: Real-Time Price Engine & Activity */}
              <div className="ex-market-column">
                <ExchangeRateEngineCard
                  market={market}
                  lastSyncedAt={lastSyncedAt}
                  rateHistory={rateHistory}
                  refreshing={refreshing}
                  onRefresh={() => void refresh()}
                />

                <section className="ex-panel ex-activity mt-4">
                  <div className="ex-panel-head">
                    <div className="ex-tabs">
                      <button
                        type="button"
                        aria-pressed={tab === 'activity'}
                        onClick={() => setTab('activity')}
                      >
                        Your activity
                      </button>
                      <button
                        type="button"
                        aria-pressed={tab === 'details'}
                        onClick={() => setTab('details')}
                      >
                        Market details
                      </button>
                    </div>
                    <span className="ex-small-label">PNR / USDT</span>
                  </div>

                  {tab === 'activity' ? (
                    <div className="ex-empty">
                      <div className="ex-empty-icon">
                        <Activity size={22} />
                      </div>
                      <div>
                        <h3>{pending ? 'Transaction awaiting confirmation' : 'Your next chapter starts here'}</h3>
                        <p>
                          {pending
                            ? 'Check the receipt before submitting another purchase.'
                            : 'Confirmed purchases happen on-chain. There are no simulated fills.'}
                        </p>
                        {hash && (
                          <a href={`https://amoy.polygonscan.com/tx/${hash}`} target="_blank" rel="noreferrer">
                            View transaction on PolygonScan <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    </div>
                  ) : (
                    <dl className="ex-details">
                      <div>
                        <dt>Network</dt>
                        <dd>Polygon Amoy · 80002</dd>
                      </div>
                      <div>
                        <dt>Market model</dt>
                        <dd>Owner-priced inventory desk</dd>
                      </div>
                      <div>
                        <dt>Trading fee</dt>
                        <dd>0% desk fee · network gas applies</dd>
                      </div>
                      <div>
                        <dt>Exchange Address</dt>
                        <dd>
                          {configured ? (
                            <a
                              href={`https://amoy.polygonscan.com/address/${exchangeAddress}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {short(exchangeAddress)} ↗
                            </a>
                          ) : (
                            'Awaiting deployment'
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Sell / limit orders</dt>
                        <dd>Available via P2P Marketplace</dd>
                      </div>
                    </dl>
                  )}
                </section>
              </div>

              {/* Right Column: Instant Purchase Desk Trade Form */}
              <aside className="ex-trade-column">
                <section className="ex-panel ex-buy-panel">
                  <div className="ex-buy-title">
                    <span className="ex-buy-label">BUY PNR</span>
                    <span className="ex-small-label">
                      INSTANT QUOTE <span className="ex-dot" />
                    </span>
                  </div>

                  <h2>
                    A little USDT.
                    <br />
                    <span>More possibility.</span>
                  </h2>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void requestQuote();
                    }}
                  >
                    <div className="ex-input-card">
                      <div className="ex-input-label">
                        <label htmlFor="ex-pay">You pay</label>
                        <span>
                          Available:{' '}
                          <strong className="font-mono text-white">
                            {wallet.balanceUsdt !== null ? `${wallet.balanceUsdt} USDT` : '—'}
                          </strong>
                        </span>
                      </div>

                      <div className="ex-amount-row">
                        <input
                          id="ex-pay"
                          inputMode="decimal"
                          autoComplete="off"
                          placeholder="0.00"
                          value={amount}
                          maxLength={80}
                          disabled={busy}
                          onChange={(e) => {
                            setAmount(e.target.value);
                            setQuote(null);
                          }}
                        />
                        <span>
                          <i className="ex-usdt-mark">₮</i> USDT
                        </span>
                      </div>

                      <div className="ex-percentages">
                        {[25, 50, 75, 100].map((value) => (
                          <button
                            key={value}
                            type="button"
                            disabled={busy || wallet.balanceUsdt === null || !wallet.isCorrectNetwork}
                            onClick={() => setFraction(value)}
                          >
                            {value === 100 ? 'MAX' : `${value}%`}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="ex-direction">
                      <ArrowDown size={16} />
                    </div>

                    <div className="ex-input-card ex-receive">
                      <span className="ex-muted">You receive · estimated</span>
                      <div className="ex-amount-row">
                        <output>{quote ? compact(quote.output) : '—'}</output>
                        <span>
                          <i className="ex-pnr-mark">P</i> PNR
                        </span>
                      </div>
                      <span className="ex-receive-caption">Liquid PNR delivered to your connected wallet</span>
                    </div>

                    <dl className="ex-quote-details">
                      <div>
                        <dt>Slippage tolerance</dt>
                        <dd>0.5%</dd>
                      </div>
                      <div>
                        <dt>Minimum received</dt>
                        <dd>{quote ? `${formatUnits(quote.minimum, 18)} PNR` : '—'}</dd>
                      </div>
                      <div>
                        <dt>Allowance status</dt>
                        <dd className="font-mono text-[10px]">
                          {userAllowance > 0n && amount && parseUnits(amount, 6) <= userAllowance
                            ? 'Pre-approved (1 click)'
                            : 'Approval required (2 steps)'}
                        </dd>
                      </div>
                      <div>
                        <dt>Network fee</dt>
                        <dd>{gasEstimatePol ? `~${parseFloat(gasEstimatePol).toFixed(6)} POL` : 'POL gas'}</dd>
                      </div>
                    </dl>

                    {pending ? (
                      <button type="button" className="ex-primary" disabled={busy} onClick={() => void check()}>
                        Check transaction status <RefreshCw size={16} />
                      </button>
                    ) : !wallet.address ? (
                      <button
                        type="button"
                        className="ex-primary"
                        disabled={busy || wallet.status === 'connecting'}
                        onClick={connectWallet}
                      >
                        Connect wallet <Wallet size={16} />
                      </button>
                    ) : !wallet.isCorrectNetwork ? (
                      <button
                        type="button"
                        className="ex-primary"
                        onClick={() => void penoraWalletService.switchOrAddAmoyNetwork()}
                      >
                        Switch to Amoy <ArrowRight size={16} />
                      </button>
                    ) : (
                      <button
                        className="ex-primary"
                        type="submit"
                        disabled={busy || !configured || market?.paused || market?.inventory === 0n || !amount}
                      >
                        {busy
                          ? 'Working…'
                          : !configured
                          ? 'Trading opens after activation'
                          : market?.paused
                          ? 'Desk paused by owner'
                          : market?.inventory === 0n
                          ? 'Desk inventory empty (0 PNR)'
                          : 'Review purchase'}{' '}
                        <ArrowUpRight size={17} />
                      </button>
                    )}

                    <p className="ex-trade-note">
                      {configured
                        ? 'Approval and purchase are separate wallet transactions.'
                        : 'Exchange deployment and PNR liquidity are required before buying.'}
                    </p>
                  </form>

                  <div
                    role="status"
                    aria-live="polite"
                    className={message || wallet.error ? 'ex-feedback' : ''}
                  >
                    {message || wallet.error}
                  </div>
                </section>

                <section className="ex-liquidity">
                  <div>
                    <Layers3 size={18} />
                    <span>Built around real liquidity.</span>
                  </div>
                  <p>
                    {market
                      ? `${compact(market.inventory)} PNR currently held by the desk. Real-time balance refreshed after each transaction.`
                      : 'Quotes come directly from the verified desk contract. No artificial order book or invented trading volume.'}
                  </p>
                  <span className="ex-liquidity-bottom">
                    YOUR WALLET. YOUR SIGNATURE. <ArrowUpRight size={14} />
                  </span>
                </section>
              </aside>
            </div>
          </>
        )}

        <footer className="ex-bottom">
          <span>
            <span className="ex-dot" /> PENORA EXCHANGE
          </span>
          <p>Designed for the people who create the value.</p>
          <a href="/wallet/">
            Manage assets <ArrowRight size={13} />
          </a>
        </footer>

        {/* Purchase Review Confirmation Dialog */}
        <dialog
          ref={dialog}
          className="ex-review"
          onCancel={(e) => {
            if (busy) e.preventDefault();
            else setReview(null);
          }}
          onClose={() => {
            if (!busy) setReview(null);
          }}
          aria-labelledby="ex-review-title"
        >
          <div className="ex-eyebrow">CHECK BEFORE YOU SIGN</div>
          <h2 id="ex-review-title">Review your purchase</h2>
          {review && (
            <>
              <dl className="ex-details">
                <div>
                  <dt>You pay</dt>
                  <dd>{formatUnits(review.input, 6)} test USDT</dd>
                </div>
                <div>
                  <dt>Expected PNR</dt>
                  <dd>{formatUnits(review.output, 18)}</dd>
                </div>
                <div>
                  <dt>Minimum PNR</dt>
                  <dd>{formatUnits(review.minimum, 18)}</dd>
                </div>
                <div>
                  <dt>Recipient</dt>
                  <dd className="ex-address">{wallet.address}</dd>
                </div>
                <div>
                  <dt>Network</dt>
                  <dd>Polygon Amoy testnet (80002)</dd>
                </div>
                <div>
                  <dt>Estimated Gas</dt>
                  <dd>{gasEstimatePol ? `~${parseFloat(gasEstimatePol).toFixed(6)} POL` : 'POL gas'}</dd>
                </div>
              </dl>
              <p>
                Owner-set desk price. 0.5% maximum adverse slippage tolerance. Network gas applies. Quote expires after 60 seconds.
              </p>
              <div role="status" className="ex-review-status">
                {message}
              </div>
              <button
                type="button"
                className="ex-primary"
                disabled={busy}
                onClick={() => void purchase()}
              >
                {busy
                  ? 'Waiting for wallet…'
                  : userAllowance >= review.input
                  ? 'Buy PNR (Pre-approved)'
                  : 'Approve USDT & Buy PNR'}
                <Check size={16} />
              </button>
              <button
                type="button"
                className="ex-review-cancel"
                disabled={busy}
                onClick={() => setReview(null)}
              >
                Back to exchange
              </button>
            </>
          )}
        </dialog>
      </div>
    </div>
  );
}
