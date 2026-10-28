/** Circle plan prices, the same rules as private.circle_plan_list_price in the database. */

export type BillingPeriod = 'monthly' | 'quarterly' | 'annual';

export const BILLING_PERIODS: BillingPeriod[] = ['monthly', 'quarterly', 'annual'];

export const PERIOD_LABEL: Record<BillingPeriod, { adjective: string; per: string; length: string }> = {
  monthly: { adjective: 'Monthly', per: '/ month', length: '1 month' },
  quarterly: { adjective: 'Quarterly', per: '/ quarter', length: '3 months' },
  annual: { adjective: 'Yearly', per: '/ year', length: '1 year' },
};

export function isBillingPeriod(value: unknown): value is BillingPeriod {
  return value === 'monthly' || value === 'quarterly' || value === 'annual';
}

export type PlanPricing = {
  price_kes: number | string;
  price_quarterly_kes?: number | string | null;
  price_annual_kes?: number | string | null;
  included_members?: number | null;
  per_member_kes?: number | string | null;
  price_cap_kes?: number | string | null;
};

const num = (v: number | string | null | undefined) => (v == null || v === '' ? null : Number(v));

/** What a circle of `members` pays for one billing period, before any launch discount. */
export function planListPrice(plan: PlanPricing, members: number, period: BillingPeriod): number {
  const base = num(plan.price_kes) ?? 0;
  const included = plan.included_members ?? null;
  const extra =
    included == null ? 0 : (num(plan.per_member_kes) ?? 0) * Math.max(members - included, 0);
  const cap = num(plan.price_cap_kes);
  const monthly = cap == null ? base + extra : Math.min(base + extra, cap);
  if (period === 'quarterly') {
    const fixed = num(plan.price_quarterly_kes);
    return extra === 0 && fixed != null ? fixed : Math.round(monthly * 3 * 0.95);
  }
  if (period === 'annual') {
    const fixed = num(plan.price_annual_kes);
    return extra === 0 && fixed != null ? fixed : monthly * 10;
  }
  return monthly;
}
