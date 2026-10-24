export type AccountAsset = 'PNR' | 'USDT';
export interface AccountRequest {
  action: 'balance' | 'transfer';
  username: string;
  recipient: string;
  asset: AccountAsset;
  amount: string;
  nonce: string;
  expires: number;
}

export function accountMessage(body: AccountRequest, origin: string): string {
  return JSON.stringify(['PENORA_ACCOUNT_WALLET_V1', origin, 80002, body.action,
    body.username, body.recipient, body.asset, body.amount, body.nonce, body.expires]);
}

export function accountUnits(amount: string, asset: AccountAsset): bigint {
  const decimals = asset === 'USDT' ? 6 : 18;
  if (!/^(0|[1-9]\d{0,17})(\.\d+)?$/.test(amount)) throw new Error('Enter a valid amount.');
  const [whole, fraction = ''] = amount.split('.');
  if (fraction.length > decimals) throw new Error(`Use at most ${decimals} decimal places.`);
  const units = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, '0'));
  if (units <= 0n) throw new Error('Amount must be greater than zero.');
  return units;
}

export function displayAccountUnits(value: string, asset: AccountAsset): string {
  const decimals = asset === 'USDT' ? 6 : 18;
  const padded = BigInt(value).toString().padStart(decimals + 1, '0');
  const fractional = padded.slice(-decimals).replace(/0+$/, '');
  return padded.slice(0, -decimals) + (fractional ? `.${fractional}` : '');
}

export function validateAccountRequest(value: unknown, now = Date.now()): AccountRequest {
  if (!value || typeof value !== 'object') throw new Error('Invalid wallet request.');
  const b = value as Record<string, unknown>;
  if (b.action !== 'balance' && b.action !== 'transfer') throw new Error('Invalid wallet action.');
  if (typeof b.username !== 'string' || !/^[a-z0-9][a-z0-9_.-]{0,49}$/.test(b.username)) throw new Error('Invalid username.');
  if (b.asset !== 'PNR' && b.asset !== 'USDT') throw new Error('Unsupported asset.');
  if (typeof b.nonce !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(b.nonce)) throw new Error('Invalid request identifier.');
  if (typeof b.expires !== 'number' || !Number.isSafeInteger(b.expires) || b.expires <= now || b.expires > now + 120_000) throw new Error('Wallet request expired. Try again.');
  if (typeof b.recipient !== 'string' || typeof b.amount !== 'string') throw new Error('Invalid transfer.');
  if (b.action === 'transfer') {
    if (!/^[a-z0-9][a-z0-9_.-]{0,49}$/.test(b.recipient) || b.username === b.recipient) throw new Error('Choose another PENORA creator.');
    accountUnits(b.amount, b.asset);
  } else if (b.recipient !== '' || b.amount !== '') throw new Error('Invalid balance request.');
  return b as unknown as AccountRequest;
}
