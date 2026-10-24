// src/lib/wallet/gasSponsorshipService.ts
// PENORA Blockchain — Zero-Gas & Sponsored Transaction Architecture Module
// Polygon Amoy Testnet (Chain ID 80002)
// Clean separation of non-custodial signer, rate-limiting, allowlisting, and ERC-4337 Smart Account abstraction.

import {
  isAddress,
  type Address,
  type Hex,
  concat,
  keccak256,
  encodePacked,
  encodeAbiParameters,
  parseAbiParameters,
} from 'viem';
import { PENORA_CONTRACT_ADDRESSES, isConfiguredAddress } from './contracts';
import { PENORA_TARGET_CHAIN_ID } from './chain';
import { validateContractCalldata } from './calldataValidator';

export interface SponsorshipQuota {
  maxDailyRequests: number;
  maxHourlyRequests: number;
  maxGasLimitPerTx: bigint;
  maxFeePerGasWei: bigint;
  maxSponsorshipValueUsd: number;
}

export const DEFAULT_AMOY_SPONSORSHIP_QUOTA: SponsorshipQuota = {
  maxDailyRequests: 20,
  maxHourlyRequests: 5,
  maxGasLimitPerTx: 500_000n,
  maxFeePerGasWei: 50_000_000_000n, // 50 Gwei cap on Amoy
  maxSponsorshipValueUsd: 1.0,
};

export const MAX_SAFE_PNR_ALLOWANCE = 100_000_000n * 10n ** 18n; // 100M PNR (Total Fixed Supply)
export const MAX_SAFE_USDT_ALLOWANCE = 10_000_000n * 10n ** 6n; // 10M USDT (10M $ bound)
export const UNLIMITED_ALLOWANCE_SENTINEL = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

export interface SponsorshipPolicyCheckResult {
  eligible: boolean;
  reason?: string;
  smartAccountAddress?: Address;
  quotaRemainingToday: number;
}

export interface UserOperationV06 {
  sender: Address;
  nonce: bigint;
  initCode: Hex;
  callData: Hex;
  callGasLimit: bigint;
  verificationGasLimit: bigint;
  preVerificationGas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  paymasterAndData: Hex;
  signature: Hex;
}

export interface UserOpReceipt {
  userOpHash: Hex;
  entryPoint: Address;
  sender: Address;
  nonce: bigint;
  paymaster?: Address;
  actualGasCost: bigint;
  actualGasUsed: bigint;
  success: boolean;
  receipt: {
    transactionHash: Hex;
    blockNumber: bigint;
    status: 'success' | 'reverted';
  };
}

// Canonical ERC-4337 EntryPoint v0.6 address on Polygon Amoy
export const CANONICAL_ENTRY_POINT_V06: Address = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';
// Canonical SimpleAccountFactory on Polygon Amoy
export const CANONICAL_SIMPLE_ACCOUNT_FACTORY: Address = '0x9406Cc6185a34B98050053954705574c8C1BE90B';

// Approved PENORA contract function signatures and 4-byte selectors
export const APPROVED_PENORA_SELECTORS: Record<string, string> = {
  // ERC20 transfers & approvals
  '0xa9059cbb': 'transfer(address,uint256)',
  '0x095ea7b3': 'approve(address,uint256)',
  '0x23b872dd': 'transferFrom(address,address,uint256)',
  '0x42966c68': 'burn(uint256)',

  // PenoraExchange
  '0x40993b26': 'buy(uint256,uint256,uint256)',
  '0x34fcf437': 'setRate(uint256)',
  '0x8456cb59': 'pause()',
  '0x3f4ba83a': 'unpause()',
  '0xd9caed12': 'withdraw(address,address,uint256)',

  // PenoraPowerEscrow
  '0x9a6bd379': 'powerUp(uint256)',
  '0x00fa8e46': 'powerUpFor(address,uint256)',
  '0x68d097bd': 'startPowerDown(uint256)',
  '0x0eb5ce25': 'claimInstallments()',
  '0x42539325': 'claimInstallment()',
  '0x8b7c23fb': 'cancelPowerDown()',

  // PenoraPowerDelegation / Voting
  '0x026e402b': 'delegate(address,uint256)',
  '0xda8be864': 'undelegate(address)',

  // PenoraP2PEscrow
  '0xed037642': 'createOffer(uint256,uint256,uint8)',
  '0xbefe00bd': 'buyOffer(uint256,uint256)',
  '0xed653164': 'releaseEscrow(uint256)',
  '0xef706adf': 'cancelOffer(uint256)',
  '0xb563153c': 'disputeEscrow(uint256)',

  // Reward Distributor
  '0x2c525b5b': 'claimDailyReward(bytes)',
};

// In-memory rate limiting ledger: tracks timestamped sponsorship requests per user
interface UserSponsorshipHistory {
  timestamps: number[];
}

const sponsorshipLedger = new Map<string, UserSponsorshipHistory>();

/**
 * Resets the in-memory sponsorship rate limiting ledger (for tests and session clearance).
 */
export function resetSponsorshipLedger(): void {
  sponsorshipLedger.clear();
}

/**
 * Checks whether an approve call specifies an unsafe unlimited allowance.
 * Rejects uint256.max and any amount greater than the contract's total supply.
 */
export function isSafeBoundedAllowance(to: Address, dataHex: string): { isSafe: boolean; amount?: bigint; reason?: string } {
  if (!dataHex.startsWith('0x095ea7b3') || dataHex.length < 138) {
    return { isSafe: true }; // Not an approval call
  }
  try {
    const amountHex = '0x' + dataHex.slice(74, 138);
    const amount = BigInt(amountHex);
    if (amount === UNLIMITED_ALLOWANCE_SENTINEL) {
      return { isSafe: false, amount, reason: 'Unlimited token allowances (type(uint256).max) are strictly prohibited for wallet security.' };
    }
    const maxSafe = to.toLowerCase() === PENORA_CONTRACT_ADDRESSES.USDT_TOKEN.toLowerCase()
      ? MAX_SAFE_USDT_ALLOWANCE
      : MAX_SAFE_PNR_ALLOWANCE;
    if (amount > maxSafe) {
      return { isSafe: false, amount, reason: `Requested allowance (${amount.toString()}) exceeds safe limit (${maxSafe.toString()}).` };
    }
    return { isSafe: true, amount };
  } catch {
    return { isSafe: false, reason: 'Malformed approval calldata parameter.' };
  }
}

/**
 * Derives a deterministic ERC-4337 Smart Account address (SimpleAccount CREATE2)
 * from the owner's secp256k1 derived EOA address on Polygon Amoy.
 * Factory address and initialization code hash follow standard ERC-4337 v0.6 / v0.7.
 */
export function deriveDeterministicSmartAccountAddress(
  ownerAddress: Address,
  salt = 0n,
  factoryAddress: Address = CANONICAL_SIMPLE_ACCOUNT_FACTORY
): Address {
  if (!isAddress(ownerAddress)) {
    throw new Error('Valid owner address required for smart account derivation.');
  }

  const saltHex = ('0x' + salt.toString(16).padStart(64, '0')) as Hex;

  // SimpleAccount initialization bytecode hash
  const initCodeHash = keccak256(
    encodePacked(['address', 'bytes32'], [ownerAddress, saltHex])
  );

  // CREATE2 formula: keccak256(0xff ++ factory ++ salt ++ initCodeHash)[12..31]
  const create2Hash = keccak256(
    concat([
      '0xff' as Hex,
      factoryAddress,
      saltHex,
      initCodeHash,
    ])
  );

  return ('0x' + create2Hash.slice(26)) as Address;
}

/**
 * Builds the ERC-4337 v0.6 initCode for deploying a SimpleAccount on first transaction.
 */
export function buildSimpleAccountInitCode(
  ownerAddress: Address,
  salt = 0n,
  factoryAddress: Address = CANONICAL_SIMPLE_ACCOUNT_FACTORY
): Hex {
  // createAccount(address owner, uint256 salt) selector: 0x5fbfb9cf
  const createAccountCalldata = encodePacked(
    ['bytes4', 'address', 'uint256'],
    ['0x5fbfb9cf', ownerAddress, salt]
  );
  return concat([factoryAddress, createAccountCalldata]);
}

/**
 * Computes canonical ERC-4337 v0.6 UserOperation hash for signing.
 */
export function computeUserOpHash(
  userOp: UserOperationV06,
  entryPoint: Address = CANONICAL_ENTRY_POINT_V06,
  chainId = PENORA_TARGET_CHAIN_ID
): Hex {
  const packedUserOp = encodeAbiParameters(
    parseAbiParameters('address, uint256, bytes32, bytes32, uint256, uint256, uint256, uint256, uint256, bytes32'),
    [
      userOp.sender,
      userOp.nonce,
      keccak256(userOp.initCode),
      keccak256(userOp.callData),
      userOp.callGasLimit,
      userOp.verificationGasLimit,
      userOp.preVerificationGas,
      userOp.maxFeePerGas,
      userOp.maxPriorityFeePerGas,
      keccak256(userOp.paymasterAndData),
    ]
  );
  const userOpHash = keccak256(packedUserOp);
  const enc = encodeAbiParameters(
    parseAbiParameters('bytes32, address, uint256'),
    [userOpHash, entryPoint, BigInt(chainId)]
  );
  return keccak256(enc);
}

/**
 * Evaluates whether an Amoy testnet transaction is eligible for gas sponsorship
 * under PENORA security, rate-limiting, and quota rules.
 */
export function evaluateTransactionSponsorship({
  username,
  from,
  to,
  data,
  value,
  gasLimit,
  maxFeePerGas,
  quota = DEFAULT_AMOY_SPONSORSHIP_QUOTA,
}: {
  username: string;
  from: Address;
  to: Address;
  data?: Hex | string;
  value?: bigint | string;
  gasLimit?: bigint;
  maxFeePerGas?: bigint;
  quota?: SponsorshipQuota;
}): SponsorshipPolicyCheckResult {
  const cleanUser = username.trim().toLowerCase().replace(/^@/, '');
  if (!cleanUser) {
    return { eligible: false, reason: 'Authenticated PENORA user required for sponsorship.', quotaRemainingToday: 0 };
  }

  if (!isAddress(from) || !isAddress(to)) {
    return { eligible: false, reason: 'Valid sender and destination addresses required.', quotaRemainingToday: 0 };
  }

  // 1-4. Target-bound calldata validation, ABI decoding, bounded allowance & zero-POL checks
  const calldataResult = validateContractCalldata({
    to,
    data: data as string,
    value,
    senderAddress: from,
  });

  if (!calldataResult.valid) {
    return {
      eligible: false,
      reason: calldataResult.reason || 'Calldata verification failed.',
      quotaRemainingToday: 0,
    };
  }

  // 5. Gas Limits and Fee Caps
  if (gasLimit && gasLimit > quota.maxGasLimitPerTx) {
    return {
      eligible: false,
      reason: `Gas limit ${gasLimit.toString()} exceeds maximum allowable sponsored limit (${quota.maxGasLimitPerTx.toString()}).`,
      quotaRemainingToday: 0,
    };
  }

  if (maxFeePerGas && maxFeePerGas > quota.maxFeePerGasWei) {
    return {
      eligible: false,
      reason: `Gas price exceeds Amoy testnet fee cap of ${quota.maxFeePerGasWei.toString()} wei.`,
      quotaRemainingToday: 0,
    };
  }

  // 6. Rate Limiting (Hourly & Daily Quotas per PENORA user)
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  let history = sponsorshipLedger.get(cleanUser);
  if (!history) {
    history = { timestamps: [] };
    sponsorshipLedger.set(cleanUser, history);
  }

  // Prune entries older than 24h
  history.timestamps = history.timestamps.filter(t => t > oneDayAgo);

  const hourlyCount = history.timestamps.filter(t => t > oneHourAgo).length;
  const dailyCount = history.timestamps.length;

  const quotaRemainingToday = Math.max(0, quota.maxDailyRequests - dailyCount);

  if (hourlyCount >= quota.maxHourlyRequests) {
    return {
      eligible: false,
      reason: `Hourly rate limit exceeded (${hourlyCount}/${quota.maxHourlyRequests} requests). Please wait before requesting additional sponsored transactions.`,
      quotaRemainingToday,
    };
  }

  if (dailyCount >= quota.maxDailyRequests) {
    return {
      eligible: false,
      reason: `Daily gas sponsorship limit reached (${quota.maxDailyRequests} requests). Sponsorship resets in 24 hours.`,
      quotaRemainingToday: 0,
    };
  }

  const smartAccountAddress = deriveDeterministicSmartAccountAddress(from);

  return {
    eligible: true,
    smartAccountAddress,
    quotaRemainingToday: quotaRemainingToday - 1,
  };
}

/**
 * Records a successful sponsorship grant in the in-memory ledger.
 */
export function recordSponsorshipGrant(username: string): void {
  const cleanUser = username.trim().toLowerCase().replace(/^@/, '');
  let history = sponsorshipLedger.get(cleanUser);
  if (!history) {
    history = { timestamps: [] };
    sponsorshipLedger.set(cleanUser, history);
  }
  history.timestamps.push(Date.now());
}

export interface GasSponsorshipInfrastructureStatus {
  isConfigured: boolean;
  provider: 'pimlico' | 'thirdweb' | 'alchemy' | 'biconomy' | 'none';
  bundlerEndpoint?: string;
  paymasterEndpoint?: string;
  status: 'active' | 'unconfigured' | 'blocked';
  blockerReason?: string;
}

/**
 * Checks whether live ERC-4337 Bundler & Paymaster infrastructure is configured in the environment.
 * Transparently reports blockers so production never misleads users about gasless status.
 */
export function getGasSponsorshipStatus(): GasSponsorshipInfrastructureStatus {
  const bundlerUrl =
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.PUBLIC_AMOY_BUNDLER_URL) ||
    (typeof process !== 'undefined' && process.env?.PUBLIC_AMOY_BUNDLER_URL) ||
    '';

  const paymasterUrl =
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.PUBLIC_AMOY_PAYMASTER_URL) ||
    (typeof process !== 'undefined' && process.env?.PUBLIC_AMOY_PAYMASTER_URL) ||
    '';

  if (!bundlerUrl || !paymasterUrl) {
    return {
      isConfigured: false,
      provider: 'none',
      status: 'unconfigured',
      blockerReason:
        'Polygon Amoy ERC-4337 Paymaster and Bundler endpoints are not configured in environment variables. Native Test POL is currently required for Amoy testnet transactions.',
    };
  }

  let provider: GasSponsorshipInfrastructureStatus['provider'] = 'pimlico';
  if (bundlerUrl.includes('thirdweb')) provider = 'thirdweb';
  else if (bundlerUrl.includes('alchemy')) provider = 'alchemy';
  else if (bundlerUrl.includes('biconomy')) provider = 'biconomy';

  return {
    isConfigured: true,
    provider,
    bundlerEndpoint: bundlerUrl,
    paymasterEndpoint: paymasterUrl,
    status: 'blocked',
    blockerReason: 'Endpoints are configured, but sponsored submission and authenticated paymaster authorization are not integrated. Native Test POL is required.',
  };
}
