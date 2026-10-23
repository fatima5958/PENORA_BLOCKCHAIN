// src/lib/rewards/claimClient.ts
// PENORA Creator Rewards On-Chain Claim Helper
// Interacts with PenoraArticleRewards.sol on Polygon Amoy Testnet (80002)

import { encodeFunctionData, parseAbi, type Hex } from 'viem';
import { getEthereumProvider } from '../wallet/walletService';
import { articleContentId } from './merkle';

export const ARTICLE_REWARDS_ABI = parseAbi([
  'function articles(bytes32 articleId) view returns (address author, uint256 publishedAt, bytes32 merkleRoot, uint256 budget, uint256 paid, bool settled)',
  'function hasClaimed(bytes32 articleId, address recipient) view returns (bool)',
  'function claimArticleReward(bytes32 articleId, address recipient, uint256 amount, bytes32[] calldata proof) external',
  'event ArticleRewardPaid(bytes32 indexed articleId, address indexed recipient, uint256 amount)',
]);

export interface ClaimRewardParams {
  contractAddress: `0x${string}`;
  articleRawId: string;
  recipientAddress: `0x${string}`;
  amountWei: bigint;
  proof: Hex[];
}

export interface ClaimExecutionResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

/**
 * Executes creator or curator article reward claim through the user's connected wallet.
 */
export async function executeArticleRewardClaim(params: ClaimRewardParams): Promise<ClaimExecutionResult> {
  const eth = getEthereumProvider();
  if (!eth) {
    return { success: false, error: 'Wallet not detected. Connect an EVM wallet to claim rewards.' };
  }

  try {
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

    const data = encodeFunctionData({
      abi: ARTICLE_REWARDS_ABI,
      functionName: 'claimArticleReward',
      args: [articleIdBytes, params.recipientAddress, params.amountWei, params.proof],
    });

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

    return { success: true, txHash };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Claim transaction rejected or failed.';
    return { success: false, error: message };
  }
}
