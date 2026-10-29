import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { formatCurrency } from '@jamiya/shared';
import { Button, Input } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { callRpc } from '@/lib/supabase/rpc';
import { AppPage } from '@/components/app-page';

export const metadata: Metadata = { title: 'Member register' };
export const dynamic = 'force-dynamic';

const PAGE = 50;
const OFFICER_ROLES = new Set(['circle_admin', 'chair', 'treasurer', 'secretary']);

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ q?: string; page?: string }>;
};

type Row = {
  member_id: string;
  member_code: string | null;
  name: string | null;
  phone: string | null;
  role: string;
  status: string;
  shares: number;
  deposits: number;
  loans_outstanding: number;
  pledged: number;
  can_borrow: number | null;
  arrears: number;
};

const kes = (n: number | null | undefined) => formatCurrency(Number(n ?? 0), 'KES');

export default async function MemberRegisterPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const qs = (await searchParams) ?? {};
  const q = (qs.q ?? '').trim();
  const page = Math.max(1, Number.parseInt(qs.page ?? '1', 10) || 1);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/circles/${slug}/register`);

  const { data: jamiya } = await supabase.from('jamiyas').select('id, name').eq('slug', slug).maybeSingle();
  if (!jamiya) redirect('/circles');
  const j = jamiya as { id: string; name: string };

  const { data: me } = await supabase
    .from('members')
    .select('role')
    .eq('jamiya_id', j.id)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (!OFFICER_ROLES.has(String((me as { role?: string } | null)?.role ?? ''))) redirect(`/circles/${slug}`);

  const { data } = await callRpc('circle_member_register', {
    p_jamiya_id: j.id,
    p_search: q || null,
    p_limit: PAGE,
    p_offset: (page - 1) * PAGE,
  });
  const reg = (data ?? {}) as {
    ok?: boolean;
    total?: number;
    multiplier?: number | null;
    totals?: { shares: number; deposits: number; loans_outstanding: number; arrears: number };
    rows?: Row[];
  };
  const rows = reg.rows ?? [];
  const total = Number(reg.total ?? 0);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const link = (p: number) =>
    `/circles/${slug}/register?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) }).toString()}` as Route;

  return (
    <AppPage>
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">Officer</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold">
          {j.name}: member register
        </h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Every member&apos;s shares (locked, not withdrawn while a member), deposits (savings they can
          borrow against), loans still owed, what they have pledged as a guarantor and, when the circle
          sets a limit, how much more they may borrow.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="min-h-11">
            <Link href={`/circles/${slug}/officer` as Route}>Officer console</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="min-h-11">
            <Link href={`/circles/${slug}/loan-book` as Route}>Loan book</Link>
          </Button>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-4">
        {[
          ['Members', String(total)],
          ['Shares', kes(reg.totals?.shares)],
          ['Deposits', kes(reg.totals?.deposits)],
          ['Loans owed', kes(reg.totals?.loans_outstanding)],
        ].map(([label, value]) => (
          <div key={label} className="jameiyah-surface px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-1 text-lg font-semibold">{value}</p>
          </div>
        ))}
      </section>
      {Number(reg.totals?.arrears ?? 0) > 0 ? (
        <p className="text-sm text-muted-foreground">
          Overdue contributions across the circle: {kes(reg.totals?.arrears)}.
        </p>
      ) : null}

      <form className="flex flex-wrap gap-2" action={`/circles/${slug}/register`}>
        <Input name="q" defaultValue={q} placeholder="Search name, phone or member number" className="max-w-sm" />
        <Button type="submit" variant="outline" className="min-h-11">
          Search
        </Button>
      </form>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{q ? 'No member matches that search.' : 'No members yet.'}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Member</th>
                <th className="px-3 py-2 text-right">Shares</th>
                <th className="px-3 py-2 text-right">Deposits</th>
                <th className="px-3 py-2 text-right">Loans owed</th>
                <th className="px-3 py-2 text-right">Guaranteed</th>
                <th className="px-3 py-2 text-right">Can borrow</th>
                <th className="px-3 py-2 text-right">Overdue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {rows.map((r) => (
                <tr key={r.member_id}>
                  <td className="px-3 py-2">
                    <Link
                      href={`/circles/${slug}/books?memberId=${r.member_id}` as Route}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {r.name || r.phone || 'Member'}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {[r.member_code, r.phone, r.role !== 'member' ? r.role.replaceAll('_', ' ') : null, r.status !== 'active' ? r.status : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{kes(r.shares)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{kes(r.deposits)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{kes(r.loans_outstanding)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{Number(r.pledged) > 0 ? kes(r.pledged) : '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.can_borrow == null ? '—' : kes(r.can_borrow)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${Number(r.arrears) > 0 ? 'text-destructive' : ''}`}>
                    {Number(r.arrears) > 0 ? kes(r.arrears) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 ? (
        <nav className="flex flex-wrap items-center gap-2 text-sm" aria-label="Pages">
          {page > 1 ? (
            <Button asChild variant="outline" size="sm" className="min-h-11">
              <Link href={link(page - 1)}>Previous</Link>
            </Button>
          ) : null}
          <span className="text-muted-foreground">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Button asChild variant="outline" size="sm" className="min-h-11">
              <Link href={link(page + 1)}>Next</Link>
            </Button>
          ) : null}
        </nav>
      ) : null}
      {reg.multiplier == null ? (
        <p className="text-xs text-muted-foreground">
          &quot;Can borrow&quot; appears once the circle sets a borrowing limit in the Loan book.
        </p>
      ) : null}
    </AppPage>
  );
}
