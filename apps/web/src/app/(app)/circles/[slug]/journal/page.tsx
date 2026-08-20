import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { notFound, redirect } from 'next/navigation';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { callRpc } from '@/lib/supabase/rpc';
import { PrintReportButton } from '@/features/circles/components/print-report-button';
import { EmptyState } from '@/features/dashboard/components/empty-state';

export const metadata: Metadata = { title: 'Cashbook journal' };
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export default async function CircleJournalPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/circles/${slug}/journal`);

  const { data: jamiyaData } = await supabase
    .from('jamiyas')
    .select('id, name, slug, currency')
    .eq('slug', slug)
    .maybeSingle();
  const jamiya = jamiyaData as { id: string; name: string; slug: string; currency: string } | null;
  if (!jamiya) notFound();

  const { data: membership } = await supabase
    .from('members')
    .select('role, status')
    .eq('jamiya_id', jamiya.id)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (!membership) notFound();

  const { data } = await callRpc('circle_journal', {
    p_jamiya_id: jamiya.id,
    p_limit: 150,
  });
  const pack = data as {
    ok?: boolean;
    entries?: Array<{
      id: string;
      effective_date: string;
      entry_type: string;
      amount: number;
      currency: string;
      notes: string | null;
      debit_account: string;
      credit_account: string;
    }>;
  } | null;

  const entries = pack?.ok ? (pack.entries ?? []) : [];

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-6 py-10 print:px-0 print:py-0">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">Journal</p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold">
            {jamiya.name}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Cashbook as simple debit/credit lines for officer review.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/circles/${slug}` as Route}>Back to circle</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/circles/${slug}/treasury` as Route}>Treasury</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/circles/${slug}/report` as Route}>GL reports</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/circles/${slug}/invoices` as Route}>Invoices</Link>
          </Button>
          <PrintReportButton />
        </div>
      </div>

      {pack && pack.ok === false ? (
        <p className="text-sm text-destructive">
          Could not load journal lines. Try again from Treasury.
        </p>
      ) : entries.length === 0 ? (
        <EmptyState
          title="No journal lines yet"
          description="Cashbook lines appear after officers seed treasury accounts and record deposits, expenses, or fines."
          actionLabel="Open treasury"
          actionHref={`/circles/${slug}/treasury` as Route}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Debit</th>
                <th className="px-4 py-3">Credit</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((row) => (
                <tr key={row.id} className="border-b border-border/70">
                  <td className="px-4 py-3 align-top">
                    <p>{formatDate(row.effective_date)}</p>
                    {row.notes ? (
                      <p className="text-xs text-muted-foreground">{row.notes}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 align-top">{row.debit_account}</td>
                  <td className="px-4 py-3 align-top">{row.credit_account}</td>
                  <td className="px-4 py-3 align-top capitalize">
                    {row.entry_type.replaceAll('_', ' ')}
                  </td>
                  <td className="px-4 py-3 align-top text-right font-semibold">
                    {formatCurrency(Number(row.amount), row.currency || jamiya.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
