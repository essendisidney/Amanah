import Link from 'next/link';
import type { Route } from 'next';
import { notFound } from 'next/navigation';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ code: string }> };

export default async function DonationReceiptPage({ params }: Props) {
  const { code } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_donation_receipt', {
    p_code: decodeURIComponent(code),
  });

  if (error) notFound();
  const result = data as {
    ok?: boolean;
    receipt_code?: string;
    amount?: number;
    fee_amount?: number;
    currency?: string;
    created_at?: string;
    donor_name?: string | null;
    is_anonymous?: boolean;
    campaign?: {
      title?: string;
      slug?: string;
      fee_mode?: string;
      fee_bps?: number;
      sharia_board_endorsed?: boolean;
    };
  } | null;

  if (!result?.ok || !result.receipt_code) notFound();

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">Donation receipt</p>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-semibold">
        Thank you
      </h1>
      <p className="mt-3 text-muted-foreground">
        Keep this receipt for your records. Share the campaign to help it grow.
      </p>

      <div className="mt-8 space-y-4 border border-border bg-card p-6">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-mono text-lg font-semibold">{result.receipt_code}</p>
          {result.campaign?.sharia_board_endorsed ? (
            <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              Sharia board endorsed
            </span>
          ) : null}
        </div>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Campaign</dt>
            <dd className="font-medium">{result.campaign?.title ?? 'Sadaka'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Gift</dt>
            <dd className="font-medium">
              {formatCurrency(Number(result.amount ?? 0), result.currency ?? 'KES')}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Fee</dt>
            <dd>
              {formatCurrency(Number(result.fee_amount ?? 0), result.currency ?? 'KES')}
              {result.campaign?.fee_mode === 'donation_addon' ? ' (added on top)' : ' (deducted)'}
            </dd>
          </div>
          {result.created_at ? (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Date</dt>
              <dd>{formatDate(result.created_at)}</dd>
            </div>
          ) : null}
          {!result.is_anonymous && result.donor_name ? (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Donor</dt>
              <dd>{result.donor_name}</dd>
            </div>
          ) : null}
        </dl>
        <p className="text-xs text-muted-foreground print:block">
          Print this page (Ctrl/Cmd+P) to save a PDF copy.
        </p>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link href={`/sadaka/${result.campaign?.slug ?? ''}` as Route}>Back to campaign</Link>
        </Button>
        <Button asChild>
          <Link href={'/sadaka' as Route}>All campaigns</Link>
        </Button>
      </div>
    </main>
  );
}
