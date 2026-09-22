import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { formatCurrency, formatDate, formatRelativeTime } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { EmptyState } from '@/features/dashboard/components/empty-state';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';
import { TopUpForm } from '@/features/wallet/components/top-up-form';
import { WithdrawalForm } from '@/features/wallet/components/withdrawal-form';
import { RetryIntentButton } from '@/features/wallet/components/retry-intent-button';
import { CheckPaystackStatusButton } from '@/features/wallet/components/check-paystack-status-button';
import { IntasendTrustBadge } from '@/features/wallet/components/intasend-trust-badge';
import { hasValidProfilePhone } from '@/features/profile/components/profile-onboarding-banner';
import { getDictionary } from '@/i18n/get-dictionary';
import { paymentProvider } from '@/lib/payments/provider';
import { reconcileUserPaymentIntents } from '@/lib/payments/reconcile-user-intents';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChartNoAxesCombined,
  HandHeart,
  Landmark,
  Calculator,
  Plus,
  TrendingUp,
} from 'lucide-react';
import { AppPage, PageHeader } from '@/components/app-page';

export const metadata: Metadata = {
  title: 'Money',
};

export const dynamic = 'force-dynamic';

type Props = {
  searchParams?: Promise<{
    notice?: string;
    noticeType?: string;
    next?: string;
    amount?: string;
  }>;
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
  const { getSafeReturnPath } = await import('@/features/auth/lib/types');
  const returnPath = getSafeReturnPath(notices.next);
  const amountPrefill = Number(notices.amount ?? '');
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const q = new URLSearchParams();
    if (notices.next) q.set('next', notices.next);
    if (notices.amount) q.set('amount', notices.amount);
    const walletNext = q.toString() ? `/wallet?${q.toString()}` : '/wallet';
    redirect(`/login?next=${encodeURIComponent(walletNext)}`);
  }

  const [
    { dict },
    walletResult,
    txResult,
    intentResult,
    pendingResult,
    profileResult,
    withdrawalResult,
    journalResult,
  ] = await Promise.all([
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
        .limit(12),
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
      supabase
        .from('profiles')
        .select('phone, mpesa_phone')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('withdrawal_requests')
        .select(
          'id, amount, currency, status, destination_type, destination_phone, created_at, error_message',
        )
        .eq('user_id', user.id)
        .in('status', ['pending', 'processing'])
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('journal_entries')
        .select('id, domain, description, currency, source_type, posted_at')
        .eq('user_id', user.id)
        .order('posted_at', { ascending: false })
        .limit(8),
    ]);

  const labels = dict.wallet;
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
  type WithdrawalRow = {
    id: string;
    amount: number | string;
    currency: string;
    status: string;
    destination_type: string;
    destination_phone: string | null;
    created_at: string;
    error_message: string | null;
  };

  let wallets = (walletResult.data ?? []) as unknown as WalletRow[];
  const transactions = (txResult.data ?? []) as unknown as TxRow[];
  let failedIntents = (intentResult.data ?? []) as unknown as IntentRow[];
  let pendingIntents = (pendingResult.data ?? []) as unknown as IntentRow[];
  const pendingWithdrawals = (withdrawalResult.data ?? []) as unknown as WithdrawalRow[];
  const journalEntries = (journalResult.data ?? []) as unknown as Array<{
    id: string;
    domain: string;
    description: string | null;
    currency: string;
    source_type: string;
    posted_at: string;
  }>;

  const withdrawPhone =
    (profileResult.data as { mpesa_phone?: string | null; phone?: string | null } | null)
      ?.mpesa_phone ??
    (profileResult.data as { phone?: string | null } | null)?.phone ??
    '';
  const hasPhone = hasValidProfilePhone(
    (profileResult.data as { phone?: string | null } | null)?.phone ?? withdrawPhone,
  );

  await reconcileUserPaymentIntents(user.id);

  const [freshWallets, freshFailed, freshPending] = await Promise.all([
    supabase
      .from('wallets')
      .select('balance, available_balance, currency, updated_at')
      .eq('user_id', user.id)
      .order('currency', { ascending: true }),
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

  wallets = (freshWallets.data ?? []) as unknown as WalletRow[];
  failedIntents = (freshFailed.data ?? []) as unknown as IntentRow[];
  pendingIntents = (freshPending.data ?? []) as unknown as IntentRow[];

  const primary = wallets[0];
  const primaryCurrency = primary?.currency ?? 'KES';
  const available = primary
    ? typeof primary.available_balance === 'number'
      ? primary.available_balance
      : Number(primary.available_balance)
    : 0;
  const provider = paymentProvider();

  return (
    <AppPage>
      <PageHeader title={labels.title} subtitle={labels.subtitle} />

      {notices.notice ? (
        <div className="space-y-2">
          <p
            className={
              notices.noticeType === 'error'
                ? 'rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive'
                : notices.noticeType === 'info'
                  ? 'rounded-2xl border border-border bg-secondary/60 px-4 py-3 text-sm text-foreground'
                  : 'rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary'
            }
            role="status"
          >
            {notices.notice}
          </p>
          {returnPath && notices.noticeType !== 'error' ? (
            <Button asChild className="min-h-11">
              <Link href={returnPath as Route}>{labels.payContributionCta}</Link>
            </Button>
          ) : null}
        </div>
      ) : null}

      {!hasPhone ? (
        <div className="amanah-surface flex flex-col gap-3 border-accent/30 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">{labels.phoneBannerTitle}</p>
            <p className="mt-1 text-sm text-muted-foreground">{labels.phoneBannerBody}</p>
          </div>
          <Button asChild className="min-h-11 shrink-0">
            <Link href={'/profile?onboarding=1&next=/wallet#personal-details' as Route}>
              {labels.addPhone}
            </Link>
          </Button>
        </div>
      ) : null}

      {wallets.length === 0 ? (
        <EmptyState
          title={labels.emptyTitle}
          description={labels.emptyDesc}
          actionLabel={labels.topUp}
          actionHref={'#top-up' as Route}
        />
      ) : (
        <section className="amanah-forest overflow-hidden rounded-[1.75rem] p-5 text-white md:p-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
            {labels.availableLabel}
          </p>
          <p className="amanah-money mt-2 text-4xl font-bold tracking-tight md:text-5xl">
            {formatCurrency(available, primaryCurrency)}
          </p>
        </section>
      )}

      <section className="grid grid-cols-4 gap-2 sm:gap-3">
        {[
          { href: '#top-up', label: labels.topUp, icon: Plus },
          { href: '/pay', label: labels.quickPay, icon: ArrowDownLeft },
          { href: '#withdraw', label: labels.withdraw, icon: ArrowUpRight },
          { href: '#more', label: labels.quickMore, icon: ChartNoAxesCombined },
        ].map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.label}
              href={action.href as Route}
              className="amanah-surface flex flex-col items-center gap-2 px-2 py-3 text-center transition-transform active:scale-[0.98]"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary">
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-[11px] font-semibold sm:text-xs">{action.label}</span>
            </Link>
          );
        })}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section id="top-up" className="space-y-4">
          <h2 className="text-lg font-bold tracking-tight">{labels.topUp}</h2>
          <div className="amanah-surface p-5">
            <TopUpForm
              currency={primaryCurrency}
              labels={dict.walletForms}
              provider={provider}
              defaultPhone={withdrawPhone}
              defaultAmount={
                Number.isFinite(amountPrefill) && amountPrefill >= 10
                  ? amountPrefill
                  : undefined
              }
              returnPath={returnPath}
            />
          </div>
        </section>

        <section id="withdraw" className="space-y-4">
          <h2 className="text-lg font-bold tracking-tight">{labels.withdraw}</h2>
          <div className="amanah-surface p-5">
            <WithdrawalForm
              currency={primaryCurrency}
              labels={dict.walletForms}
              defaultPhone={withdrawPhone}
            />
          </div>
        </section>
      </div>

      {pendingIntents.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-bold tracking-tight">{labels.paymentsInProgress}</h2>
          <ul className="amanah-surface divide-y divide-border/70">
            {pendingIntents.map((intent) => {
              const canCheck =
                intent.provider === 'paystack' ||
                intent.provider === 'intasend' ||
                intent.provider === 'tendepay';
              return (
                <li key={intent.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold">
                      {formatCurrency(Number(intent.amount), intent.currency)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {intent.phone ? `${intent.phone} · ` : ''}
                      {formatDate(intent.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={intent.status} />
                    {canCheck ? (
                      <CheckPaystackStatusButton
                        intentId={intent.id}
                        labels={{
                          checkStatus: dict.walletForms.checkStatus,
                          checkingStatus: dict.walletForms.checkingStatus,
                        }}
                      />
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {failedIntents.length > 0 ? (
        <details className="space-y-3">
          <summary className="cursor-pointer text-lg font-bold tracking-tight">
            {labels.failedPayments}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({failedIntents.length})
            </span>
          </summary>
          <p className="text-xs text-muted-foreground">{labels.failedPaymentsHint}</p>
          <ul className="amanah-surface divide-y divide-border/70">
            {failedIntents.slice(0, 5).map((intent) => (
              <li key={intent.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">
                    {formatCurrency(Number(intent.amount), intent.currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {intent.error_message ?? intent.status}
                  </p>
                </div>
                <RetryIntentButton
                  intentId={intent.id}
                  labels={{
                    retry: dict.walletForms.retry,
                    retrying: dict.walletForms.retrying,
                  }}
                />
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {pendingWithdrawals.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-bold tracking-tight">{labels.withdrawalsInProgress}</h2>
          <ul className="amanah-surface divide-y divide-border/70">
            {pendingWithdrawals.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">
                    {formatCurrency(Number(row.amount), row.currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {row.destination_type === 'mpesa'
                      ? row.destination_phone ?? 'M-Pesa'
                      : row.destination_type}{' '}
                    · {formatDate(row.created_at)}
                  </p>
                  {row.error_message ? (
                    <p className="mt-0.5 text-xs text-destructive">{row.error_message}</p>
                  ) : null}
                </div>
                <StatusBadge status={row.status} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-bold tracking-tight">{labels.historyTitle}</h2>
        {transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{labels.historyEmpty}</p>
        ) : (
          <ul className="amanah-surface divide-y divide-border/70">
            {transactions.map((row) => {
              const inflow = row.direction === 'credit';
              return (
                <li key={row.id} className="flex items-center gap-3 px-4 py-3.5">
                  <span
                    className={
                      inflow
                        ? 'inline-flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-primary'
                        : 'inline-flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground'
                    }
                  >
                    {inflow ? (
                      <ArrowDownLeft className="h-4 w-4" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold capitalize">
                      {row.type.replaceAll('_', ' ')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatRelativeTime(row.created_at)}
                    </p>
                  </div>
                  <p
                    className={
                      inflow
                        ? 'amanah-money text-sm font-bold text-primary'
                        : 'amanah-money text-sm font-bold'
                    }
                  >
                    {inflow ? '+' : '−'}
                    {formatCurrency(Number(row.amount), row.currency)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {journalEntries.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-bold tracking-tight">Ledger posts</h2>
          <p className="text-xs text-muted-foreground">
            Append-only journal for your money movements (projection alongside wallet history).
          </p>
          <ul className="amanah-surface divide-y divide-border/70">
            {journalEntries.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {row.description ?? row.source_type}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {row.domain} · {formatRelativeTime(row.posted_at)}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {row.source_type}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <details id="more" className="scroll-mt-24">
        <summary className="cursor-pointer text-lg font-bold tracking-tight">
          {labels.moreTitle}
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[
            {
              href: '/finance/goals',
              title: labels.moreGoals,
              icon: TrendingUp,
            },
            {
              href: '/finance/qard',
              title: labels.moreQard,
              icon: Landmark,
            },
            {
              href: '/finance/insights',
              title: labels.quickInsights,
              icon: ChartNoAxesCombined,
            },
            {
              href: '/finance/welfare',
              title: dict.finance.welfareTitle,
              icon: HandHeart,
            },
            {
              href: '/sadaka',
              title: dict.common.sadaka,
              icon: HandHeart,
            },
            {
              href: '/zakat',
              title: labels.moreZakat,
              icon: Calculator,
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href as Route}
                className="amanah-surface flex items-center gap-3 px-3 py-3 transition-colors hover:border-primary/30"
              >
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-sm font-semibold text-foreground">{item.title}</span>
              </Link>
            );
          })}
        </div>
      </details>

      {provider === 'intasend' ? <IntasendTrustBadge /> : null}
    </AppPage>
  );
}
