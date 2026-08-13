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
import { RetryIntentButton } from '@/features/wallet/components/retry-intent-button';
import { getDictionary } from '@/i18n/get-dictionary';
import { t } from '@/i18n/dictionaries';

export const metadata: Metadata = {
  title: 'Wallet',
};

export const dynamic = 'force-dynamic';

type Props = {
  searchParams?: Promise<{ notice?: string; noticeType?: string }>;
};

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

export default async function WalletPage({ searchParams }: Props) {
  const notices = (await searchParams) ?? {};
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?next=/wallet');
  }

  const [{ dict }, walletResult, txResult, intentResult, pendingResult] = await Promise.all([
    getDictionary(),
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
    supabase
      .from('payment_intents')
      .select('id, status, amount, currency, provider, phone, error_message, created_at')
      .eq('user_id', user.id)
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const labels = dict.wallet;
  const wallets = (walletResult.data ?? []) as unknown as WalletRow[];
  const transactions = (txResult.data ?? []) as unknown as TxRow[];
  type IntentRow = {
    id: string;
    status: string;
    amount: number | string;
    currency: string;
    provider: string;
    phone: string | null;
    error_message: string | null;
    created_at: string;
  };
  const failedIntents = (intentResult.data ?? []) as unknown as IntentRow[];
  const pendingIntents = (pendingResult.data ?? []) as unknown as IntentRow[];
  const primaryCurrency = wallets[0]?.currency ?? 'KES';

  return (
    <div className="space-y-10">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">
          {labels.eyebrow}
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight">
          {labels.title}
        </h1>
        <p className="mt-2 text-muted-foreground">{labels.subtitle}</p>
      </div>

      {notices.notice ? (
        <p
          className={
            notices.noticeType === 'error'
              ? 'rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive'
              : 'rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary'
          }
          role="status"
        >
          {notices.notice}
        </p>
      ) : null}

      {wallets.length === 0 ? (
        <EmptyState
          title={labels.emptyTitle}
          description={labels.emptyDesc}
          actionLabel={dict.common.backToDashboard}
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
                  {t(labels.totalBalance, {
                    amount: formatCurrency(balance, wallet.currency),
                  })}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <section className="space-y-4">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
            {labels.topUp}
          </h2>
          <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
            <TopUpForm
              currency={primaryCurrency}
              labels={dict.walletForms}
              provider={
                ['mpesa', 'bank', 'paystack'].includes(
                  (process.env.PAYMENT_PROVIDER ?? 'simulated').toLowerCase(),
                )
                  ? ((process.env.PAYMENT_PROVIDER ?? 'simulated').toLowerCase() as
                      | 'mpesa'
                      | 'bank'
                      | 'paystack')
                  : 'simulated'
              }
            />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
            {labels.withdraw}
          </h2>
          <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
            <WithdrawalForm currency={primaryCurrency} labels={dict.walletForms} />
          </div>
        </section>
      </div>

      {pendingIntents.length > 0 ? (
        <section className="space-y-4">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
            {labels.paymentsInProgress}
          </h2>
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {pendingIntents.map((intent) => (
              <li key={intent.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">
                    {formatCurrency(Number(intent.amount), intent.currency)}
                  </p>
                  <StatusBadge status={intent.status} />
                  <StatusBadge status={intent.provider} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatDate(intent.created_at)}
                  {intent.phone ? ` · ${intent.phone}` : ''}
                  {intent.error_message ? ` · ${intent.error_message}` : ''}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {failedIntents.length > 0 ? (
        <section className="space-y-4">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
            {labels.failedPayments}
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
                <RetryIntentButton intentId={intent.id} labels={dict.walletForms} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-4">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          {labels.historyTitle}
        </h2>
        {transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{labels.historyEmpty}</p>
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
        <Link href={'/dashboard' as Route}>{dict.common.backToDashboard}</Link>
      </Button>
    </div>
  );
}
