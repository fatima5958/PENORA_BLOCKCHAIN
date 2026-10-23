// src/components/wallet/WalletView.tsx
// PENORA Blockchain — Option 4 Hybrid Wallet (Phase 3: Real USDT Deposits, Withdrawals & Transfers)
import '../../styles/wallet.css';
import { RewardWalletLink } from './RewardWalletLink';
import { CreatorEarningsCard } from './CreatorEarningsCard';
import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Key,
  Coins,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  Award,
  AlertCircle,
  Sparkles,
  Info,
  CheckCircle2,
  Copy,
  Check,
  Zap,
  TrendingDown,
  Clock,
  Calendar,
  X,
  Lock,
  QrCode,
  DollarSign,
  Send,
  Download,
  AlertTriangle,
  Moon,
  Sun,
} from 'lucide-react';
import { isAddress } from 'viem';
import { penoraWalletService, INITIAL_WALLET_STATE } from '../../lib/wallet/walletService';
import { penoraPowerService, PowerTransactionPendingError } from '../../lib/wallet/powerService';
import { penoraUsdtService, penoraPnrService } from '../../lib/wallet/usdtService';
import { parseTokenAmount, isSpendableAmount, previewPowerDown } from '../../lib/wallet/amount';
import { localPowerTransactions } from '../../lib/wallet/powerTransactions';
import { fetchPowerHistory, historyLabel, historySign } from '../../lib/wallet/history';
import { POLYGON_AMOY_CONFIG } from '../../lib/wallet/chain';
import type { WalletState, WalletTransaction, UsdtGasEstimate } from '../../lib/wallet/types';
import { penoraKeyAuth, type PenoraUser } from '../../lib/auth/penoraKeyAuth';
import { supabase } from '../../lib/supabaseClient';
import type { User as SupabaseUser } from '@supabase/supabase-js';

export const WalletView: React.FC = () => {
  const [walletState, setWalletState] = useState<WalletState>(() => ({ ...INITIAL_WALLET_STATE }));
  const [keyUser, setKeyUser] = useState<PenoraUser | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'deposit' | 'send' | 'receive' | 'history' | 'power_system' | 'earnings'>('overview');

  const [asset, setAsset] = useState<'USDT' | 'PNR'>('USDT');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const gasRequest = useRef(0);
  const powerRequest = useRef(0);
  const actionContext = useRef(0);
  const refreshRequest = useRef(0);
  const walletIdentity = useRef('');
  const tokenService = asset === 'USDT' ? penoraUsdtService : penoraPnrService;
  const tokenBalance = asset === 'USDT' ? walletState.balanceUsdt : walletState.balancePnr;
  const tokenDecimals = asset === 'USDT' ? walletState.usdtDecimals : 18;
  const tokenConfigured = Boolean(tokenService.getContractAddress());

  useEffect(() => {
    try {
      const saved = localStorage.getItem('penora_wallet_theme');
      setTheme(saved === 'dark' || (!saved && window.matchMedia?.('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light');
    } catch {}
  }, []);

  // QR Code State
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);

  // Send / Withdraw State
  const [sendRecipient, setSendRecipient] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [gasEstimate, setGasEstimate] = useState<UsdtGasEstimate | null>(null);
  const [estimatingGas, setEstimatingGas] = useState(false);
  const [gasError, setGasError] = useState<string | null>(null);
  const [showSendConfirmModal, setShowSendConfirmModal] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccessReceipt, setSendSuccessReceipt] = useState<{
    hash: string;
    explorerUrl: string;
    amount: string;
    recipient: string;
    status: 'confirmed' | 'pending';
    symbol: 'USDT' | 'PNR';
  } | null>(null);

  // Power Up / Power Down Modal States
  const [showPowerUpModal, setShowPowerUpModal] = useState(false);
  const [showPowerDownModal, setShowPowerDownModal] = useState(false);
  const [powerUpAmount, setPowerUpAmount] = useState('');
  const [powerDownAmount, setPowerDownAmount] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [pendingPowerHash, setPendingPowerHash] = useState<string | null>(null);

  // Real Transaction History State
  const [historyTransactions, setHistoryTransactions] = useState<WalletTransaction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const loadHistory = async (address: `0x${string}`) => {
    const errors: string[] = [];
    const groups = await Promise.all([
      penoraUsdtService.fetchTransferLogs(address, undefined, message => errors.push(message)),
      penoraPnrService.fetchTransferLogs(address, undefined, message => errors.push(message)),
      fetchPowerHistory(address).catch(() => { errors.push('Staking history is unavailable; only locally saved power actions are shown.'); return localPowerTransactions(address); }),
    ]);
    return { transactions: groups.flat().sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)), error: errors.join(' ') || null };
  };

  const applyHistory = (result: { transactions: WalletTransaction[]; error: string | null }) => {
    setHistoryTransactions(result.transactions);
    setHistoryError(result.error);
    setPendingPowerHash(result.transactions.find(tx => tx.status === 'pending' &&
      ['power_up', 'power_down', 'claim_installment', 'cancel_power_down', 'approve_pnr'].includes(tx.type))?.hash ?? null);
  };

  useEffect(() => {
    // 1. Subscribe to live Web3 wallet state
    const unsubWallet = penoraWalletService.subscribe(ws => {
      const identity = `${ws.address ?? ''}:${ws.chainId ?? ''}`;
      if (walletIdentity.current !== identity) {
        walletIdentity.current = identity;
        actionContext.current++;
        refreshRequest.current++;
      }
      const version = ++powerRequest.current;
      setWalletState(ws);
      if (ws.address && ws.isCorrectNetwork) {
        penoraPowerService.fetchPowerState(ws.address).then(ps => {
          if (version !== powerRequest.current) return;
          setWalletState(prev => prev.address === ws.address && prev.isCorrectNetwork ? ({ ...prev, ...ps, balancePnr: ps.balancePnr ?? prev.balancePnr }) : prev);
        });
      }
    });

    // 2. Subscribe to PENORA account keys
    const unsubKey = penoraKeyAuth.subscribe(ku => {
      setKeyUser(ku);
    });

    // 3. Subscribe to Supabase auth session
    supabase.auth.getSession().then(({ data }) => {
      setSupabaseUser(data.session?.user ?? null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSupabaseUser(session?.user ?? null);
    });

    return () => {
      unsubWallet();
      actionContext.current++;
      refreshRequest.current++;
      gasRequest.current++;
      powerRequest.current++;
      unsubKey();
      subscription.unsubscribe();
    };
  }, []);

  // Generate QR code whenever connected address changes
  useEffect(() => {
    let active = true;
    setQrCodeDataUrl(null);
    if (walletState.address) {
      QRCode.toDataURL(walletState.address, {
        width: 240,
        margin: 2,
        color: {
          dark: '#0A2540',
          light: '#FFFFFF',
        },
      })
        .then(url => { if (active) setQrCodeDataUrl(url); })
        .catch(err => console.error('Failed to generate QR code:', err));
    } else {
      setQrCodeDataUrl(null);
    }
    return () => { active = false; };
  }, [walletState.address]);

  // Load real transaction history & watch for incoming deposit events
  useEffect(() => {
    let active = true;
    setHistoryTransactions([]);
    if (walletState.address && walletState.isCorrectNetwork) {
      setHistoryLoading(true);
      setHistoryError(null);
      loadHistory(walletState.address)
        .then(result => { if (active) { applyHistory(result); } })
        .finally(() => { if (active) setHistoryLoading(false); });

      const onDeposit = (newTx: WalletTransaction) => {
        if (!active) return;
        setHistoryTransactions(prev => [newTx, ...prev.filter(t => t.id !== newTx.id)]);
        refreshAllBalances();
      };
      const unwatchUsdt = penoraUsdtService.watchIncomingTransfers(walletState.address, onDeposit);
      const unwatchPnr = penoraPnrService.watchIncomingTransfers(walletState.address, onDeposit);
      const unwatch = () => { unwatchUsdt(); unwatchPnr(); };

      return () => {
        active = false;
        unwatch();
      };
    } else if (walletState.address) {
      setHistoryTransactions([...penoraUsdtService.getLocalTransactions(walletState.address), ...penoraPnrService.getLocalTransactions(walletState.address), ...localPowerTransactions(walletState.address)]);
    }
    setHistoryLoading(false);
    return () => { active = false; };
  }, [walletState.address, walletState.isCorrectNetwork]);

  useEffect(() => {
    actionContext.current++;
    refreshRequest.current++;
    gasRequest.current++;
    setGasEstimate(null);
    setGasError(null);
    setEstimatingGas(false);
    setShowSendConfirmModal(false);
    setShowPowerUpModal(false);
    setShowPowerDownModal(false);
    setSendSuccessReceipt(null);
    setActionError(null);
    setActionSuccess(null);
    setPendingPowerHash(null);
    setSendError(null);
    setSendRecipient('');
    setSendAmount('');
  }, [walletState.address, walletState.chainId, asset]);

  const handleCopy = async (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
        setCopiedAddress(true);
        setTimeout(() => setCopiedAddress(false), 2000);
      } catch { setCopiedAddress(false); }
    }
  };

  const refreshAllBalances = async () => {
    const request = ++refreshRequest.current;
    const current = () => request === refreshRequest.current && penoraWalletService.getState().address === walletState.address && penoraWalletService.getState().isCorrectNetwork;
    if (walletState.address && walletState.isCorrectNetwork) {
      await penoraWalletService.refreshBalance(walletState.address);
      if (!current()) return;
      const powerVersion = ++powerRequest.current;
      const ps = await penoraPowerService.fetchPowerState(walletState.address);
      if (!current() || powerVersion !== powerRequest.current) return;
      setWalletState(prev => prev.address === walletState.address && prev.isCorrectNetwork ? ({ ...prev, ...ps, balancePnr: ps.balancePnr ?? prev.balancePnr }) : prev);
      setHistoryLoading(true);
      try {
        const result = await loadHistory(walletState.address);
        if (current()) { applyHistory(result); }
      } finally { if (current()) setHistoryLoading(false); }
    }
  };

  // Gas Estimation for Send USDT
  const handleEstimateGas = async (recipient: string, amount: string) => {
    const requestId = ++gasRequest.current;
    if (!walletState.address || !walletState.isCorrectNetwork || !recipient || !amount) {
      setGasEstimate(null);
      setEstimatingGas(false);
      return;
    }
    if (!isAddress(recipient)) {
      setGasError('Please enter a valid recipient address (0x...)');
      setGasEstimate(null);
      setEstimatingGas(false);
      return;
    }

    setEstimatingGas(true);
    setGasError(null);
    try {
      const est = await tokenService.estimateGas(
        walletState.address,
        recipient as `0x${string}`,
        amount
      );
      if (requestId !== gasRequest.current) return false;
      setGasEstimate(est);
      return true;
    } catch (err: any) {
      if (requestId !== gasRequest.current) return false;
      setGasError(err?.message || 'Failed to estimate gas fee');
      setGasEstimate(null);
      return false;
    } finally {
      if (requestId === gasRequest.current) setEstimatingGas(false);
    }
  };

  const handleReviewTransfer = async () => {
    setSendError(null);
    if (!sendRecipient || !isAddress(sendRecipient)) {
      setSendError('Please enter a valid recipient EVM address.');
      return;
    }
    try {
      if (!tokenConfigured) throw new Error(`${asset} contract is not configured yet.`);
      const raw = parseTokenAmount(sendAmount, tokenDecimals);
      if (tokenBalance === null) throw new Error('Balance unavailable. Refresh your wallet before continuing.');
      // Balance may be zero, so parse it without the positive-amount validator.
      const balanceRaw = tokenBalance === '0' ? 0n : parseTokenAmount(tokenBalance, tokenDecimals);
      if (raw > balanceRaw) throw new Error(`Requested amount exceeds available balance (${tokenBalance} ${asset}).`);
      if (!await handleEstimateGas(sendRecipient, sendAmount)) return;
    } catch (err: any) {
      setSendError(err.message);
      return;
    }
    setShowSendConfirmModal(true);
  };

  const handleExecuteSend = async () => {
    const context = actionContext.current;
    setSendError(null);
    setSendSuccessReceipt(null);
    setSendLoading(true);

    try {
      const reviewedAddress = walletState.address;
      const result = await tokenService.executeSendUsdt(sendRecipient, sendAmount, undefined, reviewedAddress ?? undefined);
      if (context !== actionContext.current || !penoraWalletService.getState().isCorrectNetwork || penoraWalletService.getState().address?.toLowerCase() !== reviewedAddress?.toLowerCase()) return;
      if (result.status === 'failed') {
        setSendError(`Transfer reverted. Transaction: ${result.hash}`);
        setShowSendConfirmModal(false);
        await refreshAllBalances();
        return;
      }
      setSendSuccessReceipt({
        hash: result.hash,
        explorerUrl: result.explorerUrl,
        amount: result.amount,
        recipient: result.recipient,
        status: result.status,
        symbol: asset,
      });
      setSendAmount('');
      setSendRecipient('');
      setGasEstimate(null);
      setShowSendConfirmModal(false);
      refreshAllBalances();
    } catch (err: any) {
      if (context === actionContext.current) setSendError(err?.message || 'Transfer failed');
    } finally {
      setSendLoading(false);
    }
  };

  const handleExecutePowerUp = async () => {
    setActionError(null);
    setActionSuccess(null);
    setPendingPowerHash(null);
    setActionLoading(true);
    const context = actionContext.current;
    try {
      const tx = await penoraPowerService.executePowerUp(powerUpAmount, walletState.address ?? undefined);
      if (context !== actionContext.current) return;
      setActionSuccess(`Power Up confirmed: ${tx.slice(0, 10)}...`);
      setPowerUpAmount('');
      setTimeout(() => { if (context === actionContext.current) setShowPowerUpModal(false); }, 2500);
      refreshAllBalances();
    } catch (err: any) {
      if (context === actionContext.current && err instanceof PowerTransactionPendingError) {
        setPendingPowerHash(err.hash);
        setShowPowerUpModal(false);
        setShowPowerDownModal(false);
        refreshAllBalances();
      } else if (context === actionContext.current) setActionError(err?.message || 'Failed to execute Power Up');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExecutePowerDown = async () => {
    setActionError(null);
    setActionSuccess(null);
    setPendingPowerHash(null);
    setActionLoading(true);
    const context = actionContext.current;
    try {
      const tx = await penoraPowerService.executeStartPowerDown(powerDownAmount, walletState.address ?? undefined);
      if (context !== actionContext.current) return;
      setActionSuccess(`13-week Power Down schedule started: ${tx.slice(0, 10)}...`);
      setPowerDownAmount('');
      setTimeout(() => { if (context === actionContext.current) setShowPowerDownModal(false); }, 2500);
      refreshAllBalances();
    } catch (err: any) {
      if (context === actionContext.current && err instanceof PowerTransactionPendingError) {
        setPendingPowerHash(err.hash);
        setShowPowerUpModal(false);
        setShowPowerDownModal(false);
        refreshAllBalances();
      } else if (context === actionContext.current) setActionError(err?.message || 'Failed to start Power Down');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClaimInstallments = async () => {
    setActionError(null);
    setActionSuccess(null);
    setPendingPowerHash(null);
    setActionLoading(true);
    const context = actionContext.current;
    try {
      const tx = await penoraPowerService.executeClaimInstallments(walletState.address ?? undefined);
      if (context !== actionContext.current) return;
      setActionSuccess(`Matured installment claimed: ${tx.slice(0, 10)}...`);
      refreshAllBalances();
    } catch (err: any) {
      if (context === actionContext.current && err instanceof PowerTransactionPendingError) {
        setPendingPowerHash(err.hash);
        setShowPowerUpModal(false);
        setShowPowerDownModal(false);
        refreshAllBalances();
      } else if (context === actionContext.current) setActionError(err?.message || 'Failed to claim installments');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelPowerDown = async () => {
    setActionError(null);
    setActionSuccess(null);
    setPendingPowerHash(null);
    setActionLoading(true);
    const context = actionContext.current;
    try {
      const tx = await penoraPowerService.executeCancelPowerDown(walletState.address ?? undefined);
      if (context !== actionContext.current) return;
      setActionSuccess(`Power Down cancelled; unvested power restored: ${tx.slice(0, 10)}...`);
      refreshAllBalances();
    } catch (err: any) {
      if (context === actionContext.current && err instanceof PowerTransactionPendingError) {
        setPendingPowerHash(err.hash);
        setShowPowerUpModal(false);
        setShowPowerDownModal(false);
        refreshAllBalances();
      } else if (context === actionContext.current) setActionError(err?.message || 'Failed to cancel Power Down');
    } finally {
      setActionLoading(false);
    }
  };

  const username =
    keyUser?.username ||
    (supabaseUser?.user_metadata?.username as string) ||
    supabaseUser?.email?.split('@')[0] ||
    'creator';

  const shortAddress = walletState.address
    ? `${walletState.address.slice(0, 6)}...${walletState.address.slice(-4)}`
    : null;

  return (
    <div data-wallet-theme={theme} className="penora-wallet min-h-screen bg-[var(--wallet-bg)] text-[var(--wallet-text)] relative overflow-hidden font-sans selection:bg-[#00E5F4]/30 pb-20">
      {/* Celestial Background Elements */}
      <div
        aria-hidden="true"
        className="fixed top-12 left-10 w-[500px] h-[500px] bg-[#00E5F4]/8 rounded-full blur-[140px] pointer-events-none"
      />
      <div
        aria-hidden="true"
        className="fixed bottom-10 right-10 w-[600px] h-[600px] bg-[#007C8B]/6 rounded-full blur-[160px] pointer-events-none"
      />

      <div className="max-w-[1200px] mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 relative z-10 space-y-4 sm:space-y-6">
        {/* ─── 1. TOP HEADER / TITLE BAR ────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#007C8B]/10">
          <div>
            <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
              <span className="p-2 rounded-xl bg-[var(--wallet-surface)] border border-[#007C8B]/15 shadow-2xs">
                <Wallet className="h-5 w-5 text-[#007C8B]" />
              </span>
              <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[var(--wallet-text)] tracking-tight">
                PENORA Wallet
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-[#007C8B] to-[#00E5F4] text-white shadow-2xs">
                Testnet wallet
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[var(--wallet-muted)] mt-1">
              Your tokens, your creative power. Manage Test PNR, Test USDT and staking for @{username}.
            </p>
          </div>

          {/* Network Pill Badge */}
          <div className="flex items-center gap-2">
            <button type="button" aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              onClick={() => { const next = theme === 'light' ? 'dark' : 'light'; setTheme(next); try { localStorage.setItem('penora_wallet_theme', next); } catch {} }}
              className="p-2.5 rounded-full bg-[var(--wallet-surface)] border border-[#007C8B]/15 text-[#007C8B]">
              {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--wallet-surface)] border border-[#007C8B]/15 shadow-2xs text-xs">
              <span
                className={`h-2 w-2 rounded-full ${
                  walletState.status === 'connected'
                    ? 'bg-emerald-500 animate-pulse'
                    : walletState.status === 'wrong_network'
                    ? 'bg-amber-500'
                    : 'bg-[#94A3B8]'
                }`}
              />
              <span className="font-semibold text-[var(--wallet-text)]">Polygon Amoy</span>
              <span className="text-[10px] font-mono text-[var(--wallet-muted)]">80002</span>
            </div>
          </div>
        </div>

        {/* ─── PROMINENT TESTNET WARNING BANNER ───────────────────────────────── */}
        <div className="flex items-start sm:items-center gap-3 px-4 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs shadow-xs">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5 sm:mt-0" />
          <div className="leading-relaxed">
            <strong className="font-bold tracking-wide uppercase">TESTNET ENVIRONMENT — NO REAL VALUE:</strong> Operating strictly on Polygon Amoy Testnet (Chain ID 80002). All balances (Test PNR, Test USDT, POL) and contract interactions are for protocol testing only and carry zero monetary value. Never send real mainnet assets to these addresses.
          </div>
        </div>

        {!showPowerUpModal && !showPowerDownModal && actionSuccess && (
          <div role="status" className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="break-all">{actionSuccess}</span>
          </div>
        )}
        {!showPowerUpModal && !showPowerDownModal && actionError && (
          <div role="alert" className="p-4 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="break-all">{actionError}</span>
          </div>
        )}

        {(activeTab === 'send' || activeTab === 'deposit') && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-[var(--wallet-surface)] p-4 border border-[#007C8B]/15">
            <label htmlFor="wallet-asset" className="font-semibold text-sm">Choose token</label>
            <select id="wallet-asset" value={asset} disabled={sendLoading} onChange={e => setAsset(e.target.value as 'USDT' | 'PNR')}
              className="bg-[var(--wallet-inset)] border border-[#007C8B]/20 rounded-xl px-4 py-2 text-sm">
              <option value="USDT">USDT · test token</option><option value="PNR">PNR · Penora</option>
            </select>
            {!tokenConfigured && <span className="text-sm text-[var(--wallet-muted)]">{asset} deposits and transfers open after contract deployment.</span>}
          </div>
        )}

        <RewardWalletLink address={walletState.isCorrectNetwork ? walletState.address : null} />

        <a href="/exchange/" className="flex items-center justify-between rounded-2xl border border-[#a8edbd]/30 bg-[#122129] px-5 py-4 text-white hover:bg-[#193039] transition-colors">
          <div><span className="text-[10px] tracking-[.18em] text-[#a8edbd] font-semibold">PENORA EXCHANGE</span><p className="mt-1 text-sm">Buy PNR with USDT</p></div><span className="text-xl text-[#a8edbd]" aria-hidden="true">↗</span>
        </a>

        {/* ─── NAVIGATION TABS ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-1.5 sm:gap-2 bg-[var(--wallet-surface)] backdrop-blur-md p-1.5 rounded-2xl border border-[#007C8B]/15 overflow-x-auto no-scrollbar scroll-smooth">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`shrink-0 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'overview'
                ? 'bg-gradient-to-r from-[#007C8B] via-[#00B3C4] to-[#00E5F4] text-white shadow-2xs'
                : 'text-[var(--wallet-muted)] hover:text-[var(--wallet-text)] hover:bg-[var(--wallet-surface)]'
            }`}
          >
            <Coins className="h-3.5 w-3.5" />
            <span>Overview</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('deposit')}
            className={`shrink-0 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'deposit'
                ? 'bg-gradient-to-r from-[#007C8B] via-[#00B3C4] to-[#00E5F4] text-white shadow-2xs'
                : 'text-[var(--wallet-muted)] hover:text-[var(--wallet-text)] hover:bg-[var(--wallet-surface)]'
            }`}
          >
            <Download className="h-3.5 w-3.5" />
            <span>Deposit</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('send')}
            className={`shrink-0 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'send'
                ? 'bg-gradient-to-r from-[#007C8B] via-[#00B3C4] to-[#00E5F4] text-white shadow-2xs'
                : 'text-[var(--wallet-muted)] hover:text-[var(--wallet-text)] hover:bg-[var(--wallet-surface)]'
            }`}
          >
            <Send className="h-3.5 w-3.5" />
            <span>Send / Withdraw</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('receive')}
            className={`shrink-0 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'receive'
                ? 'bg-gradient-to-r from-[#007C8B] via-[#00B3C4] to-[#00E5F4] text-white shadow-2xs'
                : 'text-[var(--wallet-muted)] hover:text-[var(--wallet-text)] hover:bg-[var(--wallet-surface)]'
            }`}
          >
            <QrCode className="h-3.5 w-3.5" />
            <span>Receive</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`shrink-0 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'history'
                ? 'bg-gradient-to-r from-[#007C8B] via-[#00B3C4] to-[#00E5F4] text-white shadow-2xs'
                : 'text-[var(--wallet-muted)] hover:text-[var(--wallet-text)] hover:bg-[var(--wallet-surface)]'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Transaction History</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('earnings')}
            className={`shrink-0 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'earnings'
                ? 'bg-gradient-to-r from-[#007C8B] via-[#00B3C4] to-[#00E5F4] text-white shadow-2xs'
                : 'text-[var(--wallet-muted)] hover:text-[var(--wallet-text)] hover:bg-[var(--wallet-surface)]'
            }`}
          >
            <Award className="h-3.5 w-3.5 text-[#00E5F4]" />
            <span>Creator Rewards</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('power_system')}
            className={`shrink-0 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'power_system'
                ? 'bg-gradient-to-r from-[#007C8B] via-[#00B3C4] to-[#00E5F4] text-white shadow-2xs'
                : 'text-[var(--wallet-muted)] hover:text-[var(--wallet-text)] hover:bg-[var(--wallet-surface)]'
            }`}
          >
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            <span>Power System</span>
          </button>
        </div>

        {pendingPowerHash && <div role="status" className="p-3 rounded-xl bg-amber-50 text-amber-900 text-sm">
          Power transaction submitted; confirmation is pending. Check history before retrying.{' '}
          <a className="underline" href={`${POLYGON_AMOY_CONFIG.blockExplorers[0]}/tx/${pendingPowerHash}`} target="_blank" rel="noopener noreferrer">View transaction</a>
        </div>}
        {walletState.address && walletState.error && (
          <div role="alert" className="p-3 rounded-xl bg-amber-50 text-amber-900 text-sm">{walletState.error}</div>
        )}

        {/* ─── TAB 1: OVERVIEW ──────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Main Celestial Card: Liquid PNR & PENORA Power & USDT (~7 cols) */}
              <div className="lg:col-span-7 bg-gradient-to-br from-[#0A2540] via-[#0E3456] to-[#06182C] text-white rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-xl border border-white/10 space-y-6">
                <div
                  aria-hidden="true"
                  className="absolute -top-24 -right-24 w-72 h-72 bg-[#00E5F4]/20 rounded-full blur-[80px] pointer-events-none"
                />
                <div
                  aria-hidden="true"
                  className="absolute -bottom-24 -left-24 w-72 h-72 bg-[#007C8B]/25 rounded-full blur-[90px] pointer-events-none"
                />

                <div className="relative z-10 space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Coins className="h-4 w-4 text-[#00E5F4]" />
                      <span className="text-xs font-semibold tracking-wider uppercase text-white/70">
                        Tokens & Curation Power
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/10 text-[#00E5F4] border border-white/10">
                      Polygon Amoy (80002)
                    </span>
                  </div>

                  {/* 4-Card Balances Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* 1. Liquid PNR */}
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium uppercase tracking-wider text-white/70">
                          Test PNR (Liquid)
                        </span>
                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                          Transferable
                        </span>
                      </div>
                      <div className="font-serif text-3xl font-bold text-white tracking-tight">
                        {walletState.balancePnr ? `${walletState.balancePnr} PNR` : '— PNR'}
                      </div>
                      <div className="text-[11px] text-white/60">
                        Est. Value: <span className="font-semibold text-white/90">— USDT</span>
                      </div>
                    </div>

                    {/* 2. PENORA Power (PP) */}
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium uppercase tracking-wider text-white/70">
                          PENORA Power
                        </span>
                        <span className="text-[10px] font-mono text-[#00E5F4] bg-[#00E5F4]/10 px-1.5 py-0.5 rounded">
                          1 PNR = 1 PP
                        </span>
                      </div>
                      <div className="font-serif text-3xl font-bold text-[#00E5F4] tracking-tight">
                        {walletState.balancePp ? `${walletState.balancePp} PP` : '— PP'}
                      </div>
                      <div className="text-[11px] text-white/60">
                        Available stake for curation
                      </div>
                    </div>

                    {/* 3. Real USDT Balance */}
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium uppercase tracking-wider text-white/70">
                          Test USDT
                        </span>
                        <span className="text-[10px] font-mono text-cyan-300 bg-cyan-500/10 px-1.5 py-0.5 rounded">
                          {walletState.usdtDecimals} Decimals
                        </span>
                      </div>
                      <div className="font-serif text-3xl font-bold text-cyan-300 tracking-tight">
                        {walletState.balanceUsdt !== null
                          ? `${walletState.balanceUsdt} USDT`
                          : '— USDT'}
                      </div>
                      <div className="text-[11px] text-white/60">
                        {walletState.isUsdtConfigured ? (
                          <span className="text-emerald-400">Configured Amoy test token</span>
                        ) : (
                          <span className="text-white/50">Test token setup pending</span>
                        )}
                      </div>
                    </div>

                    {/* 4. Native POL Fuel */}
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium uppercase tracking-wider text-white/70">
                          Testnet Gas (POL)
                        </span>
                        {walletState.address && (
                          <button
                            type="button"
                            onClick={refreshAllBalances}
                            title="Refresh balances via Polygon Amoy RPC"
                            className="p-1 rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                          >
                            <RefreshCw className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <div className="font-serif text-3xl font-bold text-white tracking-tight">
                        {walletState.balancePol ? `${walletState.balancePol} POL` : '— POL'}
                      </div>
                      <div className="text-[11px] text-white/60">
                        Required for Polygon Amoy gas fees
                      </div>
                    </div>
                  </div>

                  {/* Primary Actions Grid */}
                  <div className="pt-2 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setActiveTab('deposit')}
                      className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-gradient-to-r from-[#007C8B] via-[#00B3C4] to-[#00E5F4] hover:opacity-95 text-white font-semibold text-xs shadow-sm transition-all"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Deposit Tokens</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('send')}
                      className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs border border-white/10 transition-all"
                    >
                      <Send className="h-3.5 w-3.5 text-cyan-300" />
                      <span>Send Tokens</span>
                    </button>

                    <button
                      type="button"
                      disabled={!walletState.address || !walletState.isCorrectNetwork || !walletState.contractsDeployed} onClick={() => setShowPowerUpModal(true)}
                      className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs border border-white/10 transition-all"
                    >
                      <Zap className="h-3.5 w-3.5 text-[#00E5F4]" />
                      <span>Power Up</span>
                    </button>

                    <button
                      type="button"
                      disabled={!walletState.address || !walletState.isCorrectNetwork || !walletState.contractsDeployed} onClick={() => setShowPowerDownModal(true)}
                      className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs border border-white/10 transition-all"
                    >
                      <TrendingDown className="h-3.5 w-3.5 text-amber-300" />
                      <span>Power Down</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Web3 Connection & Mana (~5 cols) */}
              <div className="lg:col-span-5 space-y-4">
                {/* 1. Web3 EVM Connection Card */}
                <div className="bg-[var(--wallet-surface)] backdrop-blur-md rounded-3xl p-6 border border-[#007C8B]/15 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-serif text-sm font-bold text-[var(--wallet-text)] flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-[#007C8B]" />
                      <span>Web3 EVM Wallet</span>
                    </h3>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        walletState.status === 'connected'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : walletState.status === 'wrong_network'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-slate-100 text-[var(--wallet-muted)]'
                      }`}
                    >
                      {walletState.status.replace('_', ' ')}
                    </span>
                  </div>

                  {walletState.address ? (
                    <div className="space-y-3">
                      <div className="p-3 rounded-2xl bg-[var(--wallet-inset)] border border-[#007C8B]/10 space-y-1">
                        <div className="text-[11px] text-[var(--wallet-muted)]">Connected Address</div>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-semibold text-[var(--wallet-text)]">
                            {shortAddress}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(walletState.address || '')}
                            className="p-1 rounded-md hover:bg-[var(--wallet-surface)] text-[#007C8B] transition-colors"
                            title="Copy full address"
                          >
                            {copiedAddress ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Wrong Network Warning */}
                      {walletState.status === 'wrong_network' && (
                        <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-2">
                          <div className="flex items-center gap-2 font-semibold">
                            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                            <span>Wrong Network Detected</span>
                          </div>
                          <p className="text-[11px] text-amber-700 leading-relaxed">
                            Please switch your wallet to Polygon Amoy Testnet (Chain ID: 80002).
                          </p>
                          <button
                            type="button"
                            onClick={() => penoraWalletService.switchOrAddAmoyNetwork()}
                            className="w-full py-1.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs transition-colors shadow-2xs"
                          >
                            Switch to Polygon Amoy
                          </button>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1">
                        <a
                          href={`${POLYGON_AMOY_CONFIG.blockExplorers[0]}/address/${walletState.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[#007C8B] hover:underline flex items-center gap-1 font-medium"
                        >
                          <span>View on PolygonScan</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                        <button
                          type="button"
                          onClick={() => penoraWalletService.disconnect()}
                          className="text-xs text-[#D93838] hover:underline font-medium"
                        >
                          Disconnect
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-[var(--wallet-muted)] leading-relaxed">
                        Connect MetaMask to deposit USDT, transfer tokens, stake PNR, and inspect onchain curation influence.
                      </p>

                      {walletState.error && (
                        <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 space-y-2">
                          <div className="flex items-center gap-2 font-medium">
                            <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                            <span>{walletState.error}</span>
                          </div>
                          {walletState.error.includes('install') && (
                            <a
                              href="https://metamask.io/download/"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 font-semibold text-[#007C8B] hover:underline pt-0.5"
                            >
                              <span>Install MetaMask Extension</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => penoraWalletService.connect()}
                        disabled={walletState.status === 'connecting'}
                        className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#007C8B] via-[#00B3C4] to-[#00E5F4] hover:opacity-95 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
                      >
                        {walletState.status === 'connecting' ? (
                          <>
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            <span>Connecting...</span>
                          </>
                        ) : (
                          <>
                            <Wallet className="h-3.5 w-3.5" />
                            <span>Connect Web3 Wallet</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* 2. Voting Mana Gauge Card */}
                <div className="bg-[var(--wallet-surface)] backdrop-blur-md rounded-3xl p-6 border border-[#007C8B]/15 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-[#007C8B]" />
                      <h3 className="font-serif text-sm font-bold text-[var(--wallet-text)]">Voting Mana</h3>
                    </div>
                    <span className="text-xs font-mono font-bold text-[#007C8B]">
                      {walletState.votingManaPercent !== null
                        ? `${walletState.votingManaPercent.toFixed(1)}%`
                        : '—'}
                    </span>
                  </div>

                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#007C8B] to-[#00E5F4] transition-all duration-500 rounded-full"
                      style={{
                        width: `${
                          walletState.votingManaPercent !== null
                            ? walletState.votingManaPercent
                            : 0
                        }%`,
                      }}
                    />
                  </div>

                  <div className="text-[11px] text-[var(--wallet-muted)] leading-relaxed">
                    Regenerates linearly over <strong className="text-[var(--wallet-text)]">5 days</strong> (432,000s). Each 100% vote consumes 2% mana.
                  </div>
                </div>
              </div>
            </div>

            {/* Zero-Balance / Faucet & Testnet Setup Instructions */}
            {walletState.status === 'connected' && walletState.isCorrectNetwork && (
              <div className="bg-[var(--wallet-surface)] backdrop-blur-md rounded-3xl p-6 border border-[#007C8B]/20 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-[#007C8B]" />
                    <h3 className="font-serif text-sm font-bold text-[var(--wallet-text)]">
                      Polygon Amoy Testnet Setup &amp; Funding Guide
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20">
                    Amoy RPC Active (80002)
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Step 1: POL Gas */}
                  <div className="p-4 rounded-2xl bg-[var(--wallet-inset)] border border-[#007C8B]/10 space-y-2 flex flex-col justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[var(--wallet-text)]">1. Test POL (Gas Fee)</span>
                        <span className="text-[10px] font-mono text-[#007C8B] font-semibold">
                          {walletState.balancePol ? `${walletState.balancePol} POL` : '0 POL'}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--wallet-muted)] leading-relaxed">
                        Required for Polygon Amoy network transactions (transfers, power up, claims). Request free testnet POL directly from official faucets.
                      </p>
                    </div>
                    <a
                      href="https://faucet.polygon.technology/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#007C8B] hover:underline pt-2"
                    >
                      <span>Polygon Official Faucet</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>

                  {/* Step 2: Test PNR & Test USDT */}
                  <div className="p-4 rounded-2xl bg-[var(--wallet-inset)] border border-[#007C8B]/10 space-y-2 flex flex-col justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[var(--wallet-text)]">2. Test Tokens Funding</span>
                        <span className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400 font-semibold">
                          Target: 10,000 PNR / 1,000 USDT
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--wallet-muted)] leading-relaxed">
                        Deploy and fund your test contracts directly with MetaMask on Polygon Amoy. Testnet tokens have zero monetary value.
                      </p>
                    </div>
                    <a
                      href="/deploy-testnet"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#007C8B] hover:underline pt-2"
                    >
                      <span>Deploy via MetaMask (Amoy)</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>

                  {/* Step 3: Power Up & Staking */}
                  <div className="p-4 rounded-2xl bg-[var(--wallet-inset)] border border-[#007C8B]/10 space-y-2 flex flex-col justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[var(--wallet-text)]">3. Power Up &amp; Curation</span>
                        <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 font-semibold">
                          1 PNR = 1 PP
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--wallet-muted)] leading-relaxed">
                        Deposit liquid Test PNR into the Power Escrow contract to convert it into locked PENORA Power (PP) for stake-weighted creator voting influence.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('power_system')}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#007C8B] hover:underline pt-2 text-left"
                    >
                      <span>Explore Power System</span>
                      <ArrowUpRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 13-Week Schedule Tracker */}
            <div className="bg-[var(--wallet-surface)] backdrop-blur-md rounded-3xl p-6 border border-[#007C8B]/15 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[#007C8B]" />
                  <h3 className="font-serif text-sm font-bold text-[var(--wallet-text)]">
                    13-Week Power Down Schedule
                  </h3>
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-[#007C8B]/10 text-[#007C8B]">
                  Permissionless Escrow
                </span>
              </div>

              {walletState.powerDownSchedule && walletState.powerDownSchedule.active ? (
                <div className="space-y-4 p-4 rounded-2xl bg-[var(--wallet-inset)] border border-[#007C8B]/15">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <span className="text-[11px] text-[var(--wallet-muted)] block">Total Withdrawal</span>
                      <span className="font-mono text-sm font-bold text-[var(--wallet-text)]">
                        {walletState.powerDownSchedule.totalAmount} PNR
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-[var(--wallet-muted)] block">Weekly Installment</span>
                      <span className="font-mono text-sm font-bold text-[#007C8B]">
                        {walletState.powerDownSchedule.weeklyInstallment} PNR
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-[var(--wallet-muted)] block">Claimed Progress</span>
                      <span className="font-mono text-sm font-bold text-[var(--wallet-text)]">
                        {walletState.powerDownSchedule.weeksClaimed} / 13 Weeks
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-[var(--wallet-muted)] block">Claimable Now</span>
                      <span className="font-mono text-sm font-bold text-emerald-600">
                        {walletState.powerDownSchedule.claimableAmount} PNR
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-[var(--wallet-muted)]">Next installment unlocks: {new Date(walletState.powerDownSchedule.nextUnlockTimestamp * 1000).toLocaleString()}</p>
                  <div className="space-y-1">
                    <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-[#00E5F4] transition-all"
                        style={{
                          width: `${(walletState.powerDownSchedule.weeksClaimed / 13) * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleClaimInstallments}
                      disabled={
                        actionLoading ||
                        parseFloat(walletState.powerDownSchedule.claimableAmount) <= 0
                      }
                      className={`py-2 px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                        parseFloat(walletState.powerDownSchedule.claimableAmount) > 0
                          ? 'bg-gradient-to-r from-[#007C8B] to-[#00E5F4] text-white shadow-2xs hover:opacity-95'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <Coins className="h-3.5 w-3.5" />
                      <span>Claim Matured Installments</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCancelPowerDown}
                      disabled={actionLoading}
                      className="py-2 px-3 rounded-xl text-xs text-amber-700 bg-amber-50 hover:bg-amber-100 font-semibold transition-colors"
                    >
                      Cancel Remaining Schedule (Restore PP)
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-[var(--wallet-inset)] border border-[#007C8B]/10 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[var(--wallet-text)]">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>{walletState.contractsDeployed ? 'No active Power Down schedule' : 'Power Down status unavailable'}</span>
                  </div>
                  <p className="text-xs text-[var(--wallet-muted)] leading-relaxed">
                    Connect on Amoy with configured staking contracts to load your schedule. Power Down reserves the requested stake immediately, then unlocks it over 13 weekly installments. The final installment includes any rounding remainder.
                  </p>
                </div>
              )}
            </div>

            {/* Key Separation Info */}
            <div className="bg-[var(--wallet-surface)] backdrop-blur-md rounded-3xl p-6 border border-[#007C8B]/15 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-[#007C8B]" />
                <h3 className="font-serif text-sm font-bold text-[var(--wallet-text)]">
                  Key Architecture: PENORA Account Keys vs. Blockchain Wallet Keys
                </h3>
              </div>
              <p className="text-xs text-[var(--wallet-muted)] leading-relaxed">
                PENORA protects user sovereignty by decoupling account publishing authorities from Web3 EVM fund custody:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div className="p-4 rounded-2xl bg-[var(--wallet-inset)] border border-[#007C8B]/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-[var(--wallet-text)] flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#007C8B]" />
                      <span>PENORA Account Authorities</span>
                    </span>
                    <span className="text-[10px] font-mono text-[#007C8B] bg-[#007C8B]/10 px-2 py-0.5 rounded-full">
                      Multi-Authority
                    </span>
                  </div>
                  <ul className="text-[11px] text-[var(--wallet-muted)] space-y-1 list-disc pl-4 leading-relaxed">
                    <li><strong>Posting Key:</strong> Publish essays, edit drafts, and cast curation upvotes gaslessly.</li>
                    <li><strong>Active Key:</strong> Manage PENORA account actions. Token transfers and reward claims require a separate Web3 wallet signature.</li>
                    <li><strong>Master Owner Key:</strong> Cold storage authority used solely for key rotation.</li>
                  </ul>
                </div>

                <div className="p-4 rounded-2xl bg-[var(--wallet-inset)] border border-[#007C8B]/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-[var(--wallet-text)] flex items-center gap-1.5">
                      <Coins className="h-3.5 w-3.5 text-[#00E5F4]" />
                      <span>Polygon Amoy EVM Wallet</span>
                    </span>
                    <span className="text-[10px] font-mono text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
                      Chain 80002
                    </span>
                  </div>
                  <ul className="text-[11px] text-[var(--wallet-muted)] space-y-1 list-disc pl-4 leading-relaxed">
                    <li><strong>Self-Custodial:</strong> Private keys remain exclusively in MetaMask.</li>
                    <li><strong>Token Custody:</strong> Used for liquid USDT transfers, PNR, and staking PP.</li>
                    <li><strong>Non-Custodial Guarantee:</strong> PENORA never stores your EVM seed phrase.</li>
                  </ul>
                </div>
              </div>
            </div>
            <CreatorEarningsCard
              address={walletState.address}
              isCorrectNetwork={walletState.isCorrectNetwork}
              balancePp={walletState.balancePp}
              votingManaPercent={walletState.votingManaPercent}
            />
          </div>
        )}

        {/* ─── TAB 7: CREATOR EARNINGS ────────────────────────────────────────── */}
        {activeTab === 'earnings' && (
          <div className="space-y-6">
            <CreatorEarningsCard
              address={walletState.address}
              isCorrectNetwork={walletState.isCorrectNetwork}
              balancePp={walletState.balancePp}
              votingManaPercent={walletState.votingManaPercent}
            />
          </div>
        )}

        {/* ─── TAB 2: DEPOSIT USDT ──────────────────────────────────────────── */}
        {activeTab === 'deposit' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-[var(--wallet-surface)] backdrop-blur-md rounded-3xl p-6 sm:p-8 border border-[#007C8B]/15 shadow-sm space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-[#007C8B]/10">
                <span className="p-3 rounded-2xl bg-gradient-to-br from-[#007C8B] to-[#00E5F4] text-white">
                  <Download className="h-6 w-6" />
                </span>
                <div>
                  <h2 className="font-serif text-xl font-bold text-[var(--wallet-text)]">Deposit {asset}</h2>
                  <p className="text-xs text-[var(--wallet-muted)]">
                    Receive ERC-20 {asset} into your connected Polygon Amoy wallet
                  </p>
                </div>
              </div>

              {/* Wrong Network Banner */}
              {walletState.status === 'wrong_network' && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-2">
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>Wrong Network Detected</span>
                  </div>
                  <p className="text-[11px] text-amber-700 leading-relaxed">
                    You are connected to an unsupported network. Please switch to Polygon Amoy Testnet to safely view and deposit {asset}.
                  </p>
                  <button
                    type="button"
                    onClick={() => penoraWalletService.switchOrAddAmoyNetwork()}
                    className="py-1.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs transition-colors shadow-2xs"
                  >
                    Switch to Polygon Amoy (80002)
                  </button>
                </div>
              )}

              {/* Unsupported Network Warning */}
              <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-amber-900 text-xs flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-semibold block">Important Network Notice</span>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Depositing on an unsupported network may result in permanent loss of funds. Only send {asset} on <strong>Polygon Amoy testnet (Chain ID 80002)</strong>. Testnet tokens hold zero monetary value. Never send mainnet assets to a testnet address.
                  </p>
                </div>
              </div>

              {walletState.address && walletState.isCorrectNetwork && tokenConfigured ? (
                <div className="space-y-6">
                  {/* QR Code Container */}
                  <div className="flex flex-col items-center justify-center p-6 bg-[var(--wallet-inset)] rounded-2xl border border-[#007C8B]/10 space-y-4">
                    {qrCodeDataUrl ? (
                      <div className="p-3 bg-[var(--wallet-surface)] rounded-2xl shadow-sm border border-slate-200">
                        <img
                          src={qrCodeDataUrl}
                          alt="Connected Wallet QR Code"
                          className="w-48 h-48 sm:w-56 sm:h-56"
                        />
                      </div>
                    ) : (
                      <div className="w-48 h-48 sm:w-56 sm:h-56 flex items-center justify-center bg-slate-100 rounded-2xl">
                        <RefreshCw className="h-6 w-6 text-slate-400 animate-spin" />
                      </div>
                    )}

                    <div className="text-center space-y-1 max-w-sm">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--wallet-muted)]">
                        Your Polygon Amoy Address
                      </div>
                      <div className="font-mono text-xs sm:text-sm font-bold text-[var(--wallet-text)] break-all px-2 select-all">
                        {walletState.address}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopy(walletState.address || '')}
                      className="py-2 px-5 rounded-xl bg-[var(--wallet-surface)] border border-[#007C8B]/20 text-[#007C8B] font-semibold text-xs flex items-center gap-2 hover:bg-[var(--wallet-inset)] transition-colors shadow-2xs"
                    >
                      {copiedAddress ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                          <span className="text-emerald-700">Address Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copy Address</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Real-Time Monitoring Indicator */}
                  <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                      </span>
                      <span className="font-medium text-emerald-900">
                        Monitoring configured {asset} transfers
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={refreshAllBalances}
                      className="text-[#007C8B] hover:underline font-semibold flex items-center gap-1 text-[11px]"
                    >
                      <RefreshCw className="h-3 w-3" />
                      <span>Check Now</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-12 px-4 text-center rounded-2xl border border-dashed border-[#007C8B]/20 bg-[var(--wallet-inset)] space-y-3">
                  <Wallet className="h-8 w-8 mx-auto text-[#007C8B]" />
                  <h4 className="text-sm font-semibold text-[var(--wallet-text)]">Wallet Not Connected</h4>
                  <p className="text-xs text-[var(--wallet-muted)] max-w-sm mx-auto">
                    Please connect your MetaMask wallet to view your deposit address and monitor incoming {asset} transfers.
                  </p>
                  <button
                    type="button"
                    onClick={() => penoraWalletService.connect()}
                    className="py-2.5 px-6 rounded-xl bg-gradient-to-r from-[#007C8B] to-[#00E5F4] text-white font-semibold text-xs shadow-2xs hover:opacity-95"
                  >
                    Connect Wallet
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 3: SEND / WITHDRAW USDT ──────────────────────────────────── */}
        {activeTab === 'send' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-[var(--wallet-surface)] backdrop-blur-md rounded-3xl p-6 sm:p-8 border border-[#007C8B]/15 shadow-sm space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-[#007C8B]/10">
                <span className="p-3 rounded-2xl bg-gradient-to-br from-[#007C8B] to-[#00E5F4] text-white">
                  <Send className="h-6 w-6" />
                </span>
                <div>
                  <h2 className="font-serif text-xl font-bold text-[var(--wallet-text)]">Send {asset}</h2>
                  <p className="text-xs text-[var(--wallet-muted)]">
                    Transfer ERC-20 {asset} on Polygon Amoy testnet
                  </p>
                </div>
              </div>

              {walletState.status === 'wrong_network' && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-2">
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>Wrong Network Detected</span>
                  </div>
                  <p className="text-[11px] text-amber-700 leading-relaxed">
                    Please switch to Polygon Amoy Testnet (Chain ID: 80002) to perform transfers.
                  </p>
                  <button
                    type="button"
                    onClick={() => penoraWalletService.switchOrAddAmoyNetwork()}
                    className="py-1.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs transition-colors shadow-2xs"
                  >
                    Switch to Polygon Amoy (80002)
                  </button>
                </div>
              )}

              {sendSuccessReceipt && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 space-y-2">
                  <div className="flex items-center gap-2 font-semibold">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>{sendSuccessReceipt.status === 'confirmed' ? 'Transfer confirmed' : 'Transfer submitted — confirmation pending'}</span>
                  </div>
                  <p className="text-[11px] text-emerald-700">
                    {sendSuccessReceipt.status === 'confirmed' ? 'Sent' : 'Submitted'} <strong>{sendSuccessReceipt.amount} {sendSuccessReceipt.symbol}</strong> to{' '}
                    <span className="font-mono">{sendSuccessReceipt.recipient}</span>.
                  </p>
                  <a
                    href={sendSuccessReceipt.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-[#007C8B] hover:underline"
                  >
                    <span>View on PolygonScan</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}

              {sendError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{sendError}</span>
                </div>
              )}

              <div className="space-y-4">
                {/* Recipient Address */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--wallet-text)] block">
                    Recipient Address (Polygon Amoy)
                  </label>
                  <input
                    type="text"
                    placeholder="0x..."
                    value={sendRecipient}
                    onChange={e => {
                      setSendRecipient(e.target.value);
                      handleEstimateGas(e.target.value, sendAmount);
                    }}
                    className={`w-full py-2.5 px-3.5 rounded-xl border text-xs font-mono focus:outline-hidden ${
                      sendRecipient && !isAddress(sendRecipient)
                        ? 'border-red-300 focus:border-red-500 bg-red-50/30'
                        : 'border-slate-200 focus:border-[#007C8B] bg-[var(--wallet-surface)]'
                    }`}
                  />
                  {sendRecipient && !isAddress(sendRecipient) && (
                    <span className="text-[11px] text-red-500 block">
                      Invalid Ethereum hexadecimal address format.
                    </span>
                  )}
                </div>

                {/* Amount */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-[var(--wallet-text)]">Transfer Amount</label>
                    <span className="text-[11px] text-[var(--wallet-muted)]">
                      Available:{' '}
                      <strong className="text-[var(--wallet-text)]">
                        {tokenBalance !== null
                          ? `${tokenBalance} ${asset}`
                          : `— ${asset}`}
                      </strong>
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                  inputMode="decimal"
                      min="0"
                      step="any"
                      placeholder="0.00"
                      value={sendAmount}
                      onChange={e => {
                        setSendAmount(e.target.value);
                        handleEstimateGas(sendRecipient, e.target.value);
                      }}
                      className="w-full py-2.5 px-3.5 pr-20 rounded-xl border border-slate-200 focus:outline-hidden focus:border-[#007C8B] text-sm font-mono bg-[var(--wallet-surface)]"
                    />
                    <div className="absolute right-2.5 top-2 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (tokenBalance) {
                            setSendAmount(tokenBalance);
                            if (sendRecipient && isAddress(sendRecipient)) {
                              handleEstimateGas(sendRecipient, tokenBalance);
                            }
                          }
                        }}
                        className="px-2 py-1 rounded-md bg-[#007C8B]/10 hover:bg-[#007C8B]/20 text-[#007C8B] text-[10px] font-bold uppercase transition-colors"
                      >
                        Max
                      </button>
                      <span className="text-xs font-semibold text-[var(--wallet-muted)]">{asset}</span>
                    </div>
                  </div>
                </div>

                {/* Gas Fee Explanation & Estimation Card */}
                <div className="p-4 rounded-2xl bg-[var(--wallet-inset)] border border-[#007C8B]/10 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[var(--wallet-text)]">Estimated Blockchain Fee</span>
                    <span className="text-[11px] text-[var(--wallet-muted)]">
                      {estimatingGas ? (
                        <span className="flex items-center gap-1">
                          <RefreshCw className="h-3 w-3 animate-spin" />
                          <span>Estimating gas...</span>
                        </span>
                      ) : gasEstimate ? (
                        <span className="font-mono font-semibold text-[#007C8B]">
                          ~{parseFloat(gasEstimate.estimatedCostPol).toFixed(6)} POL ({gasEstimate.estimatedCostGwei} Gwei)
                        </span>
                      ) : (
                        <span>Enter recipient & amount</span>
                      )}
                    </span>
                  </div>

                  <div className="text-[11px] text-[var(--wallet-muted)] leading-relaxed">
                    Blockchain network fees on Polygon Amoy are paid in native <strong>POL</strong>, not automatically in {asset}. Your balance:{' '}
                    <strong>{walletState.balancePol !== null ? `${walletState.balancePol} POL` : '— POL'}</strong>.
                  </div>

                  {(!walletState.balancePol || parseFloat(walletState.balancePol) <= 0) && (
                    <div className="text-[11px] text-amber-700 font-medium flex items-center gap-1.5 pt-1">
                      <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                      <span>You need a small amount of testnet POL to cover the transaction gas fee.</span>
                    </div>
                  )}
                </div>

                {/* Submit Action */}
                <button
                  type="button"
                  onClick={handleReviewTransfer}
                  disabled={
                    walletState.status !== 'connected' || !tokenConfigured || tokenBalance === null || sendLoading || estimatingGas ||
                    !sendRecipient ||
                    !isAddress(sendRecipient) ||
                    !isSpendableAmount(sendAmount, tokenBalance, tokenDecimals)
                  }
                  className={`w-full py-3 px-4 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-all ${
                    walletState.status !== 'connected' || !tokenConfigured || tokenBalance === null || sendLoading || estimatingGas ||
                    !sendRecipient ||
                    !isAddress(sendRecipient) ||
                    !isSpendableAmount(sendAmount, tokenBalance, tokenDecimals)
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-[#007C8B] via-[#00B3C4] to-[#00E5F4] text-white hover:opacity-95'
                  }`}
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Review Transfer</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 4: RECEIVE ───────────────────────────────────────────────── */}
        {activeTab === 'receive' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-[var(--wallet-surface)] backdrop-blur-md rounded-3xl p-6 sm:p-8 border border-[#007C8B]/15 shadow-sm space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-[#007C8B]/10">
                <span className="p-3 rounded-2xl bg-gradient-to-br from-[#007C8B] to-[#00E5F4] text-white">
                  <QrCode className="h-6 w-6" />
                </span>
                <div>
                  <h2 className="font-serif text-xl font-bold text-[var(--wallet-text)]">Receive Assets</h2>
                  <p className="text-xs text-[var(--wallet-muted)]">
                    Receive configured USDT, PNR and native POL on Polygon Amoy
                  </p>
                </div>
              </div>

              {walletState.address ? (
                <div className="flex flex-col items-center justify-center p-6 bg-[var(--wallet-inset)] rounded-2xl border border-[#007C8B]/10 space-y-4">
                  {qrCodeDataUrl && (
                    <div className="p-3 bg-[var(--wallet-surface)] rounded-2xl shadow-sm border border-slate-200">
                      <img
                        src={qrCodeDataUrl}
                        alt="Receive Address QR Code"
                        className="w-48 h-48 sm:w-56 sm:h-56"
                      />
                    </div>
                  )}

                  <div className="text-center space-y-1 max-w-sm">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--wallet-muted)]">
                      Your Universal Receiving Address
                    </span>
                    <div className="font-mono text-xs sm:text-sm font-bold text-[var(--wallet-text)] break-all px-2 select-all">
                      {walletState.address}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopy(walletState.address || '')}
                    className="py-2 px-5 rounded-xl bg-[var(--wallet-surface)] border border-[#007C8B]/20 text-[#007C8B] font-semibold text-xs flex items-center gap-2 hover:bg-[var(--wallet-inset)] transition-colors shadow-2xs"
                  >
                    {copiedAddress ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Address Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy Address</span>
                      </>
                    )}
                  </button>

                  <p className="text-[11px] text-[var(--wallet-muted)] text-center max-w-xs pt-2">
                    Receive configured PNR, test USDT and native POL on Polygon Amoy (80002). Test tokens have no monetary value.
                  </p>
                </div>
              ) : (
                <div className="py-12 px-4 text-center rounded-2xl border border-dashed border-[#007C8B]/20 bg-[var(--wallet-inset)] space-y-3">
                  <Wallet className="h-8 w-8 mx-auto text-[#007C8B]" />
                  <h4 className="text-sm font-semibold text-[var(--wallet-text)]">Wallet Not Connected</h4>
                  <p className="text-xs text-[var(--wallet-muted)] max-w-sm mx-auto">
                    Connect MetaMask to view your public receiving address and QR code.
                  </p>
                  <button
                    type="button"
                    onClick={() => penoraWalletService.connect()}
                    className="py-2.5 px-6 rounded-xl bg-gradient-to-r from-[#007C8B] to-[#00E5F4] text-white font-semibold text-xs shadow-2xs hover:opacity-95"
                  >
                    Connect Wallet
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 5: TRANSACTION HISTORY ──────────────────────────────────── */}
        {activeTab === 'history' && (
          <div className="bg-[var(--wallet-surface)] backdrop-blur-md rounded-3xl p-6 border border-[#007C8B]/15 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#007C8B]/10 pb-3">
              <div>
                <h3 className="font-serif text-base font-bold text-[var(--wallet-text)] flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[#007C8B]" />
                  <span>Real Onchain Transaction History</span>
                </h3>
                <p className="text-xs text-[var(--wallet-muted)]">
                  Recent PNR, test USDT and staking events, with locally tracked pending transfers
                </p>
              </div>

              {walletState.address && (
                <button
                  type="button"
                  onClick={refreshAllBalances}
                  disabled={historyLoading}
                  className="px-3 py-1.5 rounded-xl border border-[#007C8B]/20 text-[#007C8B] hover:bg-[var(--wallet-inset)] text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className={`h-3 w-3 ${historyLoading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              )}
            </div>

            {historyError && <div role="alert" className="p-3 rounded-xl bg-amber-50 text-amber-900 text-xs">{historyError}</div>}
            {historyTransactions.length > 0 ? (
              <div className="space-y-3">
                {historyTransactions.map(tx => (
                  <div
                    key={tx.id}
                    className="p-4 rounded-2xl bg-[var(--wallet-inset)] border border-[#007C8B]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-[#007C8B]/25 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`p-2.5 rounded-xl ${
                          (tx.type === 'deposit_usdt' || tx.type === 'transfer_in')
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                            : 'bg-cyan-50 text-[#007C8B] border border-[#007C8B]/20'
                        }`}
                      >
                        {(tx.type === 'deposit_usdt' || tx.type === 'transfer_in') ? (
                          <Download className="h-4 w-4" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-[var(--wallet-text)]">
                            {historyLabel(tx)}
                          </span>
                          <span
                            className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                              tx.status === 'confirmed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : tx.status === 'pending'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {tx.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-[var(--wallet-muted)] font-mono">
                          {tx.hash.slice(0, 10)}...{tx.hash.slice(-8)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4">
                      <div className="text-right">
                        <div
                          className={`font-mono text-sm font-bold ${
                            (tx.type === 'deposit_usdt' || tx.type === 'transfer_in') ? 'text-emerald-600' : 'text-[var(--wallet-text)]'
                          }`}
                        >
                          {historySign(tx)}
                          {tx.amount} {tx.symbol}
                        </div>
                        <div className="text-[10px] text-[var(--wallet-muted)]">
                          {new Date(tx.timestamp).toLocaleString(undefined, {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </div>
                      </div>

                      {tx.explorerUrl && (
                        <a
                          href={tx.explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-[#007C8B] hover:bg-[var(--wallet-surface)] transition-colors"
                          title="View on PolygonScan"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 px-4 text-center rounded-2xl border border-dashed border-[#007C8B]/20 bg-[var(--wallet-inset)] space-y-2">
                <div className="h-10 w-10 mx-auto rounded-full bg-[#007C8B]/10 flex items-center justify-center text-[#007C8B]">
                  <Info className="h-5 w-5" />
                </div>
                <h4 className="text-sm font-semibold text-[var(--wallet-text)]">
                  {historyLoading ? 'Loading recent activity…' : historyError ? 'Onchain history could not be loaded' : 'No transactions in the recent query window'}
                </h4>
                <p className="text-xs text-[var(--wallet-muted)] max-w-md mx-auto leading-relaxed">
                  Real transfers and deposits on Polygon Amoy will appear here. No fabricated transactions are shown.
                </p>
                <a
                  href={POLYGON_AMOY_CONFIG.blockExplorers[0]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-[#007C8B] font-semibold hover:underline pt-2"
                >
                  <span>Explore Polygon Amoy Testnet</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}

            {/* RPC Limitations Disclosure */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-[var(--wallet-muted)] leading-relaxed">
              <strong>Node Query Notice:</strong> Live event lookups reflect recent blockchain activity on Polygon Amoy testnet. Deep historical indexing across years requires a dedicated graph indexer.
            </div>
          </div>
        )}

        {/* ─── TAB 6: POWER SYSTEM ─────────────────────────────────────────── */}
        {activeTab === 'power_system' && (
          <div className="bg-[var(--wallet-surface)] backdrop-blur-md rounded-3xl p-6 border border-[#007C8B]/15 shadow-sm space-y-5">
            <h3 className="font-serif text-base font-bold text-[var(--wallet-text)]">
              PENORA Power Up & Power Down Rules
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-[var(--wallet-inset)] border border-[#007C8B]/10 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-[var(--wallet-text)]">
                  <Zap className="h-4 w-4 text-[#007C8B]" />
                  <span>Instant Power Up</span>
                </div>
                <p className="text-[11px] leading-relaxed text-[var(--wallet-muted)]">
                  Staking liquid PNR into PENORA Power is immediate (1 PNR = 1 PP), expanding your curation weight and voting mana capacity.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[var(--wallet-inset)] border border-[#007C8B]/10 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-[var(--wallet-text)]">
                  <Calendar className="h-4 w-4 text-amber-600" />
                  <span>13-Week Power Down</span>
                </div>
                <p className="text-[11px] leading-relaxed text-[var(--wallet-muted)]">
                  Withdrawals unlock in 13 equal weekly installments (1/13th every 7 days). First installment unlocks after 7 days.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[var(--wallet-inset)] border border-[#007C8B]/10 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-[var(--wallet-text)]">
                  <Clock className="h-4 w-4 text-[#00E5F4]" />
                  <span>5-Day Mana Recovery</span>
                </div>
                <p className="text-[11px] leading-relaxed text-[var(--wallet-muted)]">
                  Voting mana regenerates 100% linearly over 5 days (432,000s). Each full vote consumes 2% mana.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── MODAL 1: SEND CONFIRMATION MODAL ──────────────────────────────── */}
      {showSendConfirmModal && (
        <div role="dialog" aria-modal="true" aria-label="Wallet transaction" className="fixed inset-0 z-50 bg-[#0A2540]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--wallet-surface)] rounded-3xl p-6 sm:p-8 max-w-md w-full border border-[#007C8B]/20 shadow-2xl space-y-5 relative animate-in fade-in zoom-in-95 duration-150">
            <button
              type="button"
              aria-label="Close transfer review" disabled={sendLoading} onClick={() => setShowSendConfirmModal(false)}
              className="absolute top-5 right-5 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2.5">
              <span className="p-2.5 rounded-2xl bg-gradient-to-br from-[#007C8B] to-[#00E5F4] text-white">
                <Send className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-serif text-lg font-bold text-[var(--wallet-text)]">Confirm Transfer</h3>
                <p className="text-xs text-[var(--wallet-muted)]">Verify recipient and fee before signing</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--wallet-inset)] border border-slate-200 space-y-3 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200/80">
                <span className="text-[var(--wallet-muted)]">Token</span>
                <span className="font-bold text-[var(--wallet-text)]">{asset} (ERC-20, {tokenDecimals} decimals)</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-200/80">
                <span className="text-[var(--wallet-muted)]">Network</span>
                <span className="font-bold text-[var(--wallet-text)]">Polygon Amoy (80002)</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-200/80">
                <span className="text-[var(--wallet-muted)]">Amount</span>
                <span className="font-mono font-bold text-base text-[#007C8B]">{sendAmount} {asset}</span>
              </div>
              <div className="space-y-1 pb-2 border-b border-slate-200/80">
                <span className="text-[var(--wallet-muted)] block">Destination Address</span>
                <span className="font-mono text-[11px] font-semibold text-[var(--wallet-text)] break-all block">
                  {sendRecipient}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[var(--wallet-muted)]">Estimated Gas Fee</span>
                <span className="font-mono font-semibold text-[var(--wallet-text)]">
                  {gasEstimate ? `~${parseFloat(gasEstimate.estimatedCostPol).toFixed(6)} POL` : 'Dynamic'}
                </span>
              </div>
            </div>

            {/* Irreversible Transaction Warning */}
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Blockchain transactions are irreversible and non-refundable. Please confirm the recipient address is correct.
              </span>
            </div>

            {sendError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <span>{sendError}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleExecuteSend}
              disabled={sendLoading}
              className={`w-full py-3 px-4 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-all ${
                sendLoading
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-[#007C8B] via-[#00B3C4] to-[#00E5F4] text-white hover:opacity-95'
              }`}
            >
              {sendLoading ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Awaiting Wallet Signature & Confirmation...</span>
                </>
              ) : (
                <>
                  <Lock className="h-3.5 w-3.5" />
                  <span>Confirm & Sign in MetaMask</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: POWER UP MODAL ───────────────────────────────────────── */}
      {showPowerUpModal && (
        <div role="dialog" aria-modal="true" aria-label="Wallet transaction" className="fixed inset-0 z-50 bg-[#0A2540]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--wallet-surface)] rounded-3xl p-6 sm:p-8 max-w-md w-full border border-[#007C8B]/20 shadow-2xl space-y-5 relative animate-in fade-in zoom-in-95 duration-150">
            <button
              type="button"
              aria-label="Close Power Up" disabled={actionLoading} onClick={() => setShowPowerUpModal(false)}
              className="absolute top-5 right-5 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2.5">
              <span className="p-2.5 rounded-2xl bg-gradient-to-br from-[#007C8B] to-[#00E5F4] text-white">
                <Zap className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-serif text-lg font-bold text-[var(--wallet-text)]">Power Up PNR</h3>
                <p className="text-xs text-[var(--wallet-muted)]">Convert liquid PNR into staked PENORA Power (1:1)</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-[var(--wallet-text)] block">Amount to Stake (PNR)</label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  placeholder="0.0"
                  value={powerUpAmount}
                  onChange={e => setPowerUpAmount(e.target.value)}
                  className="w-full py-2.5 px-3.5 pr-14 rounded-xl border border-slate-200 focus:outline-hidden focus:border-[#007C8B] text-sm font-mono"
                />
                <span className="absolute right-3.5 top-2.5 text-xs font-semibold text-[var(--wallet-muted)]">PNR</span>
              </div>
              <div className="text-[11px] text-[var(--wallet-muted)] flex justify-between pt-1">
                <span>Available: {walletState.balancePnr ? `${walletState.balancePnr} PNR` : '— PNR'}</span>
                <span className="text-[#007C8B] font-medium">1 PNR = 1 PP</span>
              </div>
            </div>

            {actionError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <span>{actionError}</span>
              </div>
            )}

            {actionSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>{actionSuccess}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleExecutePowerUp}
              disabled={actionLoading || !isSpendableAmount(powerUpAmount, walletState.balancePnr, 18)}
              className={`w-full py-3 px-4 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-all ${
                actionLoading || !isSpendableAmount(powerUpAmount, walletState.balancePnr, 18)
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-[#007C8B] via-[#00B3C4] to-[#00E5F4] text-white hover:opacity-95'
              }`}
            >
              {actionLoading ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Processing Staking Transaction...</span>
                </>
              ) : (
                <>
                  <Zap className="h-3.5 w-3.5" />
                  <span>Confirm Power Up</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: POWER DOWN MODAL ─────────────────────────────────────── */}
      {showPowerDownModal && (
        <div role="dialog" aria-modal="true" aria-label="Wallet transaction" className="fixed inset-0 z-50 bg-[#0A2540]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--wallet-surface)] rounded-3xl p-6 sm:p-8 max-w-md w-full border border-[#007C8B]/20 shadow-2xl space-y-5 relative animate-in fade-in zoom-in-95 duration-150">
            <button
              type="button"
              aria-label="Close Power Down" disabled={actionLoading} onClick={() => setShowPowerDownModal(false)}
              className="absolute top-5 right-5 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2.5">
              <span className="p-2.5 rounded-2xl bg-amber-500 text-white">
                <TrendingDown className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-serif text-lg font-bold text-[var(--wallet-text)]">Power Down PP</h3>
                <p className="text-xs text-[var(--wallet-muted)]">13-week linear schedule (1/13th unlocked every 7 days)</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-[var(--wallet-text)] block">Amount to Withdraw (PP)</label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  placeholder="0.0"
                  value={powerDownAmount}
                  onChange={e => setPowerDownAmount(e.target.value)}
                  className="w-full py-2.5 px-3.5 pr-14 rounded-xl border border-slate-200 focus:outline-hidden focus:border-[#007C8B] text-sm font-mono"
                />
                <span className="absolute right-3.5 top-2.5 text-xs font-semibold text-[var(--wallet-muted)]">PP</span>
              </div>
              {previewPowerDown(powerDownAmount) && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 space-y-1">
                  <div>Estimated Weekly Installment: <strong>{previewPowerDown(powerDownAmount)?.weekly} PNR</strong></div>
                  <div>Final Installment: <strong>{previewPowerDown(powerDownAmount)?.final} PNR</strong> (includes remainder)</div>
                  <div>First Installment Unlocks: <strong>7 days from confirmation</strong></div>
                </div>
              )}
            </div>

            {actionError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <span>{actionError}</span>
              </div>
            )}

            {actionSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>{actionSuccess}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleExecutePowerDown}
              disabled={actionLoading || !isSpendableAmount(powerDownAmount, walletState.balancePp, 18)}
              className={`w-full py-3 px-4 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-all ${
                actionLoading || !isSpendableAmount(powerDownAmount, walletState.balancePp, 18)
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-amber-600 hover:bg-amber-700 text-white'
              }`}
            >
              {actionLoading ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Submitting Withdrawal Schedule...</span>
                </>
              ) : (
                <>
                  <TrendingDown className="h-3.5 w-3.5" />
                  <span>Start 13-Week Power Down</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
