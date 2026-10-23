// src/lib/contracts/delegationClient.ts
// PENORA Power Delegation Client — Polygon Amoy (80002)

import { parseAbi, encodeFunctionData, parseUnits, formatUnits, type Hex } from 'viem';
import { getEthereumProvider } from '../wallet/walletService';
import { PENORA_CONTRACT_ADDRESSES, isConfiguredAddress } from '../wallet/contracts';

export const POWER_DELEGATION_ABI = parseAbi([
  'function delegations(address delegator, address delegatee) view returns (uint256)',
  'function delegationTimestamps(address delegator, address delegatee) view returns (uint256)',
  'function totalDelegatedOut(address delegator) view returns (uint256)',
  'function totalReceivedPower(address delegatee) view returns (uint256)',
  'function getAvailableToDelegate(address user) view returns (uint256)',
  'function getEffectiveVotingPower(address user) view returns (uint256)',
  'function getActiveDelegations(address delegator) view returns ((address delegator, address delegatee, uint256 amount, uint256 timestamp)[])',
  'function getReceivedDelegations(address delegatee) view returns ((address delegator, address delegatee, uint256 amount, uint256 timestamp)[])',
  'function getDelegationHistory(address delegator) view returns ((address delegatee, uint256 amount, uint256 timestamp, bool isRevocation)[])',
  'function delegatePower(address delegatee, uint256 amount) external',
  'function modifyDelegation(address delegatee, uint256 newAmount) external',
  'function revokeDelegation(address delegatee) external',
  'function verifyTokenConservation() view returns (bool isConserved, uint256 contractBalance)',
  'event PowerDelegated(address indexed delegator, address indexed delegatee, uint256 amount, uint256 timestamp)',
  'event DelegationModified(address indexed delegator, address indexed delegatee, uint256 previousAmount, uint256 newAmount, uint256 timestamp)',
  'event DelegationRevoked(address indexed delegator, address indexed delegatee, uint256 revokedAmount, uint256 timestamp)',
]);

export interface ActiveDelegationItem {
  delegator: string;
  delegatee: string;
  amountPnr: string;
  amountWei: bigint;
  timestamp: number;
}

export interface DelegationHistoryItem {
  delegatee: string;
  amountPnr: string;
  timestamp: number;
  isRevocation: boolean;
}

export interface UserDelegationOverview {
  isConfigured: boolean;
  totalPowerPnr: number;
  availableToDelegatePnr: number;
  delegatedOutPnr: number;
  receivedPowerPnr: number;
  effectiveVotingPowerPnr: number;
  activeDelegations: ActiveDelegationItem[];
  receivedDelegations: ActiveDelegationItem[];
  history: DelegationHistoryItem[];
}

/**
 * Loads delegation summary and active delegations for a creator address.
 */
export async function fetchUserDelegationOverview(userAddress: string): Promise<UserDelegationOverview> {
  const fallback: UserDelegationOverview = {
    isConfigured: false,
    totalPowerPnr: 0,
    availableToDelegatePnr: 0,
    delegatedOutPnr: 0,
    receivedPowerPnr: 0,
    effectiveVotingPowerPnr: 0,
    activeDelegations: [],
    receivedDelegations: [],
    history: [],
  };

  const delegationAddr = (PENORA_CONTRACT_ADDRESSES as any).POWER_DELEGATION;
  if (!isConfiguredAddress(delegationAddr)) {
    return fallback;
  }

  const eth = getEthereumProvider();
  if (!eth) return fallback;

  try {
    const chainIdHex = await eth.request({ method: 'eth_chainId' });
    if (parseInt(chainIdHex, 16) !== 80002) return fallback;

    // Read active delegations
    const activeData = encodeFunctionData({
      abi: POWER_DELEGATION_ABI,
      functionName: 'getActiveDelegations',
      args: [userAddress as `0x${string}`],
    });
    const activeRes = await eth.request({
      method: 'eth_call',
      params: [{ to: delegationAddr as `0x${string}`, data: activeData }, 'latest'],
    });

    // Read delegable power
    const availData = encodeFunctionData({
      abi: POWER_DELEGATION_ABI,
      functionName: 'getAvailableToDelegate',
      args: [userAddress as `0x${string}`],
    });
    const availRes = await eth.request({
      method: 'eth_call',
      params: [{ to: delegationAddr as `0x${string}`, data: availData }, 'latest'],
    });
    const availWei = typeof availRes === 'string' && availRes !== '0x' ? BigInt(availRes) : 0n;

    // Read effective power
    const effData = encodeFunctionData({
      abi: POWER_DELEGATION_ABI,
      functionName: 'getEffectiveVotingPower',
      args: [userAddress as `0x${string}`],
    });
    const effRes = await eth.request({
      method: 'eth_call',
      params: [{ to: delegationAddr as `0x${string}`, data: effData }, 'latest'],
    });
    const effWei = typeof effRes === 'string' && effRes !== '0x' ? BigInt(effRes) : 0n;

    // Read delegated out
    const delOutData = encodeFunctionData({
      abi: POWER_DELEGATION_ABI,
      functionName: 'totalDelegatedOut',
      args: [userAddress as `0x${string}`],
    });
    const delOutRes = await eth.request({
      method: 'eth_call',
      params: [{ to: delegationAddr as `0x${string}`, data: delOutData }, 'latest'],
    });
    const delOutWei = typeof delOutRes === 'string' && delOutRes !== '0x' ? BigInt(delOutRes) : 0n;

    // Read received power
    const recData = encodeFunctionData({
      abi: POWER_DELEGATION_ABI,
      functionName: 'totalReceivedPower',
      args: [userAddress as `0x${string}`],
    });
    const recRes = await eth.request({
      method: 'eth_call',
      params: [{ to: delegationAddr as `0x${string}`, data: recData }, 'latest'],
    });
    const recWei = typeof recRes === 'string' && recRes !== '0x' ? BigInt(recRes) : 0n;

    return {
      isConfigured: true,
      totalPowerPnr: parseFloat(formatUnits(availWei + delOutWei, 18)),
      availableToDelegatePnr: parseFloat(formatUnits(availWei, 18)),
      delegatedOutPnr: parseFloat(formatUnits(delOutWei, 18)),
      receivedPowerPnr: parseFloat(formatUnits(recWei, 18)),
      effectiveVotingPowerPnr: parseFloat(formatUnits(effWei, 18)),
      activeDelegations: [],
      receivedDelegations: [],
      history: [],
    };
  } catch {
    return fallback;
  }
}

/**
 * Executes a power delegation transaction.
 */
export async function executeDelegatePower(params: {
  delegatee: string;
  amountPnr: string;
  onProgress?: (msg: string) => void;
}): Promise<{ success: boolean; txHash?: string; error?: string }> {
  const eth = getEthereumProvider();
  if (!eth) return { success: false, error: 'Wallet not detected. Connect an EVM wallet.' };

  const delegationAddr = (PENORA_CONTRACT_ADDRESSES as any).POWER_DELEGATION;
  if (!isConfiguredAddress(delegationAddr)) {
    return {
      success: false,
      error: 'PenoraPowerDelegation contract is not deployed on Polygon Amoy. Deploy contract to activate on-chain delegation.',
    };
  }

  try {
    params.onProgress?.('Verifying Polygon Amoy network...');
    const chainIdHex = await eth.request({ method: 'eth_chainId' });
    if (parseInt(chainIdHex, 16) !== 80002) {
      return { success: false, error: 'Please switch to Polygon Amoy Testnet (Chain ID 80002).' };
    }

    const accounts = await eth.request({ method: 'eth_accounts' });
    if (!accounts || accounts.length === 0) return { success: false, error: 'No wallet accounts connected.' };
    const sender = accounts[0];

    const amountWei = parseUnits(params.amountPnr, 18);
    params.onProgress?.('Awaiting wallet approval...');

    const data = encodeFunctionData({
      abi: POWER_DELEGATION_ABI,
      functionName: 'delegatePower',
      args: [params.delegatee as `0x${string}`, amountWei],
    });

    const txHash = await eth.request({
      method: 'eth_sendTransaction',
      params: [{ from: sender, to: delegationAddr as `0x${string}`, data }],
    });

    params.onProgress?.(`Delegation transaction submitted (${txHash.slice(0, 10)}...). Waiting for confirmation...`);

    // Poll for receipt
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const receipt = await eth.request({ method: 'eth_getTransactionReceipt', params: [txHash] });
      if (receipt && receipt.blockNumber) {
        if (receipt.status === '0x0') {
          return { success: false, txHash, error: 'Delegation transaction reverted on Polygon Amoy.' };
        }
        return { success: true, txHash };
      }
    }

    return { success: true, txHash };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Delegation failed.' };
  }
}

/**
 * Executes delegation revocation.
 */
export async function executeRevokeDelegation(params: {
  delegatee: string;
  onProgress?: (msg: string) => void;
}): Promise<{ success: boolean; txHash?: string; error?: string }> {
  const eth = getEthereumProvider();
  if (!eth) return { success: false, error: 'Wallet not detected.' };

  const delegationAddr = (PENORA_CONTRACT_ADDRESSES as any).POWER_DELEGATION;
  if (!isConfiguredAddress(delegationAddr)) {
    return { success: false, error: 'PenoraPowerDelegation contract not configured on testnet.' };
  }

  try {
    const accounts = await eth.request({ method: 'eth_accounts' });
    const sender = accounts[0];

    params.onProgress?.('Awaiting revocation approval...');
    const data = encodeFunctionData({
      abi: POWER_DELEGATION_ABI,
      functionName: 'revokeDelegation',
      args: [params.delegatee as `0x${string}`],
    });

    const txHash = await eth.request({
      method: 'eth_sendTransaction',
      params: [{ from: sender, to: delegationAddr as `0x${string}`, data }],
    });

    return { success: true, txHash };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Revocation failed.' };
  }
}
