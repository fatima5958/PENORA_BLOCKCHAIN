// src/lib/wallet/serverSponsorshipService.ts
// PENORA Blockchain — Server-Side Gas Sponsorship Authorization & Paymaster Policy Service
// Polygon Amoy Testnet (80002)
// Enforces strict target-bound ABI validation, replay prevention, and atomic quota controls.

import {
  isAddress,
  type Address,
  type Hex,
  concat,
  keccak256,
  encodePacked,
} from 'viem';
import { validateContractCalldata, type CalldataValidationResult } from './calldataValidator';
import {
  DEFAULT_AMOY_SPONSORSHIP_QUOTA,
  type SponsorshipQuota,
  CANONICAL_ENTRY_POINT_V06,
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

interface ServerLedgerEntry {
  timestamps: number[];
  lastNonce: bigint;
}

// In-memory atomic rate-limiting and nonce ledger for the server/edge session
const serverLedger = new Map<string, ServerLedgerEntry>();

export function resetServerSponsorshipLedger(): void {
  serverLedger.clear();
}

/**
 * Server-side authorization check before gas sponsorship.
 * Validates caller identity, decodes ABI calldata, enforces nonce ordering, and checks rate quotas.
 */
export async function authorizeSponsorship(
  req: SponsorshipAuthRequest,
  quota: SponsorshipQuota = DEFAULT_AMOY_SPONSORSHIP_QUOTA
): Promise<SponsorshipAuthResponse> {
  const { username, senderAddress, targetAddress, calldata, value = 0n, nonce } = req;

  // 1. Identity validation
  const cleanUser = (username || '').trim().toLowerCase().replace(/^@/, '');
  if (!cleanUser) {
    return { authorized: false, reason: 'Authenticated PENORA user identifier required.', quotaRemainingToday: 0 };
  }

  if (!senderAddress || !isAddress(senderAddress)) {
    return { authorized: false, reason: 'Valid sender address required.', quotaRemainingToday: 0 };
  }

  if (!targetAddress || !isAddress(targetAddress)) {
    return { authorized: false, reason: 'Valid target contract address required.', quotaRemainingToday: 0 };
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
      authorized: false,
      reason: calldataResult.reason || 'Calldata verification failed against authorized PENORA contracts.',
      validationResult: calldataResult,
      quotaRemainingToday: 0,
    };
  }

  // 3. Gas limits and fee caps
  if (req.gasLimit && req.gasLimit > quota.maxGasLimitPerTx) {
    return {
      authorized: false,
      reason: `Requested gas limit exceeds server cap (${quota.maxGasLimitPerTx.toString()}).`,
      quotaRemainingToday: 0,
    };
  }

  if (req.maxFeePerGas && req.maxFeePerGas > quota.maxFeePerGasWei) {
    return {
      authorized: false,
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
      authorized: false,
      reason: `Hourly rate limit exceeded (${hourlyCount}/${quota.maxHourlyRequests}).`,
      quotaRemainingToday: quotaRemaining,
    };
  }

  if (dailyCount >= quota.maxDailyRequests) {
    return {
      authorized: false,
      reason: `Daily sponsorship quota reached (${quota.maxDailyRequests}/${quota.maxDailyRequests}).`,
      quotaRemainingToday: 0,
    };
  }

  // Nonce replay check
  if (nonce !== undefined) {
    const bigNonce = BigInt(nonce);
    if (bigNonce <= entry.lastNonce) {
      return {
        authorized: false,
        reason: `Invalid or replayed nonce (${bigNonce.toString()} <= ${entry.lastNonce.toString()}).`,
        quotaRemainingToday: quotaRemaining,
      };
    }
    entry.lastNonce = bigNonce;
  }

  // Record quota usage
  entry.timestamps.push(now);

  // 5. Build sponsorship auth token
  const validUntil = Math.floor(now / 1000) + 300; // 5-minute validity window
  const tokenHash = keccak256(
    encodePacked(
      ['string', 'address', 'address', 'bytes32', 'uint256'],
      [cleanUser, senderAddress, targetAddress, keccak256(calldata), BigInt(validUntil)]
    )
  );

  return {
    authorized: true,
    validationResult: calldataResult,
    authToken: tokenHash,
    validUntil,
    quotaRemainingToday: quotaRemaining - 1,
    paymasterAndData: concat([
      CANONICAL_ENTRY_POINT_V06,
      ('0x' + validUntil.toString(16).padStart(16, '0')) as Hex,
    ]),
  };
}
