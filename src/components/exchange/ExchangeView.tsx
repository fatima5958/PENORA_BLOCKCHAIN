import React, { useEffect, useRef, useState } from 'react';
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
  SlidersHorizontal,
} from 'lucide-react';
import { formatUnits, parseUnits } from 'viem';
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
  type MarketSnapshot,
  type BuyQuote,
  type ExchangeAdminState,
} from '../../lib/exchange/exchangeService';
import '../../styles/exchange.css';
import { P2PMarketplaceView } from './P2PMarketplaceView';
import { EmbeddedWalletEntry, embeddedWalletEnabled } from '../wallet/EmbeddedWalletEntry';

const compact = (raw: bigint, decimals = 18) =>
  Number(formatUnits(raw, decimals)).toLocaleString('en-US', { maximumFractionDigits: 6 });
const short = (value: string) => `${value.slice(0, 6)}…${value.slice(-4)}`;
const frames = ['15m', '1H', '4H', '1D', '1W'] as const;

function PreviewChart() {
  const [frame, setFrame] = useState<string>('4H'),
    [mode, setMode] = useState<'candles' | 'line'>('candles');
  const index = frames.indexOf(frame as typeof frames[number]);
  const candles = Array.from({ length: 54 }, (_, i) => {
    const open = 150 + Math.sin(i * 0.56 + index) * 20 + Math.cos(i * 0.21) * 17 - i * 0.95;
    const close = open + Math.sin(i * 1.87 + index) * 14;
    return {
      open,
      close,
      high: Math.min(open, close) - 5 - (i % 4) * 2,
      low: Math.max(open, close) + 6 + (i % 3) * 3,
    };
  });
  return (
    <section className="ex-panel ex-chart" aria-label="Illustrative market chart">
      <div className="ex-panel-head">
        <div className="ex-timeframes">
          {frames.map((item) => (
            <button key={item} type="button" aria-pressed={frame === item} onClick={() => setFrame(item)}>
              {item}
            </button>
          ))}
        </div>
        <button
          className="ex-icon-button"
          type="button"
          onClick={() => setMode(mode === 'candles' ? 'line' : 'candles')}
          aria-label={`Show ${mode === 'candles' ? 'line' : 'candlestick'} chart`}
        >
          <SlidersHorizontal size={16} />
        </button>
      </div>
      <div className="ex-chart-label">
        <span className="ex-demo-dot" /> Illustrative chart · sample data <span>No live price feed</span>
      </div>
      <svg
        viewBox="0 0 800 320"
        role="img"
        aria-label={`${frame} ${mode} design preview. Sample data, not PNR market prices.`}
      >
        <defs>
          <linearGradient id="ex-chart-shade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#89f0c0" stopOpacity=".13" />
            <stop offset="100%" stopColor="#89f0c0" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[40, 90, 140, 190, 240].map((y) => (
          <line key={y} x1="24" x2="780" y1={y} y2={y} stroke="#ffffff09" />
        ))}
        {[24, 150, 276, 402, 528, 654, 780].map((x) => (
          <line key={x} x1={x} x2={x} y1="25" y2="275" stroke="#ffffff06" />
        ))}
        <path
          d={`M24 270 ${candles.map((c, i) => `L${28 + i * 14} ${c.close}`).join(' ')} L770 270Z`}
          fill="url(#ex-chart-shade)"
        />
        {mode === 'candles' ? (
          candles.map((c, i) => (
            <g
              key={i}
              fill={c.close < c.open ? '#8af3c6' : '#e77a8c'}
              stroke={c.close < c.open ? '#8af3c6' : '#e77a8c'}
            >
              <line x1={28 + i * 14} x2={28 + i * 14} y1={c.high} y2={c.low} />
              <rect
                x={24 + i * 14}
                y={Math.min(c.open, c.close)}
                width="8"
                height={Math.max(Math.abs(c.open - c.close), 2)}
                rx="1"
              />
              <rect
                x={24 + i * 14}
                y={275 - Math.abs(c.close - c.open) * 2}
                width="8"
                height={Math.abs(c.close - c.open) * 2}
                opacity=".18"
                stroke="none"
              />
            </g>
          ))
        ) : (
          <polyline
            points={candles.map((c, i) => `${28 + i * 14},${c.close}`).join(' ')}
            fill="none"
            stroke="#8af3c6"
            strokeWidth="2"
          />
        )}
        {['Window start', 'Sample volume', 'Window end'].map((t, i) => (
          <text key={t} x={24 + i * 370} y="305" fill="#6f8391" fontSize="10" textAnchor={i === 2 ? 'end' : 'start'}>
            {t}
          </text>
        ))}
      </svg>
      <div className="ex-chart-foot">
        <span>
          <span className="ex-dot" /> PNR / USDT
        </span>
        <span>Chart preview never determines your quote.</span>
      </div>
    </section>
  );
}

export function ExchangeView() {
  const [wallet, setWallet] = useState(INITIAL_WALLET_STATE),
    [market, setMarket] = useState<MarketSnapshot | null>(null);
  const [amount, setAmount] = useState(''),
    [quote, setQuote] = useState<BuyQuote | null>(null),
    [review, setReview] = useState<BuyQuote | null>(null);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [hash, setHash] = useState<string | null>(null),
    [pending, setPending] = useState(false);
  const [tab, setTab] = useState<'activity' | 'details'>('activity'),
    [refreshing, setRefreshing] = useState(false);
  const [tradingMode, setTradingMode] = useState<'desk' | 'p2p'>('desk');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const latestMarket = useRef<MarketSnapshot | null>(null);
  const marketRequest = useRef(0);

  // Owner administration state
  const [admin, setAdmin] = useState<ExchangeAdminState | null>(null);
  const [newRateInput, setNewRateInput] = useState('');
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminMessage, setAdminMessage] = useState('');

  const context = useRef(0),
    dialog = useRef<HTMLDialogElement>(null),
    active = useRef(true);
  const configured = exchangeConfigured();
  const connectFromExchange = () => {
    if (embeddedWalletEnabled) {
      document.getElementById('penora-built-in-wallet')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    void penoraWalletService.connect();
  };

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

  useEffect(() => {
    context.current++;
    setQuote(null);
    setReview(null);
    setMessage('');
  }, [wallet.address, wallet.chainId]);

  useEffect(() => {
    if (review && !dialog.current?.open) dialog.current?.showModal();
    else if (!review && dialog.current?.open) dialog.current.close();
  }, [review]);

  const refresh = async () => {
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
        setMessage('Exchange price or availability changed on-chain. Request a fresh quote.');
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
  };

  const refreshAdmin = async () => {
    if (!configured) return;
    try {
      const res = await readExchangeAdmin(wallet.address || undefined);
      if (active.current) setAdmin(res);
    } catch {
      if (active.current) setAdmin(null);
    }
  };

  useEffect(() => {
    if (!configured) return;
    void refresh();
    void refreshAdmin();

    // The owner sets the rate on-chain. Refresh public quotes/inventory without
    // requiring a page reload; paused background tabs make no RPC requests.
    const syncVisibleMarket = () => {
      if (document.visibilityState === 'hidden') return;
      void refresh();
      void refreshAdmin();
    };
    const timer = window.setInterval(syncVisibleMarket, 20_000);
    window.addEventListener('focus', syncVisibleMarket);
    document.addEventListener('visibilitychange', syncVisibleMarket);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', syncVisibleMarket);
      document.removeEventListener('visibilitychange', syncVisibleMarket);
      marketRequest.current++;
    };
  }, [configured, wallet.address]);

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

  const requestQuote = () =>
    action(async () => {
      const version = context.current;
      setMessage('Reading your onchain quote…');
      const result = await getBuyQuote(amount);
      if (version !== context.current) return;
      setQuote(result);
      setMarket(result.market);
      setMessage('Quote ready. Review the details before signing.');
      setReview(result);
    });

  const purchase = () =>
    action(async () => {
      if (!review || !wallet.address) return;
      const version = context.current;
      const result = await buyPnr(review, wallet.address, (text) => {
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
          ? `Purchase confirmed: ${formatUnits(result.amount!, 18)} PNR delivered to ${short(wallet.address)}.`
          : result?.status === 'pending'
          ? 'Transaction pending. Use Check status before submitting another purchase.'
          : 'The transaction failed or was cancelled.'
      );
      setQuote(null);
      void refresh();
      void refreshAdmin();
      void penoraWalletService.refreshBalance(wallet.address);
    });

  const check = () =>
    action(async () => {
      setMessage('Checking the transaction receipt…');
      const previous = pendingBuy();
      const result = await reconcileBuy();
      if (!active.current) return;
      setHash(result?.hash ?? null);
      setMessage(
        result?.status === 'pending'
          ? 'Still pending. No purchase is confirmed yet.'
          : result?.status === 'confirmed' && result.stage === 'buy'
          ? `Confirmed: ${formatUnits(result.amount!, 18)} PNR delivered to ${short(previous!.account)}.`
          : result?.status === 'confirmed'
          ? 'USDT approval confirmed. Request a fresh purchase quote.'
          : 'Transaction failed or cancelled.'
      );
      void refresh();
      void refreshAdmin();
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

  const handleUpdateRate = async () => {
    if (!wallet.address || !newRateInput || adminBusy) return;
    try {
      const rateWei = parseUnits(newRateInput.trim(), 18);
      if (rateWei <= 0n) throw new Error('Rate must be greater than zero.');
      setAdminBusy(true);
      setAdminMessage('Please approve the rate update in your connected wallet…');
      const res = await setExchangeRate(rateWei, wallet.address as `0x${string}`);
      setAdminMessage(
        `Rate updated on-chain! Tx: ${short(res.hash)}. New rate: ${formatUnits(res.newRate, 18)} PNR/USDT.`
      );
      setNewRateInput('');
      await refresh();
      await refreshAdmin();
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
      await refreshAdmin();
    } catch (err: any) {
      setAdminMessage(err?.message || 'Action failed or was rejected.');
    } finally {
      setAdminBusy(false);
    }
  };

  return (
    <div className="ex-shell">
      <div className="ex-wrap">
        {embeddedWalletEnabled && <EmbeddedWalletEntry compact />}
        <nav className="ex-topline" aria-label="Exchange navigation">
          <a href="/wallet/">
            <ArrowLeft size={14} /> Back to wallet
          </a>
          <span className="ex-network">
            <span className="ex-dot" /> Polygon Amoy <span className="ex-testnet">TESTNET</span>
          </span>
        </nav>
        <header className="ex-heading">
          <div>
            <div className="ex-eyebrow">PENORA / CREATOR ECONOMY</div>
            <h1>
              Your words.
              <br className="ex-mobile-break" /> Your next move<span>.</span>
            </h1>
            <p>A dedicated space to turn test USDT into liquid PNR.</p>
          </div>
          <div className="ex-heading-actions">
            <a href="/wallet/" className="ex-wallet-link">
              <Wallet size={16} /> My wallet <ArrowUpRight size={14} />
            </a>
            <span className="ex-outline-label">EXCHANGE / 01</span>
          </div>
        </header>
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
                <span>{market && market.rate > 0n ? `Per 1 test USDT · 1 PNR = ${(1 / Number(formatUnits(market.rate, 18))).toFixed(4)} MockUSDT` : market ? 'Per 1 test USDT · owner-set' : 'Price awaiting activation'}</span>
                {market && lastSyncedAt && <span className="ex-rate-synced">On-chain rate · Synced {lastSyncedAt}</span>}
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

            {/* Owner-Only Administration Panel */}
            {admin?.isOwner && (
              <section
                className="ex-panel mt-4 p-5 border border-[#00B3C4]/30 rounded-xl bg-[#122129]"
                aria-label="Exchange Owner Administration"
              >
                <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[#00B3C4]/15 text-[#00E5F4]">
                      <ShieldCheck size={18} />
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-white flex items-center gap-2">
                        Exchange Desk Administration
                        <span className="text-[9px] uppercase font-mono px-2 py-0.5 rounded bg-[#00B3C4]/20 text-[#00E5F4] border border-[#00B3C4]/30">
                          Owner Verified
                        </span>
                      </h3>
                      <p className="text-[11px] text-[var(--ex-muted)]">
                        Owner-only controls for desk inventory, pause state, and on-chain rate
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
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
                    <button
                      type="button"
                      disabled={adminBusy}
                      onClick={() => void refreshAdmin()}
                      className="ex-icon-button"
                      title="Refresh Desk State"
                    >
                      <RefreshCw size={14} className={adminBusy ? 'ex-spin' : ''} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-3">
                  <div className="p-3 rounded-lg bg-[#0c171d] border border-white/5">
                    <span className="text-[10px] uppercase tracking-wider text-[var(--ex-muted)] block mb-1">
                      Current Desk Rate
                    </span>
                    <strong className="text-sm font-semibold text-white block">{admin.rateFormatted} PNR / USDT</strong>
                    <span className="text-[11px] text-[#00E5F4]">
                      Equivalent: {admin.equivalentPricePerPnr} USDT / PNR
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-[#0c171d] border border-white/5">
                    <span className="text-[10px] uppercase tracking-wider text-[var(--ex-muted)] block mb-1">
                      PNR Inventory Held
                    </span>
                    <strong className="text-sm font-semibold text-emerald-300 block">
                      {compact(admin.pnrInventory)} PNR
                    </strong>
                    <span className="text-[11px] text-[var(--ex-muted)]">Available for instant purchases</span>
                  </div>
                  <div className="p-3 rounded-lg bg-[#0c171d] border border-white/5">
                    <span className="text-[10px] uppercase tracking-wider text-[var(--ex-muted)] block mb-1">
                      Collected USDT Proceeds
                    </span>
                    <strong className="text-sm font-semibold text-amber-200 block">
                      {admin.usdtBalanceFormatted} USDT
                    </strong>
                    <span className="text-[11px] text-[var(--ex-muted)]">Locked in desk contract</span>
                  </div>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleUpdateRate();
                  }}
                  className="p-3.5 rounded-lg bg-[#0c171d] border border-white/5"
                >
                  <h4 className="text-xs font-semibold text-white mb-1">Set PNR-per-MockUSDT Rate</h4>
                  <p className="text-[11px] text-[var(--ex-muted)] mb-3">
                    Specify the PNR units received per 1 USDT. Example: 5 PNR/USDT corresponds to 0.20 MockUSDT per PNR.
                    Calls <code className="text-[#00E5F4]">setRate()</code> with your explicit wallet signature.
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
                        <span className="absolute right-3 top-2 text-[11px] text-[#00E5F4]">
                          = {(1 / Number(newRateInput)).toFixed(6)} USDT / PNR
                        </span>
                      )}
                    </div>
                    <button
                      type="submit"
                      disabled={adminBusy || !newRateInput || isNaN(Number(newRateInput)) || Number(newRateInput) <= 0}
                      className="px-4 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-[#007C8B] via-[#00B3C4] to-[#00E5F4] text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
                    >
                      {adminBusy ? 'Signing in wallet…' : 'Update Rate (setRate)'}
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

            <div className="ex-terminal">
              <div className="ex-market-column">
                <PreviewChart />
                <section className="ex-panel ex-activity">
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
                            ? 'Check the receipt before starting another purchase.'
                            : 'Confirmed purchases happen onchain. There are no simulated fills.'}
                        </p>
                        {hash && (
                          <a href={`https://amoy.polygonscan.com/tx/${hash}`} target="_blank" rel="noreferrer">
                            View transaction <ExternalLink size={12} />
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
                        <dt>Exchange</dt>
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
                        <span>Available {wallet.balanceUsdt ?? '—'}</span>
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
                      <span className="ex-receive-caption">Liquid PNR, delivered to your connected wallet</span>
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
                        <dt>Network fee</dt>
                        <dd>Shown in wallet · POL</dd>
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
                        onClick={connectFromExchange}
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
                      ? `${compact(market.inventory)} PNR currently held by the desk. Inventory can change before execution.`
                      : 'Quotes will come from the deployed desk. No artificial order book or invented trading volume.'}
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
                  <dd>Polygon Amoy testnet</dd>
                </div>
              </dl>
              <p>
                Owner-set desk price. 0.5% maximum adverse price movement. Network gas is additional. Quote expires
                after 60 seconds.
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
                {busy ? 'Waiting for wallet…' : 'Approve & buy PNR'}
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
