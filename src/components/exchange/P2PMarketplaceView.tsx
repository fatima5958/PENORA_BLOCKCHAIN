import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet,
  ArrowRight,
  RefreshCw,
  PlusCircle,
  XCircle,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Clock,
  Tag,
  Sliders,
  DollarSign,
  TrendingUp,
  Layers3,
  Search,
  Filter,
  ArrowDownUp,
  PieChart,
  Edit3,
  Copy,
  Check,
  LayoutGrid,
  List,
  Sparkles,
} from 'lucide-react';
import { parseUnits, formatUnits, encodeFunctionData, isAddress } from 'viem';
import { penoraWalletService, INITIAL_WALLET_STATE, getEthereumProvider } from '../../lib/wallet/walletService';
import {
  fetchP2POffers,
  fetchP2PTradeHistory,
  calculateUsdtCost,
  calculateMarketMetrics,
  calculateUserPortfolio,
  fetchUserAllowances,
  preflightFillValidation,
  P2P_ESCROW_ABI,
  ERC20_ABI,
  type P2POffer,
  type P2PTradeEvent,
  type TradeCostBreakdown,
  type UserAllowances,
} from '../../lib/exchange/p2pEscrowService';

interface P2PMarketplaceProps {
  onBackToDesk?: () => void;
}

type TabType = 'buy' | 'sell' | 'open_orders' | 'my_orders' | 'history' | 'portfolio';
type SortOption = 'rate_asc' | 'rate_desc' | 'amount_desc' | 'newest';
type FilterOption = 'all' | 'no_min' | 'expiring';

export function P2PMarketplaceView({ onBackToDesk }: P2PMarketplaceProps) {
  const [wallet, setWallet] = useState(INITIAL_WALLET_STATE);
  const [tab, setTab] = useState<TabType>('buy');
  const [offers, setOffers] = useState<P2POffer[]>([]);
  const [history, setHistory] = useState<P2PTradeEvent[]>([]);
  const [allowances, setAllowances] = useState<UserAllowances>({
    pnrAllowance: 0n,
    pnrAllowanceFormatted: '0',
    usdtAllowance: 0n,
    usdtAllowanceFormatted: '0',
  });
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'info' | 'success' | 'error'>('info');
  const [txHash, setTxHash] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('rate_asc');
  const [filterMode, setFilterMode] = useState<FilterOption>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Sell Form State
  const [sellPnrAmount, setSellPnrAmount] = useState('');
  const [sellUsdtPrice, setSellUsdtPrice] = useState('');
  const [sellMinFill, setSellMinFill] = useState('');
  const [sellDurationDays, setSellDurationDays] = useState<'0' | '1' | '3' | '7'>('0');

  // Partial Fill Modal State
  const [selectedOffer, setSelectedOffer] = useState<P2POffer | null>(null);
  const [fillPnrAmount, setFillPnrAmount] = useState('');
  const [costPreview, setCostPreview] = useState<TradeCostBreakdown | null>(null);
  const [preflightError, setPreflightError] = useState<string | null>(null);

  // Address copy feedback
  const [copiedAddress, setCopiedAddress] = useState(false);

  const escrowAddress = (import.meta.env.PUBLIC_P2P_ESCROW_ADDRESS || '') as `0x${string}`;
  const pnrAddress = (import.meta.env.PUBLIC_PNR_TOKEN_ADDRESS || '0xBdD9D45524617d20111879ff914E1E2B708D59A6') as `0x${string}`;
  const usdtAddress = (import.meta.env.PUBLIC_USDT_CONTRACT_ADDRESS || '0x88E538DB3FD3980Ba510aDd2671587Daf40F1050') as `0x${string}`;
  const rpcUrl = import.meta.env.PUBLIC_AMOY_RPC_URL || 'https://polygon-amoy.drpc.org';

  // Wallet subscription
  useEffect(() => {
    const unsub = penoraWalletService.subscribe(setWallet);
    return () => unsub();
  }, []);

  // Load contract data
  const loadData = async () => {
    if (!escrowAddress) return;
    setLoading(true);
    try {
      const [fetchedOffers, fetchedHistory] = await Promise.all([
        fetchP2POffers(escrowAddress, rpcUrl),
        fetchP2PTradeHistory(escrowAddress, rpcUrl),
      ]);
      setOffers(fetchedOffers);
      setHistory(fetchedHistory);

      if (wallet.address) {
        const userAllows = await fetchUserAllowances(
          wallet.address as `0x${string}`,
          escrowAddress,
          pnrAddress,
          usdtAddress,
          rpcUrl
        );
        setAllowances(userAllows);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [escrowAddress, wallet.address]);

  // Derived market metrics & user portfolio
  const marketMetrics = useMemo(() => calculateMarketMetrics(offers, history), [offers, history]);
  const portfolio = useMemo(
    () => calculateUserPortfolio(wallet.address as `0x${string}` | null, wallet.balancePnr, wallet.balanceUsdt, offers),
    [wallet.address, wallet.balancePnr, wallet.balanceUsdt, offers]
  );

  // Filtered & Sorted Offers for Buy / Open Orders
  const processedOffers = useMemo(() => {
    return offers
      .filter(o => {
        if (!o.active) return false;
        if (filterMode === 'no_min' && o.minPnrFillWei > 0n) return false;
        if (filterMode === 'expiring' && o.expiresAt === 0) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchId = `offer #${o.id}`.includes(q) || `${o.id}` === q;
          const matchSeller = o.seller.toLowerCase().includes(q);
          if (!matchId && !matchSeller) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'rate_asc') return parseFloat(a.pricePerPnr) - parseFloat(b.pricePerPnr);
        if (sortBy === 'rate_desc') return parseFloat(b.pricePerPnr) - parseFloat(a.pricePerPnr);
        if (sortBy === 'amount_desc') return parseFloat(b.pnrRemaining) - parseFloat(a.pnrRemaining);
        if (sortBy === 'newest') return b.id - a.id;
        return 0;
      });
  }, [offers, filterMode, searchQuery, sortBy]);

  const myOffers = useMemo(
    () => offers.filter(o => wallet.address && o.seller.toLowerCase() === wallet.address.toLowerCase()),
    [offers, wallet.address]
  );

  // Recalculate cost when fill amount changes in modal
  useEffect(() => {
    if (!selectedOffer || !fillPnrAmount) {
      setCostPreview(null);
      setPreflightError(null);
      return;
    }

    try {
      const pnrNum = parseFloat(fillPnrAmount);
      if (isNaN(pnrNum) || pnrNum <= 0) {
        setCostPreview(null);
        setPreflightError('Enter a valid PNR amount');
        return;
      }

      const pnrWei = parseUnits(fillPnrAmount, 18);
      if (pnrWei > selectedOffer.pnrRemainingWei) {
        setPreflightError(`Exceeds available balance (${selectedOffer.pnrRemaining} PNR).`);
        setCostPreview(null);
        return;
      }

      if (
        selectedOffer.minPnrFillWei > 0n &&
        pnrWei < selectedOffer.pnrRemainingWei &&
        pnrWei < selectedOffer.minPnrFillWei
      ) {
        setPreflightError(`Minimum fill is ${selectedOffer.minPnrFill} PNR.`);
      } else {
        setPreflightError(null);
      }

      const cost = calculateUsdtCost(pnrWei, selectedOffer.pnrAmountWei, selectedOffer.usdtPriceWei, 50n);
      setCostPreview(cost);
    } catch {
      setCostPreview(null);
    }
  }, [fillPnrAmount, selectedOffer]);

  // Copy wallet address helper
  const handleCopyAddress = () => {
    if (!wallet.address) return;
    navigator.clipboard.writeText(wallet.address);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  // Handle creating an offer (Seller)
  const handleCreateOffer = async () => {
    if (!wallet.address || !escrowAddress || busy) return;
    const pnrNum = parseFloat(sellPnrAmount);
    const usdtNum = parseFloat(sellUsdtPrice);
    if (isNaN(pnrNum) || pnrNum <= 0 || isNaN(usdtNum) || usdtNum <= 0) {
      setMessage('Enter a valid PNR amount and USDT price.');
      setMessageType('error');
      return;
    }

    const minFillNum = parseFloat(sellMinFill || '0');
    if (minFillNum > pnrNum) {
      setMessage('Minimum fill size cannot exceed total offer amount.');
      setMessageType('error');
      return;
    }

    setBusy(true);
    setMessage('Submitting offer to escrow...');
    setMessageType('info');
    setTxHash(null);

    try {
      const eth = getEthereumProvider();
      if (!eth) throw new Error('No Web3 wallet detected.');

      const pnrWei = parseUnits(sellPnrAmount, 18);
      const usdtWei = parseUnits(sellUsdtPrice, 6);
      const minFillWei = minFillNum > 0 ? parseUnits(sellMinFill, 18) : 0n;
      const durationSeconds = BigInt(parseInt(sellDurationDays, 10) * 86400);

      // Check current allowance first to avoid redundant approval tx
      if (allowances.pnrAllowance < pnrWei) {
        setMessage('Step 1/2: Approving TESTNET PNR tokens for escrow...');
        const approveData = encodeFunctionData({
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [escrowAddress, pnrWei],
        });

        const approveTx = await eth.request({
          method: 'eth_sendTransaction',
          params: [{ from: wallet.address, to: pnrAddress, data: approveData }],
        });
        setMessage(`Approval submitted (tx: ${approveTx.slice(0, 10)}...). Confirming creation...`);
      }

      // Call createOffer on escrow
      setMessage('Step 2/2: Locking PNR in P2P escrow...');
      const createData = encodeFunctionData({
        abi: P2P_ESCROW_ABI,
        functionName: 'createOffer',
        args: [pnrWei, usdtWei, minFillWei, durationSeconds],
      });

      const createTx = await eth.request({
        method: 'eth_sendTransaction',
        params: [{ from: wallet.address, to: escrowAddress, data: createData }],
      });

      setTxHash(createTx);
      setMessage(`Offer created successfully! Tx: ${createTx.slice(0, 10)}...`);
      setMessageType('success');
      setSellPnrAmount('');
      setSellUsdtPrice('');
      setSellMinFill('');
      await loadData();
      if (wallet.address) void penoraWalletService.refreshBalance(wallet.address);
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Failed to create offer.');
      setMessageType('error');
    } finally {
      setBusy(false);
    }
  };

  // Open modal for partial or full fill
  const openFillModal = (offer: P2POffer) => {
    setSelectedOffer(offer);
    setFillPnrAmount(offer.pnrRemaining);
    setMessage('');
    setTxHash(null);
  };

  // Execute Fill
  const handleExecuteFill = async () => {
    if (!wallet.address || !escrowAddress || !selectedOffer || busy || !costPreview) return;
    setBusy(true);
    setMessage('Validating trade with on-chain preflight check...');
    setMessageType('info');
    setTxHash(null);

    try {
      const pnrWei = parseUnits(fillPnrAmount, 18);
      const preflight = await preflightFillValidation({
        escrowAddress,
        usdtAddress,
        buyerAddress: wallet.address as `0x${string}`,
        offer: selectedOffer,
        pnrToFillWei: pnrWei,
        rpcUrl,
      });

      if (!preflight.valid) {
        throw new Error(preflight.error || 'Preflight validation failed.');
      }

      const eth = getEthereumProvider();
      if (!eth) throw new Error('No wallet connected.');

      // Check MockUSDT allowance
      if (allowances.usdtAllowance < costPreview.grossUsdtWei) {
        setMessage(`Step 1/2: Approving ${costPreview.grossUsdt} TESTNET USDT for escrow...`);
        const approveData = encodeFunctionData({
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [escrowAddress, costPreview.grossUsdtWei],
        });

        const approveTx = await eth.request({
          method: 'eth_sendTransaction',
          params: [{ from: wallet.address, to: usdtAddress, data: approveData }],
        });
        setMessage(`USDT Approved (tx: ${approveTx.slice(0, 10)}...). Executing atomic fill...`);
      }

      // Call fillOffer(offerId, pnrToFill)
      setMessage('Step 2/2: Fulfilling order atomically on Polygon Amoy...');
      const fillData = encodeFunctionData({
        abi: P2P_ESCROW_ABI,
        functionName: 'fillOffer',
        args: [BigInt(selectedOffer.id), pnrWei],
      });

      const fillTx = await eth.request({
        method: 'eth_sendTransaction',
        params: [{ from: wallet.address, to: escrowAddress, data: fillData }],
      });

      setTxHash(fillTx);
      setMessage(`Trade executed! You received ${fillPnrAmount} TESTNET PNR.`);
      setMessageType('success');
      setSelectedOffer(null);
      await loadData();
      if (wallet.address) void penoraWalletService.refreshBalance(wallet.address);
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Trade failed or rejected.');
      setMessageType('error');
    } finally {
      setBusy(false);
    }
  };

  // Handle cancelling an offer (Seller)
  const handleCancelOffer = async (offerId: number) => {
    if (!wallet.address || !escrowAddress || busy) return;
    setBusy(true);
    setMessage('Cancelling offer and recovering remaining PNR from escrow...');
    setMessageType('info');
    setTxHash(null);

    try {
      const eth = getEthereumProvider();
      if (!eth) throw new Error('No wallet connected.');

      const cancelData = encodeFunctionData({
        abi: P2P_ESCROW_ABI,
        functionName: 'cancelOffer',
        args: [BigInt(offerId)],
      });

      const cancelTx = await eth.request({
        method: 'eth_sendTransaction',
        params: [{ from: wallet.address, to: escrowAddress, data: cancelData }],
      });

      setTxHash(cancelTx);
      setMessage(`Offer #${offerId} cancelled. Remaining PNR refunded to your wallet.`);
      setMessageType('success');
      await loadData();
      if (wallet.address) void penoraWalletService.refreshBalance(wallet.address);
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Failed to cancel offer.');
      setMessageType('error');
    } finally {
      setBusy(false);
    }
  };

  // Handle editing an offer safely (cancel + prefill sell form)
  const handleEditOffer = (offer: P2POffer) => {
    setSellPnrAmount(offer.pnrRemaining);
    setSellUsdtPrice(offer.usdtPriceTotal);
    setSellMinFill(offer.minPnrFillWei > 0n ? offer.minPnrFill : '');
    setTab('sell');
    setMessage(`Offer #${offer.id} parameters loaded into Sell form. Note: Cancel your original offer to recover its PNR.`);
    setMessageType('info');
  };

  return (
    <div className="space-y-6">
      {/* ─── TOP BANNER & NETWORK BADGE ───────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-5 rounded-3xl bg-gradient-to-r from-[#0A2540] via-[#0D2F4F] to-[#0A2540] text-white border border-white/10 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-mono tracking-widest text-[#00E5F4] font-semibold">
              PENORA P2P ESCROW MARKETPLACE
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#007C8B]/40 text-[#00E5F4] border border-[#00E5F4]/30">
              POLYGON AMOY (80002)
            </span>
          </div>
          <h2 className="text-xl font-serif font-bold text-white">Peer-to-Peer Creator Exchange</h2>
          <p className="text-xs text-white/70">
            Trade liquid <strong className="text-white">TESTNET PNR</strong> directly using <strong className="text-white">TESTNET MockUSDT</strong>. Atomic, non-custodial smart contracts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onBackToDesk && (
            <button
              type="button"
              onClick={onBackToDesk}
              className="py-2 px-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-all border border-white/10"
            >
              Switch to Instant Desk
            </button>
          )}

          {wallet.address ? (
            <button
              type="button"
              onClick={handleCopyAddress}
              className="py-1.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-mono flex items-center gap-1.5 transition-all border border-white/10"
              title="Click to copy wallet address"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}</span>
              {copiedAddress ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3 opacity-60" />}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void penoraWalletService.connect()}
              className="py-2 px-4 rounded-xl bg-gradient-to-r from-[#007C8B] via-[#00B3C4] to-[#00E5F4] hover:opacity-95 text-white font-semibold text-xs shadow-md transition-all flex items-center gap-1.5"
            >
              <Wallet className="h-3.5 w-3.5" />
              <span>Connect Wallet</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── LIVE MARKET METRICS STRIP ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-[var(--wallet-surface)] border border-[#007C8B]/15 space-y-1">
          <span className="text-[10px] uppercase font-bold text-[var(--wallet-muted)] flex items-center gap-1">
            <DollarSign className="h-3 w-3 text-[#007C8B]" />
            Best Ask Rate
          </span>
          <div className="font-mono text-base font-bold text-[var(--wallet-text)]">
            {marketMetrics.bestAskPrice !== '—' ? `$${marketMetrics.bestAskPrice}` : '—'}
            <span className="text-xs font-normal text-[var(--wallet-muted)] ml-1">/ PNR</span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-[var(--wallet-surface)] border border-[#007C8B]/15 space-y-1">
          <span className="text-[10px] uppercase font-bold text-[var(--wallet-muted)] flex items-center gap-1">
            <ShieldCheck className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
            Active Escrowed PNR
          </span>
          <div className="font-mono text-base font-bold text-emerald-600 dark:text-emerald-400">
            {marketMetrics.totalActivePnr}
            <span className="text-xs font-normal text-[var(--wallet-muted)] ml-1">PNR</span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-[var(--wallet-surface)] border border-[#007C8B]/15 space-y-1">
          <span className="text-[10px] uppercase font-bold text-[var(--wallet-muted)] flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-cyan-600 dark:text-cyan-400" />
            Total Trade Volume
          </span>
          <div className="font-mono text-base font-bold text-cyan-600 dark:text-cyan-400">
            ${marketMetrics.totalLifetimeVolumeUsdt}
            <span className="text-xs font-normal text-[var(--wallet-muted)] ml-1">USDT</span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-[var(--wallet-surface)] border border-[#007C8B]/15 space-y-1">
          <span className="text-[10px] uppercase font-bold text-[var(--wallet-muted)] flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-[#007C8B]" />
            Confirmed Trades
          </span>
          <div className="font-mono text-base font-bold text-[var(--wallet-text)]">
            {marketMetrics.totalTradesCount}
            <span className="text-xs font-normal text-[var(--wallet-muted)] ml-1">settled</span>
          </div>
        </div>
      </div>

      {/* Network Warning if not Polygon Amoy */}
      {wallet.address && !wallet.isCorrectNetwork && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>You are connected to an unsupported network. Please switch to Polygon Amoy Testnet (Chain ID 80002).</span>
          </div>
          <button
            type="button"
            onClick={() => void penoraWalletService.switchOrAddAmoyNetwork()}
            className="py-1.5 px-3 rounded-lg bg-amber-500 text-white font-semibold text-xs shadow-sm shrink-0"
          >
            Switch to Amoy
          </button>
        </div>
      )}

      {/* ─── NAVIGATION TABS ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 bg-[var(--wallet-surface)] p-1.5 rounded-2xl border border-[#007C8B]/15 overflow-x-auto">
        <button
          type="button"
          onClick={() => setTab('buy')}
          className={`py-2 px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            tab === 'buy'
              ? 'bg-gradient-to-r from-[#007C8B] via-[#00B3C4] to-[#00E5F4] text-white shadow-sm'
              : 'text-[var(--wallet-muted)] hover:text-[var(--wallet-text)]'
          }`}
        >
          Buy PNR ({offers.filter(o => o.active).length})
        </button>
        <button
          type="button"
          onClick={() => setTab('sell')}
          className={`py-2 px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            tab === 'sell'
              ? 'bg-gradient-to-r from-[#007C8B] via-[#00B3C4] to-[#00E5F4] text-white shadow-sm'
              : 'text-[var(--wallet-muted)] hover:text-[var(--wallet-text)]'
          }`}
        >
          Sell PNR
        </button>
        <button
          type="button"
          onClick={() => setTab('open_orders')}
          className={`py-2 px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            tab === 'open_orders'
              ? 'bg-gradient-to-r from-[#007C8B] via-[#00B3C4] to-[#00E5F4] text-white shadow-sm'
              : 'text-[var(--wallet-muted)] hover:text-[var(--wallet-text)]'
          }`}
        >
          Order Book
        </button>
        <button
          type="button"
          onClick={() => setTab('my_orders')}
          className={`py-2 px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            tab === 'my_orders'
              ? 'bg-gradient-to-r from-[#007C8B] via-[#00B3C4] to-[#00E5F4] text-white shadow-sm'
              : 'text-[var(--wallet-muted)] hover:text-[var(--wallet-text)]'
          }`}
        >
          My Orders ({myOffers.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('history')}
          className={`py-2 px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            tab === 'history'
              ? 'bg-gradient-to-r from-[#007C8B] via-[#00B3C4] to-[#00E5F4] text-white shadow-sm'
              : 'text-[var(--wallet-muted)] hover:text-[var(--wallet-text)]'
          }`}
        >
          Trade History ({history.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('portfolio')}
          className={`py-2 px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            tab === 'portfolio'
              ? 'bg-gradient-to-r from-[#007C8B] via-[#00B3C4] to-[#00E5F4] text-white shadow-sm'
              : 'text-[var(--wallet-muted)] hover:text-[var(--wallet-text)]'
          }`}
        >
          My Portfolio
        </button>
      </div>

      {/* Global Feedback Banner */}
      {message && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-medium flex items-center justify-between gap-2 border ${
            messageType === 'error'
              ? 'bg-red-500/10 text-red-600 border-red-500/20'
              : messageType === 'success'
              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
              : 'bg-[#007C8B]/10 text-[#007C8B] border-[#007C8B]/20'
          }`}
        >
          <div className="flex items-center gap-2">
            {messageType === 'error' ? (
              <AlertCircle className="h-4 w-4 shrink-0" />
            ) : messageType === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <RefreshCw className={`h-4 w-4 shrink-0 ${busy ? 'animate-spin' : ''}`} />
            )}
            <span>{message}</span>
          </div>
          {txHash && (
            <a
              href={`https://amoy.polygonscan.com/tx/${txHash}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-semibold hover:underline shrink-0 font-mono"
            >
              <span>View Tx</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}

      {/* ─── TAB 1: BUY PNR (Active Marketplace) ─────────────────────────────── */}
      {tab === 'buy' && (
        <div className="space-y-4">
          {/* Controls: Search, Filters, View Mode */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-[var(--wallet-surface)] border border-[#007C8B]/15 text-xs">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
              <div className="relative flex-1 min-w-[160px]">
                <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--wallet-muted)]" />
                <input
                  type="text"
                  placeholder="Search by offer ID or seller address..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[var(--wallet-inset)] border border-[#007C8B]/20 text-xs font-mono text-[var(--wallet-text)] focus:outline-none focus:border-[#007C8B]"
                />
              </div>

              <div className="flex items-center gap-1">
                <span className="text-[var(--wallet-muted)]">Sort:</span>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as SortOption)}
                  className="py-1 px-2 rounded-lg bg-[var(--wallet-inset)] border border-[#007C8B]/20 text-xs text-[var(--wallet-text)] focus:outline-none"
                >
                  <option value="rate_asc">Lowest Price ($/PNR)</option>
                  <option value="rate_desc">Highest Price ($/PNR)</option>
                  <option value="amount_desc">Largest Amount Available</option>
                  <option value="newest">Newest Listed</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-[var(--wallet-inset)] p-0.5 rounded-lg border border-[#007C8B]/15">
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`p-1 rounded ${viewMode === 'cards' ? 'bg-[#007C8B] text-white' : 'text-[var(--wallet-muted)]'}`}
                  title="Card view"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`p-1 rounded ${viewMode === 'table' ? 'bg-[#007C8B] text-white' : 'text-[var(--wallet-muted)]'}`}
                  title="Table view"
                >
                  <List className="h-3.5 w-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={loadData}
                disabled={loading}
                className="inline-flex items-center gap-1 py-1 px-2.5 rounded-lg bg-[var(--wallet-inset)] hover:text-[var(--wallet-text)] text-[#007C8B] font-medium"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Offers Display */}
          {loading && offers.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="p-5 rounded-3xl bg-[var(--wallet-surface)] border border-[#007C8B]/15 animate-pulse space-y-3">
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
                  <div className="h-16 bg-slate-200 dark:bg-slate-700 rounded-2xl" />
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : processedOffers.length === 0 ? (
            <div className="p-10 text-center rounded-3xl bg-[var(--wallet-surface)] border border-[#007C8B]/15 text-xs text-[var(--wallet-muted)] space-y-3">
              <ShieldCheck className="h-10 w-10 mx-auto text-[#007C8B] opacity-80" />
              <div className="space-y-1">
                <p className="font-semibold text-base text-[var(--wallet-text)]">No Active P2P Sell Offers</p>
                <p className="max-w-md mx-auto">
                  {searchQuery
                    ? 'No offers match your search criteria. Try adjusting your query or filters.'
                    : 'Be the first creator to list TESTNET PNR tokens for sale on Polygon Amoy.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTab('sell')}
                className="py-2 px-4 rounded-xl bg-gradient-to-r from-[#007C8B] via-[#00B3C4] to-[#00E5F4] hover:opacity-95 text-white font-semibold text-xs shadow-sm transition-all"
              >
                Create First Sell Offer
              </button>
            </div>
          ) : viewMode === 'cards' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {processedOffers.map(offer => (
                <div
                  key={offer.id}
                  className="p-5 rounded-3xl bg-[var(--wallet-surface)] border border-[#007C8B]/20 hover:border-[#007C8B]/40 transition-all shadow-sm space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono font-bold text-[#007C8B] bg-[#007C8B]/10 px-2 py-0.5 rounded-full">
                        Offer #{offer.id}
                      </span>
                      {offer.minPnrFillWei > 0n && (
                        <span className="text-[10px] font-mono bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded">
                          Min: {offer.minPnrFill} PNR
                        </span>
                      )}
                      {offer.expiresAt > 0 && (
                        <span className="text-[10px] font-mono bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          <span>Timed</span>
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-[var(--wallet-muted)] font-mono">
                      Seller: {offer.seller.slice(0, 6)}...{offer.seller.slice(-4)}
                    </span>
                  </div>

                  {/* Quantity & Rate */}
                  <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-[var(--wallet-inset)] border border-[#007C8B]/10">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[var(--wallet-muted)] block">Available PNR</span>
                      <span className="font-mono text-base font-bold text-[var(--wallet-text)]">
                        {offer.pnrRemaining}
                        <span className="text-[11px] font-normal text-[var(--wallet-muted)] block">of {offer.pnrAmount} total</span>
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[var(--wallet-muted)] block">Rate</span>
                      <span className="font-mono text-base font-bold text-cyan-600 dark:text-cyan-400">
                        ${offer.pricePerPnr}
                        <span className="text-[11px] font-normal text-[var(--wallet-muted)] block">USDT / PNR</span>
                      </span>
                    </div>
                  </div>

                  {/* Fill Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-[var(--wallet-muted)] font-mono">
                      <span>Fill Progress</span>
                      <span>{offer.fillPercentage}% complete</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#007C8B] to-[#00E5F4] transition-all"
                        style={{ width: `${offer.fillPercentage}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-[var(--wallet-muted)]">
                      Total Order: <strong className="font-mono text-[var(--wallet-text)]">{offer.usdtPriceTotal} USDT</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => openFillModal(offer)}
                      disabled={busy || !wallet.address || offer.seller.toLowerCase() === wallet.address?.toLowerCase()}
                      className="py-1.5 px-4 rounded-xl bg-gradient-to-r from-[#007C8B] to-[#00E5F4] hover:opacity-95 text-white font-semibold text-xs shadow-sm transition-all disabled:opacity-50"
                    >
                      {offer.seller.toLowerCase() === wallet.address?.toLowerCase() ? 'Your Offer' : 'Buy with USDT'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-3xl bg-[var(--wallet-surface)] border border-[#007C8B]/15">
              <table className="w-full text-xs text-left">
                <thead className="bg-[var(--wallet-inset)] text-[var(--wallet-muted)] uppercase text-[10px] font-semibold border-b border-[#007C8B]/15">
                  <tr>
                    <th className="py-3 px-4">Offer</th>
                    <th className="py-3 px-4">Seller</th>
                    <th className="py-3 px-4">Available PNR</th>
                    <th className="py-3 px-4">Price / PNR</th>
                    <th className="py-3 px-4">Total USDT</th>
                    <th className="py-3 px-4">Min Fill</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#007C8B]/10 font-mono">
                  {processedOffers.map(offer => (
                    <tr key={offer.id} className="hover:bg-[var(--wallet-inset)]/50 transition-colors">
                      <td className="py-3 px-4 font-bold text-[#007C8B]">#{offer.id}</td>
                      <td className="py-3 px-4 text-[var(--wallet-muted)]">
                        {offer.seller.slice(0, 6)}...{offer.seller.slice(-4)}
                      </td>
                      <td className="py-3 px-4 font-bold text-[var(--wallet-text)]">
                        {offer.pnrRemaining} PNR
                      </td>
                      <td className="py-3 px-4 text-cyan-600 dark:text-cyan-400 font-bold">
                        ${offer.pricePerPnr}
                      </td>
                      <td className="py-3 px-4">{offer.usdtPriceTotal} USDT</td>
                      <td className="py-3 px-4 text-[var(--wallet-muted)]">
                        {offer.minPnrFillWei > 0n ? `${offer.minPnrFill} PNR` : 'None'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => openFillModal(offer)}
                          disabled={busy || !wallet.address || offer.seller.toLowerCase() === wallet.address?.toLowerCase()}
                          className="py-1 px-3 rounded-lg bg-gradient-to-r from-[#007C8B] to-[#00E5F4] text-white font-semibold text-[11px] disabled:opacity-50"
                        >
                          {offer.seller.toLowerCase() === wallet.address?.toLowerCase() ? 'Mine' : 'Buy'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: SELL PNR (Create Offer) ─────────────────────────────────── */}
      {tab === 'sell' && (
        <div className="max-w-xl mx-auto p-6 sm:p-7 rounded-3xl bg-[var(--wallet-surface)] border border-[#007C8B]/20 shadow-sm space-y-5">
          <div className="space-y-1">
            <h3 className="font-serif text-base font-bold text-[var(--wallet-text)]">Create P2P Sell Offer</h3>
            <p className="text-xs text-[var(--wallet-muted)]">
              Lock your liquid TESTNET PNR in non-custodial smart contract escrow. Other creators can purchase it with TESTNET MockUSDT atomically.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <label htmlFor="sell-pnr" className="font-semibold text-[var(--wallet-text)]">
                  TESTNET PNR Amount to Sell
                </label>
                <div className="flex items-center gap-1.5 text-[var(--wallet-muted)]">
                  <span>Balance: {wallet.balancePnr || '0'} PNR</span>
                  {wallet.balancePnr && (
                    <button
                      type="button"
                      onClick={() => setSellPnrAmount(wallet.balancePnr || '0')}
                      className="text-[#007C8B] font-semibold hover:underline"
                    >
                      MAX
                    </button>
                  )}
                </div>
              </div>
              <input
                id="sell-pnr"
                type="number"
                step="any"
                min="1"
                placeholder="e.g. 500"
                value={sellPnrAmount}
                onChange={e => setSellPnrAmount(e.target.value)}
                className="w-full p-3 rounded-2xl bg-[var(--wallet-inset)] border border-[#007C8B]/20 text-sm font-mono text-[var(--wallet-text)] focus:outline-none focus:border-[#007C8B]"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <label htmlFor="sell-usdt" className="font-semibold text-[var(--wallet-text)]">
                  Total MockUSDT Price Requested
                </label>
                <span className="text-[var(--wallet-muted)]">
                  {parseFloat(sellPnrAmount) > 0 && parseFloat(sellUsdtPrice) > 0
                    ? `Rate: $${(parseFloat(sellUsdtPrice) / parseFloat(sellPnrAmount)).toFixed(6)} / PNR`
                    : ''}
                </span>
              </div>
              <input
                id="sell-usdt"
                type="number"
                step="any"
                min="0.1"
                placeholder="e.g. 5.00"
                value={sellUsdtPrice}
                onChange={e => setSellUsdtPrice(e.target.value)}
                className="w-full p-3 rounded-2xl bg-[var(--wallet-inset)] border border-[#007C8B]/20 text-sm font-mono text-[var(--wallet-text)] focus:outline-none focus:border-[#007C8B]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="sell-min-fill" className="block text-xs font-semibold text-[var(--wallet-text)] mb-1">
                  Min Fill Size (Optional)
                </label>
                <input
                  id="sell-min-fill"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0 (any amount)"
                  value={sellMinFill}
                  onChange={e => setSellMinFill(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[var(--wallet-inset)] border border-[#007C8B]/20 text-xs font-mono text-[var(--wallet-text)] focus:outline-none focus:border-[#007C8B]"
                />
              </div>

              <div>
                <label htmlFor="sell-duration" className="block text-xs font-semibold text-[var(--wallet-text)] mb-1">
                  Offer Duration
                </label>
                <select
                  id="sell-duration"
                  value={sellDurationDays}
                  onChange={e => setSellDurationDays(e.target.value as '0' | '1' | '3' | '7')}
                  className="w-full p-2.5 rounded-xl bg-[var(--wallet-inset)] border border-[#007C8B]/20 text-xs text-[var(--wallet-text)] focus:outline-none focus:border-[#007C8B]"
                >
                  <option value="0">No Expiration</option>
                  <option value="1">24 Hours</option>
                  <option value="3">3 Days</option>
                  <option value="7">7 Days</option>
                </select>
              </div>
            </div>

            {/* Estimated Proceeds Card */}
            {parseFloat(sellUsdtPrice) > 0 && (
              <div className="p-3.5 rounded-2xl bg-[#007C8B]/5 border border-[#007C8B]/20 space-y-1.5 text-xs">
                <div className="flex justify-between text-[var(--wallet-muted)]">
                  <span>Gross Order Value:</span>
                  <span className="font-mono font-semibold text-[var(--wallet-text)]">{sellUsdtPrice} USDT</span>
                </div>
                <div className="flex justify-between text-[var(--wallet-muted)]">
                  <span>Platform Fee (0.50%):</span>
                  <span className="font-mono text-xs">
                    {(parseFloat(sellUsdtPrice) * 0.005).toFixed(6)} USDT
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-[#007C8B]/15 text-sm font-bold">
                  <span className="text-[var(--wallet-text)]">Estimated Net Proceeds:</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">
                    {(parseFloat(sellUsdtPrice) * 0.995).toFixed(6)} USDT
                  </span>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleCreateOffer}
              disabled={busy || !wallet.address || !sellPnrAmount || !sellUsdtPrice}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#007C8B] via-[#00B3C4] to-[#00E5F4] hover:opacity-95 text-white font-semibold text-xs shadow-sm transition-all disabled:opacity-50"
            >
              {busy ? 'Processing Transaction...' : 'Approve PNR & Create Escrow Offer'}
            </button>
          </div>
        </div>
      )}

      {/* ─── TAB 3: OPEN ORDERS (Order Book View) ────────────────────────────── */}
      {tab === 'open_orders' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-[var(--wallet-muted)]">
            <span>Live on-chain order book showing all active market sell orders.</span>
            <span className="font-mono">{processedOffers.length} active orders</span>
          </div>

          <div className="overflow-x-auto rounded-3xl bg-[var(--wallet-surface)] border border-[#007C8B]/15">
            <table className="w-full text-xs text-left">
              <thead className="bg-[var(--wallet-inset)] text-[var(--wallet-muted)] uppercase text-[10px] font-semibold border-b border-[#007C8B]/15">
                <tr>
                  <th className="py-3 px-4">Order ID</th>
                  <th className="py-3 px-4">Seller Address</th>
                  <th className="py-3 px-4">Remaining PNR</th>
                  <th className="py-3 px-4">Price / PNR</th>
                  <th className="py-3 px-4">Total Cost (USDT)</th>
                  <th className="py-3 px-4">Progress</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#007C8B]/10 font-mono">
                {processedOffers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[var(--wallet-muted)]">
                      No active orders found in the order book.
                    </td>
                  </tr>
                ) : (
                  processedOffers.map(offer => (
                    <tr key={offer.id} className="hover:bg-[var(--wallet-inset)]/50 transition-colors">
                      <td className="py-3 px-4 font-bold text-[#007C8B]">#{offer.id}</td>
                      <td className="py-3 px-4 text-[var(--wallet-muted)]">
                        {offer.seller.slice(0, 6)}...{offer.seller.slice(-4)}
                      </td>
                      <td className="py-3 px-4 font-bold text-[var(--wallet-text)]">
                        {offer.pnrRemaining} PNR
                      </td>
                      <td className="py-3 px-4 text-cyan-600 dark:text-cyan-400 font-bold">
                        ${offer.pricePerPnr}
                      </td>
                      <td className="py-3 px-4">{offer.usdtPriceTotal} USDT</td>
                      <td className="py-3 px-4">
                        <span className="text-[11px] text-[var(--wallet-muted)]">{offer.fillPercentage}%</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => openFillModal(offer)}
                          disabled={busy || !wallet.address || offer.seller.toLowerCase() === wallet.address?.toLowerCase()}
                          className="py-1 px-3 rounded-lg bg-gradient-to-r from-[#007C8B] to-[#00E5F4] text-white font-semibold text-[11px] disabled:opacity-50"
                        >
                          Buy
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB 4: MY ORDERS ────────────────────────────────────────────────── */}
      {tab === 'my_orders' && (
        <div className="space-y-4">
          <div className="text-xs text-[var(--wallet-muted)]">
            Manage your personal active and completed sell orders. Active orders can be cancelled anytime to reclaim remaining escrow.
          </div>

          {myOffers.length === 0 ? (
            <div className="p-10 text-center rounded-3xl bg-[var(--wallet-surface)] border border-[#007C8B]/15 text-xs text-[var(--wallet-muted)] space-y-2">
              <p className="font-semibold text-base text-[var(--wallet-text)]">You have no P2P orders yet.</p>
              <p>Create an offer to sell TESTNET PNR tokens in the Sell PNR tab.</p>
              <button
                type="button"
                onClick={() => setTab('sell')}
                className="mt-2 py-2 px-4 rounded-xl bg-gradient-to-r from-[#007C8B] via-[#00B3C4] to-[#00E5F4] text-white font-semibold text-xs shadow-sm transition-all"
              >
                Create Sell Offer
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {myOffers.map(offer => (
                <div
                  key={offer.id}
                  className="p-4 rounded-2xl bg-[var(--wallet-surface)] border border-[#007C8B]/20 flex flex-wrap items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[#007C8B]">Offer #{offer.id}</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                          offer.active
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : offer.cancelled
                            ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                            : 'bg-slate-100 dark:bg-slate-800 text-[var(--wallet-muted)]'
                        }`}
                      >
                        {offer.active
                          ? `Active (${offer.fillPercentage}% filled)`
                          : offer.cancelled
                          ? 'Cancelled & Refunded'
                          : 'Fully Settled'}
                      </span>
                    </div>
                    <div className="text-[11px] text-[var(--wallet-muted)] font-mono">
                      Remaining in Escrow: <strong className="text-[var(--wallet-text)]">{offer.pnrRemaining} PNR</strong> of {offer.pnrAmount} total · Rate: ${offer.pricePerPnr} / PNR
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {offer.active && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleEditOffer(offer)}
                          disabled={busy}
                          className="py-1.5 px-3 rounded-lg bg-[var(--wallet-inset)] hover:bg-[#007C8B]/10 text-[#007C8B] text-xs font-semibold flex items-center gap-1 transition-colors"
                        >
                          <Edit3 className="h-3 w-3" />
                          <span>Edit Price</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCancelOffer(offer.id)}
                          disabled={busy}
                          className="py-1.5 px-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 text-xs font-semibold transition-colors disabled:opacity-50"
                        >
                          Cancel &amp; Refund PNR
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 5: TRADE HISTORY ────────────────────────────────────────────── */}
      {tab === 'history' && (
        <div className="space-y-4">
          <div className="text-xs text-[var(--wallet-muted)]">
            Verified atomic settlements executed on Polygon Amoy Testnet.
          </div>

          {history.length === 0 ? (
            <div className="p-10 text-center rounded-3xl bg-[var(--wallet-surface)] border border-[#007C8B]/15 text-xs text-[var(--wallet-muted)] space-y-1">
              <Clock className="h-8 w-8 mx-auto text-[#007C8B]" />
              <p className="font-semibold text-base text-[var(--wallet-text)]">No Trades Settled Yet</p>
              <p>Executed partial and full fills will appear here with on-chain transaction receipts.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((evt, idx) => (
                <div
                  key={`${evt.txHash}-${idx}`}
                  className="p-3.5 rounded-2xl bg-[var(--wallet-surface)] border border-[#007C8B]/10 flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[var(--wallet-text)]">Trade #{evt.offerId} Executed</span>
                      <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                        +{evt.pnrFilled} PNR
                      </span>
                    </div>
                    <span className="text-[11px] text-[var(--wallet-muted)] font-mono block">
                      Buyer: {evt.buyer.slice(0, 6)}...{evt.buyer.slice(-4)} paid {evt.usdtPaid} USDT (Protocol Fee: {evt.feePaid} USDT)
                    </span>
                  </div>

                  <a
                    href={`https://amoy.polygonscan.com/tx/${evt.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-[11px] text-[#007C8B] hover:underline"
                  >
                    <span>Tx Receipt</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 6: MY PORTFOLIO ─────────────────────────────────────────────── */}
      {tab === 'portfolio' && (
        <div className="space-y-6">
          <div className="space-y-1">
            <h3 className="font-serif text-base font-bold text-[var(--wallet-text)]">My P2P Trading Portfolio</h3>
            <p className="text-xs text-[var(--wallet-muted)]">
              Real-time balance breakdown of your liquid wallet tokens vs non-custodial smart contract escrow commitments.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-3xl bg-[var(--wallet-surface)] border border-[#007C8B]/20 space-y-2">
              <span className="text-[10px] uppercase font-bold text-[var(--wallet-muted)] block">Liquid TESTNET PNR</span>
              <div className="font-mono text-2xl font-bold text-[var(--wallet-text)]">
                {portfolio.liquidPnr}
                <span className="text-xs font-normal text-[var(--wallet-muted)] ml-1">PNR</span>
              </div>
              <p className="text-[11px] text-[var(--wallet-muted)]">Available in your wallet for tipping, staking, or selling.</p>
            </div>

            <div className="p-5 rounded-3xl bg-[var(--wallet-surface)] border border-[#007C8B]/20 space-y-2">
              <span className="text-[10px] uppercase font-bold text-[var(--wallet-muted)] block">Escrowed PNR (In Orders)</span>
              <div className="font-mono text-2xl font-bold text-amber-600 dark:text-amber-400">
                {portfolio.escrowedPnr}
                <span className="text-xs font-normal text-[var(--wallet-muted)] ml-1">PNR</span>
              </div>
              <p className="text-[11px] text-[var(--wallet-muted)]">Locked across {portfolio.activeOffersCount} active sell offers. Recoverable anytime.</p>
            </div>

            <div className="p-5 rounded-3xl bg-[var(--wallet-surface)] border border-[#007C8B]/20 space-y-2">
              <span className="text-[10px] uppercase font-bold text-[var(--wallet-muted)] block">Total PNR Assets</span>
              <div className="font-mono text-2xl font-bold text-[#007C8B]">
                {portfolio.totalPnr}
                <span className="text-xs font-normal text-[var(--wallet-muted)] ml-1">PNR</span>
              </div>
              <p className="text-[11px] text-[var(--wallet-muted)]">Sum of liquid wallet balance + active escrow balances.</p>
            </div>
          </div>

          {/* TESTNET MockUSDT Card */}
          <div className="p-5 rounded-3xl bg-[var(--wallet-surface)] border border-[#007C8B]/20 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-[var(--wallet-muted)] block">
                Available TESTNET MockUSDT
              </span>
              <div className="font-mono text-xl font-bold text-cyan-600 dark:text-cyan-400">
                {portfolio.liquidUsdt} <span className="text-xs font-normal text-[var(--wallet-muted)]">USDT</span>
              </div>
              <p className="text-[11px] text-[var(--wallet-muted)]">
                Used to purchase creator PNR directly on the P2P marketplace.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <a
                href="/wallet/"
                className="py-2 px-3.5 rounded-xl bg-[var(--wallet-inset)] hover:bg-[#007C8B]/10 text-xs font-semibold text-[var(--wallet-text)] transition-all border border-[#007C8B]/20"
              >
                Go to Wallet
              </a>
            </div>
          </div>

          {/* Contract Allowances Status */}
          <div className="p-5 rounded-3xl bg-[var(--wallet-surface)] border border-[#007C8B]/15 space-y-3">
            <h4 className="font-serif text-sm font-bold text-[var(--wallet-text)]">Active Smart Contract Allowances</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-2xl bg-[var(--wallet-inset)] space-y-1">
                <span className="text-[10px] uppercase font-bold text-[var(--wallet-muted)] block">PNR Escrow Allowance</span>
                <span className="font-mono font-bold text-[var(--wallet-text)]">{allowances.pnrAllowanceFormatted} PNR</span>
                <span className="text-[10px] text-[var(--wallet-muted)] block">Pre-approved for creating sell offers</span>
              </div>
              <div className="p-3 rounded-2xl bg-[var(--wallet-inset)] space-y-1">
                <span className="text-[10px] uppercase font-bold text-[var(--wallet-muted)] block">MockUSDT Trading Allowance</span>
                <span className="font-mono font-bold text-[var(--wallet-text)]">{allowances.usdtAllowanceFormatted} USDT</span>
                <span className="text-[10px] text-[var(--wallet-muted)] block">Pre-approved for filling buy orders</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── PARTIAL / FULL FILL MODAL ───────────────────────────────────────── */}
      {selectedOffer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-3xl bg-[var(--wallet-surface)] border border-[#007C8B]/30 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#007C8B]/15 pb-3">
              <div>
                <span className="text-[10px] font-mono text-[#007C8B] uppercase font-bold tracking-wider">
                  Fill Order #{selectedOffer.id}
                </span>
                <h3 className="font-serif text-base font-bold text-[var(--wallet-text)]">
                  Buy TESTNET PNR with MockUSDT
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOffer(null)}
                className="p-1.5 rounded-lg text-[var(--wallet-muted)] hover:text-[var(--wallet-text)] hover:bg-[var(--wallet-inset)]"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-[var(--wallet-inset)] border border-[#007C8B]/10 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-[var(--wallet-muted)]">Available in Escrow:</span>
                <span className="font-mono font-bold text-[var(--wallet-text)]">{selectedOffer.pnrRemaining} PNR</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--wallet-muted)]">Rate:</span>
                <span className="font-mono font-bold text-[#007C8B]">${selectedOffer.pricePerPnr} USDT / PNR</span>
              </div>
              {selectedOffer.minPnrFillWei > 0n && (
                <div className="flex justify-between text-amber-600 dark:text-amber-400">
                  <span>Minimum Fill:</span>
                  <span className="font-mono font-semibold">{selectedOffer.minPnrFill} PNR</span>
                </div>
              )}
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <label htmlFor="fill-amount" className="font-semibold text-[var(--wallet-text)]">
                  PNR Quantity to Purchase
                </label>
                <span className="text-[var(--wallet-muted)]">USDT Balance: {wallet.balanceUsdt || '0'}</span>
              </div>
              <input
                id="fill-amount"
                type="number"
                step="any"
                min="0.1"
                max={selectedOffer.pnrRemaining}
                placeholder={`Max ${selectedOffer.pnrRemaining}`}
                value={fillPnrAmount}
                onChange={e => setFillPnrAmount(e.target.value)}
                className="w-full p-3 rounded-2xl bg-[var(--wallet-inset)] border border-[#007C8B]/20 text-sm font-mono text-[var(--wallet-text)] focus:outline-none focus:border-[#007C8B]"
              />

              {/* Quick Percentage Presets */}
              <div className="grid grid-cols-4 gap-2 mt-2">
                {[0.25, 0.5, 0.75, 1.0].map(pct => {
                  const val = (parseFloat(selectedOffer.pnrRemaining) * pct).toFixed(2);
                  return (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setFillPnrAmount(val)}
                      className="py-1 px-2 rounded-lg bg-[var(--wallet-inset)] hover:bg-[#007C8B]/10 text-[11px] font-mono font-semibold text-[var(--wallet-muted)] hover:text-[#007C8B] transition-all"
                    >
                      {pct * 100}%
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live Calculation Preview */}
            {costPreview && (
              <div className="p-3.5 rounded-2xl bg-[#007C8B]/5 border border-[#007C8B]/20 space-y-1.5 text-xs">
                <div className="flex justify-between text-[var(--wallet-muted)]">
                  <span>Gross Cost:</span>
                  <span className="font-mono font-semibold text-[var(--wallet-text)]">{costPreview.grossUsdt} USDT</span>
                </div>
                <div className="flex justify-between text-[var(--wallet-muted)]">
                  <span>Platform Fee (0.50%):</span>
                  <span className="font-mono text-xs">{costPreview.fee} USDT</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-[#007C8B]/15 text-sm font-bold">
                  <span className="text-[var(--wallet-text)]">Total Payment Due:</span>
                  <span className="font-mono text-cyan-600 dark:text-cyan-400">{costPreview.grossUsdt} USDT</span>
                </div>
              </div>
            )}

            {preflightError && (
              <div className="p-2.5 rounded-xl bg-red-500/10 text-red-600 text-xs font-medium flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{preflightError}</span>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedOffer(null)}
                className="w-1/3 py-2.5 px-3 rounded-xl bg-[var(--wallet-inset)] text-[var(--wallet-muted)] font-semibold text-xs hover:text-[var(--wallet-text)] transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteFill}
                disabled={busy || !costPreview || !!preflightError}
                className="w-2/3 py-2.5 px-3 rounded-xl bg-gradient-to-r from-[#007C8B] via-[#00B3C4] to-[#00E5F4] hover:opacity-95 text-white font-semibold text-xs shadow-sm transition-all disabled:opacity-50"
              >
                {busy ? 'Confirming...' : 'Approve USDT & Settle'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
