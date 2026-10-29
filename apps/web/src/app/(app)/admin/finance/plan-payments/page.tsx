import type { Metadata } from 'next';
import type { SupabaseClient } from '@supabase/supabase-js';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { Button, Input, Label } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { callRpc } from '@/lib/supabase/rpc';
import { fetchAllRows, fetchByIdChunks } from '@/lib/supabase/fetch-all';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import { AdminSectionHeader } from '@/features/admin/components/admin-section-header';
import { PlanPaymentsForm } from '@/features/admin/components/plan-payments-form';
import { setJameiyahPaymentDetailsAction } from '@/features/admin/actions/plan-payment-actions';
import type { BillingCircle, BillingPlan } from '@/features/admin/lib/plan-payment-match';
import { findPhone } from '@/features/circles/lib/statement-match';
import { isBillingPeriod } from '@/features/circles/lib/plan-price';

export const metadata: Metadata = { title: 'Admin · Plan payments' };
export const dynamic = 'force-dynamic';

const OFFICER_ROLES = ['circle_admin', 'chair', 'treasurer', 'secretary'];

type Details = {
  account_name?: string;
  bank?: string;
  branch?: string;
  account?: string;
  paybill?: string;
  mpesa_account?: string;
};

type Payment = {
  id: string;
  reference: string;
  paid_on: string | null;
  amount: number | string;
  jamiya_id: string;
  plan_id: string;
  billing_period: string;
  status: string;
};

const STATUS_LABEL: Record<string, string> = { applied: 'Plan paid', held: 'Held (short)', used: 'Joined to a later payment' };

export default async function AdminPlanPaymentsPage() {
  await requireAdminAccess('admin');
  const supabase = await createClient();
  // billing_ref, platform_plan_payments and the plan price columns are newer than the generated types.
  const db = supabase as unknown as SupabaseClient;

  const [jamiyas, subs, officers, { data: planRows }, { data: settings }, { data: payments }, { data: refsPack }] =
    await Promise.all([
      fetchAllRows<{ id: string; name: string; billing_ref: string; member_count: number | null }>((from, to) =>
        db.from('jamiyas').select('id, name, billing_ref, member_count').order('name').range(from, to),
      ),
      fetchAllRows<{ jamiya_id: string; plan_id: string; billing_period: string | null; status: string }>(
        (from, to) => db.from('circle_subscriptions').select('jamiya_id, plan_id, billing_period, status').range(from, to),
      ),
      fetchAllRows<{ jamiya_id: string; user_id: string }>((from, to) =>
        db
          .from('members')
          .select('jamiya_id, user_id')
          .in('role', OFFICER_ROLES)
          .eq('status', 'active')
          .range(from, to),
      ),
      db
        .from('platform_plans')
        .select('id, name, max_members, price_kes, price_quarterly_kes, price_annual_kes, included_members, per_member_kes, price_cap_kes, sort_order')
        .eq('active', true)
        .order('sort_order'),
      db.from('platform_settings').select('value').eq('key', 'jameiyah_payment_details').maybeSingle(),
      db
        .from('platform_plan_payments')
        .select('id, reference, paid_on, amount, jamiya_id, plan_id, billing_period, status')
        .order('created_at', { ascending: false })
        .limit(100),
      callRpc('admin_plan_payment_refs', {}),
    ]);

  const profiles = await fetchByIdChunks<{ id: string; phone: string | null }>(
    [...new Set(officers.map((o) => o.user_id))],
    (chunk) => db.from('profiles').select('id, phone').in('id', chunk),
  );
  const phoneByUser = new Map(profiles.map((p) => [p.id, p.phone ? findPhone(p.phone) : null]));
  const subByCircle = new Map(subs.map((s) => [s.jamiya_id, s]));
  const officerPhones = new Map<string, string[]>();
  for (const o of officers) {
    const phone = phoneByUser.get(o.user_id);
    if (!phone) continue;
    officerPhones.set(o.jamiya_id, [...(officerPhones.get(o.jamiya_id) ?? []), phone]);
  }

  const circles: BillingCircle[] = jamiyas.map((j) => {
    const sub = subByCircle.get(j.id);
    const paidPlan = sub && sub.plan_id !== 'free' && sub.status !== 'cancelled' ? sub.plan_id : null;
    return {
      id: j.id,
      name: j.name,
      billingRef: j.billing_ref,
      members: Number(j.member_count ?? 0),
      planId: paidPlan,
      period: paidPlan && isBillingPeriod(sub?.billing_period) ? sub!.billing_period as BillingCircle['period'] : null,
      officerPhones: officerPhones.get(j.id) ?? [],
    };
  });
  const plans = (planRows ?? []) as BillingPlan[];
  const nameById = new Map(jamiyas.map((j) => [j.id, j.name]));
  const planName = new Map(plans.map((p) => [p.id, p.name]));
  const details = ((settings as { value?: Details } | null)?.value ?? {}) as Details;
  const recordedRefs = ((refsPack as { refs?: string[] } | null)?.refs ?? []) as string[];

  return (
    <div className="space-y-4">
      <AdminSectionHeader
        title="Plan payments"
        subtitle="Circles pay Jameiyah by M-Pesa or bank transfer, quoting their JM reference. Read the bank statement here to switch plans on."
      />

      <section className="jameiyah-surface space-y-3 px-4 py-4 sm:px-5">
        <h2 className="font-semibold">Where circles pay</h2>
        <p className="text-sm text-muted-foreground">
          Officers see these on their Circle plan card. In the M-Pesa account, {'{ref}'} is replaced by the
          circle&apos;s reference, for example <code>711920#{'{ref}'}</code>. Leave the paybill empty until the bank
          confirms the format; officers then see the bank transfer details only.
        </p>
        <form action={setJameiyahPaymentDetailsAction} className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ['account_name', 'Account name'],
              ['bank', 'Bank'],
              ['branch', 'Branch'],
              ['account', 'Account number'],
              ['paybill', 'M-Pesa paybill'],
              ['mpesa_account', 'M-Pesa account (use {ref})'],
            ] as const
          ).map(([name, label]) => (
            <div key={name} className="space-y-1">
              <Label htmlFor={`pd-${name}`}>{label}</Label>
              <Input id={`pd-${name}`} name={name} maxLength={80} defaultValue={details[name] ?? ''} />
            </div>
          ))}
          <div className="sm:col-span-2">
            <Button type="submit" className="min-h-11">
              Save payment details
            </Button>
          </div>
        </form>
      </section>

      <PlanPaymentsForm circles={circles} plans={plans} recordedRefs={recordedRefs} />

      <section className="jameiyah-surface space-y-2 px-4 py-4 sm:px-5">
        <h2 className="font-semibold">Recorded payments</h2>
        {((payments ?? []) as Payment[]).length === 0 ? (
          <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
        ) : (
          <ul className="divide-y divide-border/70 text-sm">
            {((payments ?? []) as Payment[]).map((p) => (
              <li key={p.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>
                  {nameById.get(p.jamiya_id) ?? 'Circle'} · {planName.get(p.plan_id) ?? p.plan_id} {p.billing_period} ·{' '}
                  {p.reference}
                  {p.paid_on ? ` · ${formatDate(p.paid_on)}` : ''} · {STATUS_LABEL[p.status] ?? p.status}
                </span>
                <span className="font-medium">{formatCurrency(Number(p.amount), 'KES')}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
