import React from 'react';
import {
  QrCode,
  Download,
  Copy,
  Check,
  RefreshCw,
  Wallet,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react';
import type { WalletState } from '../../lib/wallet/types';

export interface WalletReceiveViewProps {
  mode: 'receive' | 'deposit';
  state: WalletState;
  asset: 'USDT' | 'PNR';
  onAssetChange: (asset: 'USDT' | 'PNR') => void;
  tokenConfigured: boolean;
  qrCodeDataUrl: string | null;
  copied: boolean;
  onCopyAddress: () => void;
  onConnect: () => void;
  onSwitchNetwork: () => void;
  onRefresh: () => void;
}

export const WalletReceiveView: React.FC<WalletReceiveViewProps> = ({
  mode,
  state,
  asset,
  onAssetChange,
  tokenConfigured,
  qrCodeDataUrl,
  copied,
  onCopyAddress,
  onConnect,
  onSwitchNetwork,
  onRefresh,
}) => {
  const isDeposit = mode === 'deposit';

  return (
    <div className="max-w-2xl mx-auto">
      <section
        aria-label={isDeposit ? `Deposit ${asset}` : 'Receive assets'}
        className="rounded-2xl bg-[var(--wallet-surface)] border border-[var(--wallet-border)] p-5 sm:p-6 shadow-2xs space-y-5"
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[var(--wallet-border)]">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-[#0A2540] text-[#00E5F4] flex items-center justify-center shrink-0">
              {isDeposit ? <Download className="h-5 w-5" /> : <QrCode className="h-5 w-5" />}
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[var(--wallet-text)]">
                {isDeposit ? `Deposit ${asset}` : 'Receive Assets'}
              </h2>
              <p className="text-xs text-[var(--wallet-muted)]">
                {isDeposit
                  ? `Receive ERC-20 ${asset} into your connected Polygon Amoy wallet`
                  : 'Receive PNR, MockUSDT, and Test POL on Polygon Amoy (80002)'}
              </p>
            </div>
          </div>

          {isDeposit && (
            <div className="flex items-center gap-2">
              <label htmlFor="deposit-asset" className="text-xs font-semibold text-[var(--wallet-muted)]">
                Token
              </label>
              <select
                id="deposit-asset"
                value={asset}
                onChange={e => onAssetChange(e.target.value as 'USDT' | 'PNR')}
                className="min-h-[40px] bg-[var(--wallet-inset)] border border-[var(--wallet-border)] rounded-xl px-3 py-1.5 text-xs font-semibold text-[var(--wallet-text)]"
              >
                <option value="PNR">PNR · Penora Token (18 dec)</option>
                <option value="USDT">USDT · MockUSDT (6 dec)</option>
              </select>
            </div>
          )}
        </div>

        {/* Network Notice */}
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <strong className="font-semibold">Polygon Amoy Testnet Only (Chain ID 80002):</strong>{' '}
            Only send testnet {isDeposit ? asset : 'PNR, MockUSDT, or Test POL'} on Polygon Amoy. Never send mainnet tokens to this address.
          </div>
        </div>

        {/* Wrong Network Switch */}
        {state.status === 'wrong_network' && (
          <div className="p-4 rounded-xl bg-amber-500/12 border border-amber-500/25 text-xs text-amber-900 dark:text-amber-200 space-y-2">
            <div className="flex items-center gap-2 font-semibold">
              <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
              <span>Wrong Network Detected</span>
            </div>
            <button
              type="button"
              onClick={onSwitchNetwork}
              className="min-h-[38px] py-1.5 px-4 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-colors"
            >
              Switch to Polygon Amoy (80002)
            </button>
          </div>
        )}

        {state.address && (!isDeposit || (state.isCorrectNetwork && tokenConfigured)) ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center p-5 rounded-2xl bg-[var(--wallet-inset)] border border-[var(--wallet-border)] space-y-4">
              {qrCodeDataUrl ? (
                <div className="p-3 bg-white rounded-2xl shadow-2xs border border-slate-200">
                  <img
                    src={qrCodeDataUrl}
                    alt="Connected Wallet QR Code"
                    className="w-44 h-44 sm:w-52 sm:h-52"
                  />
                </div>
              ) : (
                <div className="w-44 h-44 sm:w-52 sm:h-52 flex items-center justify-center bg-[var(--wallet-surface)] rounded-2xl">
                  <RefreshCw className="h-5 w-5 text-[var(--wallet-muted)] animate-spin" />
                </div>
              )}

              <div className="text-center space-y-1 max-w-md">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--wallet-muted)]">
                  Your Polygon Amoy Receiving Address
                </span>
                <div className="font-mono text-xs sm:text-sm font-bold text-[var(--wallet-text)] break-all px-2 select-all">
                  {state.address}
                </div>
              </div>

              <button
                type="button"
                onClick={onCopyAddress}
                className="min-h-[42px] py-2 px-5 rounded-xl bg-[#007C8B] hover:bg-[#006673] text-white font-semibold text-xs inline-flex items-center gap-2 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Address Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span>Copy Address</span>
                  </>
                )}
              </button>
            </div>

            {isDeposit && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-medium text-emerald-900 dark:text-emerald-200">
                    Monitoring incoming {asset} transfers on Amoy
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onRefresh}
                  className="text-[#007C8B] dark:text-[#00E5F4] hover:underline font-semibold inline-flex items-center gap-1"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Check Now</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="py-10 px-4 text-center rounded-xl border border-dashed border-[var(--wallet-border)] bg-[var(--wallet-inset)] space-y-3">
            <Wallet className="h-7 w-7 mx-auto text-[#007C8B] dark:text-[#00E5F4]" />
            <h3 className="text-sm font-semibold text-[var(--wallet-text)]">
              {state.address ? 'Network or Token Setup Required' : 'Wallet Not Connected'}
            </h3>
            <p className="text-xs text-[var(--wallet-muted)] max-w-sm mx-auto">
              {state.address
                ? `Connect to Polygon Amoy (80002) with configured ${asset} to monitor deposits.`
                : 'Connect your MetaMask wallet to display your receiving address and QR code.'}
            </p>
            {!state.address && (
              <button
                type="button"
                onClick={onConnect}
                className="min-h-[42px] py-2 px-5 rounded-xl bg-[#007C8B] hover:bg-[#006673] text-white font-semibold text-xs transition-colors"
              >
                Connect Wallet
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
