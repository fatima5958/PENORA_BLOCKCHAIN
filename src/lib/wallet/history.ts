import { formatEther, parseAbiItem, type AbiEvent, type Address } from 'viem';
import { publicClient } from './walletService';
import { PENORA_CONTRACT_ADDRESSES, isConfiguredAddress } from './contracts';
import { POLYGON_AMOY_CONFIG } from './chain';
import { reconcilePowerTransactions } from './powerTransactions';
import type { WalletTransaction } from './types';

/** Bounded, paginated public-RPC queries. This is recent activity, not a complete indexer. */
export async function readRecentEvents(address: Address, event: AbiEvent, args: Record<string, Address>, head?: bigint) {
  const end = head ?? await publicClient.getBlockNumber();
  const logs = [];
  for (let from = end > 10000n ? end - 10000n : 0n; from <= end; from += 1000n) {
    const to = from + 999n < end ? from + 999n : end;
    logs.push(...await publicClient.getLogs({ address, event, args, fromBlock: from, toBlock: to }));
  }
  return logs;
}

const powerEvents = [
  { event: parseAbiItem('event PowerUp(address indexed caller, address indexed recipient, uint256 amount, uint256 timestamp)'), type: 'power_up', field: 'recipient', amount: 'amount', symbol: 'PP' },
  { event: parseAbiItem('event PowerDownStarted(address indexed user, uint256 totalAmount, uint256 weeklyInstallment, uint256 remainder, uint256 startTime)'), type: 'power_down', field: 'user', amount: 'totalAmount', symbol: 'PP' },
  { event: parseAbiItem('event InstallmentClaimed(address indexed user, uint256 amountClaimed, uint256 totalWeeksClaimed, uint256 timestamp)'), type: 'claim_installment', field: 'user', amount: 'amountClaimed', symbol: 'PNR' },
  { event: parseAbiItem('event PowerDownCancelled(address indexed user, uint256 restoredPower, uint256 maturedClaimed, uint256 timestamp)'), type: 'cancel_power_down', field: 'user', amount: 'restoredPower', symbol: 'PP' },
] as const;

export async function fetchPowerHistory(user: Address): Promise<WalletTransaction[]> {
  const escrow = PENORA_CONTRACT_ADDRESSES.POWER_ESCROW;
  if (!isConfiguredAddress(escrow)) return [];
  const head = await publicClient.getBlockNumber();
  const times = new Map<bigint, Promise<string>>();
  const groups = await Promise.all(powerEvents.map(async definition => {
    const logs = await readRecentEvents(escrow as Address, definition.event, { [definition.field]: user }, head);
    return Promise.all(logs.filter(log => !log.removed && log.transactionHash && log.blockNumber != null).map(async log => {
      const args = (log as unknown as { args: Record<string, bigint | string> }).args;
      if (!times.has(log.blockNumber!)) {
        times.set(log.blockNumber!, publicClient.getBlock({ blockNumber: log.blockNumber! })
          .then(block => new Date(Number(block.timestamp) * 1000).toISOString()));
      }
      return {
        id: `power_${escrow.toLowerCase()}_${log.transactionHash}_${log.logIndex}`,
        hash: log.transactionHash!, type: definition.type, symbol: definition.symbol,
        amount: formatEther(args[definition.amount] as bigint), status: 'confirmed' as const,
        timestamp: await times.get(log.blockNumber!)!,
        from: definition.type === 'claim_installment' ? escrow : user,
        to: definition.type === 'claim_installment' ? user : escrow,
        explorerUrl: `${POLYGON_AMOY_CONFIG.blockExplorers[0]}/tx/${log.transactionHash}`,
      };
    }));
  }));
  const onchain = groups.flat();
  const knownActions = new Set(onchain.map(tx => `${tx.hash.toLowerCase()}:${tx.type}`));
  const local = await reconcilePowerTransactions(user);
  return [...onchain, ...local.filter(tx => !knownActions.has(`${tx.hash.toLowerCase()}:${tx.type}`))];
}

export function historyLabel(tx: WalletTransaction): string {
  switch (tx.type) {
    case 'approve_pnr': return 'PNR staking approval';
    case 'power_up': return 'Power Up';
    case 'power_down': return 'Power Down started';
    case 'claim_installment': return 'Installment claimed';
    case 'cancel_power_down': return 'Power Down cancelled';
    case 'deposit_usdt': case 'transfer_in': return `Deposit ${tx.symbol}`;
    default: return `Send ${tx.symbol}`;
  }
}

export function historySign(tx: WalletTransaction): string {
  if (['power_down', 'cancel_power_down', 'approve_pnr'].includes(tx.type)) return '';
  return ['deposit_usdt', 'transfer_in', 'claim_installment', 'power_up'].includes(tx.type) ? '+' : '−';
}
