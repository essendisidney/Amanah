import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { Button, Input, Label, Textarea } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { AppPage } from '@/components/app-page';
import { CircleNoticeBanner } from '@/features/circles/components/circle-notice-banner';
import { StatementMatchForm, type RecordedRef } from '@/features/circles/components/statement-match-form';
import { callRpc } from '@/lib/supabase/rpc';
import { setCirclePaymentDetailsAction } from '@/features/circles/actions/statement-actions';
import type { PaymentDetails } from '@/features/circles/components/how-to-pay-card';

export const metadata: Metadata = { title: 'Bank payments' };
export const dynamic = 'force-dynamic';

const OFFICER_ROLES = new Set(['circle_admin', 'chair', 'treasurer', 'secretary']);

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ notice?: string; noticeType?: string }>;
};

type Receipt = {
  id: string;
  reference: string;
  paid_on: string | null;
  amount: number | string;
  member_id: string;
  allocated: number | string;
  unallocated: number | string;
  created_at: string;
};

type Payout = {
  id: string;
  reference: string;
  paid_on: string | null;
  amount: number | string;
  kind: string;
  member_id: string | null;
};

const KIND_NAME: Record<string, string> = {
  payout: 'Payout',
  withdrawal: 'Withdrawal',
  loan: 'Loan',
  expense: 'Expense',
};

export default async function BankPaymentsPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const notices = (await searchParams) ?? {};
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/circles/${slug}/bank-payments`);

  // payment_details and circle_statement_receipts are newer than the generated types.
  const db = supabase as unknown as SupabaseClient;
  const { data: jamiya } = await db
    .from('jamiyas')
    .select('id, name, payment_details')
    .eq('slug', slug)
    .maybeSingle();
  if (!jamiya) redirect('/circles');
  const j = jamiya as { id: string; name: string; payment_details: PaymentDetails | null };

  const { data: me } = await supabase
    .from('members')
    .select('role')
    .eq('jamiya_id', j.id)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (!OFFICER_ROLES.has(String((me as { role?: string } | null)?.role ?? ''))) {
    redirect(`/circles/${slug}`);
  }

  const [{ data: memberRows }, { data: dues }, { data: receipts }, { data: payouts }] = await Promise.all([
    supabase
      .from('members')
      .select('id, user_id')
      .eq('jamiya_id', j.id)
      .in('status', ['active', 'suspended']),
    supabase
      .from('contributions')
      .select('member_id, amount, amount_paid')
      .eq('jamiya_id', j.id)
      .in('status', ['pending', 'late', 'partial']),
    db
      .from('circle_statement_receipts')
      .select('id, reference, paid_on, amount, member_id, allocated, unallocated, created_at')
      .eq('jamiya_id', j.id)
      .order('created_at', { ascending: false })
      .limit(500),
    db
      .from('circle_statement_payouts')
      .select('id, reference, paid_on, amount, kind, member_id')
      .eq('jamiya_id', j.id)
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  const memberList = (memberRows ?? []) as Array<{ id: string; user_id: string }>;
  const { data: profiles } = memberList.length
    ? await supabase
        .from('profiles')
        .select('id, full_name, phone')
        .in(
          'id',
          memberList.map((m) => m.user_id),
        )
    : { data: [] };
  const profileById = new Map(
    ((profiles ?? []) as Array<{ id: string; full_name: string | null; phone: string | null }>).map((p) => [
      p.id,
      p,
    ]),
  );
  const members = memberList.map((m) => {
    const p = profileById.get(m.user_id);
    return { id: m.id, name: p?.full_name || p?.phone || 'Member', phone: p?.phone ?? null };
  });
  const nameById = new Map(members.map((m) => [m.id, m.name]));

  const owed: Record<string, number> = {};
  for (const d of (dues ?? []) as Array<{ member_id: string; amount: number | string; amount_paid: number | string | null }>) {
    const left = Number(d.amount) - Number(d.amount_paid ?? 0);
    if (left > 0) owed[d.member_id] = (owed[d.member_id] ?? 0) + left;
  }

  const receiptRows = (receipts ?? []) as Receipt[];
  // References recorded here or in another circle paid into the same bank account.
  const { data: refsPack } = await callRpc('circle_statement_refs', { p_jamiya_id: j.id });
  const recordedRefs = ((refsPack as { refs?: RecordedRef[] } | null)?.refs ?? []) as RecordedRef[];
  const leftover = receiptRows.filter((r) => Number(r.unallocated) > 0);
  const details = j.payment_details ?? {};

  return (
    <AppPage>
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">Officer</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold">
          {j.name}: bank payments
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          For circles that keep their own bank account or paybill. Members pay the way they always do;
          you paste the statement here and Jameiyah marks who has paid, and records payouts, loans and
          expenses in Books.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="min-h-11">
            <Link href={`/circles/${slug}/officer` as Route}>Officer console</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="min-h-11">
            <Link href={`/circles/${slug}/books` as Route}>Books</Link>
          </Button>
        </div>
      </div>

      <CircleNoticeBanner notice={notices.notice} noticeType={notices.noticeType} />

      <section className="space-y-3 rounded-xl border border-border bg-card p-5">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">How members pay</h2>
        <p className="text-sm text-muted-foreground">
          Shown to every member on the circle page. Leave a field empty to hide it.
        </p>
        <form action={setCirclePaymentDetailsAction} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="jamiyaId" value={j.id} />
          <input type="hidden" name="slug" value={slug} />
          <div className="space-y-1">
            <Label htmlFor="paybill">M-Pesa paybill</Label>
            <Input id="paybill" name="paybill" inputMode="numeric" maxLength={20} defaultValue={details.paybill ?? ''} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="account">Account number</Label>
            <Input id="account" name="account" maxLength={40} defaultValue={details.account ?? ''} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bank">Bank</Label>
            <Input id="bank" name="bank" maxLength={60} defaultValue={details.bank ?? ''} placeholder="DIB Bank" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="note">Note for members</Label>
            <Textarea
              id="note"
              name="note"
              rows={2}
              maxLength={280}
              defaultValue={details.note ?? ''}
              placeholder="Pay between the 1st and 5th of every month."
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" className="min-h-11">
              Save payment details
            </Button>
          </div>
        </form>
      </section>

      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground">Add members to the circle before matching a statement.</p>
      ) : (
        <StatementMatchForm
          jamiyaId={j.id}
          slug={slug}
          members={members}
          owed={owed}
          recordedRefs={recordedRefs}
        />
      )}

      {leftover.length > 0 ? (
        <section className="space-y-2 rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold">Paid more than owed</h2>
          <p className="text-sm text-muted-foreground">
            These payments were more than the member&apos;s open contributions. Record the extra in Books
            (savings, a loan repayment or a share purchase).
          </p>
          <ul className="divide-y divide-border/70 text-sm">
            {leftover.slice(0, 50).map((r) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>
                  {nameById.get(r.member_id) ?? 'Member'} · {r.reference}
                  {r.paid_on ? ` · ${formatDate(r.paid_on)}` : ''}
                </span>
                <span className="font-medium">{formatCurrency(Number(r.unallocated), 'KES')} extra</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {((payouts ?? []) as Payout[]).length > 0 ? (
        <section className="space-y-2">
          <h2 className="font-semibold">Money out recorded from statements</h2>
          <ul className="divide-y divide-border/70 rounded-xl border border-border text-sm">
            {((payouts ?? []) as Payout[]).map((r) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-2 px-4 py-2">
                <span>
                  {KIND_NAME[r.kind] ?? r.kind}
                  {r.member_id ? ` · ${nameById.get(r.member_id) ?? 'Member'}` : ''} · {r.reference}
                  {r.paid_on ? ` · ${formatDate(r.paid_on)}` : ''}
                </span>
                <span className="font-medium">{formatCurrency(Number(r.amount), 'KES')}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="font-semibold">Money in recorded from statements</h2>
        {receiptRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing recorded from a statement yet.</p>
        ) : (
          <ul className="divide-y divide-border/70 rounded-xl border border-border text-sm">
            {receiptRows.slice(0, 100).map((r) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-2 px-4 py-2">
                <span>
                  {nameById.get(r.member_id) ?? 'Member'} · {r.reference}
                  {r.paid_on ? ` · ${formatDate(r.paid_on)}` : ''}
                </span>
                <span className="font-medium">{formatCurrency(Number(r.amount), 'KES')}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppPage>
  );
}
