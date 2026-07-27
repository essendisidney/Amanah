import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { EmptyState } from '@/features/dashboard/components/empty-state';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';
import { TopUpForm } from '@/features/wallet/components/top-up-form';
import { WithdrawalForm } from '@/features/wallet/components/withdrawal-form';
import { retryPaymentIntentAction } from '@/features/wallet/actions/wallet-actions';

export const metadata: Metadata = {
  title: 'Wallet',
};

export const dynamic = 'force-dynamic';

type WalletRow = {
  balance: number | string;
  available_balance: number | string;
  currency: string;
  updated_at: string;
};

type TxRow = {
  id: string;
  type: string;
  status: string;
  amount: number | string;
  currency: string;
  direction: string;
  reference: string | null;
  created_at: string;
};

export default async function WalletPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?next=/wallet');
  }

  const [{ data }, { data: txData }, { data: intentData }] = await Promise.all([
    supabase
      .from('wallets')
      .select('balance, available_balance, currency, updated_at')
      .eq('user_id', user.id)
      .order('currency', { ascending: true }),
    supabase
      .from('transactions')
      .select('id, type, status, amount, currency, direction, reference, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(40),
    supabase
      .from('payment_intents')
      .select('id, status, amount, currency, provider, phone, error_message, created_at')
      .eq('user_id', user.id)
      .in('status', ['failed', 'expired', 'cancelled'])
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const wallets = (data ?? []) as unknown as WalletRow[];
  const transactions = (txData ?? []) as unknown as TxRow[];
  const failedIntents = (intentData ?? []) as unknown as Array<{
    id: string;
    status: string;
    amount: number | string;
    currency: string;
    provider: string;
    phone: string | null;
    error_message: string | null;
    created_at: string;
  }>;
  const primaryCurrency = wallets[0]?.currency ?? 'KES';

  return (
    <div className="space-y-10">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">Balances</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight">
          Wallet
        </h1>
        <p className="mt-2 text-muted-foreground">
          Top up to pay contributions. Payouts credit here when cycles settle.
        </p>
      </div>

      {wallets.length === 0 ? (
        <EmptyState
          title="No wallet found"
          description="A default wallet is created automatically when your profile is provisioned."
          actionLabel="Back to dashboard"
          actionHref={'/dashboard' as Route}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {wallets.map((wallet) => {
            const available =
              typeof wallet.available_balance === 'number'
                ? wallet.available_balance
                : Number(wallet.available_balance);
            const balance =
              typeof wallet.balance === 'number' ? wallet.balance : Number(wallet.balance);

            return (
              <li
                key={wallet.currency}
                className="rounded-xl border border-border bg-card px-5 py-5"
              >
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {wallet.currency}
                </p>
                <p className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold">
                  {formatCurrency(available, wallet.currency)}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Total balance {formatCurrency(balance, wallet.currency)}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <section className="max-w-md space-y-4">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          Top up
        </h2>
        <div className="rounded-xl border border-border bg-card p-6">
          <TopUpForm
            currency={primaryCurrency}
            provider={
              ['mpesa', 'bank'].includes(
                (process.env.PAYMENT_PROVIDER ?? 'simulated').toLowerCase(),
              )
                ? ((process.env.PAYMENT_PROVIDER ?? 'simulated').toLowerCase() as
                    | 'mpesa'
                    | 'bank')
                : 'simulated'
            }
          />
        </div>
      </section>

      <section className="max-w-md space-y-4">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          Withdraw
        </h2>
        <div className="rounded-xl border border-border bg-card p-6">
          <WithdrawalForm currency={primaryCurrency} />
        </div>
      </section>

      {failedIntents.length > 0 ? (
        <section className="space-y-4">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
            Failed payments — retry
          </h2>
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {failedIntents.map((intent) => (
              <li
                key={intent.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">
                      {formatCurrency(Number(intent.amount), intent.currency)}
                    </p>
                    <StatusBadge status={intent.status} />
                    <StatusBadge status={intent.provider} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatDate(intent.created_at)}
                    {intent.error_message ? ` · ${intent.error_message}` : ''}
                  </p>
                </div>
                <form action={retryPaymentIntentAction}>
                  <input type="hidden" name="intentId" value={intent.id} />
                  <Button type="submit" size="sm">
                    Retry
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-4">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          Transaction history
        </h2>
        {transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No ledger entries yet. Top-ups, contributions, and payouts will appear here.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {transactions.map((tx) => {
              const amount = typeof tx.amount === 'number' ? tx.amount : Number(tx.amount);
              return (
                <li
                  key={tx.id}
                  className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium capitalize">
                        {tx.type.replaceAll('_', ' ')}
                      </p>
                      <StatusBadge status={tx.status} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatDate(tx.created_at)}
                      {tx.reference ? ` · ${tx.reference}` : ''}
                    </p>
                  </div>
                  <p
                    className={
                      tx.direction === 'credit'
                        ? 'text-sm font-semibold text-primary'
                        : 'text-sm font-semibold'
                    }
                  >
                    {tx.direction === 'credit' ? '+' : '−'}
                    {formatCurrency(amount, tx.currency)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Button asChild variant="outline">
        <Link href={'/dashboard' as Route}>Back to dashboard</Link>
      </Button>
    </div>
  );
}
