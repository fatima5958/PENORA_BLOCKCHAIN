import { formatUnits, maxUint256, parseUnits } from 'viem';

/** Reject ambiguous input and excess precision instead of rounding a user's transfer. */
export function parseTokenAmount(value: string, decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
    throw new Error('Unable to verify token decimals. Please try again.');
  }
  const amount = value.trim();
  if (amount.length > 334) throw new Error('Amount exceeds the supported token range.');
  if (!/^\d+(\.\d+)?$/.test(amount)) {
    throw new Error('Enter a positive decimal amount without exponents or separators.');
  }
  if ((amount.split('.')[1]?.length ?? 0) > decimals) {
    throw new Error(`Amount supports at most ${decimals} decimal places.`);
  }
  const raw = parseUnits(amount, decimals);
  if (raw <= 0n) throw new Error('Amount must be greater than zero.');
  if (raw > maxUint256) throw new Error('Amount exceeds the supported token range.');
  return raw;
}

export function isSpendableAmount(value: string, balance: string | null, decimals: number): boolean {
  if (balance === null) return false;
  try { return parseTokenAmount(value, decimals) <= parseUnits(balance, decimals); }
  catch { return false; }
}

/** Mirrors the escrow: weeks 1–12 receive the base amount; week 13 includes the remainder. */
export function previewPowerDown(value: string): { weekly: string; final: string } | null {
  try {
    const total = parseTokenAmount(value, 18);
    const weekly = total / 13n;
    return { weekly: formatUnits(weekly, 18), final: formatUnits(weekly + total % 13n, 18) };
  } catch { return null; }
}
