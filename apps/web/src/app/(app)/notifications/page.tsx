import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { formatCurrency, formatRelativeTime } from '@jamiya/shared';
import { createClient } from '@/lib/supabase/server';
import {
  MarkAllNotificationsReadButton,
  MarkNotificationReadButton,
} from '@/features/dashboard/components/mark-notification-read-button';
import { notificationHref } from '@/features/dashboard/lib/notification-href';
import { AppPage, PageCard, PageHeader } from '@/components/app-page';
import { enrichNotification } from '@/features/dashboard/lib/notification-enrichment';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';
import { getDictionary } from '@/i18n/get-dictionary';
import type { Route } from 'next';

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

  return (
    <AppPage width="medium">
      <PageHeader
        title={labels.title}
        action={
          unreadCount > 0 ? (
            <MarkAllNotificationsReadButton label={labels.markAllRead} />
          ) : undefined
        }
      />

      <PageCard className="!py-2">
        <h2 className="mb-1 px-1 pt-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Updates
        </h2>
        <ul className="divide-y divide-border/50">
          {notifications.length === 0 ? (
            <li className="py-6 text-sm text-muted-foreground">
              {labels.emptyDesc}
            </li>
          ) : (
            notifications.map((item) => {
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
              return (
                <li key={item.id} className="flex items-start justify-between gap-3 py-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {href ? (
                        <Link href={href} className="text-[15px] font-medium text-foreground">
                          {item.title}
                        </Link>
                      ) : (
                        <p className="text-[15px] font-medium">{item.title}</p>
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
                  {!item.read_at ? (
                    <MarkNotificationReadButton
                      notificationId={item.id}
                      label={labels.markRead}
                    />
                  ) : null}
                </li>
              );
            })
          )}
        </ul>
      </PageCard>

      <details className="group">
        <summary className="cursor-pointer list-none rounded-[1.35rem] border border-border/70 bg-card/40 px-4 py-3.5 text-sm font-semibold text-foreground">
          {labels.recentMoney}
          <span className="ml-2 font-normal text-muted-foreground">
            ({recentTx.length})
          </span>
        </summary>
        <PageCard className="mt-3 !py-2">
          <ul className="divide-y divide-border/50">
            {recentTx.length === 0 ? (
              <li className="py-6 text-sm text-muted-foreground">No money movement yet</li>
            ) : (
              recentTx.map((tx) => {
                const amount = typeof tx.amount === 'number' ? tx.amount : Number(tx.amount);
                const signed =
                  tx.direction === 'debit' || tx.direction === 'out'
                    ? -Math.abs(amount)
                    : amount;
                return (
                  <li key={tx.id} className="flex items-center justify-between gap-3 py-3.5">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-medium capitalize">
                        {tx.type.replaceAll('_', ' ')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatRelativeTime(tx.created_at)}
                      </p>
                    </div>
                    <p
                      className={`amanah-money text-[15px] font-semibold ${
                        signed < 0 ? 'amanah-money-out' : 'amanah-money-in'
                      }`}
                    >
                      {signed < 0 ? '−' : '+'}
                      {formatCurrency(Math.abs(signed), tx.currency)}
                    </p>
                  </li>
                );
              })
            )}
          </ul>
        </PageCard>
      </details>
    </AppPage>
  );
}
