// src/lib/voting/votingClient.ts
// Weighted Voting & Influence Client for PENORA
// Interacts with PenoraVotingInfluence, PenoraPowerEscrow, and PenoraPowerDelegation on Polygon Amoy (80002)

import { parseAbi, encodeFunctionData, keccak256, toHex, type Hex } from 'viem';
import { getEthereumProvider } from '../wallet/walletService';
import { PENORA_CONTRACT_ADDRESSES, isConfiguredAddress } from '../wallet/contracts';

export const VOTING_INFLUENCE_ABI = parseAbi([
  'function getCurrentMana(address user) view returns (uint256)',
  'function previewVoteInfluence(address voter, uint256 voteWeightBps) view returns (uint256 effectiveInfluence, uint256 postVoteManaBps)',
  'function recordContentVote(bytes32 contentId, uint256 voteWeightBps, bool isUpvote) external returns (uint256 influence)',
  'function hasVotedOnContent(bytes32 contentId, address voter) view returns (bool)',
  'event VoteInfluenceCast(bytes32 indexed contentId, address indexed voter, uint256 voteWeightBps, uint256 remainingManaBps, uint256 effectiveInfluence, int8 direction)',
]);

export const POWER_ESCROW_ABI = parseAbi([
  'function getAvailablePower(address user) view returns (uint256)',
  'function lockedPower(address user) view returns (uint256)',
]);

export const POWER_DELEGATION_ABI = parseAbi([
  'function getEffectiveVotingPower(address user) view returns (uint256)',
  'function totalDelegatedOut(address user) view returns (uint256)',
  'function totalReceivedPower(address user) view returns (uint256)',
  'function getAvailableToDelegate(address user) view returns (uint256)',
]);

export interface VoterPowerState {
  hasWallet: boolean;
  walletAddress: string | null;
  totalPowerPnr: number;
  availablePowerPnr: number;
  delegatedOutPnr: number;
  receivedPowerPnr: number;
  effectivePowerPnr: number;
  manaPercent: number; // 0 to 100
  manaBps: number;     // 0 to 10000
  isEligibleForFinancialVoting: boolean;
}

export const MAX_MANA_BPS = 10_000;
export const VOTE_COST_DIVISOR = 50; // 100% weight consumes 2% of current mana

/**
 * Calculates consumed mana basis points for a given vote weight.
 * Formula matches PenoraVotingInfluence.sol: (currentMana * voteWeightBps) / (10000 * 50)
 */
export function calculateManaConsumptionBps(currentManaBps: number, weightPercent: number): number {
  const weightBps = Math.min(10000, Math.max(100, Math.round(weightPercent * 100)));
  return Math.floor((currentManaBps * weightBps) / (MAX_MANA_BPS * VOTE_COST_DIVISOR));
}

/**
 * Calculates theoretical influence score.
 * Formula matches PenoraVotingInfluence.sol: (effectivePP * voteWeightBps * currentMana) / (10000 * 10000)
 */
export function calculateInfluenceScore(effectivePP: number, weightPercent: number, manaPercent: number): number {
  const weightFraction = Math.min(1, Math.max(0.01, weightPercent / 100));
  const manaFraction = Math.min(1, Math.max(0, manaPercent / 100));
  return effectivePP * weightFraction * manaFraction;
}

/**
 * Converts a content slug or UUID into a 32-byte content ID hash.
 */
export function contentToBytes32(contentId: string): Hex {
  return keccak256(toHex(contentId));
}

/**
 * Fetches the voter's active voting power, delegated power, and regenerating mana.
 */
export async function fetchVoterPowerState(accountAddress?: string | null): Promise<VoterPowerState> {
  const defaultState: VoterPowerState = {
    hasWallet: false,
    walletAddress: null,
    totalPowerPnr: 0,
    availablePowerPnr: 0,
    delegatedOutPnr: 0,
    receivedPowerPnr: 0,
    effectivePowerPnr: 0,
    manaPercent: 100,
    manaBps: 10000,
    isEligibleForFinancialVoting: false,
  };

  const eth = getEthereumProvider();
  if (!eth) return defaultState;

  let address = accountAddress;
  if (!address) {
    try {
      const accounts = await eth.request({ method: 'eth_accounts' });
      if (accounts && accounts.length > 0) address = accounts[0];
    } catch {
      return defaultState;
    }
  }

  if (!address) return defaultState;
  defaultState.hasWallet = true;
  defaultState.walletAddress = address;

  // Check if contracts are configured
  const escrowAddr = PENORA_CONTRACT_ADDRESSES.POWER_ESCROW;
  const influenceAddr = PENORA_CONTRACT_ADDRESSES.VOTING_INFLUENCE;
  const delegationAddr = (PENORA_CONTRACT_ADDRESSES as any).POWER_DELEGATION;

  if (!isConfiguredAddress(escrowAddr)) {
    return defaultState;
  }

  try {
    // 1. Read escrow available power
    const escrowData = encodeFunctionData({
      abi: POWER_ESCROW_ABI,
      functionName: 'getAvailablePower',
      args: [address as `0x${string}`],
    });
    const escrowRes = await eth.request({
      method: 'eth_call',
      params: [{ to: escrowAddr as `0x${string}`, data: escrowData }, 'latest'],
    });
    const availablePPWei = typeof escrowRes === 'string' && escrowRes !== '0x' ? BigInt(escrowRes) : 0n;
    const availablePPPnr = Number(availablePPWei) / 1e18;

    let delegatedOutPnr = 0;
    let receivedPowerPnr = 0;
    let effectivePowerPnr = availablePPPnr;

    // 2. Read delegation if configured
    if (isConfiguredAddress(delegationAddr)) {
      try {
        const effData = encodeFunctionData({
          abi: POWER_DELEGATION_ABI,
          functionName: 'getEffectiveVotingPower',
          args: [address as `0x${string}`],
        });
        const effRes = await eth.request({
          method: 'eth_call',
          params: [{ to: delegationAddr as `0x${string}`, data: effData }, 'latest'],
        });
        if (typeof effRes === 'string' && effRes !== '0x') {
          effectivePowerPnr = Number(BigInt(effRes)) / 1e18;
        }

        const delOutData = encodeFunctionData({
          abi: POWER_DELEGATION_ABI,
          functionName: 'totalDelegatedOut',
          args: [address as `0x${string}`],
        });
        const delOutRes = await eth.request({
          method: 'eth_call',
          params: [{ to: delegationAddr as `0x${string}`, data: delOutData }, 'latest'],
        });
        if (typeof delOutRes === 'string' && delOutRes !== '0x') {
          delegatedOutPnr = Number(BigInt(delOutRes)) / 1e18;
        }

        const recData = encodeFunctionData({
          abi: POWER_DELEGATION_ABI,
          functionName: 'totalReceivedPower',
          args: [address as `0x${string}`],
        });
        const recRes = await eth.request({
          method: 'eth_call',
          params: [{ to: delegationAddr as `0x${string}`, data: recData }, 'latest'],
        });
        if (typeof recRes === 'string' && recRes !== '0x') {
          receivedPowerPnr = Number(BigInt(recRes)) / 1e18;
        }
      } catch {}
    }

    // 3. Read Mana from Voting Influence contract
    let manaBps = 10000;
    if (isConfiguredAddress(influenceAddr)) {
      try {
        const manaData = encodeFunctionData({
          abi: VOTING_INFLUENCE_ABI,
          functionName: 'getCurrentMana',
          args: [address as `0x${string}`],
        });
        const manaRes = await eth.request({
          method: 'eth_call',
          params: [{ to: influenceAddr as `0x${string}`, data: manaData }, 'latest'],
        });
        if (typeof manaRes === 'string' && manaRes !== '0x') {
          manaBps = Number(BigInt(manaRes));
        }
      } catch {}
    }

    return {
      hasWallet: true,
      walletAddress: address,
      totalPowerPnr: availablePPPnr + delegatedOutPnr,
      availablePowerPnr: availablePPPnr,
      delegatedOutPnr,
      receivedPowerPnr,
      effectivePowerPnr,
      manaPercent: Math.round((manaBps / 10000) * 100),
      manaBps,
      isEligibleForFinancialVoting: effectivePowerPnr > 0 && manaBps > 0,
    };
  } catch {
    return defaultState;
  }
}

/**
 * Casts an on-chain content curation vote with chosen weight.
 */
export async function castOnChainCurationVote(params: {
  contentRawId: string;
  weightPercent: number;
  isUpvote: boolean;
  onProgress?: (msg: string) => void;
}): Promise<{ success: boolean; txHash?: string; influence?: bigint; error?: string }> {
  const eth = getEthereumProvider();
  if (!eth) {
    return { success: false, error: 'Wallet not detected. Connect an EVM wallet to cast on-chain votes.' };
  }

  const influenceAddr = PENORA_CONTRACT_ADDRESSES.VOTING_INFLUENCE;
  if (!isConfiguredAddress(influenceAddr)) {
    return {
      success: false,
      error: 'PENORA Voting Influence contract is not yet deployed on Polygon Amoy. Cast standard social vote instead.',
    };
  }

  try {
    params.onProgress?.('Verifying Polygon Amoy network...');
    const chainIdHex = await eth.request({ method: 'eth_chainId' });
    if (parseInt(chainIdHex, 16) !== 80002) {
      return { success: false, error: 'Incorrect network. Please switch to Polygon Amoy Testnet (Chain ID 80002).' };
    }

    const accounts = await eth.request({ method: 'eth_accounts' });
    if (!accounts || accounts.length === 0) {
      return { success: false, error: 'No wallet accounts connected.' };
    }
    const voter = accounts[0] as `0x${string}`;

    const contentIdBytes = contentToBytes32(params.contentRawId);
    const weightBps = Math.min(10000, Math.max(100, Math.round(params.weightPercent * 100)));

    params.onProgress?.('Awaiting wallet signature...');
    const data = encodeFunctionData({
      abi: VOTING_INFLUENCE_ABI,
      functionName: 'recordContentVote',
      args: [contentIdBytes, BigInt(weightBps), params.isUpvote],
    });

    const txHash = await eth.request({
      method: 'eth_sendTransaction',
      params: [{ from: voter, to: influenceAddr as `0x${string}`, data }],
    });

    params.onProgress?.(`Vote broadcast (${txHash.slice(0, 10)}...). Waiting for confirmation...`);

    // Poll for receipt
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const receipt = await eth.request({ method: 'eth_getTransactionReceipt', params: [txHash] });
      if (receipt && receipt.blockNumber) {
        if (receipt.status === '0x0') {
          return { success: false, txHash, error: 'On-chain vote transaction reverted.' };
        }
        return { success: true, txHash };
      }
    }

    return { success: true, txHash };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Vote transaction failed or rejected.';
    return { success: false, error: msg };
  }
}
