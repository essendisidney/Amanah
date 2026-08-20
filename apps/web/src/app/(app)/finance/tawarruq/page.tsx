import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { Button, Input, Label, Textarea } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { submitTawarruqFormAction } from '@/features/finance/actions';
import { EmptyState } from '@/features/dashboard/components/empty-state';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';

export const dynamic = 'force-dynamic';

type Application = {
  id: string;
  amount: number | string;
  currency: string;
  purpose: string;
  status: string;
  partner_status: string | null;
  created_at: string;
};

export default async function TawarruqPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/finance/tawarruq');

  const { data } = await supabase
    .from('tawarruq_applications')
    .select('id, amount, currency, purpose, status, partner_status, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  const applications = (data ?? []) as unknown as Application[];

  return (
    <div className="space-y-10">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">
          <Link href={'/finance' as Route} className="hover:text-primary">
            Finance
          </Link>
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-semibold">
          Tawarruq
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Submit an application for review and partner-bank handoff. Approval is not guaranteed.
          Prefer interest-free support from your circle? Try{' '}
          <Link href={'/finance/qard' as Route} className="text-accent underline-offset-4 hover:underline">
            Qard Hassan
          </Link>
          .
        </p>
      </div>

      <form
        action={submitTawarruqFormAction}
        className="max-w-xl space-y-4 rounded-xl border border-border bg-card p-6"
      >
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          New application
        </h2>
        <p className="text-sm text-muted-foreground">
          After you submit, Amanah reviews the request, then may hand it to a partner. You will see
          status updates below.
        </p>
        <div className="space-y-2">
          <Label htmlFor="amount">Requested amount (KES)</Label>
          <Input id="amount" name="amount" type="number" min="1000" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="purpose">Purpose</Label>
          <Textarea id="purpose" name="purpose" minLength={5} required />
        </div>
        <Button type="submit" className="min-h-11">
          Submit application
        </Button>
      </form>

      <section className="space-y-4">
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
          Your applications
        </h2>
        {applications.length ? (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {applications.map((application) => (
              <li key={application.id} className="flex flex-wrap justify-between gap-4 px-5 py-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{application.purpose}</p>
                    <StatusBadge status={application.status} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatDate(application.created_at)}
                    {application.partner_status ? ` · partner: ${application.partner_status}` : ''}
                  </p>
                </div>
                <strong>{formatCurrency(Number(application.amount), application.currency)}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No applications yet"
            description="Submit a request above when you need partner Sharia finance beyond circle Qard."
            actionLabel="Back to Finance"
            actionHref={'/finance' as Route}
          />
        )}
      </section>
    </div>
  );
}
