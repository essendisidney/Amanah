import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { notFound, redirect } from 'next/navigation';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { CircleNoticeBanner } from '@/features/circles/components/circle-notice-banner';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';
import {
  issueInvoicesAction,
  remindInvoicesAction,
} from '@/features/circles/actions/invoice-actions';
import { PrintReportButton } from '@/features/circles/components/print-report-button';

export const metadata: Metadata = { title: 'Contribution invoices' };
export const dynamic = 'force-dynamic';

const OFFICER_ROLES = new Set(['circle_admin', 'chair', 'treasurer', 'secretary']);

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ notice?: string; noticeType?: string }>;
};

export default async function CircleInvoicesPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const notices = (await searchParams) ?? {};
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/circles/${slug}/invoices`);

  const { data: jamiyaData } = await supabase
    .from('jamiyas')
    .select('id, name, slug, currency')
    .eq('slug', slug)
    .maybeSingle();
  const jamiya = jamiyaData as { id: string; name: string; slug: string; currency: string } | null;
  if (!jamiya) notFound();

  const { data: membershipData } = await supabase
    .from('members')
    .select('id, role, status')
    .eq('jamiya_id', jamiya.id)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  const membership = membershipData as { id: string; role: string } | null;
  if (!membership) notFound();

  const isOfficer = OFFICER_ROLES.has(membership.role);

  let query = supabase
    .from('circle_contribution_invoices')
    .select(
      'id, invoice_number, amount_due, currency, due_date, status, issued_at, reminded_at, user_id, member_id, notes',
    )
    .eq('jamiya_id', jamiya.id)
    .order('issued_at', { ascending: false })
    .limit(80);

  if (!isOfficer) {
    query = query.eq('user_id', user.id);
  }

  const { data: invoiceData } = await query;
  const invoices = (invoiceData ?? []) as Array<{
    id: string;
    invoice_number: string;
    amount_due: number | string;
    currency: string;
    due_date: string | null;
    status: string;
    issued_at: string;
    reminded_at: string | null;
    user_id: string;
    notes: string | null;
  }>;

  const userIds = Array.from(new Set(invoices.map((i) => i.user_id)));
  const { data: profiles } = userIds.length
    ? await supabase.from('profiles').select('id, full_name, email').in('id', userIds)
    : { data: [] };
  const profileMap = new Map(
    ((profiles ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>).map(
      (p) => [p.id, p],
    ),
  );

  const openCount = invoices.filter((i) => i.status === 'open').length;

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-6 py-10 print:max-w-none print:px-0 print:py-0">
      <CircleNoticeBanner notice={notices.notice} noticeType={notices.noticeType} />

      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">Invoices</p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold">
            {jamiya.name}
          </h1>
          <p className="mt-2 text-muted-foreground">
            Contribution invoices and payment reminders — {openCount} open.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/circles/${slug}` as Route}>Circle</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/circles/${slug}/treasury` as Route}>Treasury</Link>
          </Button>
          <PrintReportButton />
        </div>
      </div>

      <header className="hidden border-b border-border pb-4 print:block">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">
          Amanah contribution invoices
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold">
          {jamiya.name}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Generated {formatDate(new Date().toISOString())} · {openCount} open
        </p>
      </header>

      {isOfficer ? (
        <div className="flex flex-wrap gap-2 print:hidden">
          <form action={issueInvoicesAction}>
            <input type="hidden" name="jamiyaId" value={jamiya.id} />
            <input type="hidden" name="slug" value={slug} />
            <Button type="submit" size="sm">
              Issue invoices for open dues
            </Button>
          </form>
          <form action={remindInvoicesAction}>
            <input type="hidden" name="jamiyaId" value={jamiya.id} />
            <input type="hidden" name="slug" value={slug} />
            <Button type="submit" size="sm" variant="outline">
              Remind open invoices
            </Button>
          </form>
        </div>
      ) : null}

      {invoices.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {isOfficer
            ? 'No invoices yet. Issue invoices for pending or late contributions.'
            : 'You have no contribution invoices in this circle.'}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card print:rounded-none print:border-0">
          {invoices.map((inv) => {
            const profile = profileMap.get(inv.user_id);
            return (
              <li
                key={inv.id}
                className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between print:break-inside-avoid"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{inv.invoice_number}</p>
                    <StatusBadge status={inv.status} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {isOfficer
                      ? profile?.full_name || profile?.email || inv.user_id.slice(0, 8)
                      : 'Your dues'}
                    {inv.due_date ? ` · due ${formatDate(inv.due_date)}` : ''}
                    {inv.notes ? ` · ${inv.notes}` : ''}
                    {inv.reminded_at ? ` · reminded ${formatDate(inv.reminded_at)}` : ''}
                  </p>
                </div>
                <p className="text-sm font-semibold">
                  {formatCurrency(Number(inv.amount_due), inv.currency)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
