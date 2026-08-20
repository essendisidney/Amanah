import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { formatCurrency, formatRelativeTime } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { EmptyState } from '@/features/dashboard/components/empty-state';
import {
  MarkAllNotificationsReadButton,
  MarkNotificationReadButton,
} from '@/features/dashboard/components/mark-notification-read-button';
import { notificationHref } from '@/features/dashboard/lib/notification-href';
import { getDictionary } from '@/i18n/get-dictionary';
import { t } from '@/i18n/dictionaries';

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
      .limit(50),
    supabase
      .from('transactions')
      .select('id, type, status, amount, currency, direction, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const notifications = (data ?? []) as unknown as NotificationRow[];
  const recentTx = (txData ?? []) as unknown as TxRow[];
  const unreadCount = notifications.filter((item) => !item.read_at).length;

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
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">
            {labels.eyebrow}
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight">
            {labels.title}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {unreadCount > 0
              ? t(unreadCount === 1 ? labels.unreadOne : labels.unreadMany, {
                  count: unreadCount,
                })
              : labels.upToDate}
          </p>
        </div>
        {unreadCount > 0 ? (
          <MarkAllNotificationsReadButton label={labels.markAllRead} />
        ) : null}
      </div>

      {recentTx.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <h2 className="text-lg font-bold tracking-tight">{labels.recentMoney}</h2>
            <Button asChild size="sm" variant="ghost">
              <Link href={'/wallet' as Route}>{labels.openMoney}</Link>
            </Button>
          </div>
          <ul className="amanah-surface divide-y divide-border/70">
            {recentTx.map((tx) => {
              const amount = typeof tx.amount === 'number' ? tx.amount : Number(tx.amount);
              const signed =
                tx.direction === 'debit' || tx.direction === 'out' ? -Math.abs(amount) : amount;
              return (
                <li key={tx.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold capitalize">
                      {tx.type.replaceAll('_', ' ')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {tx.status} · {formatRelativeTime(tx.created_at)}
                    </p>
                  </div>
                  <p
                    className={`amanah-money text-sm font-semibold ${
                      signed < 0 ? 'text-destructive' : 'text-primary'
                    }`}
                  >
                    {signed < 0 ? '−' : '+'}
                    {formatCurrency(Math.abs(signed), tx.currency)}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <section className="amanah-surface flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">No recent money yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Top-ups, contributions, and withdrawals will show here.
            </p>
          </div>
          <Button asChild className="min-h-11 shrink-0">
            <Link href={'/wallet#top-up' as Route}>{labels.openMoney}</Link>
          </Button>
        </section>
      )}

      {notifications.length === 0 ? (
        <div className="space-y-3">
          <EmptyState
            title={labels.emptyTitle}
            description={labels.emptyDesc}
            actionLabel={labels.openCircles}
            actionHref={'/circles' as Route}
          />
          <Button asChild variant="outline" className="min-h-11">
            <Link href={'/wallet' as Route}>{labels.openMoney}</Link>
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {notifications.map((item) => {
            const href = notificationHref(item.type, item.data, slugByJamiyaId);
            return (
              <li
                key={item.id}
                className={`flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between ${
                  item.read_at ? '' : 'bg-primary/[0.03]'
                }`}
              >
                <div className="min-w-0 flex-1">
                  {href ? (
                    <Link
                      href={href}
                      className="font-medium text-foreground hover:text-primary"
                    >
                      {item.title}
                    </Link>
                  ) : (
                    <p className="font-medium text-foreground">{item.title}</p>
                  )}
                  <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
                  <p className="mt-2 text-xs capitalize text-muted-foreground">
                    {item.type.replaceAll('_', ' ')} · {formatRelativeTime(item.created_at)}
                  </p>
                  {href ? (
                    <Button asChild size="sm" variant="link" className="mt-1 h-auto px-0">
                      <Link href={href}>{labels.openItem}</Link>
                    </Button>
                  ) : null}
                </div>
                {!item.read_at ? (
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

      <Button asChild variant="outline">
        <Link href={'/dashboard' as Route}>{dict.common.backToDashboard}</Link>
      </Button>
    </div>
  );
}
