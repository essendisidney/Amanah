/**
 * Which circle a payment on Jameiyah's bank statement is for: the circle's payment reference
 * (JM10001) in the narration, or else the payer's phone when it belongs to an officer of one circle.
 */
import { planListPrice, BILLING_PERIODS, type BillingPeriod, type PlanPricing } from '../../circles/lib/plan-price.ts';

export type BillingCircle = {
  id: string;
  name: string;
  billingRef: string;
  members: number;
  /** Plan the circle is on now (or trying), if paid. */
  planId: string | null;
  period: BillingPeriod | null;
  /** Officer phones as 2547XXXXXXXX. */
  officerPhones: string[];
};

export type BillingPlan = PlanPricing & { id: string; name: string; max_members: number };

export function findCircle(details: string, phone: string | null, circles: BillingCircle[]): BillingCircle | null {
  const refs = details.toUpperCase().match(/JM\s?\d{5,}/g) ?? [];
  for (const raw of refs) {
    const hit = circles.find((c) => c.billingRef === raw.replace(/\s/g, ''));
    if (hit) return hit;
  }
  if (phone) {
    const byPhone = circles.filter((c) => c.officerPhones.includes(phone));
    if (byPhone.length === 1) return byPhone[0]!;
  }
  return null;
}

/** The plan and period this amount most likely pays for: an exact price first, else the circle's own plan. */
export function guessPlan(
  amount: number,
  circle: BillingCircle,
  plans: BillingPlan[],
): { planId: string; period: BillingPeriod } | null {
  const paid = plans.filter((p) => Number(p.price_kes) > 0 && p.max_members >= circle.members);
  const own = paid.find((p) => p.id === circle.planId);
  const ordered = own ? [own, ...paid.filter((p) => p !== own)] : paid;
  for (const plan of ordered) {
    for (const period of BILLING_PERIODS) {
      if (planListPrice(plan, circle.members, period) === amount) return { planId: plan.id, period };
    }
  }
  const fallback = own ?? paid[0];
  return fallback ? { planId: fallback.id, period: circle.period ?? 'monthly' } : null;
}
