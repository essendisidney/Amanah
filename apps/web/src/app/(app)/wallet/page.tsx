import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { formatCurrency, formatDate, formatRelativeTime } from '@jamiya/shared';
import { createClient } from '@/lib/supabase/server';
import { EmptyState } from '@/features/dashboard/components/empty-state';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';
import { TopUpForm } from '@/features/wallet/components/top-up-form';
import { WithdrawalForm } from '@/features/wallet/components/withdrawal-form';
import { RetryIntentButton } from '@/features/wallet/components/retry-intent-button';
import { getDictionary } from '@/i18n/get-dictionary';
import { t } from '@/i18n/dictionaries';
import { paymentProvider } from '@/lib/payments/provider';
import {
  requireRealProviders,
  shouldBlockSimulatedPayments,
} from '@/lib/production-cutover';
import { ArrowDownLeft, ArrowUpRight, ChartNoAxesCombined, PiggyBank, Plus } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Money',
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

  const [{ dict }, walletResult, txResult, intentResult, pendingResult, profileResult] =
    await Promise.all([
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
      supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
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
  const primary = wallets[0];
  const primaryCurrency = primary?.currency ?? 'KES';
  const available = primary
    ? typeof primary.available_balance === 'number'
      ? primary.available_balance
      : Number(primary.available_balance)
    : 0;
  const balance = primary
    ? typeof primary.balance === 'number'
      ? primary.balance
      : Number(primary.balance)
    : 0;
  const provider = paymentProvider();
  const liveLocked = shouldBlockSimulatedPayments();
  const requireReal = requireRealProviders();
  const displayName =
    (profileResult.data as { full_name?: string | null } | null)?.full_name ?? 'Member';

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          {labels.eyebrow}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">{labels.title}</h1>
        <p className="mt-2 text-muted-foreground">{labels.subtitle}</p>
      </div>

      {notices.notice ? (
        <p
          className={
            notices.noticeType === 'error'
              ? 'rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive'
              : 'rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary'
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
        <section className="amanah-surface overflow-hidden bg-[linear-gradient(145deg,#0b5c42_0%,#0f766e_55%,#0b5c42_100%)] p-5 text-primary-foreground md:p-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
            Available
          </p>
          <p className="amanah-money mt-2 text-4xl font-bold tracking-tight md:text-5xl">
            {formatCurrency(available, primaryCurrency)}
          </p>
          <p className="mt-2 text-sm text-white/80">
            {t(labels.totalBalance, {
              amount: formatCurrency(balance, primaryCurrency),
            })}
          </p>
          <p className="mt-4 text-[11px] text-white/60">
            Mode: {provider}
            {provider === 'simulated' ? ' · demo UAT credit' : ''}
            {requireReal ? ' · live required' : ''}
            {liveLocked ? ' · simulated blocked' : ''}
          </p>
        </section>
      )}

      <section className="grid grid-cols-4 gap-2 sm:gap-3">
        {[
          { href: '#top-up', label: 'Add', icon: Plus },
          { href: '/finance/goals', label: 'Save', icon: PiggyBank },
          { href: '/finance/insights', label: 'Insights', icon: ChartNoAxesCombined },
          { href: '#withdraw', label: 'Withdraw', icon: ArrowUpRight },
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

      <section className="amanah-surface overflow-hidden bg-[linear-gradient(135deg,#121816_0%,#1f2a24_55%,#0b5c42_120%)] p-5 text-white">
        <div className="flex items-start justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Amanah</p>
          <span className="text-accent">✦</span>
        </div>
        <p className="mt-8 font-mono text-lg tracking-[0.22em] text-white/90">
          {String(user.id).replace(/-/g, '').slice(0, 4)} ···· ····{' '}
          {displayName.replace(/\s+/g, '').slice(0, 4).toUpperCase().padEnd(4, 'X')}
        </p>
        <p className="mt-6 text-sm font-semibold tracking-wide">{displayName.toUpperCase()}</p>
        <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-white/55">
          Virtual card · Quiet premium · Coming with live rails
        </p>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section id="top-up" className="space-y-4">
          <h2 className="text-lg font-bold tracking-tight">{labels.topUp}</h2>
          <div className="amanah-surface p-5">
            <TopUpForm
              currency={primaryCurrency}
              labels={dict.walletForms}
              provider={provider}
            />
          </div>
        </section>

        <section id="withdraw" className="space-y-4">
          <h2 className="text-lg font-bold tracking-tight">{labels.withdraw}</h2>
          <div className="amanah-surface p-5">
            <WithdrawalForm currency={primaryCurrency} labels={dict.walletForms} />
          </div>
        </section>
      </div>

      {pendingIntents.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-bold tracking-tight">{labels.paymentsInProgress}</h2>
          <ul className="amanah-surface divide-y divide-border/70">
            {pendingIntents.map((intent) => (
              <li key={intent.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">
                    {formatCurrency(Number(intent.amount), intent.currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {intent.provider} · {formatDate(intent.created_at)}
                  </p>
                </div>
                <StatusBadge status={intent.status} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {failedIntents.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-bold tracking-tight">{labels.failedPayments}</h2>
          <ul className="amanah-surface divide-y divide-border/70">
            {failedIntents.map((intent) => (
              <li key={intent.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">
                    {formatCurrency(Number(intent.amount), intent.currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {intent.error_message ?? intent.status}
                  </p>
                </div>
                <RetryIntentButton intentId={intent.id} label={dict.walletForms.retry} />
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
    </div>
  );
}
