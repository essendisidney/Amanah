import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { createClient } from '@/lib/supabase/server';
import { EmptyState } from '@/features/dashboard/components/empty-state';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';
import { TawarruqRequestForm } from '@/features/finance/components/tawarruq-request-form';
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

type Membership = {
  jamiya_id: string;
  jamiya: { name: string } | { name: string }[] | null;
};

type Props = {
  searchParams?: Promise<{ jamiyaId?: string }>;
};

function circleName(jamiya: Membership['jamiya']): string {
  if (!jamiya) return 'Circle';
  if (Array.isArray(jamiya)) return jamiya[0]?.name ?? 'Circle';
  return jamiya.name;
}

function asNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const amount = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(amount) ? amount : null;
}

export default async function TawarruqPage({ searchParams }: Props) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/finance/tawarruq');

  const params = (await searchParams) ?? {};
  const { dict } = await getDictionary();
  const labels = dict.finance;

  const [{ data }, { data: membershipsData }] = await Promise.all([
    supabase
      .from('tawarruq_applications')
      .select(
        'id, amount, currency, purpose, status, partner_status, created_at, deferred_amount, profit_amount, tenor_months',
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('members')
      .select('jamiya_id, jamiya:jamiyas(name)')
      .eq('user_id', user.id)
      .eq('status', 'active'),
  ]);

  const applications = (data ?? []) as unknown as Application[];
  const memberships = (membershipsData ?? []) as unknown as Membership[];
  const circles = memberships.map((membership) => ({
    id: membership.jamiya_id,
    name: circleName(membership.jamiya),
  }));
  const preferred = params.jamiyaId?.trim() || '';
  const defaultCircleId = circles.some((circle) => circle.id === preferred) ? preferred : '';

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

      <TawarruqRequestForm circles={circles} defaultCircleId={defaultCircleId} />

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
