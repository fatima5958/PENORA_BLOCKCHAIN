// src/lib/wallet/powerService.ts
// PENORA Blockchain — Power Up / Power Down & Voting Mana Execution Service
// Orchestrates non-custodial transactions via connected Web3 wallet and Polygon Amoy RPC.

import { formatEther, parseEther, encodeFunctionData } from 'viem';
import { publicClient, getEthereumProvider, penoraWalletService } from './walletService';
import {
  PENORA_CONTRACT_ADDRESSES,
  areContractsConfigured,
  PNR_TOKEN_ABI,
  POWER_ESCROW_ABI,
  VOTING_INFLUENCE_ABI,
  REWARD_DISTRIBUTOR_ABI,
} from './contracts';
import type { PowerDownInfo } from './types';

export class PenoraPowerService {
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

      // 1. Read liquid PNR balance
      const rawPnr = (await publicClient.readContract({
        address: pnrAddress,
        abi: PNR_TOKEN_ABI,
        functionName: 'balanceOf',
        args: [address],
      })) as bigint;

      // 2. Read locked PP balance
      const rawPp = (await publicClient.readContract({
        address: escrowAddress,
        abi: POWER_ESCROW_ABI,
        functionName: 'lockedPower',
        args: [address],
      })) as bigint;

      // 3. Read active Power Down schedule
      const rawSchedule = (await publicClient.readContract({
        address: escrowAddress,
        abi: POWER_ESCROW_ABI,
        functionName: 'powerDownSchedules',
        args: [address],
      })) as [bigint, bigint, bigint, bigint, bigint, boolean];

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
      let manaPercent = 100.0;
      if (influenceAddress !== '0x0000000000000000000000000000000000000000') {
        const rawMana = (await publicClient.readContract({
          address: influenceAddress,
          abi: VOTING_INFLUENCE_ABI,
          functionName: 'getCurrentMana',
          args: [address],
        })) as bigint;
        manaPercent = Number(rawMana) / 100.0; // 10,000 bps -> 100.00%
      }

      return {
        balancePnr: parseFloat(formatEther(rawPnr)).toFixed(4),
        balancePp: parseFloat(formatEther(rawPp)).toFixed(4),
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
  public async executePowerUp(amountPnr: string): Promise<`0x${string}`> {
    const eth = getEthereumProvider();
    if (!eth) throw new Error('MetaMask or Web3 wallet extension not detected.');

    const accounts = await eth.request({ method: 'eth_accounts' });
    if (!accounts || accounts.length === 0) throw new Error('Wallet not connected.');
    const userAddress = accounts[0];

    if (!areContractsConfigured()) {
      throw new Error(
        'PENORA Token and Escrow contracts are pending testnet deployment. Live token staking will open upon contract deployment.'
      );
    }

    const parsedAmount = parseEther(amountPnr);
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

      await eth.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: userAddress,
            to: pnrAddress,
            data: approveData,
          },
        ],
      });
    }

    // 3. Request Power Up deposit
    const powerUpData = encodeFunctionData({
      abi: POWER_ESCROW_ABI,
      functionName: 'powerUp',
      args: [parsedAmount],
    });

    const txHash = await eth.request({
      method: 'eth_sendTransaction',
      params: [
        {
          from: userAddress,
          to: escrowAddress,
          data: powerUpData,
        },
      ],
    });

    return txHash as `0x${string}`;
  }

  /**
   * Prompts user wallet to start a 13-week Power Down schedule.
   */
  public async executeStartPowerDown(amountPp: string): Promise<`0x${string}`> {
    const eth = getEthereumProvider();
    if (!eth) throw new Error('MetaMask or Web3 wallet extension not detected.');

    const accounts = await eth.request({ method: 'eth_accounts' });
    if (!accounts || accounts.length === 0) throw new Error('Wallet not connected.');
    const userAddress = accounts[0];

    if (!areContractsConfigured()) {
      throw new Error('PENORA Escrow contract is pending testnet deployment.');
    }

    const parsedAmount = parseEther(amountPp);
    if (parsedAmount <= 0n) throw new Error('Withdrawal amount must be greater than zero.');

    const escrowAddress = PENORA_CONTRACT_ADDRESSES.POWER_ESCROW as `0x${string}`;
    const data = encodeFunctionData({
      abi: POWER_ESCROW_ABI,
      functionName: 'startPowerDown',
      args: [parsedAmount],
    });

    const txHash = await eth.request({
      method: 'eth_sendTransaction',
      params: [
        {
          from: userAddress,
          to: escrowAddress,
          data,
        },
      ],
    });

    return txHash as `0x${string}`;
  }

  /**
   * Prompts user wallet to claim matured Power Down installments.
   */
  public async executeClaimInstallments(): Promise<`0x${string}`> {
    const eth = getEthereumProvider();
    if (!eth) throw new Error('MetaMask or Web3 wallet extension not detected.');

    const accounts = await eth.request({ method: 'eth_accounts' });
    if (!accounts || accounts.length === 0) throw new Error('Wallet not connected.');
    const userAddress = accounts[0];

    if (!areContractsConfigured()) {
      throw new Error('PENORA Escrow contract is pending testnet deployment.');
    }

    const escrowAddress = PENORA_CONTRACT_ADDRESSES.POWER_ESCROW as `0x${string}`;
    const data = encodeFunctionData({
      abi: POWER_ESCROW_ABI,
      functionName: 'claimInstallments',
      args: [],
    });

    const txHash = await eth.request({
      method: 'eth_sendTransaction',
      params: [
        {
          from: userAddress,
          to: escrowAddress,
          data,
        },
      ],
    });

    return txHash as `0x${string}`;
  }

  /**
   * Prompts user wallet to cancel unvested Power Down installments.
   */
  public async executeCancelPowerDown(): Promise<`0x${string}`> {
    const eth = getEthereumProvider();
    if (!eth) throw new Error('MetaMask or Web3 wallet extension not detected.');

    const accounts = await eth.request({ method: 'eth_accounts' });
    if (!accounts || accounts.length === 0) throw new Error('Wallet not connected.');
    const userAddress = accounts[0];

    if (!areContractsConfigured()) {
      throw new Error('PENORA Escrow contract is pending testnet deployment.');
    }

    const escrowAddress = PENORA_CONTRACT_ADDRESSES.POWER_ESCROW as `0x${string}`;
    const data = encodeFunctionData({
      abi: POWER_ESCROW_ABI,
      functionName: 'cancelPowerDown',
      args: [],
    });

    const txHash = await eth.request({
      method: 'eth_sendTransaction',
      params: [
        {
          from: userAddress,
          to: escrowAddress,
          data,
        },
      ],
    });

    return txHash as `0x${string}`;
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
