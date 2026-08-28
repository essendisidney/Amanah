import type { Metadata } from 'next';
import { AppPage } from '@/components/app-page';
import Link from 'next/link';
import type { Route } from 'next';
import { notFound, redirect } from 'next/navigation';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { callRpc } from '@/lib/supabase/rpc';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';
import { PrintReportButton } from '@/features/circles/components/print-report-button';
import { OpenPenaltiesPanel } from '@/features/circles/components/open-penalties-panel';

export const metadata: Metadata = { title: 'Member statement' };
export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ memberId?: string }>;
};

type StatementSummary = {
  share_capital?: number;
  share_units?: number;
  schedule_contributions_due?: number;
  schedule_contributions_paid?: number;
  schedule_contributions_outstanding?: number;
  cycles_paid?: number;
  cycles_open?: number;
  book_contributions?: number;
  contributions_so_far?: number;
  penalties_total?: number;
  penalties_open?: number;
  penalties_paid?: number;
  loan_principal?: number;
  loan_repaid?: number;
  loan_outstanding?: number;
  savings_total?: number;
};

function money(n: unknown, currency: string) {
  const v = typeof n === 'number' ? n : Number(n ?? 0);
  return formatCurrency(Number.isFinite(v) ? v : 0, currency);
}

function kindLabel(kind: unknown) {
  return String(kind ?? 'fine').replaceAll('_', ' ');
}

export default async function MemberStatementPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const qs = (await searchParams) ?? {};
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/phone?next=/circles/${slug}/statement`);

  const { data: jamiyaData } = await supabase
    .from('jamiyas')
    .select('id, name, slug, currency, challenge_kind')
    .eq('slug', slug)
    .maybeSingle();
  const jamiya = jamiyaData as {
    id: string;
    name: string;
    slug: string;
    currency: string;
    challenge_kind: string | null;
  } | null;
  if (!jamiya) notFound();

  const { data: myMembership } = await supabase
    .from('members')
    .select('id, role, status, member_code')
    .eq('jamiya_id', jamiya.id)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  const me = myMembership as {
    id: string;
    role: string;
    status: string;
    member_code: string | null;
  } | null;
  if (!me) notFound();

  const isOfficer = ['circle_admin', 'chair', 'treasurer', 'secretary'].includes(me.role);
  let memberId = me.id;
  if (qs.memberId && isOfficer) {
    memberId = qs.memberId;
  }

  const { data: planPack } = await callRpc('get_circle_plan', { p_jamiya_id: jamiya.id });
  const planInfo = planPack as {
    ok?: boolean;
    plan?: { exports_included?: boolean; name?: string };
  } | null;
  const canExportOthers = Boolean(planInfo?.plan?.exports_included);

  const { data } = await callRpc('member_circle_statement', {
    p_jamiya_id: jamiya.id,
    p_member_id: memberId,
  });
  const stmt = data as {
    ok?: boolean;
    error?: string;
    member_code?: string | null;
    role?: string;
    status?: string;
    payout_position?: number | null;
    joined_at?: string | null;
    summary?: StatementSummary;
    share_lots?: Array<Record<string, unknown>>;
    contributions?: Array<Record<string, unknown>>;
    penalties?: Array<Record<string, unknown>>;
    loans?: Array<Record<string, unknown>>;
    book_entries?: Array<Record<string, unknown>>;
    savings_pockets?: Array<Record<string, unknown>>;
  } | null;

  if (!stmt?.ok) {
    notFound();
  }

  const { data: allMembers } = isOfficer
    ? await supabase
        .from('members')
        .select('id, member_code, user_id')
        .eq('jamiya_id', jamiya.id)
        .in('status', ['active', 'suspended'])
        .order('created_at')
    : { data: [] as never[] };

  const memberRows = (allMembers ?? []) as Array<{
    id: string;
    member_code: string | null;
    user_id: string;
  }>;
  const ids = memberRows.map((m) => m.user_id);
  const { data: profiles } = ids.length
    ? await supabase.from('profiles').select('id, full_name, email, phone').in('id', ids)
    : { data: [] };
  const profileMap = new Map(
    (
      (profiles ?? []) as Array<{
        id: string;
        full_name: string | null;
        email: string | null;
        phone: string | null;
      }>
    ).map((p) => [p.id, p]),
  );

  const summary = stmt.summary ?? {};
  const shareLots = stmt.share_lots ?? [];
  const contributions = stmt.contributions ?? [];
  const penalties = stmt.penalties ?? [];
  const loans = stmt.loans ?? [];
  const pockets = stmt.savings_pockets ?? [];
  const books = stmt.book_entries ?? [];
  const bookContributions = books.filter((b) => b.entry_type === 'contribution');
  const otherBooks = books.filter(
    (b) =>
      b.entry_type !== 'contribution' &&
      !(b.entry_type === 'adjustment' && b.source === 'share_capital_grid'),
  );

  const isShareDividend = jamiya.challenge_kind === 'share_dividend';
  const isRotating = jamiya.challenge_kind === 'rotating' || !jamiya.challenge_kind;

  const viewingOther = memberId !== me.id;
  const viewedMember = memberRows.find((m) => m.id === memberId);
  const viewedProfile = viewedMember ? profileMap.get(viewedMember.user_id) : null;
  const viewedName =
    viewedProfile?.full_name ||
    viewedProfile?.email ||
    viewedProfile?.phone ||
    stmt.member_code ||
    'Member';

  const snapshotCards = [
    {
      label: 'Share capital',
      value: money(summary.share_capital, jamiya.currency),
      hint:
        Number(summary.share_units ?? 0) > 0
          ? `${Number(summary.share_units).toLocaleString()} share units`
          : 'Buy-in / shares held',
    },
    {
      label: 'Contributions so far',
      value: money(summary.contributions_so_far, jamiya.currency),
      hint: isRotating
        ? `${summary.cycles_paid ?? 0} cycles paid · ${summary.cycles_open ?? 0} open`
        : 'Schedule + monthly books',
    },
    {
      label: 'Penalties',
      value: money(summary.penalties_total, jamiya.currency),
      hint:
        Number(summary.penalties_open ?? 0) > 0
          ? `${money(summary.penalties_open, jamiya.currency)} still open`
          : Number(summary.penalties_total ?? 0) > 0
            ? 'All settled'
            : 'No fines recorded',
    },
    {
      label: 'Loan outstanding',
      value: money(summary.loan_outstanding, jamiya.currency),
      hint:
        Number(summary.loan_principal ?? 0) > 0
          ? `Repaid ${money(summary.loan_repaid, jamiya.currency)} of ${money(summary.loan_principal, jamiya.currency)}`
          : 'No Qard loans',
    },
  ];

  return (
    <AppPage>
      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">
            {viewingOther ? 'Member statement' : 'My statement'}
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold">
            {jamiya.name}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {viewingOther ? `${viewedName} · ` : ''}
            Member ID {stmt.member_code ?? '—'} · {stmt.role?.replaceAll('_', ' ')} · {stmt.status}
            {stmt.payout_position != null ? ` · payout slot ${stmt.payout_position}` : ''}
            {stmt.joined_at ? ` · joined ${formatDate(stmt.joined_at)}` : ''}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
          <Button asChild variant="outline" size="sm" className="min-h-11">
            <Link href={`/circles/${slug}` as Route}>Circle</Link>
          </Button>
          {isOfficer && isShareDividend ? (
            <Button asChild size="sm" className="min-h-11">
              <Link
                href={
                  `/circles/${slug}/books${memberId ? `?view=member&memberId=${memberId}` : ''}` as Route
                }
              >
                Record books
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="outline" size="sm" className="min-h-11">
            <Link href={`/circles/${slug}/treasury` as Route}>Treasury</Link>
          </Button>
          {memberId === me.id || canExportOthers ? (
            <Button asChild size="sm" className="min-h-11">
              <a
                href={`/api/circles/${slug}/statement.pdf${
                  memberId !== me.id ? `?memberId=${memberId}` : ''
                }`}
              >
                Download PDF
              </a>
            </Button>
          ) : (
            <Button asChild size="sm" variant="outline" className="min-h-11">
              <Link href={`/circles/${slug}/officer` as Route}>Upgrade for PDF export</Link>
            </Button>
          )}
          <PrintReportButton />
        </div>
      </div>

      {memberId !== me.id && !canExportOthers ? (
        <p className="rounded-md border border-accent/30 bg-accent-muted/50 px-3 py-2 text-sm text-muted-foreground print:hidden">
          Viewing another member’s statement is allowed for officers. PDF download for others
          needs Starter/Pro — upgrade under Officer → Circle plan.
        </p>
      ) : null}

      <header className="hidden border-b border-border pb-4 print:block">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">
          Amanah · Member statement
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold">
          {jamiya.name}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {viewedName} · Member {stmt.member_code ?? '—'} · {stmt.role?.replaceAll('_', ' ')} ·
          Generated {formatDate(new Date().toISOString())}
        </p>
      </header>

      {isOfficer && memberRows.length ? (
        <form
          className="flex w-full flex-col gap-2 print:hidden sm:flex-row sm:flex-wrap sm:items-end"
          method="get"
        >
          <label className="w-full space-y-1 text-sm sm:w-auto">
            <span className="text-muted-foreground">View member</span>
            <select
              name="memberId"
              defaultValue={memberId}
              className="block h-11 w-full min-w-[14rem] rounded-md border border-input bg-background px-3 text-sm"
            >
              {memberRows.map((m) => {
                const p = profileMap.get(m.user_id);
                return (
                  <option key={m.id} value={m.id}>
                    {p?.full_name || p?.email || p?.phone || m.id.slice(0, 8)}
                    {m.member_code ? ` (${m.member_code})` : ''}
                  </option>
                );
              })}
            </select>
          </label>
          <Button type="submit" size="sm" variant="outline" className="min-h-11 w-full sm:w-auto">
            Open
          </Button>
        </form>
      ) : null}

      <section className="space-y-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
            At a glance
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Key balances for this member — share capital, contributions, penalties, and loans.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {snapshotCards.map((card) => (
            <div key={card.label} className="amanah-surface px-4 py-4 print:rounded-none">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {card.label}
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{card.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{card.hint}</p>
            </div>
          ))}
        </div>
        {(Number(summary.schedule_contributions_outstanding ?? 0) > 0 ||
          Number(summary.book_contributions ?? 0) > 0 ||
          Number(summary.savings_total ?? 0) > 0) && (
          <dl className="amanah-surface grid gap-3 px-4 py-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Schedule paid / due
              </dt>
              <dd className="mt-1 font-medium tabular-nums">
                {money(summary.schedule_contributions_paid, jamiya.currency)}
                <span className="font-normal text-muted-foreground">
                  {' '}
                  / {money(summary.schedule_contributions_due, jamiya.currency)}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Monthly books contributions
              </dt>
              <dd className="mt-1 font-medium tabular-nums">
                {money(summary.book_contributions, jamiya.currency)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Savings pockets
              </dt>
              <dd className="mt-1 font-medium tabular-nums">
                {money(summary.savings_total, jamiya.currency)}
              </dd>
            </div>
          </dl>
        )}
      </section>

      <StatementSection
        title="Share capital"
        description="Member buy-in / share lots held in this circle."
        empty="No share capital recorded for this member."
        emptyHref={
          isOfficer && isShareDividend
            ? (`/circles/${slug}/books?view=grid` as Route)
            : undefined
        }
        emptyLabel={isOfficer && isShareDividend ? 'Record in member payments' : undefined}
        rows={shareLots.map((lot) => ({
          key: String(lot.id),
          title: `${Number(lot.shares ?? 0).toLocaleString()} shares`,
          meta: [
            lot.purchased_on ? `Purchased ${formatDate(String(lot.purchased_on))}` : null,
            lot.unit_price
              ? `Par ${money(lot.unit_price, jamiya.currency)}`
              : null,
            lot.notes ? String(lot.notes) : null,
          ]
            .filter(Boolean)
            .join(' · '),
          amount: money(lot.amount, jamiya.currency),
        }))}
        footer={
          shareLots.length > 0
            ? `Total share capital: ${money(summary.share_capital, jamiya.currency)}`
            : undefined
        }
      />

      <StatementSection
        title="Schedule contributions"
        description={
          isRotating
            ? 'Merry-go-round monthly dues by cycle — paid vs still owing.'
            : 'Contribution calendar dues for this member.'
        }
        empty="No schedule contributions yet."
        emptyHref={`/circles/${slug}#calendar` as Route}
        emptyLabel="Open calendar"
        rows={contributions.map((c) => ({
          key: String(c.id),
          title: `Cycle ${c.cycle}`,
          meta: [
            c.due_date ? `Due ${formatDate(String(c.due_date))}` : null,
            Number(c.amount_paid ?? 0) > 0
              ? `Paid ${money(c.amount_paid, jamiya.currency)} of ${money(c.amount, jamiya.currency)}`
              : `Due ${money(c.amount, jamiya.currency)}`,
            c.paid_at ? `Cleared ${formatDate(String(c.paid_at))}` : null,
          ]
            .filter(Boolean)
            .join(' · '),
          amount: money(c.amount_paid ?? 0, jamiya.currency),
          badge: String(c.status),
        }))}
        footer={
          contributions.length > 0
            ? `Paid ${money(summary.schedule_contributions_paid, jamiya.currency)} · Outstanding ${money(summary.schedule_contributions_outstanding, jamiya.currency)}`
            : undefined
        }
      />

      <StatementSection
        title="Monthly contributions (books)"
        description="Savings recorded in member books / payment grid (table banking style)."
        empty="No monthly book contributions recorded."
        emptyHref={
          isOfficer && isShareDividend
            ? (`/circles/${slug}/books?view=grid` as Route)
            : (`/circles/${slug}` as Route)
        }
        emptyLabel={isOfficer && isShareDividend ? 'Open member payments' : 'Back to circle'}
        rows={bookContributions.map((b) => ({
          key: String(b.id),
          title: b.notes ? String(b.notes) : 'Monthly contribution',
          meta: b.effective_date ? formatDate(String(b.effective_date)) : '',
          amount: money(b.amount, jamiya.currency),
        }))}
        footer={
          bookContributions.length > 0
            ? `Total from books: ${money(summary.book_contributions, jamiya.currency)}`
            : undefined
        }
      />

      <StatementSection
        title="Fines & penalties"
        description="Late, missed, or other fines assessed against this member."
        empty="No fines on this statement."
        emptyHref={
          isOfficer ? (`/circles/${slug}/treasury` as Route) : (`/circles/${slug}` as Route)
        }
        emptyLabel={isOfficer ? 'Open treasury' : 'Back to circle'}
        rows={penalties.map((p) => ({
          key: String(p.id),
          title: kindLabel(p.kind),
          meta: [
            p.notes ? String(p.notes) : null,
            p.assessed_at ? `Assessed ${formatDate(String(p.assessed_at))}` : null,
            p.paid_at ? `Paid ${formatDate(String(p.paid_at))}` : null,
          ]
            .filter(Boolean)
            .join(' · '),
          amount: money(p.amount, jamiya.currency),
          badge: String(p.status),
        }))}
        footer={
          penalties.length > 0
            ? `Open ${money(summary.penalties_open, jamiya.currency)} · Paid ${money(summary.penalties_paid, jamiya.currency)} · Total ${money(summary.penalties_total, jamiya.currency)}`
            : undefined
        }
      />

      {isOfficer &&
      penalties.some((p) => String(p.status) === 'open') ? (
        <div className="space-y-2 print:hidden">
          <h3 className="text-sm font-medium text-foreground">Resolve open fines</h3>
          <OpenPenaltiesPanel
            slug={slug}
            returnPath={
              qs.memberId ? `/statement?memberId=${qs.memberId}` : '/statement'
            }
            rows={penalties
              .filter((p) => String(p.status) === 'open')
              .map((p) => ({
                id: String(p.id),
                memberLabel: 'This member',
                kind: String(p.kind ?? 'fine'),
                amount: Number(p.amount),
                currency: jamiya.currency,
                notes: p.notes ? String(p.notes) : null,
                assessedAt: p.assessed_at ? String(p.assessed_at) : null,
              }))}
          />
        </div>
      ) : null}

      <StatementSection
        title="Loans (Qard)"
        description="Interest-free loans issued to this member and repayments so far."
        empty="No loans on this statement."
        emptyHref={'/finance/qard' as Route}
        emptyLabel="Open Qard"
        rows={loans.map((l) => ({
          key: String(l.id),
          title: String(l.purpose || 'Qard Hassan loan'),
          meta: [
            l.status ? String(l.status) : null,
            `Repaid ${money(l.amount_repaid, jamiya.currency)}`,
            l.due_date ? `Due ${formatDate(String(l.due_date))}` : null,
          ]
            .filter(Boolean)
            .join(' · '),
          amount: money(l.amount, jamiya.currency),
          badge: String(l.status),
        }))}
        footer={
          loans.length > 0
            ? `Outstanding ${money(summary.loan_outstanding, jamiya.currency)}`
            : undefined
        }
      />

      <StatementSection
        title="Savings pockets"
        description="Dedicated savings balances held for this member in the circle."
        empty="No savings pockets yet."
        emptyHref={
          isOfficer ? (`/circles/${slug}/treasury` as Route) : (`/circles/${slug}` as Route)
        }
        emptyLabel={isOfficer ? 'Open treasury' : 'Back to circle'}
        rows={pockets.map((s) => ({
          key: String(s.id),
          title: String(s.label || s.category || 'Pocket'),
          meta: s.target_amount
            ? `Target ${money(s.target_amount, jamiya.currency)}`
            : String(s.category ?? ''),
          amount: money(s.balance, jamiya.currency),
        }))}
      />

      <StatementSection
        title="Other book entries"
        description="Adjustments, deposits, and other cashbook lines linked to this member."
        empty="No other book entries."
        rows={otherBooks.map((b) => ({
          key: String(b.id),
          title: String(b.entry_type).replaceAll('_', ' '),
          meta: [
            b.effective_date ? formatDate(String(b.effective_date)) : null,
            b.notes ? String(b.notes) : null,
          ]
            .filter(Boolean)
            .join(' · '),
          amount: money(b.amount, jamiya.currency),
        }))}
      />
    </AppPage>
  );
}

function StatementSection({
  title,
  description,
  empty,
  emptyHref,
  emptyLabel,
  rows,
  footer,
}: {
  title: string;
  description?: string;
  empty: string;
  emptyHref?: Route;
  emptyLabel?: string;
  rows: Array<{
    key: string;
    title: string;
    meta: string;
    amount: string;
    badge?: string;
  }>;
  footer?: string;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{empty}</p>
          {emptyHref && emptyLabel ? (
            <Button asChild size="sm" variant="outline" className="min-h-11 print:hidden">
              <Link href={emptyHref}>{emptyLabel}</Link>
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          <ul className="amanah-surface divide-y divide-border/50">
            {rows.map((row) => (
              <li
                key={row.key}
                className="flex flex-wrap items-center justify-between gap-2 px-5 py-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium capitalize">{row.title}</p>
                    {row.badge ? <StatusBadge status={row.badge} /> : null}
                  </div>
                  {row.meta ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">{row.meta}</p>
                  ) : null}
                </div>
                <p className="text-sm font-semibold tabular-nums">{row.amount}</p>
              </li>
            ))}
          </ul>
          {footer ? (
            <p className="text-sm font-medium text-foreground">{footer}</p>
          ) : null}
        </>
      )}
    </section>
  );
}
