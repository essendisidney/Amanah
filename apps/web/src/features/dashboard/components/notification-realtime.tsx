'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { Route } from 'next';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { dispatchNotificationInsert } from '@/lib/notification-events';
import { notificationHref } from '../lib/notification-href';

type NotificationPayload = {
  id: string;
  title: string;
  body: string;
  type?: string;
  data?: Record<string, unknown> | null;
  user_id: string;
};

/**
 * Subscribes to in-app notification inserts for the signed-in user.
 * Toast “Open” deep-links into the right approve / review screen.
 */
export function NotificationRealtime({ userId }: { userId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    let channel: ReturnType<ReturnType<typeof createClient>['channel']> | null = null;
    let supabase: ReturnType<typeof createClient> | null = null;

    try {
      supabase = createClient();
      channel = supabase
        .channel(`notifications:${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          (payload: { new: NotificationPayload }) => {
            const row = payload.new;
            const href =
              notificationHref(row.type ?? 'system', row.data, undefined, row.title) ??
              ('/notifications' as Route);

            toast(row.title, {
              description: row.body,
              duration: 10_000,
              action: {
                label: 'Open',
                onClick: () => {
                  router.push(href);
                },
              },
            });
            dispatchNotificationInsert();

            const path = pathnameRef.current ?? '';
            if (!path.startsWith('/notifications') && !path.startsWith('/dashboard')) {
              return;
            }

            if (refreshTimerRef.current) {
              clearTimeout(refreshTimerRef.current);
            }
            refreshTimerRef.current = setTimeout(() => {
              router.refresh();
            }, 1500);
          },
        )
        .subscribe();
    } catch {
      return undefined;
    }

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      if (supabase && channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [userId, router]);

  return null;
}
