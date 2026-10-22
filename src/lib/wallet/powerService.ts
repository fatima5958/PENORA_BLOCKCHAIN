// src/lib/wallet/powerService.ts
// PENORA Blockchain — Power Up / Power Down & Voting Mana Execution Service
// Orchestrates non-custodial transactions via connected Web3 wallet and Polygon Amoy RPC.

import { formatEther, encodeFunctionData } from 'viem';
import { publicClient, getEthereumProvider } from './walletService';
import {
  PENORA_CONTRACT_ADDRESSES,
  areContractsConfigured,
  isConfiguredAddress,
  PNR_TOKEN_ABI,
  POWER_ESCROW_ABI,
  VOTING_INFLUENCE_ABI,
} from './contracts';
import { parseTokenAmount } from './amount';
import { waitForWalletTransaction } from './transactionReceipt';
import { PENORA_TARGET_CHAIN_ID } from './chain';
import { pendingPowerTransaction, confirmedPowerTransaction, savePowerTransaction, reconcilePowerTransactions, type PowerAction } from './powerTransactions';
import type { PowerDownInfo } from './types';

export class PowerTransactionPendingError extends Error {
  constructor(public readonly hash: `0x${string}`) {
    super(`Transaction submitted; confirmation is pending. Check history before retrying: ${hash}`);
    this.name = 'PowerTransactionPendingError';
  }
}

export class PenoraPowerService {
  private isSubmitting = false;

  private async requireAccount(expectedAddress?: string): Promise<`0x${string}`> {
    const eth = getEthereumProvider();
    if (!eth) throw new Error('MetaMask or Web3 wallet extension not detected.');
    const accounts = await eth.request({ method: 'eth_accounts' });
    if (!accounts?.length) throw new Error('Wallet not connected.');
    const chainId = await eth.request({ method: 'eth_chainId' });
    if (Number(chainId) !== PENORA_TARGET_CHAIN_ID) {
      throw new Error('Please switch to Polygon Amoy Testnet before continuing.');
    }
    if (expectedAddress && accounts[0].toLowerCase() !== expectedAddress.toLowerCase()) {
      throw new Error('Wallet account changed. Please review the transaction again.');
    }
    return accounts[0] as `0x${string}`;
  }

  private async submitConfirmed(from: string, to: string, data: `0x${string}`, type: PowerAction, amount?: string): Promise<`0x${string}`> {
    // Approval may take time: recheck the account and network before each signature.
    const activeAccount = await this.requireAccount();
    if (activeAccount.toLowerCase() !== from.toLowerCase()) {
      throw new Error('Wallet account changed. Please review the transaction again.');
    }
    const hash = await getEthereumProvider().request({
      method: 'eth_sendTransaction', params: [{ from, to, data }],
    }) as `0x${string}`;
    const pending = pendingPowerTransaction(from, hash, type, amount);
    const result = await waitForWalletTransaction(hash);
    if (result.status === 'pending') {
      savePowerTransaction(from, { ...pending, hash: result.hash, explorerUrl: undefined });
      throw new PowerTransactionPendingError(result.hash);
    }
    const updated = result.status === 'confirmed' && result.receipt
      ? confirmedPowerTransaction(pending, result.receipt, result.hash)
      : { ...pending, hash: result.hash, status: 'failed' as const };
    savePowerTransaction(from, updated);
    if (updated.status !== 'confirmed') throw new Error(`Transaction reverted, cancelled or expected action was not confirmed: ${result.hash}`);
    return result.hash;
  }

  private async withSubmission<T>(action: () => Promise<T>): Promise<T> {
    if (this.isSubmitting) throw new Error('A power transaction is already in progress.');
    this.isSubmitting = true;
    try { return await action(); } finally { this.isSubmitting = false; }
  }

  private async validatePowerContracts(user: `0x${string}`) {
    const pending = await reconcilePowerTransactions(user);
    if (pending.some(tx => tx.status === 'pending')) {
      throw new Error('A previous power transaction is still pending. Refresh history and confirm its outcome before retrying.');
    }
    const [decimals, token, paused] = await Promise.all([
      publicClient.readContract({ address: PENORA_CONTRACT_ADDRESSES.PNR_TOKEN as `0x${string}`, abi: PNR_TOKEN_ABI, functionName: 'decimals' }),
      publicClient.readContract({ address: PENORA_CONTRACT_ADDRESSES.POWER_ESCROW as `0x${string}`, abi: POWER_ESCROW_ABI, functionName: 'pnrToken' }),
      publicClient.readContract({ address: PENORA_CONTRACT_ADDRESSES.POWER_ESCROW as `0x${string}`, abi: POWER_ESCROW_ABI, functionName: 'paused' }),
    ]);
    if (Number(decimals) !== 18 || String(token).toLowerCase() !== PENORA_CONTRACT_ADDRESSES.PNR_TOKEN.toLowerCase()) {
      throw new Error('PNR and staking contract configuration do not match. Staking was not submitted.');
    }
    if (paused) throw new Error('Staking is paused onchain. Please try again after it resumes.');
  }

  /**
   * Refreshes on-chain PNR, PP, and Power Down state for a connected address.
   */
  public async fetchPowerState(address: `0x${string}`): Promise<{
    balancePnr: string | null;
    balancePp: string | null;
    votingManaPercent: number | null;
    powerDownSchedule: PowerDownInfo | null;
    contractsDeployed: boolean;
  }> {
    if (!areContractsConfigured()) {
      return {
        balancePnr: null,
        balancePp: null,
        votingManaPercent: null,
        powerDownSchedule: null,
        contractsDeployed: false,
      };
    }

    try {
      const pnrAddress = PENORA_CONTRACT_ADDRESSES.PNR_TOKEN as `0x${string}`;
      const escrowAddress = PENORA_CONTRACT_ADDRESSES.POWER_ESCROW as `0x${string}`;
      const influenceAddress = PENORA_CONTRACT_ADDRESSES.VOTING_INFLUENCE as `0x${string}`;

      const [rawPnr, rawPp, rawSchedule, decimals, escrowToken] = await Promise.all([
        publicClient.readContract({ address: pnrAddress, abi: PNR_TOKEN_ABI, functionName: 'balanceOf', args: [address] }),
        publicClient.readContract({ address: escrowAddress, abi: POWER_ESCROW_ABI, functionName: 'getAvailablePower', args: [address] }),
        publicClient.readContract({ address: escrowAddress, abi: POWER_ESCROW_ABI, functionName: 'powerDownSchedules', args: [address] }),
        publicClient.readContract({ address: pnrAddress, abi: PNR_TOKEN_ABI, functionName: 'decimals' }),
        publicClient.readContract({ address: escrowAddress, abi: POWER_ESCROW_ABI, functionName: 'pnrToken' }),
      ]);
      if (Number(decimals) !== 18 || escrowToken.toLowerCase() !== pnrAddress.toLowerCase()) throw new Error('Staking configuration mismatch');

      let powerDownSchedule: PowerDownInfo | null = null;
      if (rawSchedule && rawSchedule[5]) {
        // Schedule is active
        const totalAmount = formatEther(rawSchedule[0]);
        const weeklyInstallment = formatEther(rawSchedule[1]);
        const startTime = Number(rawSchedule[3]);
        const weeksClaimed = Number(rawSchedule[4]);

        // Query claimable details
        const claimableDetails = (await publicClient.readContract({
          address: escrowAddress,
          abi: POWER_ESCROW_ABI,
          functionName: 'getClaimableDetails',
          args: [address],
        })) as [bigint, bigint, bigint];

        const nextUnlock = (await publicClient.readContract({
          address: escrowAddress,
          abi: POWER_ESCROW_ABI,
          functionName: 'getNextUnlockTimestamp',
          args: [address],
        })) as bigint;

        powerDownSchedule = {
          totalAmount,
          weeklyInstallment,
          weeksClaimed,
          totalWeeks: 13,
          startTime,
          nextUnlockTimestamp: Number(nextUnlock),
          claimableAmount: formatEther(claimableDetails[2]),
          claimableWeeks: Number(claimableDetails[1]),
          active: true,
        };
      }

      // 4. Read voting mana
      let manaPercent: number | null = null;
      if (isConfiguredAddress(influenceAddress)) {
        // Mana is optional: its outage must not hide verified stake or a withdrawal schedule.
        try {
          const rawMana = await publicClient.readContract({
            address: influenceAddress, abi: VOTING_INFLUENCE_ABI,
            functionName: 'getCurrentMana', args: [address],
          }) as bigint;
          manaPercent = Number(rawMana) / 100;
        } catch { manaPercent = null; }
      }

      return {
        balancePnr: formatEther(rawPnr),
        balancePp: formatEther(rawPp),
        votingManaPercent: manaPercent,
        powerDownSchedule,
        contractsDeployed: true,
      };
    } catch {
      return {
        balancePnr: null,
        balancePp: null,
        votingManaPercent: null,
        powerDownSchedule: null,
        contractsDeployed: false,
      };
    }
  }

  /**
   * Prompts user wallet to execute Power Up (approve + deposit).
   */
  public async executePowerUp(amountPnr: string, expectedAddress?: string): Promise<`0x${string}`> {
    return this.withSubmission(async () => {
      const userAddress = await this.requireAccount(expectedAddress);

      if (!areContractsConfigured()) {
        throw new Error(
          'PENORA Token and Escrow contracts are pending testnet deployment. Live token staking will open upon contract deployment.'
        );
      }

      await this.validatePowerContracts(userAddress);
      const parsedAmount = parseTokenAmount(amountPnr, 18);
      const liquid = await publicClient.readContract({ address: PENORA_CONTRACT_ADDRESSES.PNR_TOKEN as `0x${string}`, abi: PNR_TOKEN_ABI, functionName: 'balanceOf', args: [userAddress] }) as bigint;
      if (liquid < parsedAmount) throw new Error('Insufficient liquid PNR for Power Up.');
      if (parsedAmount <= 0n) throw new Error('Deposit amount must be greater than zero.');

      const pnrAddress = PENORA_CONTRACT_ADDRESSES.PNR_TOKEN as `0x${string}`;
      const escrowAddress = PENORA_CONTRACT_ADDRESSES.POWER_ESCROW as `0x${string}`;

      // 1. Check current allowance
      const currentAllowance = (await publicClient.readContract({
        address: pnrAddress,
        abi: PNR_TOKEN_ABI,
        functionName: 'allowance',
        args: [userAddress as `0x${string}`, escrowAddress],
      })) as bigint;

      // 2. Request approve if allowance is insufficient
      if (currentAllowance < parsedAmount) {
        const approveData = encodeFunctionData({
          abi: PNR_TOKEN_ABI,
          functionName: 'approve',
          args: [escrowAddress, parsedAmount],
        });

        await this.submitConfirmed(userAddress, pnrAddress, approveData, 'approve_pnr', formatEther(parsedAmount));

        const approved = await publicClient.readContract({
          address: pnrAddress, abi: PNR_TOKEN_ABI, functionName: 'allowance',
          args: [userAddress, escrowAddress],
        }) as bigint;
        if (approved < parsedAmount) throw new Error('Token approval was not granted. Power Up was not submitted.');
      }

      // 3. Request Power Up deposit
      const powerUpData = encodeFunctionData({
        abi: POWER_ESCROW_ABI,
        functionName: 'powerUp',
        args: [parsedAmount],
      });

      return this.submitConfirmed(userAddress, escrowAddress, powerUpData, 'power_up', formatEther(parsedAmount));
    });
  }

  /**
   * Prompts user wallet to start a 13-week Power Down schedule.
   */
  public async executeStartPowerDown(amountPp: string, expectedAddress?: string): Promise<`0x${string}`> {
    return this.withSubmission(async () => {
      const userAddress = await this.requireAccount(expectedAddress);

      if (!areContractsConfigured()) {
        throw new Error('PENORA Escrow contract is pending testnet deployment.');
      }

      await this.validatePowerContracts(userAddress);
      const parsedAmount = parseTokenAmount(amountPp, 18);
      const available = await publicClient.readContract({ address: PENORA_CONTRACT_ADDRESSES.POWER_ESCROW as `0x${string}`, abi: POWER_ESCROW_ABI, functionName: 'getAvailablePower', args: [userAddress] }) as bigint;
      if (available < parsedAmount) throw new Error('Insufficient available PP for Power Down.');
      const schedule = await publicClient.readContract({ address: PENORA_CONTRACT_ADDRESSES.POWER_ESCROW as `0x${string}`, abi: POWER_ESCROW_ABI, functionName: 'powerDownSchedules', args: [userAddress] });
      if (schedule[5]) throw new Error('A Power Down schedule is already active. Cancel it before starting another.');
      if (parsedAmount <= 0n) throw new Error('Withdrawal amount must be greater than zero.');

      const escrowAddress = PENORA_CONTRACT_ADDRESSES.POWER_ESCROW as `0x${string}`;
      const data = encodeFunctionData({
        abi: POWER_ESCROW_ABI,
        functionName: 'startPowerDown',
        args: [parsedAmount],
      });

      return this.submitConfirmed(userAddress, escrowAddress, data, 'power_down', formatEther(parsedAmount));
    });
  }

  /**
   * Prompts user wallet to claim matured Power Down installments.
   */
  public async executeClaimInstallments(expectedAddress?: string): Promise<`0x${string}`> {
    return this.withSubmission(async () => {
      const userAddress = await this.requireAccount(expectedAddress);

      if (!areContractsConfigured()) {
        throw new Error('PENORA Escrow contract is pending testnet deployment.');
      }

      await this.validatePowerContracts(userAddress);
      const escrowAddress = PENORA_CONTRACT_ADDRESSES.POWER_ESCROW as `0x${string}`;
      const claimable = await publicClient.readContract({ address: escrowAddress, abi: POWER_ESCROW_ABI, functionName: 'getClaimableDetails', args: [userAddress] }) as [bigint, bigint, bigint];
      if (!claimable[1]) throw new Error('No matured installments are available to claim.');
      const data = encodeFunctionData({
        abi: POWER_ESCROW_ABI,
        functionName: 'claimInstallments',
        args: [],
      });

      return this.submitConfirmed(userAddress, escrowAddress, data, 'claim_installment');
    });
  }

  /**
   * Prompts user wallet to cancel unvested Power Down installments.
   */
  public async executeCancelPowerDown(expectedAddress?: string): Promise<`0x${string}`> {
    return this.withSubmission(async () => {
      const userAddress = await this.requireAccount(expectedAddress);

      if (!areContractsConfigured()) {
        throw new Error('PENORA Escrow contract is pending testnet deployment.');
      }

      await this.validatePowerContracts(userAddress);
      const escrowAddress = PENORA_CONTRACT_ADDRESSES.POWER_ESCROW as `0x${string}`;
      const schedule = await publicClient.readContract({ address: escrowAddress, abi: POWER_ESCROW_ABI, functionName: 'powerDownSchedules', args: [userAddress] });
      if (!schedule[5]) throw new Error('There is no active Power Down schedule to cancel.');
      const data = encodeFunctionData({
        abi: POWER_ESCROW_ABI,
        functionName: 'cancelPowerDown',
        args: [],
      });

      return this.submitConfirmed(userAddress, escrowAddress, data, 'cancel_power_down');
    });
  }

  /**
   * Educational / mathematical formula for Voting Mana recovery over 5 days (432,000s).
   */
  public calculateManaRecovery(
    currentManaBps: number,
    elapsedSeconds: number
  ): {
    updatedManaBps: number;
    updatedManaPercent: number;
    secondsUntilFull: number;
  } {
    const MAX_BPS = 10000;
    const REGEN_SECONDS = 432000; // 5 days

    const regeneratedBps = Math.floor((elapsedSeconds * MAX_BPS) / REGEN_SECONDS);
    const updatedManaBps = Math.min(MAX_BPS, currentManaBps + regeneratedBps);
    const remainingToRegen = MAX_BPS - updatedManaBps;
    const secondsUntilFull = Math.ceil((remainingToRegen * REGEN_SECONDS) / MAX_BPS);

    return {
      updatedManaBps,
      updatedManaPercent: updatedManaBps / 100,
      secondsUntilFull,
    };
  }
}

export const penoraPowerService = new PenoraPowerService();
