import { decodeEventLog, formatEther, parseAbi, type Hash, type TransactionReceipt } from 'viem';
import { PENORA_CONTRACT_ADDRESSES } from './contracts';
import { POLYGON_AMOY_CONFIG } from './chain';
import { publicClient } from './walletService';
import type { WalletTransaction } from './types';

export type PowerAction = 'power_up' | 'power_down' | 'claim_installment' | 'cancel_power_down' | 'approve_pnr';
const events = parseAbi([
  'event PowerUp(address indexed caller, address indexed recipient, uint256 amount, uint256 timestamp)',
  'event PowerDownStarted(address indexed user, uint256 totalAmount, uint256 weeklyInstallment, uint256 remainder, uint256 startTime)',
  'event InstallmentClaimed(address indexed user, uint256 amountClaimed, uint256 totalWeeksClaimed, uint256 timestamp)',
  'event PowerDownCancelled(address indexed user, uint256 restoredPower, uint256 maturedClaimed, uint256 timestamp)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
]);
const eventFor = { power_up: 'PowerUp', power_down: 'PowerDownStarted', claim_installment: 'InstallmentClaimed', cancel_power_down: 'PowerDownCancelled', approve_pnr: 'Approval' };
const storageKey = (user: string) => `penora_power_80002_${PENORA_CONTRACT_ADDRESSES.PNR_TOKEN.toLowerCase()}_${PENORA_CONTRACT_ADDRESSES.POWER_ESCROW.toLowerCase()}_${user.toLowerCase()}`;
const explorer = (hash: string) => `${POLYGON_AMOY_CONFIG.blockExplorers[0]}/tx/${hash}`;

export function localPowerTransactions(user: string): WalletTransaction[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const records: unknown = JSON.parse(localStorage.getItem(storageKey(user)) || '[]');
    if (!Array.isArray(records)) return [];
    return records.filter(tx => tx && typeof tx.id === 'string' && /^0x[0-9a-f]{64}$/i.test(tx.hash) &&
      tx.from?.toLowerCase() === user.toLowerCase() && Object.prototype.hasOwnProperty.call(eventFor, tx.type) &&
      ['pending', 'confirmed', 'failed'].includes(tx.status) && ['PNR', 'PP'].includes(tx.symbol) &&
      typeof tx.amount === 'string' && Number.isFinite(Date.parse(tx.timestamp)))
      .map(tx => ({ ...tx, explorerUrl: explorer(tx.hash) }));
  } catch { return []; }
}

export function savePowerTransaction(user: string, tx: WalletTransaction): void {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(storageKey(user), JSON.stringify([tx, ...localPowerTransactions(user).filter(old => old.id !== tx.id)].slice(0, 100))); }
  catch { /* A blocked browser store must not change the outcome of an onchain action. */ }
}

export function pendingPowerTransaction(user: string, hash: Hash, type: PowerAction, amount?: string): WalletTransaction {
  const tx: WalletTransaction = { id: `power_local_${hash}`, hash, type, amount: amount ?? '—',
    symbol: ['power_up', 'power_down', 'cancel_power_down'].includes(type) ? 'PP' : 'PNR',
    status: 'pending', timestamp: new Date().toISOString(), from: user,
    to: type === 'approve_pnr' ? PENORA_CONTRACT_ADDRESSES.PNR_TOKEN : PENORA_CONTRACT_ADDRESSES.POWER_ESCROW,
    explorerUrl: explorer(hash),
  };
  savePowerTransaction(user, tx);
  return tx;
}

/** An EVM success receipt alone does not establish that this particular staking action happened. */
export function confirmedPowerTransaction(tx: WalletTransaction, receipt: Pick<TransactionReceipt, 'logs' | 'status'>, hash: Hash): WalletTransaction {
  let amount: bigint | undefined;
  if (receipt.status === 'success') for (const log of receipt.logs ?? []) {
    if (log.address.toLowerCase() !== tx.to?.toLowerCase()) continue;
    try {
      const event = decodeEventLog({ abi: events, topics: log.topics, data: log.data });
      if (event.eventName !== eventFor[tx.type as PowerAction]) continue;
      const args = event.args as Record<string, string | bigint>;
      const actor = args.owner ?? args.user ?? args.caller;
      if (String(actor).toLowerCase() !== tx.from?.toLowerCase()) continue;
      if (tx.type === 'power_up' && String(args.recipient).toLowerCase() !== tx.from?.toLowerCase()) continue;
      if (tx.type === 'approve_pnr' && String(args.spender).toLowerCase() !== PENORA_CONTRACT_ADDRESSES.POWER_ESCROW.toLowerCase()) continue;
      amount = (args.amount ?? args.totalAmount ?? args.amountClaimed ?? args.restoredPower ?? args.value) as bigint;
      // Exact review amounts must match; claims/cancellations are calculated by the contract.
      if (tx.amount !== '—' && formatEther(amount) !== tx.amount) { amount = undefined; continue; }
      break;
    } catch { /* Unrelated event. */ }
  }
  return { ...tx, hash, explorerUrl: explorer(hash), status: amount !== undefined ? 'confirmed' : 'failed',
    amount: amount !== undefined ? formatEther(amount) : tx.amount };
}

export async function reconcilePowerTransactions(user: string): Promise<WalletTransaction[]> {
  return Promise.all(localPowerTransactions(user).map(async tx => {
    if (tx.status !== 'pending') return tx;
    try {
      const receipt = await publicClient.getTransactionReceipt({ hash: tx.hash as Hash });
      const updated = confirmedPowerTransaction(tx, receipt, tx.hash as Hash);
      savePowerTransaction(user, updated);
      return updated;
    } catch { return tx; } // Unknown/dropped receipts are not proof of failure.
  }));
}
