// src/lib/wallet/calldataValidator.ts
// PENORA Blockchain — Contract-Specific Decoded Calldata & ABI Validator
// Replaces loose global selector checks with rigorous destination-bound decoded ABI validation.

import {
  isAddress,
  type Address,
  type Hex,
  decodeFunctionData,
  zeroAddress,
} from 'viem';
import {
  PENORA_CONTRACT_ADDRESSES,
  isConfiguredAddress,
  PNR_TOKEN_ABI,
  POWER_ESCROW_ABI,
  ERC20_USDT_ABI,
} from './contracts';
import { EXCHANGE_ABI, FOUNDER_WALLET_ADDRESS } from '../exchange/exchangeService';

export const MAX_SAFE_PNR_ALLOWANCE = 100_000_000n * 10n ** 18n; // 100M PNR
export const MAX_SAFE_USDT_ALLOWANCE = 10_000_000n * 10n ** 6n; // 10M USDT
export const UNLIMITED_ALLOWANCE_SENTINEL = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

export interface CalldataValidationResult {
  valid: boolean;
  contractName?: string;
  functionName?: string;
  reason?: string;
  decodedArgs?: Record<string, unknown>;
}

// Selector mappings for each contract when calldata contains only the 4-byte selector
const PNR_SELECTORS: Record<string, string> = {
  '0xa9059cbb': 'transfer',
  '0x095ea7b3': 'approve',
  '0x42966c68': 'burn',
};

const USDT_SELECTORS: Record<string, string> = {
  '0xa9059cbb': 'transfer',
  '0x095ea7b3': 'approve',
};

const EXCHANGE_SELECTORS: Record<string, string> = {
  '0x40993b26': 'buy',
  '0x34fcf437': 'setRate',
  '0x8456cb59': 'pause',
  '0x3f4ba83a': 'unpause',
  '0xd9caed12': 'withdraw',
};

const POWER_SELECTORS: Record<string, string> = {
  '0x9a6bd379': 'powerUp',
  '0x00fa8e46': 'powerUpFor',
  '0x68d097bd': 'startPowerDown',
  '0x0eb5ce25': 'claimInstallments',
  '0x42539325': 'claimInstallment',
  '0x8b7c23fb': 'cancelPowerDown',
};

const VOTING_SELECTORS: Record<string, string> = {
  '0x026e402b': 'delegate',
  '0xda8be864': 'undelegate',
};

const REWARD_SELECTORS: Record<string, string> = {
  '0x2c525b5b': 'claimDailyReward',
};

const P2P_SELECTORS: Record<string, string> = {
  '0xed037642': 'createOffer',
  '0xbefe00bd': 'buyOffer',
  '0xed653164': 'releaseEscrow',
  '0xef706adf': 'cancelOffer',
  '0xb563153c': 'disputeEscrow',
};

/**
 * Validates transaction destination and decodes calldata against the target contract's exact ABI.
 * Strictly prevents mismatched selectors, unauthorized spenders, unlimited allowances, and non-zero POL transfers.
 */
export function validateContractCalldata({
  to,
  data,
  value,
  senderAddress,
}: {
  to: string;
  data?: string;
  value?: string | bigint;
  senderAddress?: string;
}): CalldataValidationResult {
  if (!to || !isAddress(to)) {
    return { valid: false, reason: 'Valid destination contract address required.' };
  }

  // 1. Value Check: Native POL value must be zero for all contract calls
  try {
    const val = BigInt(value || '0');
    if (val !== 0n) {
      return { valid: false, reason: 'Gas sponsorship permits contract calls only; native POL value must be zero.' };
    }
  } catch {
    return { valid: false, reason: 'Malformed transaction value parameter.' };
  }

  const calldata = (data || '0x') as Hex;
  if (!/^0x[0-9a-fA-F]{8}/.test(calldata)) {
    return { valid: false, reason: 'Transaction requires valid calldata with a 4-byte selector.' };
  }

  const toLower = to.toLowerCase();
  const c = PENORA_CONTRACT_ADDRESSES;
  const selector = calldata.slice(0, 10).toLowerCase();

  // 2. Identify Target Contract & Decode
  // A) PNR Token
  if (isConfiguredAddress(c.PNR_TOKEN) && toLower === c.PNR_TOKEN.toLowerCase()) {
    if (!PNR_SELECTORS[selector]) {
      return { valid: false, reason: `Selector ${selector} is not permitted on PNR token.` };
    }

    if (calldata.length === 10) {
      return { valid: true, contractName: 'PenoraToken', functionName: PNR_SELECTORS[selector] };
    }

    try {
      const decoded = decodeFunctionData({ abi: PNR_TOKEN_ABI, data: calldata });
      const { functionName, args } = decoded;

      if (functionName === 'transfer') {
        const [recipient, amount] = args as [Address, bigint];
        if (!isAddress(recipient)) {
          return { valid: false, reason: 'Valid recipient address required.' };
        }
        if (amount < 0n) {
          return { valid: false, reason: 'Transfer amount cannot be negative.' };
        }
        return { valid: true, contractName: 'PenoraToken', functionName, decodedArgs: { recipient, amount } };
      }

      if (functionName === 'approve') {
        const [spender, amount] = args as [Address, bigint];
        if (!isAddress(spender) || spender.toLowerCase() === zeroAddress) {
          return { valid: false, reason: 'Cannot approve zero address as spender.' };
        }
        if (amount === UNLIMITED_ALLOWANCE_SENTINEL) {
          return { valid: false, reason: 'Unlimited token allowances (type(uint256).max) are strictly prohibited.' };
        }
        if (amount > MAX_SAFE_PNR_ALLOWANCE) {
          return { valid: false, reason: `Approval exceeds maximum safe total supply (${MAX_SAFE_PNR_ALLOWANCE.toString()}).` };
        }
        return { valid: true, contractName: 'PenoraToken', functionName, decodedArgs: { spender, amount } };
      }

      if (functionName === 'burn') {
        const [amount] = args as [bigint];
        if (amount <= 0n) return { valid: false, reason: 'Burn amount must be greater than zero.' };
        return { valid: true, contractName: 'PenoraToken', functionName, decodedArgs: { amount } };
      }

      return { valid: false, reason: `Function ${functionName} is not permitted on PNR token.` };
    } catch {
      return { valid: false, reason: 'Calldata does not conform to PNR Token ABI.' };
    }
  }

  // B) MockUSDT Token
  if (isConfiguredAddress(c.USDT_TOKEN) && toLower === c.USDT_TOKEN.toLowerCase()) {
    if (!USDT_SELECTORS[selector]) {
      return { valid: false, reason: `Selector ${selector} is not permitted on MockUSDT.` };
    }

    if (calldata.length === 10) {
      return { valid: true, contractName: 'MockUSDT', functionName: USDT_SELECTORS[selector] };
    }

    try {
      const decoded = decodeFunctionData({ abi: ERC20_USDT_ABI, data: calldata });
      const { functionName, args } = decoded;

      if (functionName === 'transfer') {
        const [recipient, amount] = args as [Address, bigint];
        if (!isAddress(recipient)) {
          return { valid: false, reason: 'Valid recipient address required.' };
        }
        if (amount < 0n) return { valid: false, reason: 'Transfer amount cannot be negative.' };
        return { valid: true, contractName: 'MockUSDT', functionName, decodedArgs: { recipient, amount } };
      }

      if (functionName === 'approve') {
        const [spender, amount] = args as [Address, bigint];
        if (!isAddress(spender) || spender.toLowerCase() === zeroAddress) {
          return { valid: false, reason: 'Cannot approve zero address as spender.' };
        }
        if (amount === UNLIMITED_ALLOWANCE_SENTINEL) {
          return { valid: false, reason: 'Unlimited token allowances are strictly prohibited.' };
        }
        if (amount > MAX_SAFE_USDT_ALLOWANCE) {
          return { valid: false, reason: `Approval exceeds maximum safe USDT bound (${MAX_SAFE_USDT_ALLOWANCE.toString()}).` };
        }
        return { valid: true, contractName: 'MockUSDT', functionName, decodedArgs: { spender, amount } };
      }

      return { valid: false, reason: `Function ${functionName} is not permitted on MockUSDT.` };
    } catch {
      return { valid: false, reason: 'Calldata does not conform to MockUSDT ABI.' };
    }
  }

  // C) PenoraExchange
  if (isConfiguredAddress(c.EXCHANGE) && toLower === c.EXCHANGE.toLowerCase()) {
    if (!EXCHANGE_SELECTORS[selector]) {
      return { valid: false, reason: `Selector ${selector} is not permitted on PenoraExchange.` };
    }

    if (calldata.length === 10) {
      return { valid: true, contractName: 'PenoraExchange', functionName: EXCHANGE_SELECTORS[selector] };
    }

    try {
      const decoded = decodeFunctionData({ abi: EXCHANGE_ABI, data: calldata });
      const { functionName, args } = decoded;

      if (functionName === 'buy') {
        const [usdtIn, minimumPnr, deadline] = args as [bigint, bigint, bigint];
        if (usdtIn <= 0n) return { valid: false, reason: 'Exchange purchase input must be greater than zero.' };
        if (minimumPnr <= 0n) return { valid: false, reason: 'Slippage minimum output must be greater than zero.' };
        return { valid: true, contractName: 'PenoraExchange', functionName, decodedArgs: { usdtIn, minimumPnr, deadline } };
      }

      // Founder-only administration check
      if (['setRate', 'pause', 'unpause', 'withdraw'].includes(functionName)) {
        if (!senderAddress || senderAddress.toLowerCase() !== FOUNDER_WALLET_ADDRESS.toLowerCase()) {
          return { valid: false, reason: `Exchange admin function ${functionName} is reserved for founder wallet.` };
        }
        return { valid: true, contractName: 'PenoraExchange', functionName };
      }

      return { valid: false, reason: `Function ${functionName} is not permitted on PenoraExchange.` };
    } catch {
      return { valid: false, reason: 'Calldata does not conform to PenoraExchange ABI.' };
    }
  }

  // D) PenoraPowerEscrow
  if (isConfiguredAddress(c.POWER_ESCROW) && toLower === c.POWER_ESCROW.toLowerCase()) {
    if (!POWER_SELECTORS[selector]) {
      return { valid: false, reason: `Selector ${selector} is not permitted on PenoraPowerEscrow.` };
    }

    if (calldata.length === 10) {
      return { valid: true, contractName: 'PenoraPowerEscrow', functionName: POWER_SELECTORS[selector] };
    }

    try {
      const decoded = decodeFunctionData({ abi: POWER_ESCROW_ABI, data: calldata });
      const { functionName, args } = decoded;

      if (functionName === 'powerUp' || functionName === 'startPowerDown') {
        const [amount] = args as [bigint];
        if (amount <= 0n) return { valid: false, reason: `${functionName} amount must be greater than zero.` };
        return { valid: true, contractName: 'PenoraPowerEscrow', functionName, decodedArgs: { amount } };
      }

      if (functionName === 'powerUpFor') {
        const [recipient, amount] = args as [Address, bigint];
        if (!isAddress(recipient)) return { valid: false, reason: 'Valid recipient required for powerUpFor.' };
        if (amount <= 0n) return { valid: false, reason: 'Amount must be greater than zero.' };
        return { valid: true, contractName: 'PenoraPowerEscrow', functionName, decodedArgs: { recipient, amount } };
      }

      if (functionName === 'claimInstallments' || functionName === 'cancelPowerDown') {
        return { valid: true, contractName: 'PenoraPowerEscrow', functionName };
      }

      return { valid: false, reason: `Function ${functionName} is not permitted on PenoraPowerEscrow.` };
    } catch {
      return { valid: false, reason: 'Calldata does not conform to PenoraPowerEscrow ABI.' };
    }
  }

  // E) PenoraVotingInfluence
  if (isConfiguredAddress(c.VOTING_INFLUENCE) && toLower === c.VOTING_INFLUENCE.toLowerCase()) {
    if (VOTING_SELECTORS[selector]) {
      return { valid: true, contractName: 'PenoraVotingInfluence', functionName: VOTING_SELECTORS[selector] };
    }
    return { valid: false, reason: 'Unrecognized function selector for PenoraVotingInfluence.' };
  }

  // F) PenoraRewardDistributor
  if (isConfiguredAddress(c.REWARD_DISTRIBUTOR) && toLower === c.REWARD_DISTRIBUTOR.toLowerCase()) {
    if (REWARD_SELECTORS[selector]) {
      return { valid: true, contractName: 'PenoraRewardDistributor', functionName: REWARD_SELECTORS[selector] };
    }
    return { valid: false, reason: 'Unrecognized function selector for PenoraRewardDistributor.' };
  }

  // G) PenoraP2PEscrow
  if (isConfiguredAddress(c.P2P_ESCROW) && toLower === c.P2P_ESCROW.toLowerCase()) {
    if (P2P_SELECTORS[selector]) {
      return { valid: true, contractName: 'PenoraP2PEscrow', functionName: P2P_SELECTORS[selector] };
    }
    return { valid: false, reason: 'Unrecognized function selector for PenoraP2PEscrow.' };
  }

  return { valid: false, reason: `Target address ${to} is not an authorized PENORA Amoy contract.` };
}
