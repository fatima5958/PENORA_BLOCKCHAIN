// src/lib/wallet/serverSponsorshipService.ts
// PENORA Blockchain — Server-Side Gas Sponsorship Authorization & Paymaster Policy Service
// Polygon Amoy Testnet (80002)
// Prototype policy simulation only; live authorization fails closed.
// Process-local quotas are not durable authorization or production replay protection.

import {
  isAddress,
  type Address,
  type Hex,
} from 'viem';
import { validateContractCalldata, type CalldataValidationResult } from './calldataValidator';
import {
  DEFAULT_AMOY_SPONSORSHIP_QUOTA,
  type SponsorshipQuota,
} from './gasSponsorshipService';

export interface SponsorshipAuthRequest {
  username: string;
  senderAddress: Address;
  smartAccountAddress?: Address;
  targetAddress: Address;
  calldata: Hex;
  value?: bigint | string;
  nonce?: bigint | number;
  gasLimit?: bigint;
  maxFeePerGas?: bigint;
}

export interface SponsorshipAuthResponse {
  authorized: boolean;
  reason?: string;
  validationResult?: CalldataValidationResult;
  paymasterAndData?: Hex;
  authToken?: Hex;
  validUntil?: number;
  quotaRemainingToday: number;
}

export interface SponsorshipPolicyEvaluation {
  eligible: boolean;
  reason?: string;
  validationResult?: CalldataValidationResult;
  quotaRemainingToday: number;
}

interface ServerLedgerEntry {
  timestamps: number[];
  lastNonce: bigint;
}

// In-memory simulation ledger; resets on process restart and differs across instances.
const serverLedger = new Map<string, ServerLedgerEntry>();

export function resetServerSponsorshipLedger(): void {
  serverLedger.clear();
}

/** Never issue spend authorization from an unverified username or local policy simulation.
 * Live grants require authenticated wallet ownership, durable atomic quotas/replay
 * protection, and a real paymaster signing the complete UserOperation.
 */
export async function authorizeSponsorship(
  _req: SponsorshipAuthRequest,
  _quota: SponsorshipQuota = DEFAULT_AMOY_SPONSORSHIP_QUOTA
): Promise<SponsorshipAuthResponse> {
  return {
    authorized: false,
    reason: 'Gas sponsorship unavailable: authenticated ownership, durable quotas and a verified paymaster are not integrated. Native Test POL is required.',
    quotaRemainingToday: 0,
  };
}

/** Testnet policy simulation only. Eligibility is not permission to spend sponsor funds. */
export async function evaluateSponsorshipPolicy(
  req: SponsorshipAuthRequest,
  quota: SponsorshipQuota = DEFAULT_AMOY_SPONSORSHIP_QUOTA
): Promise<SponsorshipPolicyEvaluation> {
  const { username, senderAddress, targetAddress, calldata, value = 0n, nonce } = req;

  // 1. Identity validation
  const cleanUser = (username || '').trim().toLowerCase().replace(/^@/, '');
  if (!cleanUser) {
    return { eligible: false, reason: 'Authenticated PENORA user identifier required.', quotaRemainingToday: 0 };
  }

  if (!senderAddress || !isAddress(senderAddress)) {
    return { eligible: false, reason: 'Valid sender address required.', quotaRemainingToday: 0 };
  }

  if (!targetAddress || !isAddress(targetAddress)) {
    return { eligible: false, reason: 'Valid target contract address required.', quotaRemainingToday: 0 };
  }

  // 2. Calldata & Decoded ABI validation
  const calldataResult = validateContractCalldata({
    to: targetAddress,
    data: calldata,
    value,
    senderAddress,
  });

  if (!calldataResult.valid) {
    return {
      eligible: false,
      reason: calldataResult.reason || 'Calldata verification failed against authorized PENORA contracts.',
      validationResult: calldataResult,
      quotaRemainingToday: 0,
    };
  }

  // 3. Gas limits and fee caps
  if (req.gasLimit && req.gasLimit > quota.maxGasLimitPerTx) {
    return {
      eligible: false,
      reason: `Requested gas limit exceeds server cap (${quota.maxGasLimitPerTx.toString()}).`,
      quotaRemainingToday: 0,
    };
  }

  if (req.maxFeePerGas && req.maxFeePerGas > quota.maxFeePerGasWei) {
    return {
      eligible: false,
      reason: `Gas fee exceeds server Amoy cap (${quota.maxFeePerGasWei.toString()} wei).`,
      quotaRemainingToday: 0,
    };
  }

  // 4. Rate Limiting & Nonce Tracking
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  const userKey = `${cleanUser}:${senderAddress.toLowerCase()}`;
  let entry = serverLedger.get(userKey);
  if (!entry) {
    entry = { timestamps: [], lastNonce: -1n };
    serverLedger.set(userKey, entry);
  }

  // Prune expired timestamps
  entry.timestamps = entry.timestamps.filter(t => t > oneDayAgo);

  const hourlyCount = entry.timestamps.filter(t => t > oneHourAgo).length;
  const dailyCount = entry.timestamps.length;
  const quotaRemaining = Math.max(0, quota.maxDailyRequests - dailyCount);

  if (hourlyCount >= quota.maxHourlyRequests) {
    return {
      eligible: false,
      reason: `Hourly rate limit exceeded (${hourlyCount}/${quota.maxHourlyRequests}).`,
      quotaRemainingToday: quotaRemaining,
    };
  }

  if (dailyCount >= quota.maxDailyRequests) {
    return {
      eligible: false,
      reason: `Daily sponsorship quota reached (${quota.maxDailyRequests}/${quota.maxDailyRequests}).`,
      quotaRemainingToday: 0,
    };
  }

  // Nonce replay check
  if (nonce !== undefined) {
    const bigNonce = BigInt(nonce);
    if (bigNonce <= entry.lastNonce) {
      return {
        eligible: false,
        reason: `Invalid or replayed nonce (${bigNonce.toString()} <= ${entry.lastNonce.toString()}).`,
        quotaRemainingToday: quotaRemaining,
      };
    }
    entry.lastNonce = bigNonce;
  }

  // Record quota usage
  entry.timestamps.push(now);

  return {
    eligible: true,
    validationResult: calldataResult,
    quotaRemainingToday: quotaRemaining - 1,
  };
}
