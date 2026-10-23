// src/tests/claimClient.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeArticleRewardClaim, waitForRewardClaimReceipt, ARTICLE_REWARD_PAID_TOPIC } from '../lib/rewards/claimClient';
import { pad, toHex } from 'viem';
import * as walletService from '../lib/wallet/walletService';

describe('PENORA On-Chain Reward Claim Client', () => {
  const contractAddress = '0x4444444444444444444444444444444444444444' as const;
  const recipientAddress = '0x1111111111111111111111111111111111111111' as const;
  const articleRawId = 'post-12345';
  const amountWei = 50000000000000000000n; // 50 PNR
  const proof = ['0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'] as `0x${string}`[];

  let mockEth: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockEth = {
      request: vi.fn(),
    };
    vi.spyOn(walletService, 'getEthereumProvider').mockReturnValue(mockEth);
  });

  it('rejects claim when wallet is not detected', async () => {
    vi.spyOn(walletService, 'getEthereumProvider').mockReturnValue(null);
    const result = await executeArticleRewardClaim({
      contractAddress,
      articleRawId,
      recipientAddress,
      amountWei,
      proof,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Wallet not detected');
  });

  it('rejects claim when connected to incorrect network', async () => {
    mockEth.request.mockImplementation(async ({ method }: { method: string }) => {
      if (method === 'eth_chainId') return '0x1'; // Ethereum Mainnet (1) instead of 80002
      return null;
    });

    const result = await executeArticleRewardClaim({
      contractAddress,
      articleRawId,
      recipientAddress,
      amountWei,
      proof,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Polygon Amoy Testnet (Chain ID 80002)');
  });

  it('rejects claim when connected account does not match recipient address', async () => {
    mockEth.request.mockImplementation(async ({ method }: { method: string }) => {
      if (method === 'eth_chainId') return '0x13882'; // 80002
      if (method === 'eth_accounts') return ['0x9999999999999999999999999999999999999999'];
      return null;
    });

    const result = await executeArticleRewardClaim({
      contractAddress,
      articleRawId,
      recipientAddress,
      amountWei,
      proof,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('does not match reward recipient');
  });

  it('detects pre-flight already-claimed state and aborts before broadcasting', async () => {
    mockEth.request.mockImplementation(async ({ method }: { method: string }) => {
      if (method === 'eth_chainId') return '0x13882';
      if (method === 'eth_accounts') return [recipientAddress];
      if (method === 'eth_call') return '0x0000000000000000000000000000000000000000000000000000000000000001'; // true
      return null;
    });

    const result = await executeArticleRewardClaim({
      contractAddress,
      articleRawId,
      recipientAddress,
      amountWei,
      proof,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('already been claimed');
    // Ensure eth_sendTransaction was NOT called
    expect(mockEth.request).not.toHaveBeenCalledWith(expect.objectContaining({ method: 'eth_sendTransaction' }));
  });

  it('handles reverted transaction receipt cleanly without false success', async () => {
    mockEth.request.mockImplementation(async ({ method }: { method: string }) => {
      if (method === 'eth_chainId') return '0x13882';
      if (method === 'eth_accounts') return [recipientAddress];
      if (method === 'eth_call') return '0x0000000000000000000000000000000000000000000000000000000000000000'; // false
      if (method === 'eth_sendTransaction') return '0xaaaabbbbcccc1111';
      if (method === 'eth_getTransactionReceipt') {
        return {
          status: '0x0', // Reverted!
          blockNumber: '0x123',
          transactionHash: '0xaaaabbbbcccc1111',
          logs: [],
        };
      }
      return null;
    });

    const result = await executeArticleRewardClaim({
      contractAddress,
      articleRawId,
      recipientAddress,
      amountWei,
      proof,
    });

    expect(result.success).toBe(false);
    expect(result.confirmed).toBe(false);
    expect(result.error).toContain('reverted on Polygon Amoy');
  });

  it('verifies confirmed blockchain receipt with matching ArticleRewardPaid event', async () => {
    const paddedRecipient = pad(recipientAddress);
    // Article id in merkle is keccak256(toHex(articleRawId))
    const { articleContentId } = await import('../lib/rewards/merkle');
    const articleIdBytes = articleContentId(articleRawId);

    mockEth.request.mockImplementation(async ({ method }: { method: string }) => {
      if (method === 'eth_chainId') return '0x13882';
      if (method === 'eth_accounts') return [recipientAddress];
      if (method === 'eth_call') return '0x0000000000000000000000000000000000000000000000000000000000000000';
      if (method === 'eth_sendTransaction') return '0xsuccesshash1234';
      if (method === 'eth_getTransactionReceipt') {
        return {
          status: '0x1',
          blockNumber: '0x654321', // 6636321 in dec
          transactionHash: '0xsuccesshash1234',
          logs: [
            {
              address: contractAddress,
              topics: [ARTICLE_REWARD_PAID_TOPIC, articleIdBytes, paddedRecipient],
              data: toHex(amountWei),
            },
          ],
        };
      }
      return null;
    });

    const messages: string[] = [];
    const result = await executeArticleRewardClaim({
      contractAddress,
      articleRawId,
      recipientAddress,
      amountWei,
      proof,
      onProgress: (msg) => messages.push(msg),
    });

    expect(result.success).toBe(true);
    expect(result.confirmed).toBe(true);
    expect(result.txHash).toBe('0xsuccesshash1234');
    expect(result.blockNumber).toBe(6636321n);
    expect(result.amountClaimedWei).toBe(amountWei);
    expect(messages.some((m) => m.includes('Confirmed in block'))).toBe(true);
  });
});
