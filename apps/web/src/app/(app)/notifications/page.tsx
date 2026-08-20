import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { formatRelativeTime } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { EmptyState } from '@/features/dashboard/components/empty-state';
import {
  MarkAllNotificationsReadButton,
  MarkNotificationReadButton,
} from '@/features/dashboard/components/mark-notification-read-button';
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
  read_at: string | null;
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

  const { data } = await supabase
    .from('notifications')
    .select('id, title, body, type, read_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  const notifications = (data ?? []) as unknown as NotificationRow[];
  const unreadCount = notifications.filter((item) => !item.read_at).length;

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

      {notifications.length === 0 ? (
        <EmptyState
          title={labels.emptyTitle}
          description={labels.emptyDesc}
          actionLabel={dict.common.backToDashboard}
          actionHref={'/dashboard' as Route}
        />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {notifications.map((item) => (
            <li
              key={item.id}
              className={`flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between ${
                item.read_at ? '' : 'bg-primary/[0.03]'
              }`}
            >
              <div>
                <p className="font-medium text-foreground">{item.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
                <p className="mt-2 text-xs capitalize text-muted-foreground">
                  {item.type.replaceAll('_', ' ')} · {formatRelativeTime(item.created_at)}
                </p>
              </div>
              {!item.read_at ? (
                <MarkNotificationReadButton
                  notificationId={item.id}
                  label={labels.markRead}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <Button asChild variant="outline">
        <Link href={'/dashboard' as Route}>{dict.common.backToDashboard}</Link>
      </Button>
    </div>
  );
}
