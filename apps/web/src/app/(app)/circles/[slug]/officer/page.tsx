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
import {
  confirmCircleDualApprovalAction,
  setCircleDualApprovalAction,
  setCirclePlanAction,
} from '@/features/circles/actions/billing-actions';
import { decideQardAction } from '@/features/finance/actions';
import { Input, Label } from '@jamiya/ui';
import { getDictionary } from '@/i18n/get-dictionary';
import { CircleNoticeBanner } from '@/features/circles/components/circle-notice-banner';

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

async function decideQardFormAction(formData: FormData) {
  'use server';
  const slug = String(formData.get('slug') ?? '');
  await decideQardAction(formData);
  revalidatePath(`/circles/${slug}/officer`);
  revalidatePath(`/circles/${slug}`);
  revalidatePath('/finance/qard');
}

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ notice?: string; noticeType?: string }>;
};

export default async function OfficerConsolePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const notices = (await searchParams) ?? {};
  const { dict } = await getDictionary();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/circles/${slug}/officer`);

  const { data: jamiyaData } = await supabase
    .from('jamiyas')
    .select('id, name, slug, currency, contribution_amount')
    .eq('slug', slug)
    .maybeSingle();
  if (!jamiyaData) notFound();

  const jamiya = jamiyaData as unknown as {
    id: string;
    name: string;
    slug: string;
    currency: string;
    contribution_amount: number | string;
  };

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

  // Ops gap tables/columns may lag generated Database types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const [
    { data: lateDues },
    { data: grace },
    { data: payouts },
    { data: members },
    { data: cases },
    { data: dualPending },
    { data: planPack },
    { data: plans },
    { data: dualSettings },
    { data: pendingLoans },
    { data: pendingGuarantees },
  ] =
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
        .select('id, role, status, user_id, member_code')
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
      db
        .from('dual_approval_requests')
        .select('id, kind, entity_id, amount, currency, status, first_approver_id, created_at')
        .eq('jamiya_id', jamiya.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(30),
      callRpc('get_circle_plan', { p_jamiya_id: jamiya.id }),
      db
        .from('platform_plans')
        .select('id, name, price_kes, max_members')
        .eq('active', true)
        .order('sort_order', { ascending: true }),
      db
        .from('jamiyas')
        .select('dual_approval_enabled, dual_approval_threshold')
        .eq('id', jamiya.id)
        .maybeSingle(),
      supabase
        .from('qard_loans')
        .select('id, amount, currency, status, purpose, borrower_id, created_at')
        .eq('jamiya_id', jamiya.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('qard_guarantees')
        .select('id, loan_id, status, guarantor_user_id')
        .eq('jamiya_id', jamiya.id)
        .eq('status', 'pending')
        .limit(40),
    ]);

  const memberRows = (members ?? []) as Array<{
    id: string;
    role: string;
    status: string;
    user_id: string;
    member_code: string | null;
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

  const dualMeta = dualSettings as {
    dual_approval_enabled?: boolean;
    dual_approval_threshold?: number | string;
  } | null;
  const jamiyaRow = {
    ...jamiya,
    dual_approval_enabled: Boolean(dualMeta?.dual_approval_enabled),
    dual_approval_threshold: dualMeta?.dual_approval_threshold ?? 10000,
  };
  const planInfo = planPack as {
    ok?: boolean;
    plan_id?: string;
    status?: string;
    renews_at?: string | null;
    plan?: {
      name?: string;
      price_kes?: number;
      max_members?: number;
      exports_included?: boolean;
    };
  } | null;
  const planRows = (plans ?? []) as Array<{
    id: string;
    name: string;
    price_kes: number | string;
    max_members: number;
  }>;
  const dualRows = (dualPending ?? []) as Array<{
    id: string;
    kind: string;
    amount: number | string;
    currency: string;
    first_approver_id: string;
    created_at: string;
  }>;
  const loanRows = (pendingLoans ?? []) as Array<{
    id: string;
    amount: number | string;
    currency: string;
    purpose: string | null;
    created_at: string;
  }>;
  const guaranteeRows = (pendingGuarantees ?? []) as Array<{
    id: string;
    loan_id: string;
    status: string;
  }>;
  const guaranteeCountByLoan = new Map<string, number>();
  for (const g of guaranteeRows) {
    guaranteeCountByLoan.set(g.loan_id, (guaranteeCountByLoan.get(g.loan_id) ?? 0) + 1);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-6 py-10">
      <CircleNoticeBanner notice={notices.notice} noticeType={notices.noticeType} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">
            {dict.officer.title}
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold">
            {jamiyaRow.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Role: {(membership as { role: string }).role.replaceAll('_', ' ')}
            {planInfo?.plan_id ? ` · Plan ${planInfo.plan?.name ?? planInfo.plan_id}` : ''}
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
            href={`/circles/${slug}/treasury` as Route}
            className="rounded-md border border-border px-3 py-1.5 text-sm"
          >
            Treasury
          </Link>
          <Link
            href={`/circles/${slug}/shares` as Route}
            className="rounded-md border border-border px-3 py-1.5 text-sm"
          >
            Shares
          </Link>
          <Link
            href={`/circles/${slug}/journal` as Route}
            className="rounded-md border border-border px-3 py-1.5 text-sm"
          >
            Journal
          </Link>
          <Link
            href={`/circles/${slug}/invoices` as Route}
            className="rounded-md border border-border px-3 py-1.5 text-sm"
          >
            Invoices
          </Link>
          <Link
            href={`/circles/${slug}/statement` as Route}
            className="rounded-md border border-border px-3 py-1.5 text-sm"
          >
            ID reports
          </Link>
          <Link
            href={`/circles/${slug}/report` as Route}
            className="rounded-md border border-border px-3 py-1.5 text-sm"
          >
            GL report
          </Link>
          <Link
            href={`/circles/${slug}/arrears` as Route}
            className="rounded-md border border-border px-3 py-1.5 text-sm"
          >
            {dict.circle.arrears}
          </Link>
          <Link
            href={`/circles/${slug}/audit` as Route}
            className="rounded-md border border-border px-3 py-1.5 text-sm"
          >
            {dict.circle.auditTrail}
          </Link>
        </div>
      </div>

      <OfficerOverviewStrip
        slug={slug}
        lateCount={late.length}
        pendingGrace={(grace ?? []).length}
        pendingQard={loanRows.length}
        pendingDual={dualRows.length}
        openCases={(cases ?? []).length}
        nextPayoutLabel={nextPayout ? `Cycle ${nextPayout.cycle_number}` : null}
        nextPayoutDate={nextPayout?.scheduled_date ?? null}
        nextPayoutAmount={
          nextPayout ? Number(nextPayout.amount) : null
        }
        currency={jamiyaRow.currency}
      />

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-border bg-card p-5">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
            Circle plan
          </h2>
          <p className="text-sm text-muted-foreground">
            Current:{' '}
            <span className="font-medium text-foreground">
              {planInfo?.plan?.name ?? 'Free'}
            </span>
            {planInfo?.status && planInfo.status !== 'active'
              ? ` · ${planInfo.status.replaceAll('_', ' ')}`
              : ''}
            {planInfo?.renews_at
              ? ` · renews ${formatDate(planInfo.renews_at)}`
              : ''}
            . Starter and Pro charge the officer wallet in KES for 30 days (auto-renews if
            balance allows). See{' '}
            <Link href={'/pricing' as Route} className="underline-offset-4 hover:underline">
              pricing
            </Link>
            .
          </p>
          {planInfo?.status === 'past_due' ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              Plan is past due. Top up your wallet, then tap the plan button again to reactivate.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {planRows.map((plan) => (
              <form key={plan.id} action={setCirclePlanAction}>
                <input type="hidden" name="jamiyaId" value={jamiyaRow.id} />
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="planId" value={plan.id} />
                <Button
                  type="submit"
                  size="sm"
                  variant={planInfo?.plan_id === plan.id ? 'default' : 'outline'}
                >
                  {plan.name}
                  {Number(plan.price_kes) > 0
                    ? ` · ${formatCurrency(Number(plan.price_kes), 'KES')}`
                    : ''}
                </Button>
              </form>
            ))}
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-border bg-card p-5">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
            Dual approval
          </h2>
          <p className="text-sm text-muted-foreground">
            Require a second officer for payouts and loan approvals at/above the threshold.
          </p>
          <form action={setCircleDualApprovalAction} className="space-y-3">
            <input type="hidden" name="jamiyaId" value={jamiyaRow.id} />
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="enabled" value="false" />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="enabled"
                value="true"
                defaultChecked={Boolean(jamiyaRow.dual_approval_enabled)}
              />
              Enable dual approval
            </label>
            <div className="space-y-1">
              <Label htmlFor="threshold">Threshold ({jamiyaRow.currency})</Label>
              <Input
                id="threshold"
                name="threshold"
                type="number"
                min={0}
                step={100}
                defaultValue={Number(jamiyaRow.dual_approval_threshold ?? 10000)}
              />
            </div>
            <Button type="submit" size="sm">
              Save dual-approval settings
            </Button>
          </form>
        </div>
      </section>

      <section id="officer-qard" className="space-y-3">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          {dict.officer.qardQueue}
        </h2>
        {!loanRows.length ? (
          <p className="text-sm text-muted-foreground">{dict.officer.noPendingQard}</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {loanRows.map((loan) => (
              <li
                key={loan.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">
                    {formatCurrency(Number(loan.amount), loan.currency)} ·{' '}
                    {loan.purpose ?? dict.loans.purpose}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(loan.created_at)}
                    {(guaranteeCountByLoan.get(loan.id) ?? 0) > 0
                      ? ` · ${dict.officer.kafalaPending}: ${guaranteeCountByLoan.get(loan.id)}`
                      : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <form action={decideQardFormAction}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="loanId" value={loan.id} />
                    <input type="hidden" name="approve" value="true" />
                    <Button type="submit" size="sm">
                      {dict.officer.approveLoan}
                    </Button>
                  </form>
                  <form action={decideQardFormAction}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="loanId" value={loan.id} />
                    <input type="hidden" name="approve" value="false" />
                    <Button type="submit" size="sm" variant="outline">
                      {dict.officer.rejectLoan}
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {dualRows.length > 0 ? (
        <section id="officer-dual" className="space-y-3">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
            Awaiting second officer
          </h2>
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {dualRows.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium capitalize">
                    {row.kind.replaceAll('_', ' ')} ·{' '}
                    {formatCurrency(Number(row.amount), row.currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    First: {row.first_approver_id.slice(0, 8)}… · {formatDate(row.created_at)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <form action={confirmCircleDualApprovalAction}>
                    <input type="hidden" name="requestId" value={row.id} />
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="approve" value="true" />
                    <Button type="submit" size="sm">
                      Second approve
                    </Button>
                  </form>
                  <form action={confirmCircleDualApprovalAction}>
                    <input type="hidden" name="requestId" value={row.id} />
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="approve" value="false" />
                    <Button type="submit" size="sm" variant="outline">
                      Reject
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section id="officer-dues" className="space-y-3">
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

      <section id="officer-grace" className="space-y-3">
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

      <section id="officer-cases" className="space-y-3">
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
                    {m.member_code ? `${m.member_code} · ` : ''}
                    {m.role} · {m.status}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/circles/${slug}/statement?memberId=${m.id}` as Route}>
                      ID report
                    </Link>
                  </Button>
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
