/** Jameiyah offers Tawarruq. The murabaha profit is Jameiyah's income. */
export const TAWARRUQ_MIN_CASH = 1000;
export const TAWARRUQ_MAX_CASH = 5_000_000;
/** Jameiyah sets the profit rate for each term (platform setting 'tawarruq_profit_bps'). */
export const TAWARRUQ_MAX_PROFIT_BPS = 5000;
export const TAWARRUQ_TENORS = [3, 6, 12, 24] as const;
export const TAWARRUQ_DEFAULT_TENOR = 12;

/** Jameiyah's rate for each term in basis points, keyed by months ("12": 1000). */
export type TawarruqRates = Record<string, number>;

export function tawarruqRateFor(rates: TawarruqRates, tenorMonths: number): number | null {
  const bps = Number(rates[String(tenorMonths)]);
  return Number.isInteger(bps) && bps > 0 && bps <= TAWARRUQ_MAX_PROFIT_BPS ? bps : null;
}

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
  if (!Number.isInteger(profitRateBps) || profitRateBps <= 0 || profitRateBps > TAWARRUQ_MAX_PROFIT_BPS) {
    return null;
  }
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
