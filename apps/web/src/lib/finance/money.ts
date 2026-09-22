/** Convert major units (KES) to minor units (cents). */
export function toAmountMinor(amount: number | string): number {
  const n = typeof amount === 'string' ? Number(amount) : amount;
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error('INVALID_AMOUNT');
  }
  return Math.round(n * 100);
}

export function fromAmountMinor(minor: number): number {
  return minor / 100;
}
