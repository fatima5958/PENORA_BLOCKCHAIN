// src/lib/wallet/txLifecycle.ts
// Unified 7-state transaction lifecycle model for PENORA Wallet (Phase 21)

import { POLYGON_AMOY_CONFIG } from './chain';

export type WalletTxLifecycleStatus =
  | 'idle'
  | 'preparing'
  | 'awaiting_approval'
  | 'submitted'
  | 'confirming'
  | 'confirmed'
  | 'failed'
  | 'unknown';

export interface WalletTxLifecycleState {
  status: WalletTxLifecycleStatus;
  label: string;
  description: string;
  hash?: string | null;
  explorerUrl?: string | null;
  error?: string | null;
}

export const TX_LIFECYCLE_LABELS: Record<Exclude<WalletTxLifecycleStatus, 'idle'>, string> = {
  preparing: 'Preparing',
  awaiting_approval: 'Awaiting wallet approval',
  submitted: 'Submitted',
  confirming: 'Confirming',
  confirmed: 'Confirmed',
  failed: 'Failed',
  unknown: 'Unknown / Needs verification',
};

export function buildTxExplorerUrl(hash?: string | null): string | null {
  if (!hash || !hash.startsWith('0x')) return null;
  return `${POLYGON_AMOY_CONFIG.blockExplorers[0]}/tx/${hash}`;
}

export function createTxLifecycleState(
  status: WalletTxLifecycleStatus,
  options?: {
    description?: string;
    hash?: string | null;
    error?: string | null;
  }
): WalletTxLifecycleState {
  const hash = options?.hash ?? null;
  const explorerUrl = buildTxExplorerUrl(hash);

  switch (status) {
    case 'preparing':
      return {
        status,
        label: TX_LIFECYCLE_LABELS.preparing,
        description:
          options?.description || 'Validating parameters, network state, and gas estimate…',
        hash,
        explorerUrl,
      };
    case 'awaiting_approval':
      return {
        status,
        label: TX_LIFECYCLE_LABELS.awaiting_approval,
        description:
          options?.description ||
          'Please review and approve the transaction signature in your wallet.',
        hash,
        explorerUrl,
      };
    case 'submitted':
      return {
        status,
        label: TX_LIFECYCLE_LABELS.submitted,
        description:
          options?.description || 'Transaction broadcast to Polygon Amoy. Waiting for block inclusion…',
        hash,
        explorerUrl,
      };
    case 'confirming':
      return {
        status,
        label: TX_LIFECYCLE_LABELS.confirming,
        description:
          options?.description ||
          'Verifying on-chain transaction receipt on Polygon Amoy (80002)…',
        hash,
        explorerUrl,
      };
    case 'confirmed':
      return {
        status,
        label: TX_LIFECYCLE_LABELS.confirmed,
        description:
          options?.description || 'On-chain transaction receipt verified on Polygon Amoy.',
        hash,
        explorerUrl,
      };
    case 'failed':
      return {
        status,
        label: TX_LIFECYCLE_LABELS.failed,
        description:
          options?.error ||
          options?.description ||
          'Transaction failed or was rejected in wallet.',
        hash,
        explorerUrl,
        error: options?.error || null,
      };
    case 'unknown':
      return {
        status,
        label: TX_LIFECYCLE_LABELS.unknown,
        description:
          options?.description ||
          'Receipt confirmation timed out. Verify transaction status on PolygonScan before retrying.',
        hash,
        explorerUrl,
        error: options?.error || null,
      };
    default:
      return {
        status: 'idle',
        label: 'Ready',
        description: '',
        hash: null,
        explorerUrl: null,
      };
  }
}
