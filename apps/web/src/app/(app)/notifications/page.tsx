import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { formatRelativeTime } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { EmptyState } from '@/features/dashboard/components/empty-state';
import { markNotificationReadAction, markAllNotificationsReadAction } from '@/features/dashboard/actions/notification-actions';

export const metadata: Metadata = {
  title: 'Notifications',
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
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">Inbox</p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight">
            Notifications
          </h1>
          <p className="mt-2 text-muted-foreground">
            {unreadCount > 0
              ? `${unreadCount} unread message${unreadCount === 1 ? '' : 's'}`
              : 'You are up to date.'}
          </p>
        </div>
        {unreadCount > 0 ? (
          <form action={markAllNotificationsReadAction}>
            <Button type="submit" variant="outline" size="sm">
              Mark all as read
            </Button>
          </form>
        ) : null}
      </div>

      {notifications.length === 0 ? (
        <EmptyState
          title="No notifications yet"
          description="Circle invites, contribution reminders, and payout updates will appear here."
          actionLabel="Back to dashboard"
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
                <form action={markNotificationReadAction}>
                  <input type="hidden" name="notificationId" value={item.id} />
                  <Button type="submit" size="sm" variant="ghost">
                    Mark read
                  </Button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <Button asChild variant="outline">
        <Link href={'/dashboard' as Route}>Back to dashboard</Link>
      </Button>
    </div>
  );
}
