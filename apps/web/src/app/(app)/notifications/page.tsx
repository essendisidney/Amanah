import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { formatCurrency, formatRelativeTime } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import {
  MarkAllNotificationsReadButton,
  MarkNotificationReadButton,
} from '@/features/dashboard/components/mark-notification-read-button';
import { notificationHref } from '@/features/dashboard/lib/notification-href';
import { AppPage, PageHeader } from '@/components/app-page';
import { enrichNotification } from '@/features/dashboard/lib/notification-enrichment';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';
import { getDictionary } from '@/i18n/get-dictionary';
import { t } from '@/i18n/dictionaries';
import type { Route } from 'next';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Activity',
};

export const dynamic = 'force-dynamic';

type NotificationRow = {
  id: string;
  title: string;
  body: string;
  type: string;
  data: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

type TxRow = {
  id: string;
  type: string;
  status: string;
  amount: number | string;
  currency: string;
  direction: string;
  created_at: string;
};

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?next=/notifications');
  }

  const { dict } = await getDictionary();
  const labels = dict.notificationsPage;

  const [{ data }, { data: txData }] = await Promise.all([
    supabase
      .from('notifications')
      .select('id, title, body, type, data, read_at, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(40),
    supabase
      .from('transactions')
      .select('id, type, status, amount, currency, direction, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  const notifications = (data ?? []) as unknown as NotificationRow[];
  const recentTx = (txData ?? []) as unknown as TxRow[];
  const unreadCount = notifications.filter((item) => !item.read_at).length;

  const withdrawalIds = Array.from(
    new Set(
      notifications
        .map((item) =>
          item.data && typeof item.data.withdrawal_id === 'string'
            ? item.data.withdrawal_id
            : null,
        )
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const intentIds = Array.from(
    new Set(
      notifications
        .map((item) => {
          if (!item.data) return null;
          if (typeof item.data.payment_intent_id === 'string') return item.data.payment_intent_id;
          if (typeof item.data.intent_id === 'string') return item.data.intent_id;
          return null;
        })
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const withdrawalsById = new Map<
    string,
    { id: string; status: string; error_message?: string | null }
  >();
  const intentsById = new Map<
    string,
    {
      id: string;
      status: string;
      settlement_status?: string | null;
      reconcile_status?: string | null;
      error_message?: string | null;
    }
  >();

  if (withdrawalIds.length > 0) {
    const { data: withdrawals } = await supabase
      .from('withdrawal_requests')
      .select('id, status, error_message')
      .in('id', withdrawalIds)
      .eq('user_id', user.id);
    for (const row of (withdrawals ?? []) as Array<{
      id: string;
      status: string;
      error_message: string | null;
    }>) {
      withdrawalsById.set(row.id, row);
    }
  }

  if (intentIds.length > 0) {
    const { data: intents } = await supabase
      .from('payment_intents')
      .select('id, status, settlement_status, reconcile_status, error_message')
      .in('id', intentIds)
      .eq('user_id', user.id);
    for (const row of (intents ?? []) as Array<{
      id: string;
      status: string;
      settlement_status: string | null;
      reconcile_status: string | null;
      error_message: string | null;
    }>) {
      intentsById.set(row.id, row);
    }
  }

  const jamiyaIds = Array.from(
    new Set(
      notifications
        .map((item) =>
          item.data && typeof item.data.jamiya_id === 'string'
            ? item.data.jamiya_id
            : null,
        )
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const slugByJamiyaId = new Map<string, string>();
  if (jamiyaIds.length > 0) {
    const { data: circles } = await supabase
      .from('jamiyas')
      .select('id, slug')
      .in('id', jamiyaIds);
    for (const row of (circles ?? []) as Array<{ id: string; slug: string }>) {
      slugByJamiyaId.set(row.id, row.slug);
    }
  }

  const subtitle =
    unreadCount > 0
      ? unreadCount === 1
        ? t(labels.unreadOne, { count: unreadCount })
        : t(labels.unreadMany, { count: unreadCount })
      : labels.upToDate;

  return (
    <AppPage width="medium">
      <PageHeader
        title={labels.title}
        subtitle={subtitle}
        action={
          unreadCount > 0 ? (
            <MarkAllNotificationsReadButton label={labels.markAllRead} />
          ) : undefined
        }
      />

      <section className="space-y-2.5">
        <h2 className="text-sm font-semibold text-foreground">Updates</h2>
        {notifications.length === 0 ? (
          <div className="amanah-surface space-y-3.5 border-primary/20 px-4 py-4 sm:px-5">
            <div>
              <p className="text-base font-semibold tracking-tight text-foreground">
                {labels.emptyTitle}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{labels.emptyDesc}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button asChild className="min-h-11 w-full">
                <Link href={'/circles' as Route}>{labels.openCircles}</Link>
              </Button>
              <Button asChild variant="outline" className="min-h-11 w-full">
                <Link href={'/wallet' as Route}>{labels.openMoney}</Link>
              </Button>
            </div>
          </div>
        ) : (
          <ul className="amanah-surface divide-y divide-border/70">
            {notifications.map((item) => {
              const enrichment = enrichNotification({
                title: item.title,
                type: item.type,
                data: item.data,
                withdrawalsById,
                intentsById,
              });
              const href =
                notificationHref(item.type, item.data, slugByJamiyaId, item.title) ??
                (enrichment.hrefHint as Route | null);
              const unread = !item.read_at;

              return (
                <li
                  key={item.id}
                  className={cn(
                    'flex items-start justify-between gap-3 px-4 py-3.5 sm:px-5',
                    unread && 'bg-primary/[0.04]',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {href ? (
                        <Link
                          href={href}
                          className="text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          {item.title}
                        </Link>
                      ) : (
                        <p className="text-sm font-semibold text-foreground">{item.title}</p>
                      )}
                      {enrichment.currentStatus ? (
                        <StatusBadge status={enrichment.currentStatus} />
                      ) : null}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{item.body}</p>
                    {enrichment.statusNote ? (
                      <p className="mt-1 text-xs font-medium text-foreground">
                        {enrichment.statusNote}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatRelativeTime(item.created_at)}
                    </p>
                  </div>
                  {unread ? (
                    <MarkNotificationReadButton
                      notificationId={item.id}
                      label={labels.markRead}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-2.5">
        <div className="flex items-baseline justify-between gap-3 px-0.5">
          <h2 className="text-sm font-semibold text-foreground">{labels.recentMoney}</h2>
          <Link
            href={'/wallet' as Route}
            className="text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {labels.openMoney}
          </Link>
        </div>
        <ul className="amanah-surface divide-y divide-border/70">
          {recentTx.length === 0 ? (
            <li className="px-4 py-4 text-sm text-muted-foreground sm:px-5">
              No money movement yet
            </li>
          ) : (
            recentTx.map((tx) => {
              const amount = typeof tx.amount === 'number' ? tx.amount : Number(tx.amount);
              const inflow = !(tx.direction === 'debit' || tx.direction === 'out');
              return (
                <li
                  key={tx.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold capitalize text-foreground">
                        {tx.type.replaceAll('_', ' ')}
                      </p>
                      <StatusBadge status={tx.status} />
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatRelativeTime(tx.created_at)}
                    </p>
                  </div>
                  <p
                    className={cn(
                      'amanah-money shrink-0 text-sm font-semibold',
                      inflow ? 'amanah-money-in' : 'amanah-money-out',
                    )}
                  >
                    {inflow ? '+' : '−'}
                    {formatCurrency(Math.abs(amount), tx.currency)}
                  </p>
                </li>
              );
            })
          )}
        </ul>
      </section>
    </AppPage>
  );
}
