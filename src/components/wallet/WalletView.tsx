// src/components/wallet/WalletView.tsx
// PENORA Blockchain — Clean, Modular Non-Custodial Wallet (Phase 20 UX Redesign)
import '../../styles/wallet.css';
import '../../styles/wallet-mobile.css';
import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { isAddress } from 'viem';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import {
  MobileWalletHeader,
  MobileWalletNavigation,
  MobileWalletOverview,
  type WalletTab,
} from './MobileWalletOverview';
import { WalletHeader } from './WalletHeader';
import { WalletNavigation } from './WalletNavigation';
import { WalletBalanceCard } from './WalletBalanceCard';
import { WalletQuickActions } from './WalletQuickActions';
import { WalletAssetList } from './WalletAssetList';
import { WalletActivityPreview } from './WalletActivityPreview';
import { WalletConnectionPanel } from './WalletConnectionPanel';
import { WalletActivityView } from './WalletActivityView';
import { WalletSendFlow, type SendSuccessReceipt } from './WalletSendFlow';
import { WalletReceiveView } from './WalletReceiveView';
import { WalletPowerView } from './WalletPowerView';
import { WalletMoreView } from './WalletMoreView';
import { SendConfirmDialog, PowerTransactionDialog } from './WalletTransactionDialog';
import { CreatorEarningsCard } from './CreatorEarningsCard';
import { PowerDelegationCard } from './PowerDelegationCard';
import { RewardWalletLink } from './RewardWalletLink';
import { P2PMarketplaceView } from '../exchange/P2PMarketplaceView';
import { resolveCreatorRecipient, type CreatorRecipient } from '../../lib/wallet/creatorRecipient';
import { penoraWalletService, INITIAL_WALLET_STATE } from '../../lib/wallet/walletService';
import { penoraPowerService, PowerTransactionPendingError } from '../../lib/wallet/powerService';
import { penoraUsdtService, penoraPnrService } from '../../lib/wallet/usdtService';
import { parseTokenAmount } from '../../lib/wallet/amount';
import { localPowerTransactions } from '../../lib/wallet/powerTransactions';
import { fetchPowerHistory } from '../../lib/wallet/history';
import { POLYGON_AMOY_CONFIG } from '../../lib/wallet/chain';
import type { WalletState, WalletTransaction, UsdtGasEstimate } from '../../lib/wallet/types';

export const WalletView: React.FC = () => {
  const [walletState, setWalletState] = useState<WalletState>(() => ({ ...INITIAL_WALLET_STATE }));
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [activeTab, setActiveTab] = useState<WalletTab>('overview');
  const [asset, setAsset] = useState<'USDT' | 'PNR'>('PNR');
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
      setTheme(
        saved === 'dark' ||
          (!saved && window.matchMedia?.('(prefers-color-scheme: dark)').matches)
          ? 'dark'
          : 'light'
      );
    } catch {}
  }, []);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    try {
      localStorage.setItem('penora_wallet_theme', next);
    } catch {}
  };

  // QR Code State
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);

  // Send / Withdraw State
  const [sendRecipient, setSendRecipient] = useState('');
  const [creatorRecipient, setCreatorRecipient] = useState<CreatorRecipient | null>(null);
  const [reviewingTransfer, setReviewingTransfer] = useState(false);
  const [recipientPickerVersion, setRecipientPickerVersion] = useState(0);
  const [sendAmount, setSendAmount] = useState('');
  const [gasEstimate, setGasEstimate] = useState<UsdtGasEstimate | null>(null);
  const [estimatingGas, setEstimatingGas] = useState(false);
  const [gasError, setGasError] = useState<string | null>(null);
  const [showSendConfirmModal, setShowSendConfirmModal] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccessReceipt, setSendSuccessReceipt] = useState<SendSuccessReceipt | null>(null);

  // Power Up / Power Down Modal States
  const [showPowerUpModal, setShowPowerUpModal] = useState(false);
  const [showPowerDownModal, setShowPowerDownModal] = useState(false);
  const [powerUpAmount, setPowerUpAmount] = useState('');
  const [powerDownAmount, setPowerDownAmount] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [pendingPowerHash, setPendingPowerHash] = useState<string | null>(null);

  // Transaction History State
  const [historyTransactions, setHistoryTransactions] = useState<WalletTransaction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const loadHistory = async (address: `0x${string}`) => {
    const errors: string[] = [];
    const groups = await Promise.all([
      penoraUsdtService.fetchTransferLogs(address, undefined, message => errors.push(message)),
      penoraPnrService.fetchTransferLogs(address, undefined, message => errors.push(message)),
      fetchPowerHistory(address).catch(() => {
        errors.push('Staking history is unavailable; only locally saved power actions are shown.');
        return localPowerTransactions(address);
      }),
    ]);
    return {
      transactions: groups
        .flat()
        .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)),
      error: errors.join(' ') || null,
    };
  };

  const applyHistory = (result: { transactions: WalletTransaction[]; error: string | null }) => {
    setHistoryTransactions(result.transactions);
    setHistoryError(result.error);
    setPendingPowerHash(
      result.transactions.find(
        tx =>
          tx.status === 'pending' &&
          [
            'power_up',
            'power_down',
            'claim_installment',
            'cancel_power_down',
            'approve_pnr',
          ].includes(tx.type)
      )?.hash ?? null
    );
  };

  useEffect(() => {
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
          setWalletState(prev =>
            prev.address === ws.address && prev.isCorrectNetwork
              ? { ...prev, ...ps, balancePnr: ps.balancePnr ?? prev.balancePnr }
              : prev
          );
        });
      }
    });

    return () => {
      unsubWallet();
      actionContext.current++;
      refreshRequest.current++;
      gasRequest.current++;
      powerRequest.current++;
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
        .then(url => {
          if (active) setQrCodeDataUrl(url);
        })
        .catch(err => console.error('Failed to generate QR code:', err));
    } else {
      setQrCodeDataUrl(null);
    }
    return () => {
      active = false;
    };
  }, [walletState.address]);

  // Load real transaction history & watch for incoming deposit events
  useEffect(() => {
    let active = true;
    setHistoryTransactions([]);
    if (walletState.address && walletState.isCorrectNetwork) {
      setHistoryLoading(true);
      setHistoryError(null);
      loadHistory(walletState.address)
        .then(result => {
          if (active) applyHistory(result);
        })
        .finally(() => {
          if (active) setHistoryLoading(false);
        });

      const onDeposit = (newTx: WalletTransaction) => {
        if (!active) return;
        setHistoryTransactions(prev => [newTx, ...prev.filter(t => t.id !== newTx.id)]);
        refreshAllBalances();
      };
      const unwatchUsdt = penoraUsdtService.watchIncomingTransfers(walletState.address, onDeposit);
      const unwatchPnr = penoraPnrService.watchIncomingTransfers(walletState.address, onDeposit);

      return () => {
        active = false;
        unwatchUsdt();
        unwatchPnr();
      };
    } else if (walletState.address) {
      setHistoryTransactions([
        ...penoraUsdtService.getLocalTransactions(walletState.address),
        ...penoraPnrService.getLocalTransactions(walletState.address),
        ...localPowerTransactions(walletState.address),
      ]);
    }
    setHistoryLoading(false);
    return () => {
      active = false;
    };
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
    setCreatorRecipient(null);
    setSendAmount('');
  }, [walletState.address, walletState.chainId, asset]);

  const handleCopy = async (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
        setCopiedAddress(true);
        setTimeout(() => setCopiedAddress(false), 2000);
      } catch {
        setCopiedAddress(false);
      }
    }
  };

  const refreshAllBalances = async () => {
    const request = ++refreshRequest.current;
    const current = () =>
      request === refreshRequest.current &&
      penoraWalletService.getState().address === walletState.address &&
      penoraWalletService.getState().isCorrectNetwork;
    if (walletState.address && walletState.isCorrectNetwork) {
      await penoraWalletService.refreshBalance(walletState.address);
      if (!current()) return;
      const powerVersion = ++powerRequest.current;
      const ps = await penoraPowerService.fetchPowerState(walletState.address);
      if (!current() || powerVersion !== powerRequest.current) return;
      setWalletState(prev =>
        prev.address === walletState.address && prev.isCorrectNetwork
          ? { ...prev, ...ps, balancePnr: ps.balancePnr ?? prev.balancePnr }
          : prev
      );
      setHistoryLoading(true);
      try {
        const result = await loadHistory(walletState.address);
        if (current()) applyHistory(result);
      } finally {
        if (current()) setHistoryLoading(false);
      }
    }
  };

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
    if (reviewingTransfer || sendLoading) return;
    const context = actionContext.current;
    setSendError(null);
    setReviewingTransfer(true);
    try {
      if (!sendRecipient || !isAddress(sendRecipient)) {
        throw new Error('Choose a creator or enter a valid recipient EVM address.');
      }
      if (!walletState.address || !walletState.isCorrectNetwork) {
        throw new Error('Connect your wallet on Polygon Amoy first.');
      }
      if (sendRecipient.toLowerCase() === walletState.address.toLowerCase()) {
        throw new Error('Recipient wallet must be different from your wallet.');
      }
      if (creatorRecipient) {
        const latest = await resolveCreatorRecipient(creatorRecipient.username);
        if (
          latest.id !== creatorRecipient.id ||
          latest.address.toLowerCase() !== sendRecipient.toLowerCase()
        ) {
          throw new Error(
            'The creator wallet changed. Look up the creator again and review the new address.'
          );
        }
      }
      if (context !== actionContext.current) return;
      if (!tokenConfigured) throw new Error(asset + ' contract is not configured yet.');
      const raw = parseTokenAmount(sendAmount, tokenDecimals);
      if (tokenBalance === null) {
        throw new Error('Balance unavailable. Refresh your wallet before continuing.');
      }
      const balanceRaw = tokenBalance === '0' ? 0n : parseTokenAmount(tokenBalance, tokenDecimals);
      if (raw > balanceRaw) throw new Error('Requested amount exceeds available balance.');
      if (!(await handleEstimateGas(sendRecipient, sendAmount))) return;
      if (context === actionContext.current) setShowSendConfirmModal(true);
    } catch (err: any) {
      if (context === actionContext.current) {
        setSendError(err.message || 'Transfer review failed.');
      }
    } finally {
      setReviewingTransfer(false);
    }
  };

  const handleExecuteSend = async () => {
    const context = actionContext.current;
    setSendError(null);
    setSendSuccessReceipt(null);
    setSendLoading(true);

    try {
      const reviewedAddress = walletState.address;
      if (creatorRecipient) {
        const latest = await resolveCreatorRecipient(creatorRecipient.username);
        if (context !== actionContext.current) return;
        if (
          latest.id !== creatorRecipient.id ||
          latest.address.toLowerCase() !== sendRecipient.toLowerCase()
        ) {
          setShowSendConfirmModal(false);
          throw new Error('The creator wallet changed. Find the creator again before sending.');
        }
      }
      if (context !== actionContext.current) return;
      const result = await tokenService.executeSendUsdt(
        sendRecipient,
        sendAmount,
        undefined,
        reviewedAddress ?? undefined
      );
      if (
        context !== actionContext.current ||
        !penoraWalletService.getState().isCorrectNetwork ||
        penoraWalletService.getState().address?.toLowerCase() !== reviewedAddress?.toLowerCase()
      ) {
        return;
      }
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
      const tx = await penoraPowerService.executePowerUp(
        powerUpAmount,
        walletState.address ?? undefined
      );
      if (context !== actionContext.current) return;
      setActionSuccess(`Power Up confirmed: ${tx.slice(0, 10)}...`);
      setPowerUpAmount('');
      setTimeout(() => {
        if (context === actionContext.current) setShowPowerUpModal(false);
      }, 2500);
      refreshAllBalances();
    } catch (err: any) {
      if (context === actionContext.current && err instanceof PowerTransactionPendingError) {
        setPendingPowerHash(err.hash);
        setShowPowerUpModal(false);
        setShowPowerDownModal(false);
        refreshAllBalances();
      } else if (context === actionContext.current) {
        setActionError(err?.message || 'Failed to execute Power Up');
      }
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
      const tx = await penoraPowerService.executeStartPowerDown(
        powerDownAmount,
        walletState.address ?? undefined
      );
      if (context !== actionContext.current) return;
      setActionSuccess(`13-week Power Down schedule started: ${tx.slice(0, 10)}...`);
      setPowerDownAmount('');
      setTimeout(() => {
        if (context === actionContext.current) setShowPowerDownModal(false);
      }, 2500);
      refreshAllBalances();
    } catch (err: any) {
      if (context === actionContext.current && err instanceof PowerTransactionPendingError) {
        setPendingPowerHash(err.hash);
        setShowPowerUpModal(false);
        setShowPowerDownModal(false);
        refreshAllBalances();
      } else if (context === actionContext.current) {
        setActionError(err?.message || 'Failed to start Power Down');
      }
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
      const tx = await penoraPowerService.executeClaimInstallments(
        walletState.address ?? undefined
      );
      if (context !== actionContext.current) return;
      setActionSuccess(`Matured installment claimed: ${tx.slice(0, 10)}...`);
      refreshAllBalances();
    } catch (err: any) {
      if (context === actionContext.current && err instanceof PowerTransactionPendingError) {
        setPendingPowerHash(err.hash);
        setShowPowerUpModal(false);
        setShowPowerDownModal(false);
        refreshAllBalances();
      } else if (context === actionContext.current) {
        setActionError(err?.message || 'Failed to claim installments');
      }
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
      const tx = await penoraPowerService.executeCancelPowerDown(
        walletState.address ?? undefined
      );
      if (context !== actionContext.current) return;
      setActionSuccess(`Power Down cancelled; unvested power restored: ${tx.slice(0, 10)}...`);
      refreshAllBalances();
    } catch (err: any) {
      if (context === actionContext.current && err instanceof PowerTransactionPendingError) {
        setPendingPowerHash(err.hash);
        setShowPowerUpModal(false);
        setShowPowerDownModal(false);
        refreshAllBalances();
      } else if (context === actionContext.current) {
        setActionError(err?.message || 'Failed to cancel Power Down');
      }
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div
      data-wallet-theme={theme}
      className="penora-wallet min-h-screen bg-[var(--wallet-bg)] text-[var(--wallet-text)] font-sans selection:bg-[#00E5F4]/30 pb-24"
    >
      <div className="wallet-content max-w-[1160px] mx-auto px-3.5 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-5">
        {/* Mobile Header (visible < 768px) */}
        <MobileWalletHeader theme={theme} onToggleTheme={toggleTheme} />

        {/* Desktop & Tablet Header (visible >= 768px) */}
        <div className="wallet-page-heading">
          <WalletHeader
            state={walletState}
            theme={theme}
            onToggleTheme={toggleTheme}
            onConnect={() => {
              void penoraWalletService.connect();
            }}
            onSwitchNetwork={() => {
              void penoraWalletService.switchOrAddAmoyNetwork();
            }}
            onCopyAddress={() => {
              if (walletState.address) void handleCopy(walletState.address);
            }}
            copied={copiedAddress}
          />
        </div>

        {/* Status / Feedback Alerts */}
        {!showPowerUpModal && !showPowerDownModal && actionSuccess && (
          <div
            role="status"
            className="p-3 rounded-xl bg-emerald-500/12 border border-emerald-500/25 text-xs text-emerald-800 dark:text-emerald-200 flex items-start gap-2"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="break-all">{actionSuccess}</span>
          </div>
        )}
        {!showPowerUpModal && !showPowerDownModal && actionError && (
          <div
            role="alert"
            className="p-3 rounded-xl bg-red-500/12 border border-red-500/25 text-xs text-red-700 dark:text-red-300 flex items-start gap-2"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="break-all">{actionError}</span>
          </div>
        )}
        {pendingPowerHash && (
          <div
            role="status"
            className="p-3 rounded-xl bg-amber-500/12 border border-amber-500/25 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between gap-2"
          >
            <span>Power transaction submitted; confirmation is pending.</span>
            <a
              className="underline font-semibold shrink-0"
              href={`${POLYGON_AMOY_CONFIG.blockExplorers[0]}/tx/${pendingPowerHash}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View tx
            </a>
          </div>
        )}
        {walletState.address && walletState.error && (
          <div
            role="alert"
            className="p-3 rounded-xl bg-amber-500/12 border border-amber-500/25 text-amber-900 dark:text-amber-200 text-xs"
          >
            {walletState.error}
          </div>
        )}

        {/* Navigation: Mobile (< 768px) & Desktop (>= 768px) */}
        <MobileWalletNavigation activeTab={activeTab} onNavigate={setActiveTab} />
        <div className="wallet-tabs">
          <WalletNavigation activeTab={activeTab} onNavigate={setActiveTab} />
        </div>

        {/* ─── SECTION 1: OVERVIEW ─────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <>
            {/* Mobile Overview (< 768px) */}
            <MobileWalletOverview
              state={walletState}
              onNavigate={setActiveTab}
              onConnect={() => {
                void penoraWalletService.connect();
              }}
              onSwitchNetwork={() => {
                void penoraWalletService.switchOrAddAmoyNetwork();
              }}
              onCopyAddress={() => {
                if (walletState.address) void handleCopy(walletState.address);
              }}
              onRefresh={refreshAllBalances}
              copied={copiedAddress}
              onPowerUp={() => setShowPowerUpModal(true)}
              onPowerDown={() => setShowPowerDownModal(true)}
              transactions={historyTransactions}
              historyLoading={historyLoading}
              historyError={historyError}
            />

            {/* Desktop Two-Column Overview (>= 768px) */}
            <div className="wallet-full-overview grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Left / Main Column (7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                <WalletBalanceCard
                  state={walletState}
                  copied={copiedAddress}
                  onConnect={() => {
                    void penoraWalletService.connect();
                  }}
                  onSwitchNetwork={() => {
                    void penoraWalletService.switchOrAddAmoyNetwork();
                  }}
                  onCopyAddress={() => {
                    if (walletState.address) void handleCopy(walletState.address);
                  }}
                  onRefresh={refreshAllBalances}
                  onPowerUp={() => setShowPowerUpModal(true)}
                />

                <WalletQuickActions onNavigate={setActiveTab} />

                <WalletAssetList state={walletState} />

                <WalletActivityPreview
                  transactions={historyTransactions}
                  loading={historyLoading}
                  error={historyError}
                  hasAddress={Boolean(walletState.address)}
                  onViewAll={() => setActiveTab('history')}
                />
              </div>

              {/* Right / Secondary Column (5 cols) */}
              <div className="lg:col-span-5">
                <WalletConnectionPanel
                  state={walletState}
                  copied={copiedAddress}
                  onConnect={() => {
                    void penoraWalletService.connect();
                  }}
                  onDisconnect={() => {
                    penoraWalletService.disconnect();
                  }}
                  onSwitchNetwork={() => {
                    void penoraWalletService.switchOrAddAmoyNetwork();
                  }}
                  onCopyAddress={() => {
                    if (walletState.address) void handleCopy(walletState.address);
                  }}
                  onPowerUp={() => setShowPowerUpModal(true)}
                  onPowerDown={() => setShowPowerDownModal(true)}
                  onNavigate={setActiveTab}
                />
              </div>
            </div>
          </>
        )}

        {/* ─── SECTION 2: ACTIVITY (FULL TRANSACTION HISTORY) ─────────────── */}
        {activeTab === 'history' && (
          <WalletActivityView
            address={walletState.address}
            transactions={historyTransactions}
            loading={historyLoading}
            error={historyError}
            onRefresh={refreshAllBalances}
          />
        )}

        {/* ─── SECTION 3: CREATOR EARNINGS ────────────────────────────────── */}
        {activeTab === 'earnings' && (
          <div className="space-y-5">
            <CreatorEarningsCard
              address={walletState.address}
              isCorrectNetwork={walletState.isCorrectNetwork}
              balancePp={walletState.balancePp}
              votingManaPercent={walletState.votingManaPercent}
            />
            <RewardWalletLink
              address={walletState.isCorrectNetwork ? walletState.address : null}
            />
          </div>
        )}

        {/* ─── SECTION 4: POWER & STAKING ─────────────────────────────────── */}
        {activeTab === 'power_system' && (
          <WalletPowerView
            state={walletState}
            actionLoading={actionLoading}
            onPowerUp={() => setShowPowerUpModal(true)}
            onPowerDown={() => setShowPowerDownModal(true)}
            onClaimInstallments={handleClaimInstallments}
            onCancelPowerDown={handleCancelPowerDown}
            onRefreshWallet={refreshAllBalances}
          />
        )}

        {/* ─── SECTION 5: SEND / WITHDRAW ─────────────────────────────────── */}
        {activeTab === 'send' && (
          <WalletSendFlow
            state={walletState}
            asset={asset}
            onAssetChange={setAsset}
            tokenBalance={tokenBalance}
            tokenDecimals={tokenDecimals}
            tokenConfigured={tokenConfigured}
            sendRecipient={sendRecipient}
            onRecipientChange={val => {
              actionContext.current++;
              setCreatorRecipient(null);
              setRecipientPickerVersion(n => n + 1);
              setShowSendConfirmModal(false);
              setSendRecipient(val);
              void handleEstimateGas(val, sendAmount);
            }}
            onCreatorSelect={recipient => {
              actionContext.current++;
              gasRequest.current++;
              setCreatorRecipient(recipient);
              setSendRecipient(recipient?.address || '');
              setGasEstimate(null);
              setGasError(null);
              setEstimatingGas(false);
              setShowSendConfirmModal(false);
            }}
            recipientPickerVersion={recipientPickerVersion}
            sendAmount={sendAmount}
            onAmountChange={val => {
              actionContext.current++;
              setSendAmount(val);
              void handleEstimateGas(sendRecipient, val);
            }}
            onMaxAmount={() => {
              if (tokenBalance) {
                setSendAmount(tokenBalance);
                if (sendRecipient && isAddress(sendRecipient)) {
                  void handleEstimateGas(sendRecipient, tokenBalance);
                }
              }
            }}
            gasEstimate={gasEstimate}
            estimatingGas={estimatingGas}
            gasError={gasError}
            sendLoading={sendLoading}
            reviewingTransfer={reviewingTransfer}
            sendError={sendError}
            sendSuccessReceipt={sendSuccessReceipt}
            onReviewTransfer={() => {
              void handleReviewTransfer();
            }}
            onSwitchNetwork={() => {
              void penoraWalletService.switchOrAddAmoyNetwork();
            }}
          />
        )}

        {/* ─── SECTION 6: RECEIVE & DEPOSIT ───────────────────────────────── */}
        {(activeTab === 'receive' || activeTab === 'deposit') && (
          <WalletReceiveView
            mode={activeTab}
            state={walletState}
            asset={asset}
            onAssetChange={setAsset}
            tokenConfigured={tokenConfigured}
            qrCodeDataUrl={qrCodeDataUrl}
            copied={copiedAddress}
            onCopyAddress={() => {
              if (walletState.address) void handleCopy(walletState.address);
            }}
            onConnect={() => {
              void penoraWalletService.connect();
            }}
            onSwitchNetwork={() => {
              void penoraWalletService.switchOrAddAmoyNetwork();
            }}
            onRefresh={refreshAllBalances}
          />
        )}

        {/* ─── SECTION 7: DELEGATION ──────────────────────────────────────── */}
        {activeTab === 'delegation' && (
          <PowerDelegationCard
            userAddress={walletState.address}
            onRefreshWallet={refreshAllBalances}
          />
        )}

        {/* ─── SECTION 8: TRADE PNR (P2P MARKETPLACE) ────────────────────── */}
        {activeTab === 'trade_pnr' && (
          <div className="space-y-5">
            <P2PMarketplaceView onBackToDesk={() => setActiveTab('overview')} />
          </div>
        )}

        {/* ─── SECTION 9: MORE (TOOLS, VERIFICATION & GUIDES) ────────────── */}
        {activeTab === 'details' && (
          <WalletMoreView state={walletState} onNavigate={setActiveTab} />
        )}
      </div>

      {/* ─── TRANSACTION DIALOGS ────────────────────────────────────────────── */}
      <SendConfirmDialog
        open={showSendConfirmModal}
        onClose={() => setShowSendConfirmModal(false)}
        asset={asset}
        tokenDecimals={tokenDecimals}
        sendAmount={sendAmount}
        sendRecipient={sendRecipient}
        creatorRecipient={creatorRecipient}
        gasEstimate={gasEstimate}
        sendLoading={sendLoading}
        sendError={sendError}
        onConfirm={() => {
          void handleExecuteSend();
        }}
      />

      <PowerTransactionDialog
        mode="up"
        open={showPowerUpModal}
        onClose={() => setShowPowerUpModal(false)}
        state={walletState}
        amount={powerUpAmount}
        onAmountChange={setPowerUpAmount}
        actionLoading={actionLoading}
        actionError={actionError}
        actionSuccess={actionSuccess}
        onConfirm={() => {
          void handleExecutePowerUp();
        }}
      />

      <PowerTransactionDialog
        mode="down"
        open={showPowerDownModal}
        onClose={() => setShowPowerDownModal(false)}
        state={walletState}
        amount={powerDownAmount}
        onAmountChange={setPowerDownAmount}
        actionLoading={actionLoading}
        actionError={actionError}
        actionSuccess={actionSuccess}
        onConfirm={() => {
          void handleExecutePowerDown();
        }}
      />
    </div>
  );
};
