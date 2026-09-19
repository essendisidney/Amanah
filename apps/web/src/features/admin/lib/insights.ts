import { createClient } from '@/lib/supabase/server';

export type CountMap = Record<string, number>;

export type AdminInsights = {
  generated_at: string;
  activation: {
    profiles_total: number;
    profiles_7d: number;
    profiles_30d: number;
    with_membership: number;
    with_paid_contribution: number;
    avg_hours_to_first_pay: number | null;
    officers_active: number;
    members_active: number;
    invites_pending: number;
    invites_accepted: number;
  };
  payments: {
    intents_total: number;
    intents_by_status: CountMap;
    intents_by_provider: CountMap;
    intents_7d: number;
    intents_completed_7d: number;
    intents_failed_7d: number;
    top_errors: Array<{ error: string; n: number }>;
    transactions_by_type: CountMap;
    transactions_completed_30d: number;
    contribution_payments_30d: number;
    payment_methods: CountMap;
  };
  circle_health: {
    circles_total: number;
    circles_active: number;
    contributions_paid: number;
    contributions_pending: number;
    contributions_overdue: number;
    on_time_rate_pct: number | null;
    open_collection_cases: number;
    dormant_circles_14d: number;
    circles: Array<{
      id: string;
      name: string;
      slug: string;
      status: string;
      members: number;
      pending: number;
      paid: number;
      overdue: number;
    }>;
  };
};

function asCountMap(value: unknown): CountMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: CountMap = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const n = typeof v === 'number' ? v : Number(v);
    if (Number.isFinite(n)) out[k] = n;
  }
  return out;
}

export async function fetchAdminInsights(): Promise<AdminInsights | null> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('admin_product_insights');
  if (error || !data) {
    console.error('[admin_insights]', error?.message ?? 'empty');
    return null;
  }

  const raw = data as AdminInsights;
  return {
    generated_at: String(raw.generated_at ?? new Date().toISOString()),
    activation: {
      profiles_total: Number(raw.activation?.profiles_total ?? 0),
      profiles_7d: Number(raw.activation?.profiles_7d ?? 0),
      profiles_30d: Number(raw.activation?.profiles_30d ?? 0),
      with_membership: Number(raw.activation?.with_membership ?? 0),
      with_paid_contribution: Number(raw.activation?.with_paid_contribution ?? 0),
      avg_hours_to_first_pay:
        raw.activation?.avg_hours_to_first_pay == null
          ? null
          : Number(raw.activation.avg_hours_to_first_pay),
      officers_active: Number(raw.activation?.officers_active ?? 0),
      members_active: Number(raw.activation?.members_active ?? 0),
      invites_pending: Number(raw.activation?.invites_pending ?? 0),
      invites_accepted: Number(raw.activation?.invites_accepted ?? 0),
    },
    payments: {
      intents_total: Number(raw.payments?.intents_total ?? 0),
      intents_by_status: asCountMap(raw.payments?.intents_by_status),
      intents_by_provider: asCountMap(raw.payments?.intents_by_provider),
      intents_7d: Number(raw.payments?.intents_7d ?? 0),
      intents_completed_7d: Number(raw.payments?.intents_completed_7d ?? 0),
      intents_failed_7d: Number(raw.payments?.intents_failed_7d ?? 0),
      top_errors: Array.isArray(raw.payments?.top_errors)
        ? raw.payments.top_errors.map((e) => ({
            error: String((e as { error?: string }).error ?? ''),
            n: Number((e as { n?: number }).n ?? 0),
          }))
        : [],
      transactions_by_type: asCountMap(raw.payments?.transactions_by_type),
      transactions_completed_30d: Number(raw.payments?.transactions_completed_30d ?? 0),
      contribution_payments_30d: Number(raw.payments?.contribution_payments_30d ?? 0),
      payment_methods: asCountMap(raw.payments?.payment_methods),
    },
    circle_health: {
      circles_total: Number(raw.circle_health?.circles_total ?? 0),
      circles_active: Number(raw.circle_health?.circles_active ?? 0),
      contributions_paid: Number(raw.circle_health?.contributions_paid ?? 0),
      contributions_pending: Number(raw.circle_health?.contributions_pending ?? 0),
      contributions_overdue: Number(raw.circle_health?.contributions_overdue ?? 0),
      on_time_rate_pct:
        raw.circle_health?.on_time_rate_pct == null
          ? null
          : Number(raw.circle_health.on_time_rate_pct),
      open_collection_cases: Number(raw.circle_health?.open_collection_cases ?? 0),
      dormant_circles_14d: Number(raw.circle_health?.dormant_circles_14d ?? 0),
      circles: Array.isArray(raw.circle_health?.circles)
        ? raw.circle_health.circles.map((c) => ({
            id: String((c as { id: string }).id),
            name: String((c as { name: string }).name),
            slug: String((c as { slug: string }).slug),
            status: String((c as { status: string }).status),
            members: Number((c as { members: number }).members ?? 0),
            pending: Number((c as { pending: number }).pending ?? 0),
            paid: Number((c as { paid: number }).paid ?? 0),
            overdue: Number((c as { overdue: number }).overdue ?? 0),
          }))
        : [],
    },
  };
}

export function pct(numerator: number, denominator: number): number | null {
  if (!denominator) return null;
  return Math.round((1000 * numerator) / denominator) / 10;
}

export function formatCountMap(map: CountMap): Array<{ label: string; value: number }> {
  return Object.entries(map)
    .map(([label, value]) => ({ label: label.replaceAll('_', ' '), value }))
    .sort((a, b) => b.value - a.value);
}
