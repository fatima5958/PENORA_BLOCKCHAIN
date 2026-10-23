import React from 'react';
import {
  Send,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { isAddress } from 'viem';
import { CreatorRecipientPicker } from './CreatorRecipientPicker';
import { isSpendableAmount } from '../../lib/wallet/amount';
import type { CreatorRecipient } from '../../lib/wallet/creatorRecipient';
import type { WalletState, UsdtGasEstimate } from '../../lib/wallet/types';

export interface SendSuccessReceipt {
  hash: string;
  explorerUrl: string;
  amount: string;
  recipient: string;
  status: 'confirmed' | 'pending';
  symbol: 'USDT' | 'PNR';
}

export interface WalletSendFlowProps {
  state: WalletState;
  asset: 'USDT' | 'PNR';
  onAssetChange: (asset: 'USDT' | 'PNR') => void;
  tokenBalance: string | null;
  tokenDecimals: number;
  tokenConfigured: boolean;
  sendRecipient: string;
  onRecipientChange: (recipient: string) => void;
  onCreatorSelect: (recipient: CreatorRecipient | null) => void;
  recipientPickerVersion: number;
  sendAmount: string;
  onAmountChange: (amount: string) => void;
  onMaxAmount: () => void;
  gasEstimate: UsdtGasEstimate | null;
  estimatingGas: boolean;
  gasError: string | null;
  sendLoading: boolean;
  reviewingTransfer: boolean;
  sendError: string | null;
  sendSuccessReceipt: SendSuccessReceipt | null;
  onReviewTransfer: () => void;
  onSwitchNetwork: () => void;
}

export const WalletSendFlow: React.FC<WalletSendFlowProps> = ({
  state,
  asset,
  onAssetChange,
  tokenBalance,
  tokenDecimals,
  tokenConfigured,
  sendRecipient,
  onRecipientChange,
  onCreatorSelect,
  recipientPickerVersion,
  sendAmount,
  onAmountChange,
  onMaxAmount,
  gasEstimate,
  estimatingGas,
  gasError,
  sendLoading,
  reviewingTransfer,
  sendError,
  sendSuccessReceipt,
  onReviewTransfer,
  onSwitchNetwork,
}) => {
  const canSubmit =
    state.status === 'connected' &&
    state.isCorrectNetwork &&
    tokenConfigured &&
    tokenBalance !== null &&
    !sendLoading &&
    !reviewingTransfer &&
    !estimatingGas &&
    Boolean(sendRecipient) &&
    isAddress(sendRecipient) &&
    isSpendableAmount(sendAmount, tokenBalance, tokenDecimals);

  return (
    <div className="max-w-2xl mx-auto">
      <section
        aria-label="Send tokens"
        className="rounded-2xl bg-[var(--wallet-surface)] border border-[var(--wallet-border)] p-5 sm:p-6 shadow-2xs space-y-5"
      >
        {/* Header & Step 1: Choose Token */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[var(--wallet-border)]">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-[#0A2540] text-[#00E5F4] flex items-center justify-center shrink-0">
              <Send className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[var(--wallet-text)]">
                Send {asset}
              </h2>
              <p className="text-xs text-[var(--wallet-muted)]">
                Transfer ERC-20 {asset} on Polygon Amoy testnet (80002)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="wallet-asset" className="text-xs font-semibold text-[var(--wallet-muted)]">
              Token
            </label>
            <select
              id="wallet-asset"
              value={asset}
              disabled={sendLoading || reviewingTransfer}
              onChange={e => onAssetChange(e.target.value as 'USDT' | 'PNR')}
              className="min-h-[40px] bg-[var(--wallet-inset)] border border-[var(--wallet-border)] rounded-xl px-3 py-1.5 text-xs font-semibold text-[var(--wallet-text)]"
            >
              <option value="PNR">PNR · Penora Token (18 dec)</option>
              <option value="USDT">USDT · MockUSDT (6 dec)</option>
            </select>
          </div>
        </div>

        {!tokenConfigured && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-900 dark:text-amber-200">
            {asset} transfers open after contract address configuration.
          </div>
        )}

        {/* Wrong Network Notice */}
        {state.status === 'wrong_network' && (
          <div className="p-4 rounded-xl bg-amber-500/12 border border-amber-500/25 text-xs text-amber-900 dark:text-amber-200 space-y-2">
            <div className="flex items-center gap-2 font-semibold">
              <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
              <span>Wrong Network Detected</span>
            </div>
            <p className="text-[11px] opacity-90">
              Switch your wallet to Polygon Amoy Testnet (Chain ID: 80002) before sending tokens.
            </p>
            <button
              type="button"
              onClick={onSwitchNetwork}
              className="min-h-[38px] py-1.5 px-4 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-colors"
            >
              Switch to Polygon Amoy (80002)
            </button>
          </div>
        )}

        {/* Confirmed / Pending Receipt */}
        {sendSuccessReceipt && (
          <div className="p-4 rounded-xl bg-emerald-500/12 border border-emerald-500/25 text-xs text-emerald-900 dark:text-emerald-200 space-y-2">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                {sendSuccessReceipt.status === 'confirmed'
                  ? 'Transfer Confirmed on Polygon Amoy'
                  : 'Transfer Submitted — Confirmation Pending'}
              </span>
            </div>
            <p className="text-[11px]">
              {sendSuccessReceipt.status === 'confirmed' ? 'Sent' : 'Submitted'}{' '}
              <strong className="font-mono">
                {sendSuccessReceipt.amount} {sendSuccessReceipt.symbol}
              </strong>{' '}
              to <span className="font-mono break-all">{sendSuccessReceipt.recipient}</span>.
            </p>
            <a
              href={sendSuccessReceipt.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-[#007C8B] dark:text-[#00E5F4] hover:underline"
            >
              <span>View Receipt on PolygonScan</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}

        {/* Error Alert */}
        {sendError && (
          <div
            role="alert"
            className="p-3 rounded-xl bg-red-500/12 border border-red-500/25 text-xs text-red-700 dark:text-red-300 flex items-start gap-2"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{sendError}</span>
          </div>
        )}

        {/* Step 2: Verified Creator Lookup OR Direct Wallet Address */}
        <div className="space-y-4">
          <CreatorRecipientPicker
            key={`${state.address}:${asset}:${recipientPickerVersion}`}
            disabled={sendLoading || reviewingTransfer}
            onSelect={onCreatorSelect}
          />

          <div className="space-y-1.5">
            <label
              htmlFor="wallet-send-recipient"
              className="text-xs font-semibold text-[var(--wallet-text)] block"
            >
              Or enter a wallet address (Polygon Amoy)
            </label>
            <input
              id="wallet-send-recipient"
              type="text"
              placeholder="0x..."
              value={sendRecipient}
              disabled={sendLoading || reviewingTransfer}
              onChange={e => onRecipientChange(e.target.value)}
              className={`w-full min-h-[44px] py-2.5 px-3.5 rounded-xl border text-xs font-mono focus:outline-hidden ${
                sendRecipient && !isAddress(sendRecipient)
                  ? 'border-red-400 bg-red-500/5'
                  : 'border-[var(--wallet-border)] bg-[var(--wallet-inset)] focus:border-[#007C8B]'
              }`}
            />
            {sendRecipient && !isAddress(sendRecipient) && (
              <span className="text-[11px] text-red-600 dark:text-red-400 block">
                Enter a valid 42-character 0x hexadecimal address.
              </span>
            )}
          </div>

          {/* Step 3: Transfer Amount */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label
                htmlFor="wallet-send-amount"
                className="font-semibold text-[var(--wallet-text)]"
              >
                Transfer Amount
              </label>
              <span className="text-[11px] text-[var(--wallet-muted)]">
                Available:{' '}
                <strong className="font-mono text-[var(--wallet-text)]">
                  {tokenBalance !== null ? `${tokenBalance} ${asset}` : `— ${asset}`}
                </strong>
              </span>
            </div>
            <div className="relative">
              <input
                id="wallet-send-amount"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={sendAmount}
                disabled={sendLoading || reviewingTransfer}
                onChange={e => onAmountChange(e.target.value)}
                className="w-full min-h-[44px] py-2.5 px-3.5 pr-24 rounded-xl border border-[var(--wallet-border)] bg-[var(--wallet-inset)] focus:border-[#007C8B] text-sm font-mono tabular-nums"
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onMaxAmount}
                  disabled={!tokenBalance || sendLoading || reviewingTransfer}
                  className="px-2 py-1 rounded-md bg-[#007C8B]/15 hover:bg-[#007C8B]/25 text-[#007C8B] dark:text-[#00E5F4] text-[10px] font-bold uppercase transition-colors"
                >
                  Max
                </button>
                <span className="text-xs font-semibold text-[var(--wallet-muted)]">{asset}</span>
              </div>
            </div>
          </div>

          {/* Step 4: Gas Fee Estimation */}
          <div className="p-3.5 rounded-xl bg-[var(--wallet-inset)] border border-[var(--wallet-border)] space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[var(--wallet-text)]">Estimated Network Fee</span>
              <span className="text-[11px] text-[var(--wallet-muted)]">
                {estimatingGas ? (
                  <span className="inline-flex items-center gap-1">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    <span>Estimating gas…</span>
                  </span>
                ) : gasEstimate ? (
                  <span className="font-mono font-semibold text-[#007C8B] dark:text-[#00E5F4]">
                    ~{parseFloat(gasEstimate.estimatedCostPol).toFixed(6)} POL ({gasEstimate.estimatedCostGwei} Gwei)
                  </span>
                ) : (
                  <span>Enter recipient &amp; amount</span>
                )}
              </span>
            </div>

            {gasError && (
              <p className="text-[11px] text-red-600 dark:text-red-400">{gasError}</p>
            )}

            <p className="text-[11px] text-[var(--wallet-muted)]">
              Polygon Amoy gas fees are paid in native <strong>Test POL</strong> (Your balance:{' '}
              <strong className="font-mono">{state.balancePol ?? '—'} POL</strong>).
            </p>
          </div>

          {/* Review Button */}
          <button
            type="button"
            onClick={onReviewTransfer}
            disabled={!canSubmit}
            className="w-full min-h-[46px] py-3 px-4 rounded-xl bg-[#007C8B] hover:bg-[#006673] disabled:bg-[var(--wallet-inset)] disabled:text-[var(--wallet-muted)] text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
          >
            <Send className="h-3.5 w-3.5" />
            <span>{reviewingTransfer ? 'Reviewing Transfer…' : 'Review Transfer'}</span>
          </button>
        </div>
      </section>
    </div>
  );
};
