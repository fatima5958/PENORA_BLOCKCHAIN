import { parseUnits } from 'viem';

/** Reject ambiguous input and excess precision instead of rounding a user's transfer. */
export function parseTokenAmount(value: string, decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
    throw new Error('Unable to verify token decimals. Please try again.');
  }
  const amount = value.trim();
  if (!/^\d+(\.\d+)?$/.test(amount)) {
    throw new Error('Enter a positive decimal amount without exponents or separators.');
  }
  if ((amount.split('.')[1]?.length ?? 0) > decimals) {
    throw new Error(`Amount supports at most ${decimals} decimal places.`);
  }
  const raw = parseUnits(amount, decimals);
  if (raw <= 0n) throw new Error('Amount must be greater than zero.');
  return raw;
}
