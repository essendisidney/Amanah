import Link from 'next/link';
import type { Route } from 'next';
import { Button } from '@jamiya/ui';
import { formatRelativeTime } from '@jamiya/shared';
import type { Dictionary } from '@/i18n/dictionaries';
import { t } from '@/i18n/dictionaries';
import type { DashboardNotification } from '../types';
import { EmptyState, SectionHeader } from './empty-state';

export function NotificationsSection({
  notifications,
  unreadCount,
  labels,
  common,
}: {
  notifications: DashboardNotification[];
  unreadCount: number;
  labels: Dictionary['dashboard'];
  common: Dictionary['common'];
}) {
  return (
    <section>
      <SectionHeader
        title={labels.notificationsTitle}
        description={
          unreadCount > 0
            ? t(labels.unread, { count: unreadCount })
            : labels.notificationsDesc
        }
        action={
          <Button asChild size="sm" variant="outline">
            <Link href={'/notifications' as Route}>{common.viewAll}</Link>
          </Button>
        }
      />

      {notifications.length === 0 ? (
        <EmptyState
          title={labels.notificationsEmptyTitle}
          description={labels.notificationsEmptyDesc}
        />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {notifications.map((item) => (
            <li
              key={item.id}
              className={`px-5 py-4 ${item.readAt ? '' : 'bg-primary/[0.03]'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">
                    {!item.readAt ? (
                      <span
                        aria-hidden
                        className="mr-2 inline-block size-1.5 rounded-full bg-primary align-middle"
                      />
                    ) : null}
                    {item.title}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
                </div>
                <time
                  className="shrink-0 text-xs text-muted-foreground"
                  dateTime={item.createdAt}
                >
                  {formatRelativeTime(item.createdAt)}
                </time>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
