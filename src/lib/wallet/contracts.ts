import { isAddress, zeroAddress } from 'viem';

// src/lib/wallet/contracts.ts
// PENORA Blockchain — Smart Contract Addresses & Complete ABIs for Polygon Amoy Testnet (Chain ID 80002)

function getContractAddress(envKey: string, storageKey: string): string {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = localStorage.getItem(`penora_contract_${storageKey}`);
      if (stored && isAddress(stored) && stored.toLowerCase() !== zeroAddress) {
        return stored;
      }
    } catch {}
  }
  const envVal =
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.[envKey]) ||
    (typeof process !== 'undefined' && process.env?.[envKey]);
  return envVal || '0x0000000000000000000000000000000000000000';
}

export const PENORA_CONTRACT_ADDRESSES = {
  // Configured via environment variables or testnet deployer storage; defaults to zero address until live on-chain deployment
  get PNR_TOKEN(): string {
    return getContractAddress('PUBLIC_PNR_TOKEN_ADDRESS', 'PNR_TOKEN');
  },
  get POWER_ESCROW(): string {
    return getContractAddress('PUBLIC_PP_ESCROW_ADDRESS', 'POWER_ESCROW');
  },
  get VOTING_INFLUENCE(): string {
    return getContractAddress('PUBLIC_INFLUENCE_ADDRESS', 'VOTING_INFLUENCE');
  },
  get REWARD_VAULT(): string {
    return getContractAddress('PUBLIC_REWARD_VAULT_ADDRESS', 'REWARD_VAULT');
  },
  get REWARD_DISTRIBUTOR(): string {
    return getContractAddress('PUBLIC_REWARD_DISTRIBUTOR_ADDRESS', 'REWARD_DISTRIBUTOR');
  },
  get USDT_TOKEN(): string {
    return getContractAddress('PUBLIC_USDT_CONTRACT_ADDRESS', 'USDT_TOKEN');
  },
};

export function areContractsConfigured(): boolean {
  return (
    isConfiguredAddress(PENORA_CONTRACT_ADDRESSES.PNR_TOKEN) &&
    isConfiguredAddress(PENORA_CONTRACT_ADDRESSES.POWER_ESCROW)
  );
}

export function isConfiguredAddress(address: string): boolean {
  return isAddress(address) && address.toLowerCase() !== zeroAddress;
}

export function isUsdtConfigured(): boolean {
  return isConfiguredAddress(PENORA_CONTRACT_ADDRESSES.USDT_TOKEN);
}

// Verified USDT allowlist per network
export interface VerifiedTokenEntry {
  address: `0x${string}`;
  symbol: string;
  decimals: number;
  name: string;
  isTestnet: boolean;
}

export const VERIFIED_USDT_ALLOWLIST: Record<number, VerifiedTokenEntry[]> = {
  // Polygon Amoy Testnet (Chain ID 80002)
  80002: [
    ...(isUsdtConfigured()
      ? [
          {
            address: PENORA_CONTRACT_ADDRESSES.USDT_TOKEN.toLowerCase() as `0x${string}`,
            symbol: 'USDT',
            decimals: 6,
            name: 'Tether USD (Testnet Amoy)',
            isTestnet: true,
          },
        ]
      : []),
  ],
  // Polygon PoS Mainnet (Chain ID 137) - Official Tether PoS Deployment (Reference only, transactions blocked)
  137: [
    {
      address: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
      symbol: 'USDT',
      decimals: 6,
      name: 'Tether USD (PoS)',
      isTestnet: false,
    },
  ],
};

export function isTokenAddressAllowed(chainId: number, address: string): boolean {
  if (!isConfiguredAddress(address)) return false;
  const normalized = address.toLowerCase();

  // If Amoy testnet
  if (chainId === 80002) {
    if (
      isUsdtConfigured() &&
      PENORA_CONTRACT_ADDRESSES.USDT_TOKEN.toLowerCase() === normalized
    ) {
      return true;
    }
    const amoyTokens = VERIFIED_USDT_ALLOWLIST[80002] || [];
    return amoyTokens.some(t => t.address.toLowerCase() === normalized);
  }

  // Reject all other networks
  return false;
}

// ABI for ERC-20 PenoraToken (PNR)
export const PNR_TOKEN_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// ABI for PenoraPowerEscrow (PP Staking & 13-Week Power Down)
export const POWER_ESCROW_ABI = [
  { inputs: [], name: 'pnrToken', outputs: [{ name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'paused', outputs: [{ name: '', type: 'bool' }], stateMutability: 'view', type: 'function' },
  {
    inputs: [{ name: 'amount', type: 'uint256' }],
    name: 'powerUp',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'powerUpFor',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'amount', type: 'uint256' }],
    name: 'startPowerDown',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'claimInstallments',
    outputs: [{ name: 'claimedAmount', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'cancelPowerDown',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'lockedPower',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getAvailablePower',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'powerDownSchedules',
    outputs: [
      { name: 'totalAmount', type: 'uint256' },
      { name: 'weeklyInstallment', type: 'uint256' },
      { name: 'remainder', type: 'uint256' },
      { name: 'startTime', type: 'uint256' },
      { name: 'weeksClaimed', type: 'uint256' },
      { name: 'active', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getClaimableDetails',
    outputs: [
      { name: 'maturedWeeks', type: 'uint256' },
      { name: 'claimableWeeks', type: 'uint256' },
      { name: 'payout', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getNextUnlockTimestamp',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'verifySolvencyInvariant',
    outputs: [
      { name: 'isSolvent', type: 'bool' },
      { name: 'balance', type: 'uint256' },
      { name: 'liabilities', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// ABI for PenoraVotingInfluence (Mana & Content Score)
export const VOTING_INFLUENCE_ABI = [
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getCurrentMana',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'voter', type: 'address' },
      { name: 'voteWeightBps', type: 'uint256' },
    ],
    name: 'previewVoteInfluence',
    outputs: [
      { name: 'effectiveInfluence', type: 'uint256' },
      { name: 'postVoteManaBps', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'contentId', type: 'bytes32' },
      { name: 'voteWeightBps', type: 'uint256' },
      { name: 'isUpvote', type: 'bool' },
    ],
    name: 'recordContentVote',
    outputs: [{ name: 'influence', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

// ABI for PenoraRewardVault (40M Creator Reserve: 30M Scheduled + 10M Protected Reserve)
export const REWARD_VAULT_ABI = [
  {
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'releaseScheduledTokens',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getRemainingScheduledBudget',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'verifyVaultSolvency',
    outputs: [
      { name: 'isSolvent', type: 'bool' },
      { name: 'currentBalance', type: 'uint256' },
      { name: 'requiredReserve', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// ABI for PenoraRewardDistributor (Weekly Epochs & 48-Hour Review Settlement)
export const REWARD_DISTRIBUTOR_ABI = [
  {
    inputs: [
      { name: 'epochId', type: 'uint256' },
      { name: 'creator', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'merkleProof', type: 'bytes32[]' },
    ],
    name: 'claimCreatorReward',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'epochId', type: 'uint256' },
      { name: 'creator', type: 'address' },
    ],
    name: 'hasClaimed',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'epochId', type: 'uint256' }],
    name: 'getEpochStatus',
    outputs: [
      { name: 'exists', type: 'bool' },
      { name: 'isUnderReview', type: 'bool' },
      { name: 'claimableAt', type: 'uint256' },
      { name: 'isDisputed', type: 'bool' },
      { name: 'totalBudget', type: 'uint256' },
      { name: 'totalClaimed', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// Standard ERC-20 ABI for USDT / Testnet Stablecoins
export const ERC20_USDT_ABI = [
  {
    inputs: [],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    name: 'transferFrom',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'from', type: 'address' },
      { indexed: true, name: 'to', type: 'address' },
      { indexed: false, name: 'value', type: 'uint256' },
    ],
    name: 'Transfer',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'owner', type: 'address' },
      { indexed: true, name: 'spender', type: 'address' },
      { indexed: false, name: 'value', type: 'uint256' },
    ],
    name: 'Approval',
    type: 'event',
  },
] as const;
