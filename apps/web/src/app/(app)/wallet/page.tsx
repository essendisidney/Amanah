import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { formatCurrency, formatDate, formatRelativeTime } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';
import { TopUpForm } from '@/features/wallet/components/top-up-form';
import { WithdrawalForm } from '@/features/wallet/components/withdrawal-form';
import { OpenDetailsOnHash } from '@/features/wallet/components/open-details-on-hash';
import { MoneyMoreLinks } from '@/features/wallet/components/money-more-links';
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
  Plus,
} from 'lucide-react';
import { AppPage, PageHeader } from '@/components/app-page';
import { BalanceToggle, PrivateAmount } from '@/features/wallet/components/balance-privacy';

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
    focus?: string;
  }>;
};

type WalletRow = {
  balance: number | string;
  available_balance: number | string;
  currency: string;
  updated_at: string;
};

type TxMeta = {
  kind?: string;
  label?: string;
  dividend_id?: string;
  declared_total?: number | string;
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
  metadata?: TxMeta | null;
};

function moneyHistoryLine(
  row: TxRow,
  declaredTotals: Map<string, number>,
): { title: string; detail: string | null } {
  const meta = row.metadata ?? {};
  if (meta.kind === 'circle_dividend') {
    const label = meta.label?.trim() || 'the declared dividend';
    const fromMeta = Number(meta.declared_total);
    const total = Number.isFinite(fromMeta)
      ? fromMeta
      : meta.dividend_id
        ? declaredTotals.get(meta.dividend_id)
        : undefined;
    return {
      title: 'Dividend share',
      detail:
        total != null && Number.isFinite(total)
          ? `Your part of ${label}. Declared total ${formatCurrency(total, row.currency)}. No fee was taken.`
          : `Your part of ${label}. No fee was taken.`,
    };
  }
  return { title: row.type.replaceAll('_', ' '), detail: null };
}

export default async function WalletPage({ searchParams }: Props) {
  const notices = (await searchParams) ?? {};
  const { getSafeReturnPath } = await import('@/features/auth/lib/types');
  const returnPath = getSafeReturnPath(notices.next);
  const amountPrefill = Number(notices.amount ?? '');
  const focus =
    notices.focus === 'top-up' || notices.focus === 'withdraw' ? notices.focus : null;
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
        .select('id, type, status, amount, currency, direction, reference, metadata, created_at')
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
        .limit(100),
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
  const openWithdrawals = (withdrawalResult.data ?? []) as unknown as WithdrawalRow[];
  const pendingWithdrawals = openWithdrawals.slice(0, 10);
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
  const reserved = openWithdrawals
    .filter((row) => row.currency === primaryCurrency)
    .reduce((sum, row) => sum + Number(row.amount), 0);
  const withdrawable = Math.max(0, available - reserved);
  const dividendIds = [
    ...new Set(
      transactions
        .map((row) => {
          const meta = row.metadata;
          if (meta?.kind !== 'circle_dividend' || !meta.dividend_id) return null;
          const fromMeta = Number(meta.declared_total);
          return Number.isFinite(fromMeta) ? null : meta.dividend_id;
        })
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const declaredTotals = new Map<string, number>();
  if (dividendIds.length > 0) {
    const { data: dividendRows } = await supabase
      .from('circle_dividends')
      .select('id, total_amount')
      .in('id', dividendIds);
    for (const row of (dividendRows ?? []) as Array<{ id: string; total_amount: number | string }>) {
      declaredTotals.set(row.id, Number(row.total_amount));
    }
  }
  const provider = paymentProvider();

  return (
    <AppPage width="medium">
      <PageHeader title={labels.title} subtitle={labels.subtitle} />

      {notices.notice ? (
        <div className="space-y-2">
          <p
            className={
              notices.noticeType === 'error'
                ? 'rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive'
                : notices.noticeType === 'info'
                  ? 'rounded-xl border border-border bg-secondary/60 px-4 py-3 text-sm text-foreground'
                  : 'rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary'
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
        <div className="jameiyah-surface flex flex-col gap-3 border-accent/30 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
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

      <section className="jameiyah-surface jm-balance-card jameiyah-on-dark space-y-4 px-5 py-5 sm:px-6">
        {wallets.length === 0 ? (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {labels.availableLabel}
            </p>
            <p className="jameiyah-money mt-1 text-3xl font-bold tracking-tight text-foreground">
              <span className="jm-amount">{formatCurrency(0, primaryCurrency)}</span>
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{labels.emptyDesc}</p>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {labels.availableLabel}
              </p>
              <p className="jameiyah-money mt-1 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                <PrivateAmount>{formatCurrency(available, primaryCurrency)}</PrivateAmount>
              </p>
            </div>
            <BalanceToggle
              showLabel={labels.showBalance}
              hideLabel={labels.hideBalance}
              className="-mr-2 -mt-1"
            />
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <Button asChild className="min-h-11 w-full px-2">
            <Link href={'/wallet?focus=top-up#top-up' as Route}>
              <Plus className="hidden h-4 w-4 sm:block" />
              <span className="truncate">{labels.topUp}</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11 w-full px-2">
            <Link href={'/pay' as Route}>
              <ArrowDownLeft className="hidden h-4 w-4 sm:block" />
              <span className="truncate">{labels.quickPay}</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11 w-full px-2">
            <Link href={'/wallet?focus=withdraw#withdraw' as Route}>
              <ArrowUpRight className="hidden h-4 w-4 sm:block" />
              <span className="truncate">{labels.withdraw}</span>
            </Link>
          </Button>
        </div>
      </section>

      <div className={focus ? 'grid gap-5' : 'grid gap-5 md:grid-cols-2'}>
        {focus !== 'withdraw' ? (
          <section id="top-up" className="scroll-mt-24 space-y-2.5">
            <h2 className="text-sm font-semibold text-foreground">{labels.topUp}</h2>
            <div className="jameiyah-surface p-4 sm:p-5">
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
            {focus === 'top-up' ? (
              <p className="text-sm text-muted-foreground">
                <Link
                  href={'/wallet?focus=withdraw#withdraw' as Route}
                  className="font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  Need to withdraw instead?
                </Link>
              </p>
            ) : null}
          </section>
        ) : null}

        {focus !== 'top-up' ? (
          <section id="withdraw" className="scroll-mt-24 space-y-2.5">
            <h2 className="text-sm font-semibold text-foreground">{labels.withdraw}</h2>
            <div className="jameiyah-surface p-4 sm:p-5">
              <WithdrawalForm
                currency={primaryCurrency}
                labels={dict.walletForms}
                defaultPhone={withdrawPhone}
                availableBalance={withdrawable}
                reservedAmount={reserved}
              />
            </div>
            {focus === 'withdraw' ? (
              <p className="text-sm text-muted-foreground">
                <Link
                  href={'/wallet?focus=top-up#top-up' as Route}
                  className="font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  Need to add money instead?
                </Link>
              </p>
            ) : null}
          </section>
        ) : null}
      </div>

      {pendingIntents.length > 0 ? (
        <section className="space-y-2.5">
          <h2 className="text-sm font-semibold text-foreground">{labels.paymentsInProgress}</h2>
          <ul className="jameiyah-surface divide-y divide-border/70">
            {pendingIntents.map((intent) => {
              const canCheck =
                intent.provider === 'paystack' ||
                intent.provider === 'intasend' ||
                intent.provider === 'tendepay';
              return (
                <li key={intent.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="jameiyah-money text-sm font-semibold">
                      <span className="jm-amount">{formatCurrency(Number(intent.amount), intent.currency)}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {intent.phone ? `${intent.phone} · ` : ''}
                      {formatDate(intent.created_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
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
        <details className="space-y-2.5">
          <summary className="cursor-pointer text-sm font-semibold text-foreground">
            {labels.failedPayments}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({failedIntents.length})
            </span>
          </summary>
          <p className="text-xs text-muted-foreground">{labels.failedPaymentsHint}</p>
          <ul className="jameiyah-surface divide-y divide-border/70">
            {failedIntents.slice(0, 5).map((intent) => (
              <li key={intent.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="jameiyah-money text-sm font-semibold">
                    <span className="jm-amount">{formatCurrency(Number(intent.amount), intent.currency)}</span>
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
        <section className="space-y-2.5">
          <h2 className="text-sm font-semibold text-foreground">{labels.withdrawalsInProgress}</h2>
          <p className="text-xs text-muted-foreground">{labels.pendingWithdrawalsHint}</p>
          <ul className="jameiyah-surface divide-y divide-border/70">
            {pendingWithdrawals.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="jameiyah-money text-sm font-semibold">
                    <span className="jm-amount">{formatCurrency(Number(row.amount), row.currency)}</span>
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

      <section className="space-y-2.5">
        <h2 className="text-sm font-semibold text-foreground">{labels.historyTitle}</h2>
        {transactions.length === 0 ? (
          <div className="jameiyah-surface px-4 py-6 text-center">
            <p className="text-sm font-medium text-foreground">{labels.historyEmpty}</p>
            <p className="mt-1 text-xs text-muted-foreground">{labels.emptyDesc}</p>
            <Button asChild className="mt-4 min-h-11">
              <Link href={'/wallet?focus=top-up#top-up' as Route}>{labels.topUp}</Link>
            </Button>
          </div>
        ) : (
          <ul className="jameiyah-surface divide-y divide-border/70">
            {transactions.map((row) => {
              const inflow = row.direction === 'credit';
              const line = moneyHistoryLine(row, declaredTotals);
              return (
                <li key={row.id} className="flex items-center gap-3 px-4 py-3">
                  <span
                    className={
                      inflow
                        ? 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary'
                        : 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground'
                    }
                  >
                    {inflow ? (
                      <ArrowDownLeft className="h-4 w-4" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold capitalize text-foreground">
                        {line.title}
                      </p>
                      <StatusBadge status={row.status} />
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {line.detail ? `${line.detail} · ` : ''}
                      {formatRelativeTime(row.created_at)}
                    </p>
                  </div>
                  <p
                    className={
                      inflow
                        ? 'jameiyah-money jameiyah-money-in shrink-0 text-sm font-semibold'
                        : 'jameiyah-money jameiyah-money-out shrink-0 text-sm font-semibold'
                    }
                  >
                    {inflow ? '+' : '−'}
                    <span className="jm-amount">{formatCurrency(Number(row.amount), row.currency)}</span>
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {journalEntries.length > 0 ? (
        <details className="space-y-2.5">
          <summary className="cursor-pointer text-sm font-semibold text-foreground">
            Records
          </summary>
          <p className="text-xs text-muted-foreground">
            A permanent note of money in and out.
          </p>
          <ul className="jameiyah-surface divide-y divide-border/70">
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
        </details>
      ) : null}

      <details id="more" className="scroll-mt-24">
        <OpenDetailsOnHash id="more" />
        <summary className="cursor-pointer text-sm font-semibold text-foreground">
          {labels.moreTitle}
        </summary>
        <div className="mt-3">
          <MoneyMoreLinks labels={labels} />
        </div>
      </details>

      {provider === 'intasend' ? <IntasendTrustBadge /> : null}
    </AppPage>
  );
}
