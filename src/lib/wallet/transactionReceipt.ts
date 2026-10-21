import type { Hash, TransactionReceipt } from 'viem';
import { publicClient } from './walletService';

/** A successful cancellation receipt does not confirm the original wallet action. */
export async function waitForWalletTransaction(hash: Hash): Promise<{
  hash: Hash;
  status: 'confirmed' | 'pending' | 'failed';
  receipt?: TransactionReceipt;
}> {
  let replacedWithDifferentAction = false;
  let currentHash = hash;
  try {
    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
      timeout: 60_000,
      onReplaced: replacement => {
        currentHash = replacement.transaction.hash;
        replacedWithDifferentAction = replacement.reason !== 'repriced';
      },
    });
    return {
      hash: receipt.transactionHash ?? currentHash,
      status: !replacedWithDifferentAction && receipt.status === 'success' ? 'confirmed' : 'failed',
      receipt,
    };
  } catch {
    // A broadcast hash remains pending when an RPC cannot establish its outcome.
    return { hash: currentHash, status: 'pending' };
  }
}
