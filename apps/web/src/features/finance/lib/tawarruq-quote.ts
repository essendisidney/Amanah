/** Jameiyah offers Tawarruq. The murabaha profit is Jameiyah's income. */
export const TAWARRUQ_MIN_CASH = 1000;
export const TAWARRUQ_MAX_CASH = 5_000_000;
export const TAWARRUQ_PROFIT_RATES_BPS = [500, 1000, 1500] as const;
export const TAWARRUQ_DEFAULT_PROFIT_BPS = 1000;
export const TAWARRUQ_TENORS = [3, 6, 12, 24] as const;
export const TAWARRUQ_DEFAULT_TENOR = 12;

export type TawarruqQuote = {
  cashAmount: number;
  profitRateBps: number;
  tenorMonths: number;
  profitAmount: number;
  deferredAmount: number;
  installmentAmount: number;
  lastInstallmentAmount: number;
};

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

export function quoteTawarruq(input: {
  cashAmount: number;
  profitRateBps: number;
  tenorMonths: number;
}): TawarruqQuote | null {
  const cashAmount = money(input.cashAmount);
  const { profitRateBps, tenorMonths } = input;
  if (!Number.isFinite(cashAmount) || cashAmount < TAWARRUQ_MIN_CASH || cashAmount > TAWARRUQ_MAX_CASH) {
    return null;
  }
  if (!(TAWARRUQ_PROFIT_RATES_BPS as readonly number[]).includes(profitRateBps)) return null;
  if (!(TAWARRUQ_TENORS as readonly number[]).includes(tenorMonths)) return null;

  const profitAmount = money((cashAmount * profitRateBps) / 10_000);
  if (profitAmount <= 0) return null;

  const deferredAmount = money(cashAmount + profitAmount);
  const installmentAmount = money(deferredAmount / tenorMonths);
  const lastInstallmentAmount = money(
    deferredAmount - installmentAmount * (tenorMonths - 1),
  );

  return {
    cashAmount,
    profitRateBps,
    tenorMonths,
    profitAmount,
    deferredAmount,
    installmentAmount,
    lastInstallmentAmount,
  };
}
