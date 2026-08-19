'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { dispatchNotificationInsert } from '@/lib/notification-events';

type NotificationPayload = {
  id: string;
  title: string;
  body: string;
  user_id: string;
};

/**
 * Subscribes to in-app notification inserts for the signed-in user.
 * Updates the nav badge locally; only refreshes list pages when needed.
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
    const supabase = createClient();
    const channel = supabase
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
          toast(row.title, { description: row.body });
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

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      void supabase.removeChannel(channel);
    };
  }, [userId, router]);

  return null;
}
