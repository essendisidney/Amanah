import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { notFound, redirect } from 'next/navigation';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { callRpc } from '@/lib/supabase/rpc';
import { revalidatePath } from 'next/cache';
import { OfficerOverviewStrip } from '@/features/circles/components/officer-overview';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';

export const metadata: Metadata = { title: 'Officer console' };
export const dynamic = 'force-dynamic';

const OFFICER_ROLES = new Set(['circle_admin', 'chair', 'treasurer', 'secretary']);

async function decideGraceFormAction(formData: FormData) {
  'use server';
  const slug = String(formData.get('slug') ?? '');
  const requestId = String(formData.get('requestId') ?? '');
  const approve = String(formData.get('approve') ?? '') === '1';
  await callRpc('decide_grace_request', { p_request_id: requestId, p_approve: approve });
  revalidatePath(`/circles/${slug}/officer`);
  revalidatePath(`/circles/${slug}/community`);
}

async function vouchFormAction(formData: FormData) {
  'use server';
  const slug = String(formData.get('slug') ?? '');
  const memberId = String(formData.get('memberId') ?? '');
  const approve = String(formData.get('approve') ?? '') === '1';
  await callRpc('vouch_for_member', {
    p_member_id: memberId,
    p_approve: approve,
    p_notes: null,
  });
  revalidatePath(`/circles/${slug}/officer`);
  revalidatePath(`/circles/${slug}`);
}

type Props = { params: Promise<{ slug: string }> };

export default async function OfficerConsolePage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/circles/${slug}/officer`);

  const { data: jamiya } = await supabase
    .from('jamiyas')
    .select('id, name, slug, currency, contribution_amount')
    .eq('slug', slug)
    .maybeSingle();
  if (!jamiya) notFound();

  const { data: membership } = await supabase
    .from('members')
    .select('id, role, status')
    .eq('jamiya_id', jamiya.id)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (!membership || !OFFICER_ROLES.has((membership as { role: string }).role)) {
    redirect(`/circles/${slug}`);
  }

  const [{ data: lateDues }, { data: grace }, { data: payouts }, { data: members }, { data: cases }] =
    await Promise.all([
      supabase
        .from('contributions')
        .select('id, member_id, amount, currency, status, due_date, cycle_number')
        .eq('jamiya_id', jamiya.id)
        .in('status', ['late', 'pending', 'partial'])
        .order('due_date', { ascending: true })
        .limit(40),
      supabase
        .from('grace_period_requests')
        .select('id, requested_days, reason, status, created_at, requester_id')
        .eq('jamiya_id', jamiya.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('payouts')
        .select('id, cycle_number, amount, currency, scheduled_date, status')
        .eq('jamiya_id', jamiya.id)
        .in('status', ['scheduled', 'pending'])
        .order('scheduled_date', { ascending: true })
        .limit(5),
      supabase
        .from('members')
        .select('id, role, status, user_id')
        .eq('jamiya_id', jamiya.id)
        .order('created_at', { ascending: true })
        .limit(80),
      supabase
        .from('collection_cases')
        .select('id, status, severity, amount_due, currency, days_overdue, user_id')
        .eq('jamiya_id', jamiya.id)
        .in('status', ['open', 'contacted', 'promised', 'partially_paid'])
        .order('days_overdue', { ascending: false })
        .limit(20),
    ]);

  const memberRows = (members ?? []) as Array<{
    id: string;
    role: string;
    status: string;
    user_id: string;
  }>;
  const userIds = memberRows.map((m) => m.user_id);
  const { data: profiles } = userIds.length
    ? await supabase.from('profiles').select('id, full_name, email').in('id', userIds)
    : { data: [] };
  const profileMap = new Map(
    ((profiles ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>).map(
      (p) => [p.id, p],
    ),
  );

  const late = ((lateDues ?? []) as Array<{ status: string }>).filter((d) => d.status === 'late');
  const nextPayout = (payouts ?? [])[0] as
    | {
        cycle_number: number;
        amount: number | string;
        currency: string;
        scheduled_date: string | null;
      }
    | undefined;

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">
            Officer console
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold">
            {jamiya.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Role: {(membership as { role: string }).role.replaceAll('_', ' ')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/circles/${slug}` as Route}
            className="rounded-md border border-border px-3 py-1.5 text-sm"
          >
            Circle
          </Link>
          <Link
            href={`/circles/${slug}/community` as Route}
            className="rounded-md border border-border px-3 py-1.5 text-sm"
          >
            Community
          </Link>
          <Link
            href={`/circles/${slug}/report` as Route}
            className="rounded-md border border-border px-3 py-1.5 text-sm"
          >
            Report
          </Link>
        </div>
      </div>

      <OfficerOverviewStrip
        slug={slug}
        lateCount={late.length}
        pendingGrace={(grace ?? []).length}
        nextPayoutLabel={nextPayout ? `Cycle ${nextPayout.cycle_number}` : null}
        nextPayoutDate={nextPayout?.scheduled_date ?? null}
        nextPayoutAmount={
          nextPayout ? Number(nextPayout.amount) : null
        }
        currency={jamiya.currency}
      />

      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          Late & pending dues
        </h2>
        {!(lateDues ?? []).length ? (
          <p className="text-sm text-muted-foreground">All clear.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {((lateDues ?? []) as Array<{
              id: string;
              cycle_number: number;
              amount: number | string;
              currency: string;
              status: string;
              due_date: string;
            }>).map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <p className="text-sm">
                  Cycle {row.cycle_number} · {formatCurrency(Number(row.amount), row.currency)} · due{' '}
                  {formatDate(row.due_date)}
                </p>
                <StatusBadge status={row.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          Pending grace
        </h2>
        {!(grace ?? []).length ? (
          <p className="text-sm text-muted-foreground">No open grace requests.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {((grace ?? []) as Array<{
              id: string;
              requested_days: number;
              reason: string | null;
              created_at: string;
            }>).map((row) => (
              <li key={row.id} className="space-y-2 px-4 py-3">
                <p className="text-sm">
                  {row.requested_days} days · {row.reason ?? 'No reason'} ·{' '}
                  {formatDate(row.created_at)}
                </p>
                <div className="flex gap-2">
                  <form action={decideGraceFormAction}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="requestId" value={row.id} />
                    <input type="hidden" name="approve" value="1" />
                    <Button type="submit" size="sm">
                      Approve
                    </Button>
                  </form>
                  <form action={decideGraceFormAction}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="requestId" value={row.id} />
                    <input type="hidden" name="approve" value="0" />
                    <Button type="submit" size="sm" variant="outline">
                      Reject
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          Collection cases
        </h2>
        {!(cases ?? []).length ? (
          <p className="text-sm text-muted-foreground">
            No open cases for this circle. Platform collections sync creates cases for late dues.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {((cases ?? []) as Array<{
              id: string;
              status: string;
              severity: string;
              amount_due: number | string;
              currency: string;
              days_overdue: number;
            }>).map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <p className="text-sm">
                  {formatCurrency(Number(row.amount_due), row.currency)} · {row.days_overdue}d
                  overdue
                </p>
                <div className="flex gap-2">
                  <StatusBadge status={row.status} />
                  <StatusBadge status={row.severity} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">Members</h2>
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {memberRows.map((m) => {
            const profile = profileMap.get(m.user_id);
            return (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">
                    {profile?.full_name ?? profile?.email ?? m.user_id.slice(0, 8)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {m.role} · {m.status}
                  </p>
                </div>
                <div className="flex gap-2">
                  <form action={vouchFormAction}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="memberId" value={m.id} />
                    <input type="hidden" name="approve" value="1" />
                    <Button type="submit" size="sm" variant="outline">
                      Vouch
                    </Button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
