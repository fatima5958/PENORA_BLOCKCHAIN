// src/lib/rewards/claimClient.ts
// PENORA Creator Rewards On-Chain Claim Helper
// Interacts with PenoraArticleRewards.sol on Polygon Amoy Testnet (80002)

import { encodeFunctionData, parseAbi, keccak256, toHex, pad, type Hex } from 'viem';
import { getEthereumProvider } from '../wallet/walletService';
import { articleContentId } from './merkle';

export const ARTICLE_REWARDS_ABI = parseAbi([
  'function articles(bytes32 articleId) view returns (address author, uint256 publishedAt, bytes32 merkleRoot, uint256 budget, uint256 paid, bool settled)',
  'function hasClaimed(bytes32 articleId, address recipient) view returns (bool)',
  'function claimArticleReward(bytes32 articleId, address recipient, uint256 amount, bytes32[] calldata proof) external',
  'function claimAndPowerUp(bytes32 articleId, address recipient, uint256 amount, bytes32[] calldata proof) external',
  'event ArticleRewardPaid(bytes32 indexed articleId, address indexed recipient, uint256 amount)',
  'event ArticleRewardPoweredUp(bytes32 indexed articleId, address indexed recipient, uint256 amount)',
]);

// Topic 0 for ArticleRewardPaid(bytes32 indexed articleId, address indexed recipient, uint256 amount)
export const ARTICLE_REWARD_PAID_TOPIC = keccak256(toHex('ArticleRewardPaid(bytes32,address,uint256)'));
// Topic 0 for ArticleRewardPoweredUp(bytes32 indexed articleId, address indexed recipient, uint256 amount)
export const ARTICLE_REWARD_POWERED_UP_TOPIC = keccak256(toHex('ArticleRewardPoweredUp(bytes32,address,uint256)'));

export interface ClaimRewardParams {
  contractAddress: `0x${string}`;
  articleRawId: string;
  recipientAddress: `0x${string}`;
  amountWei: bigint;
  proof: Hex[];
  onProgress?: (message: string) => void;
}

export interface ClaimExecutionResult {
  success: boolean;
  txHash?: string;
  confirmed?: boolean;
  blockNumber?: bigint;
  amountClaimedWei?: bigint;
  error?: string;
}

interface TransactionReceipt {
  status: '0x1' | '0x0' | string;
  blockNumber: string;
  transactionHash: string;
  logs: Array<{
    address: string;
    topics: string[];
    data: string;
  }>;
}

/**
 * Checks if the recipient has already claimed their reward on-chain.
 */
export async function checkHasClaimed(
  eth: any,
  contractAddress: `0x${string}`,
  articleIdBytes: `0x${string}`,
  recipientAddress: `0x${string}`
): Promise<boolean> {
  try {
    const data = encodeFunctionData({
      abi: ARTICLE_REWARDS_ABI,
      functionName: 'hasClaimed',
      args: [articleIdBytes, recipientAddress],
    });
    const resultHex = await eth.request({
      method: 'eth_call',
      params: [{ to: contractAddress, data }, 'latest'],
    });
    // Viem / EVM returns 32-byte boolean (last byte 1 if true)
    return typeof resultHex === 'string' && BigInt(resultHex) === 1n;
  } catch {
    return false;
  }
}

/**
 * Polls for a transaction receipt on Polygon Amoy until finalized or timeout.
 */
export async function waitForRewardClaimReceipt(
  eth: any,
  txHash: string,
  contractAddress: `0x${string}`,
  articleIdBytes: `0x${string}`,
  recipientAddress: `0x${string}`,
  onProgress?: (message: string) => void,
  maxAttempts = 30,
  pollIntervalMs = 2000
): Promise<ClaimExecutionResult> {
  const paddedRecipient = pad(recipientAddress.toLowerCase() as `0x${string}`).toLowerCase();

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    onProgress?.(`Waiting for on-chain block confirmation... (attempt ${attempt}/${maxAttempts})`);

    let receipt: TransactionReceipt | null = null;
    try {
      receipt = await eth.request({
        method: 'eth_getTransactionReceipt',
        params: [txHash],
      });
    } catch {
      // transient RPC error, retry next loop
    }

    if (receipt && receipt.blockNumber) {
      // 1. Validate status
      if (receipt.status === '0x0' || receipt.status === '0') {
        return {
          success: false,
          txHash,
          confirmed: false,
          error: 'Claim transaction reverted on Polygon Amoy. Funds were not transferred.',
        };
      }

      if (receipt.status === '0x1' || receipt.status === '1') {
        // 2. Validate ArticleRewardPaid event
        let matchingEventFound = false;
        let amountClaimedWei = 0n;

        for (const log of receipt.logs || []) {
          if (log.address.toLowerCase() === contractAddress.toLowerCase()) {
            const topic0 = (log.topics[0] || '').toLowerCase();
            const topic1 = (log.topics[1] || '').toLowerCase();
            const topic2 = (log.topics[2] || '').toLowerCase();

            if (
              topic0 === ARTICLE_REWARD_PAID_TOPIC.toLowerCase() &&
              topic1 === articleIdBytes.toLowerCase() &&
              topic2 === paddedRecipient
            ) {
              matchingEventFound = true;
              try {
                amountClaimedWei = BigInt(log.data);
              } catch {
                amountClaimedWei = 0n;
              }
              break;
            }
          }
        }

        if (!matchingEventFound) {
          // Fallback: verify on-chain state hasClaimed
          const claimedState = await checkHasClaimed(eth, contractAddress, articleIdBytes, recipientAddress);
          if (claimedState) {
            matchingEventFound = true;
          }
        }

        if (!matchingEventFound) {
          return {
            success: false,
            txHash,
            confirmed: false,
            error: 'Transaction succeeded but ArticleRewardPaid event was not emitted for this article/recipient.',
          };
        }

        const blockNum = BigInt(receipt.blockNumber);
        onProgress?.(`Confirmed in block #${blockNum}!`);
        return {
          success: true,
          txHash,
          confirmed: true,
          blockNumber: blockNum,
          amountClaimedWei,
        };
      }
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  // Timeout occurred — check final contract state
  const claimedAtEnd = await checkHasClaimed(eth, contractAddress, articleIdBytes, recipientAddress);
  if (claimedAtEnd) {
    return {
      success: true,
      txHash,
      confirmed: true,
      error: undefined,
    };
  }

  return {
    success: false,
    txHash,
    confirmed: false,
    error: `Transaction confirmation timed out. Track hash on Polygon Amoy explorer: ${txHash}`,
  };
}

/**
 * Executes creator or curator article reward claim through the user's connected wallet,
 * guaranteeing on-chain receipt confirmation before reporting success.
 */
export async function executeArticleRewardClaim(params: ClaimRewardParams): Promise<ClaimExecutionResult> {
  const eth = getEthereumProvider();
  if (!eth) {
    return { success: false, error: 'Wallet not detected. Connect an EVM wallet to claim rewards.' };
  }

  try {
    params.onProgress?.('Verifying network connection...');
    const chainIdHex = await eth.request({ method: 'eth_chainId' });
    const chainId = parseInt(chainIdHex, 16);
    if (chainId !== 80002) {
      return { success: false, error: 'Incorrect network. Please switch to Polygon Amoy Testnet (Chain ID 80002).' };
    }

    const accounts = await eth.request({ method: 'eth_accounts' });
    if (!accounts || accounts.length === 0) {
      return { success: false, error: 'No wallet accounts connected.' };
    }

    const connected = accounts[0].toLowerCase();
    if (connected !== params.recipientAddress.toLowerCase()) {
      return {
        success: false,
        error: `Connected account (${connected.slice(0, 6)}...${connected.slice(-4)}) does not match reward recipient (${params.recipientAddress.slice(0, 6)}...${params.recipientAddress.slice(-4)}).`,
      };
    }

    const articleIdBytes = articleContentId(params.articleRawId);

    // Pre-flight check: Verify not already claimed on-chain
    params.onProgress?.('Checking on-chain claim status...');
    const alreadyClaimed = await checkHasClaimed(eth, params.contractAddress, articleIdBytes, params.recipientAddress);
    if (alreadyClaimed) {
      return {
        success: false,
        error: 'Reward has already been claimed and paid for this article.',
      };
    }

    params.onProgress?.('Encoding claim transaction with Merkle proof...');
    const data = encodeFunctionData({
      abi: ARTICLE_REWARDS_ABI,
      functionName: 'claimArticleReward',
      args: [articleIdBytes, params.recipientAddress, params.amountWei, params.proof],
    });

    params.onProgress?.('Awaiting wallet approval...');
    const txHash = await eth.request({
      method: 'eth_sendTransaction',
      params: [
        {
          from: params.recipientAddress,
          to: params.contractAddress,
          data,
        },
      ],
    });

    if (!txHash || typeof txHash !== 'string') {
      return { success: false, error: 'Transaction was rejected or failed to broadcast.' };
    }

    params.onProgress?.(`Transaction broadcast (${txHash.slice(0, 10)}...). Waiting for Polygon Amoy confirmation...`);

    // Wait for on-chain receipt verification
    return await waitForRewardClaimReceipt(
      eth,
      txHash,
      params.contractAddress,
      articleIdBytes,
      params.recipientAddress,
      params.onProgress
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Claim transaction rejected or failed.';
    return { success: false, error: message };
  }
}

/**
 * Option B: Executes creator reward claim with automatic 100% Power Up into PENORA Power (PP).
 */
export async function executeArticleRewardPowerUp(params: ClaimRewardParams): Promise<ClaimExecutionResult> {
  const eth = getEthereumProvider();
  if (!eth) {
    return { success: false, error: 'Wallet not detected. Connect an EVM wallet to power up rewards.' };
  }

  try {
    params.onProgress?.('Verifying network connection...');
    const chainIdHex = await eth.request({ method: 'eth_chainId' });
    const chainId = parseInt(chainIdHex, 16);
    if (chainId !== 80002) {
      return { success: false, error: 'Incorrect network. Please switch to Polygon Amoy Testnet (Chain ID 80002).' };
    }

    const accounts = await eth.request({ method: 'eth_accounts' });
    if (!accounts || accounts.length === 0) {
      return { success: false, error: 'No wallet accounts connected.' };
    }

    const connected = accounts[0].toLowerCase();
    if (connected !== params.recipientAddress.toLowerCase()) {
      return {
        success: false,
        error: `Connected account does not match reward recipient.`,
      };
    }

    const articleIdBytes = articleContentId(params.articleRawId);

    // Pre-flight check: Verify not already claimed on-chain
    params.onProgress?.('Checking on-chain claim status...');
    const alreadyClaimed = await checkHasClaimed(eth, params.contractAddress, articleIdBytes, params.recipientAddress);
    if (alreadyClaimed) {
      return {
        success: false,
        error: 'Reward has already been claimed and paid for this article.',
      };
    }

    params.onProgress?.('Encoding claimAndPowerUp transaction...');
    const data = encodeFunctionData({
      abi: ARTICLE_REWARDS_ABI,
      functionName: 'claimAndPowerUp',
      args: [articleIdBytes, params.recipientAddress, params.amountWei, params.proof],
    });

    params.onProgress?.('Awaiting wallet approval for 100% Power Up...');
    const txHash = await eth.request({
      method: 'eth_sendTransaction',
      params: [
        {
          from: params.recipientAddress,
          to: params.contractAddress,
          data,
        },
      ],
    });

    if (!txHash || typeof txHash !== 'string') {
      return { success: false, error: 'Transaction was rejected or failed to broadcast.' };
    }

    params.onProgress?.(`Power Up broadcast (${txHash.slice(0, 10)}...). Waiting for confirmation...`);

    return await waitForRewardClaimReceipt(
      eth,
      txHash,
      params.contractAddress,
      articleIdBytes,
      params.recipientAddress,
      params.onProgress
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Power Up claim transaction rejected or failed.';
    return { success: false, error: message };
  }
}
