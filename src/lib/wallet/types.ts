// src/lib/wallet/types.ts
// PENORA Blockchain — Typed Wallet Architecture (Polygon Amoy / Hybrid V1)

export type WalletStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'wrong_network'
  | 'loading'
  | 'error';

export interface WalletNetwork {
  id: number;
  name: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorers: string[];
  testnet: boolean;
}

export interface PowerDownInfo {
  totalAmount: string;
  weeklyInstallment: string;
  weeksClaimed: number;
  totalWeeks: number;
  startTime: number;
  nextUnlockTimestamp: number;
  claimableAmount: string;
  claimableWeeks: number;
  active: boolean;
}

export interface WalletState {
  status: WalletStatus;
  address: `0x${string}` | null;
  chainId: number | null;
  error: string | null;
  balancePol: string | null;
  balancePnr: string | null;
  balancePp: string | null;
  balanceUsdt: string | null;
  usdtDecimals: number;
  isUsdtConfigured: boolean;
  votingManaPercent: number | null;
  powerDownSchedule: PowerDownInfo | null;
  isCorrectNetwork: boolean;
  contractsDeployed: boolean;
}

export interface WalletTransaction {
  id: string;
  hash: string;
  type:
    | 'deposit_usdt'
    | 'send_usdt'
    | 'reward_claim'
    | 'curation_payout'
    | 'transfer_in'
    | 'transfer_out'
    | 'power_up'
    | 'power_down'
    | 'claim_installment';
  amount: string;
  symbol: string;
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: string;
  from?: string;
  to?: string;
  explorerUrl?: string;
}

export interface PenoraRewardSummary {
  unclaimedPnr: string;
  curationRewardPnr: string;
  authorRewardPnr: string;
  estimatedUsd: string;
  isTokenLive: boolean;
}

export interface UsdtGasEstimate {
  gasLimit: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  estimatedCostPol: string;
  estimatedCostGwei: string;
}

export interface SendUsdtParams {
  recipient: `0x${string}`;
  amount: string;
}
