'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

type NotificationPayload = {
  id: string;
  title: string;
  body: string;
  user_id: string;
};

/**
 * Subscribes to in-app notification inserts for the signed-in user.
 * Shows a toast and refreshes server-rendered notification badges.
 */
export function NotificationRealtime({ userId }: { userId: string }) {
  const router = useRouter();

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
          router.refresh();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, router]);

  return null;
}
