import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { notFound, redirect } from 'next/navigation';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { callRpc } from '@/lib/supabase/rpc';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';

export const metadata: Metadata = { title: 'Member statement' };
export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ memberId?: string }>;
};

export default async function MemberStatementPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const qs = (await searchParams) ?? {};
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/circles/${slug}/statement`);

  const { data: jamiyaData } = await supabase
    .from('jamiyas')
    .select('id, name, slug, currency')
    .eq('slug', slug)
    .maybeSingle();
  const jamiya = jamiyaData as { id: string; name: string; slug: string; currency: string } | null;
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
    ? await supabase.from('profiles').select('id, full_name, email').in('id', ids)
    : { data: [] };
  const profileMap = new Map(
    ((profiles ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>).map(
      (p) => [p.id, p],
    ),
  );

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">
            Member statement
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold">
            {jamiya.name}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Code {stmt.member_code ?? '—'} · {stmt.role?.replaceAll('_', ' ')} · {stmt.status}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/circles/${slug}` as Route}>Circle</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/circles/${slug}/treasury` as Route}>Treasury</Link>
          </Button>
        </div>
      </div>

      {isOfficer && memberRows.length ? (
        <form className="flex flex-wrap items-end gap-2" method="get">
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">View member</span>
            <select
              name="memberId"
              defaultValue={memberId}
              className="block h-10 min-w-[14rem] rounded-md border border-input bg-background px-3 text-sm"
            >
              {memberRows.map((m) => {
                const p = profileMap.get(m.user_id);
                return (
                  <option key={m.id} value={m.id}>
                    {p?.full_name || p?.email || m.id.slice(0, 8)}
                    {m.member_code ? ` (${m.member_code})` : ''}
                  </option>
                );
              })}
            </select>
          </label>
          <Button type="submit" size="sm" variant="outline">
            Open
          </Button>
        </form>
      ) : null}

      <StatementSection
        title="Contributions"
        empty="No contribution rows."
        rows={(stmt.contributions ?? []).map((c) => ({
          key: String(c.id),
          title: `Cycle ${c.cycle}`,
          meta: `${c.status} · due ${c.due_date ? formatDate(String(c.due_date)) : '—'}`,
          amount: formatCurrency(Number(c.amount), jamiya.currency),
          badge: String(c.status),
        }))}
      />

      <StatementSection
        title="Fines & penalties"
        empty="No fines on this statement."
        rows={(stmt.penalties ?? []).map((p) => ({
          key: String(p.id),
          title: String(p.notes || p.kind || 'Fine'),
          meta: `${p.status} · ${p.assessed_at ? formatDate(String(p.assessed_at)) : ''}`,
          amount: formatCurrency(Number(p.amount), jamiya.currency),
          badge: String(p.status),
        }))}
      />

      <StatementSection
        title="Loans (Qard)"
        empty="No loans."
        rows={(stmt.loans ?? []).map((l) => ({
          key: String(l.id),
          title: String(l.purpose || 'Loan'),
          meta: `${l.status} · repaid ${formatCurrency(Number(l.amount_repaid), jamiya.currency)}`,
          amount: formatCurrency(Number(l.amount), jamiya.currency),
          badge: String(l.status),
        }))}
      />

      <StatementSection
        title="Savings pockets"
        empty="No savings pockets."
        rows={(stmt.savings_pockets ?? []).map((s) => ({
          key: String(s.id),
          title: String(s.label || s.category),
          meta: s.target_amount
            ? `Target ${formatCurrency(Number(s.target_amount), jamiya.currency)}`
            : String(s.category),
          amount: formatCurrency(Number(s.balance), jamiya.currency),
        }))}
      />

      <StatementSection
        title="Book entries"
        empty="No book entries linked to this member."
        rows={(stmt.book_entries ?? []).map((b) => ({
          key: String(b.id),
          title: String(b.entry_type).replaceAll('_', ' '),
          meta: `${b.effective_date ? formatDate(String(b.effective_date)) : ''}${
            b.notes ? ` · ${b.notes}` : ''
          }`,
          amount: formatCurrency(Number(b.amount), jamiya.currency),
        }))}
      />
    </div>
  );
}

function StatementSection({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: Array<{
    key: string;
    title: string;
    meta: string;
    amount: string;
    badge?: string;
  }>;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {rows.map((row) => (
            <li
              key={row.key}
              className="flex flex-wrap items-center justify-between gap-2 px-5 py-3"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium capitalize">{row.title}</p>
                  {row.badge ? <StatusBadge status={row.badge} /> : null}
                </div>
                <p className="text-xs text-muted-foreground">{row.meta}</p>
              </div>
              <p className="text-sm font-semibold">{row.amount}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
