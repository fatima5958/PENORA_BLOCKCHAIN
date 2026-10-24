import { signChallenge } from '../crypto/penoraKeys';
import { accountMessage, accountUnits, type AccountRequest, type AccountAsset } from './accountProtocol';
export interface AccountSnapshot {
  balances: Record<AccountAsset, string>;
  transfers: { id: string; asset: AccountAsset; units: string; created_at: string; direction: string; counterparty: string }[];
}
export class AccountWalletRequestError extends Error {
  constructor(message: string, public readonly status: number) { super(message); this.name = 'AccountWalletRequestError'; }
  get rejected() { return this.status >= 400 && this.status < 500; }
}
export function validateAccountSnapshot(value: unknown): AccountSnapshot {
  const data = value as AccountSnapshot | null;
  const units = (v: unknown) => typeof v === 'string' && /^\d{1,78}$/.test(v);
  if (!data || !data.balances || !units(data.balances.PNR) || !units(data.balances.USDT) || !Array.isArray(data.transfers) ||
    data.transfers.some(tx => !tx || typeof tx.id !== 'string' || !units(tx.units) || !['PNR', 'USDT'].includes(tx.asset) ||
      !['sent', 'received'].includes(tx.direction) || typeof tx.counterparty !== 'string' ||
      !/^[a-z0-9][a-z0-9_.-]{0,49}$/.test(tx.counterparty) || typeof tx.created_at !== 'string' || !Number.isFinite(Date.parse(tx.created_at)))) {
    throw new AccountWalletRequestError('Balance response could not be verified. Refresh to try again.', 503);
  }
  return data;
}
export async function accountRequest(body: AccountRequest, key: string) {
  const fresh = { ...body, expires: Date.now() + 90_000 };
  const response = await fetch('/api/wallet/account', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...fresh, signature: signChallenge(accountMessage(fresh, window.location.origin), key) }),
  });
  const result = await response.json();
  if (!response.ok) throw new AccountWalletRequestError(result.error || 'Wallet request could not be confirmed.', response.status);
  if (fresh.action === 'balance') return validateAccountSnapshot(result);
  if (!result?.receipt || typeof result.receipt.id !== 'string' || result.receipt.status !== 'confirmed' ||
      result.receipt.asset !== fresh.asset || result.receipt.recipient !== fresh.recipient ||
      result.receipt.units !== accountUnits(fresh.amount, fresh.asset).toString() || result.settlement !== 'internal' || result.fee !== '0') {
    throw new AccountWalletRequestError('Transfer receipt could not be verified. Retry the same transfer to check its status.', 503);
  }
  return result;
}
export function makeAccountRequest(username: string, action: AccountRequest['action'], asset: AccountAsset = 'PNR', recipient = '', amount = ''): AccountRequest {
  return { username, action, asset, recipient, amount, nonce: crypto.randomUUID(), expires: Date.now() + 90_000 };
}
