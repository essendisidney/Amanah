/** Pure circle money helpers — unit-tested for Wave 10. */

/** Merry-go-round pot for one cycle: everyone pays the same contribution. */
export function mgrCyclePot(memberCount: number, contributionAmount: number): number {
  const n = Math.max(0, Math.floor(memberCount));
  const c = Math.max(0, contributionAmount);
  return roundMoney(n * c);
}

/** Amount still owed on a contribution line. */
export function remainingDue(amount: number, amountPaid: number): number {
  return roundMoney(Math.max(0, amount - Math.max(0, amountPaid)));
}

/** True when paid on or before due date (date-only comparison). */
export function wasPaidOnTime(paidAt: string | Date, dueDate: string | Date): boolean {
  const paid = toDateOnly(paidAt);
  const due = toDateOnly(dueDate);
  if (!paid || !due) return false;
  return paid.getTime() <= due.getTime();
}

/** Facilitation fee / rebate on contribution (not interest). */
export function slotFeeAmount(contributionAmount: number, pct: number): number {
  if (pct <= 0 || contributionAmount <= 0) return 0;
  return roundMoney((contributionAmount * pct) / 100);
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function toDateOnly(value: string | Date): Date | null {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
