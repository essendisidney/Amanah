import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { Button, Input, Label, NativeSelect } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { callRpc } from '@/lib/supabase/rpc';
import { AppPage } from '@/components/app-page';
import { CircleNoticeBanner } from '@/features/circles/components/circle-notice-banner';
import { setLoanPolicyAction } from '@/features/circles/actions/loan-policy-actions';

export const metadata: Metadata = { title: 'Loan book' };
export const dynamic = 'force-dynamic';

const OFFICER_ROLES = new Set(['circle_admin', 'chair', 'treasurer', 'secretary']);
const BUCKETS: Array<[string, string]> = [
  ['current', 'On time'],
  ['1_30', '1–30 days late'],
  ['31_60', '31–60 days late'],
  ['61_90', '61–90 days late'],
  ['over_90', 'Over 90 days late'],
];

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ notice?: string; noticeType?: string }>;
};

type Aging = {
  ok?: boolean;
  total_outstanding?: number;
  at_risk?: number;
  buckets?: Record<string, { count: number; amount: number }>;
  loans?: Array<{
    kind: 'qard' | 'facility';
    id: string;
    member_id: string;
    name: string | null;
    outstanding: number;
    due_date: string | null;
    days_late: number;
    bucket: string;
  }>;
};

const kes = (n: number | null | undefined) => formatCurrency(Number(n ?? 0), 'KES');

export default async function LoanBookPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const notices = (await searchParams) ?? {};
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/circles/${slug}/loan-book`);

  // The loan rule columns are newer than the generated types.
  const db = supabase as unknown as SupabaseClient;
  const { data: jamiya } = await db
    .from('jamiyas')
    .select('id, name, loan_multiplier, loan_min_guarantors, loan_guarantor_cover, loan_approvals_required')
    .eq('slug', slug)
    .maybeSingle();
  if (!jamiya) redirect('/circles');
  const j = jamiya as {
    id: string;
    name: string;
    loan_multiplier: number | string | null;
    loan_min_guarantors: number;
    loan_guarantor_cover: boolean;
    loan_approvals_required: number;
  };

  const { data: me } = await supabase
    .from('members')
    .select('role')
    .eq('jamiya_id', j.id)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (!OFFICER_ROLES.has(String((me as { role?: string } | null)?.role ?? ''))) redirect(`/circles/${slug}`);

  const { data } = await callRpc('circle_loan_aging', { p_jamiya_id: j.id });
  const aging = (data ?? {}) as Aging;
  const loans = aging.loans ?? [];
  const total = Number(aging.total_outstanding ?? 0);
  const atRisk = Number(aging.at_risk ?? 0);

  return (
    <AppPage>
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">Officer</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold">{j.name}: loan book</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          The circle&apos;s lending rules, and every loan still owed by how late it is.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="min-h-11">
            <Link href={`/circles/${slug}/officer` as Route}>Officer console</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="min-h-11">
            <Link href={`/circles/${slug}/register` as Route}>Member register</Link>
          </Button>
        </div>
      </div>

      <CircleNoticeBanner notice={notices.notice} noticeType={notices.noticeType} />

      <section className="space-y-3 rounded-xl border border-border bg-card p-5">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">Loan rules</h2>
        <p className="text-sm text-muted-foreground">
          Apply to every new Qard Hasan request. Loans stay free of interest: these rules only decide
          how much a member may borrow and who must stand behind it.
        </p>
        <form action={setLoanPolicyAction} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="jamiyaId" value={j.id} />
          <input type="hidden" name="slug" value={slug} />
          <div className="space-y-1">
            <Label htmlFor="multiplier">Borrow up to … × deposits</Label>
            <Input
              id="multiplier"
              name="multiplier"
              inputMode="decimal"
              defaultValue={j.loan_multiplier == null ? '' : String(Number(j.loan_multiplier))}
              placeholder="e.g. 3 (empty = the circle's usual limit)"
            />
            <p className="text-xs text-muted-foreground">Less what the member already owes.</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="minGuarantors">Guarantors needed for every loan</Label>
            <NativeSelect id="minGuarantors" name="minGuarantors" defaultValue={String(j.loan_min_guarantors ?? 0)}>
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n === 0 ? 'None required' : n}
                </option>
              ))}
            </NativeSelect>
          </div>
          <label className="flex items-start gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              name="guarantorCover"
              defaultChecked={j.loan_guarantor_cover}
              className="mt-0.5 h-5 w-5"
            />
            <span>
              Guarantors&apos; free deposits must cover whatever a loan is above the borrower&apos;s own
              deposits. Deposits already behind a member&apos;s own loan, or pledged for someone else,
              do not count.
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              name="twoApprovals"
              defaultChecked={j.loan_approvals_required >= 2}
              className="mt-0.5 h-5 w-5"
            />
            <span>Two different officers must approve every loan (loan committee).</span>
          </label>
          <div className="sm:col-span-2">
            <Button type="submit" className="min-h-11">
              Save loan rules
            </Button>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="jameiyah-surface px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Loans owed</p>
            <p className="mt-1 text-lg font-semibold">{kes(total)}</p>
          </div>
          <div className="jameiyah-surface px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">More than 30 days late</p>
            <p className={`mt-1 text-lg font-semibold ${atRisk > 0 ? 'text-destructive' : ''}`}>{kes(atRisk)}</p>
          </div>
          <div className="jameiyah-surface px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Share at risk</p>
            <p className="mt-1 text-lg font-semibold">{total > 0 ? `${Math.round((atRisk / total) * 100)}%` : '—'}</p>
          </div>
        </div>
        <ul className="grid gap-2 text-sm sm:grid-cols-5">
          {BUCKETS.map(([key, label]) => (
            <li key={key} className="rounded-lg border border-border px-3 py-2">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="font-medium">
                {aging.buckets?.[key]?.count ?? 0} · {kes(aging.buckets?.[key]?.amount)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Every loan still owed</h2>
        {loans.length === 0 ? (
          <p className="text-sm text-muted-foreground">No loans are owed.</p>
        ) : (
          <ul className="divide-y divide-border/70 rounded-xl border border-border text-sm">
            {loans.map((l) => (
              <li key={`${l.kind}-${l.id}`} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2">
                <span>
                  <Link
                    href={`/circles/${slug}/books?memberId=${l.member_id}` as Route}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {l.name || 'Member'}
                  </Link>
                  <span className="text-muted-foreground">
                    {' · '}
                    {l.kind === 'qard' ? 'Qard Hasan' : 'Table-banking loan'}
                    {l.due_date ? ` · due ${formatDate(l.due_date)}` : ''}
                    {l.days_late > 0
                      ? l.kind === 'qard'
                        ? ` · ${l.days_late} days late`
                        : ` · no repayment for ${l.days_late + 30} days`
                      : ''}
                  </span>
                </span>
                <span className={`font-medium tabular-nums ${l.days_late > 30 ? 'text-destructive' : ''}`}>
                  {kes(l.outstanding)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          Table-banking loans have no due date, so they count as late after 30 days with no repayment.
        </p>
      </section>
    </AppPage>
  );
}
