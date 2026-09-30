import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { createClient } from '@/lib/supabase/server';
import { EmptyState } from '@/features/dashboard/components/empty-state';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';
import {
  TawarruqGuaranteeButtons,
  TawarruqRequestForm,
} from '@/features/finance/components/tawarruq-request-form';
import { getDictionary } from '@/i18n/get-dictionary';

export const dynamic = 'force-dynamic';

type Application = {
  id: string;
  amount: number | string;
  currency: string;
  purpose: string;
  status: string;
  partner_status: string | null;
  created_at: string;
  deferred_amount: number | string | null;
  profit_amount: number | string | null;
  tenor_months: number | null;
};

function asNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const amount = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(amount) ? amount : null;
}

export default async function TawarruqPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/finance/tawarruq');

  const { dict } = await getDictionary();
  const labels = dict.finance;

  const [{ data }, { data: qualRaw }, { data: memberships }, { data: guaranteeRows }] =
    await Promise.all([
      supabase
        .from('tawarruq_applications')
        .select(
          'id, amount, currency, purpose, status, partner_status, created_at, deferred_amount, profit_amount, tenor_months',
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase.rpc('my_facility_qualification'),
      supabase.from('members').select('jamiya_id').eq('user_id', user.id).eq('status', 'active'),
      supabase
        .from('tawarruq_guarantees')
        .select('id, status, application:tawarruq_applications(amount, currency, purpose, status)')
        .eq('guarantor_user_id', user.id)
        .eq('status', 'pending'),
    ]);

  const applications = (data ?? []) as unknown as Application[];
  const qual = qualRaw as {
    ok?: boolean;
    tawarruq_room?: number;
    tawarruq_owed?: number;
    phone_ok?: boolean;
    kyc_status?: string;
    company_left?: number;
    overdue?: boolean;
  } | null;
  const circleIds = ((memberships ?? []) as Array<{ jamiya_id: string }>).map((row) => row.jamiya_id);
  const { data: peers } = circleIds.length
    ? await supabase
        .from('members')
        .select('user_id')
        .in('jamiya_id', circleIds)
        .eq('status', 'active')
        .neq('user_id', user.id)
    : { data: [] };
  const peerIds = [
    ...new Set(((peers ?? []) as Array<{ user_id: string }>).map((row) => row.user_id)),
  ];
  const { data: peerProfiles } = peerIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', peerIds)
    : { data: [] };
  const guarantors = (
    (peerProfiles ?? []) as Array<{ id: string; full_name: string | null }>
  ).map((profile) => ({
    id: profile.id,
    name: profile.full_name?.trim() || 'Circle member',
  }));
  const pendingGuarantees = (guaranteeRows ?? []) as unknown as Array<{
    id: string;
    application:
      | { amount: number | string; currency: string; purpose: string; status: string }
      | Array<{ amount: number | string; currency: string; purpose: string; status: string }>
      | null;
  }>;

  return (
    <div className="space-y-10">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">
          {labels.eyebrow}
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-semibold">
          {labels.tawarruqTitle}
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          {labels.tawarruqDesc} Need a smaller interest-free amount from money already paid in? Try{' '}
          <Link href={'/finance/qard' as Route} className="text-accent underline-offset-4 hover:underline">
            {labels.qardTitle}
          </Link>
          .
        </p>
      </div>

      {pendingGuarantees.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
            Guarantee requests
          </h2>
          <ul className="space-y-3">
            {pendingGuarantees.map((row) => {
              const application = Array.isArray(row.application) ? row.application[0] : row.application;
              if (!application || application.status !== 'requested') return null;
              return (
                <li key={row.id} className="jameiyah-surface space-y-3 px-4 py-4 sm:px-5">
                  <p className="text-sm text-foreground">
                    {application.purpose} · {formatCurrency(Number(application.amount), application.currency)}
                  </p>
                  <TawarruqGuaranteeButtons guaranteeId={row.id} />
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <TawarruqRequestForm
        qualification={{
          room: Number(qual?.tawarruq_room ?? 0),
          owed: Number(qual?.tawarruq_owed ?? 0),
          phoneOk: Boolean(qual?.phone_ok),
          kycApproved: qual?.kyc_status === 'approved',
          companyLeft: Number(qual?.company_left ?? 0),
          overdue: Boolean(qual?.overdue),
        }}
        guarantors={guarantors}
      />

      <section className="space-y-4">
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
          Your requests
        </h2>
        {applications.length ? (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {applications.map((application) => {
              const cash = asNumber(application.amount) ?? 0;
              const deferred = asNumber(application.deferred_amount);
              const profit = asNumber(application.profit_amount);
              return (
                <li key={application.id} className="flex flex-wrap justify-between gap-4 px-5 py-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{application.purpose}</p>
                      <StatusBadge status={application.status} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatDate(application.created_at)}
                      {application.tenor_months ? ` · ${application.tenor_months} months` : ''}
                      {application.partner_status ? ` · partner: ${application.partner_status}` : ''}
                    </p>
                    {deferred != null && profit != null ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        Repay {formatCurrency(deferred, application.currency)} to Jameiyah · Jameiyah
                        earns {formatCurrency(profit, application.currency)}
                      </p>
                    ) : null}
                  </div>
                  <strong>{formatCurrency(cash, application.currency)}</strong>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            title="No requests yet"
            description="Submit a request when you want Jameiyah to finance you through a commodity sale."
          />
        )}
      </section>
    </div>
  );
}
