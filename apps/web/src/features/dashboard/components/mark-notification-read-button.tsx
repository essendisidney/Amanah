'use client';

import { useTransition } from 'react';
import { Button } from '@jamiya/ui';
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from '../actions/notification-actions';
import {
  dispatchNotificationClearAll,
  dispatchNotificationRead,
} from '@/lib/notification-events';

export function MarkNotificationReadButton({
  notificationId,
  label,
}: {
  notificationId: string;
  label: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const fd = new FormData();
          fd.set('notificationId', notificationId);
          await markNotificationReadAction(fd);
          dispatchNotificationRead(1);
        });
      }}
    >
      {pending ? '…' : label}
    </Button>
  );
}

export function MarkAllNotificationsReadButton({ label }: { label: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await markAllNotificationsReadAction();
          dispatchNotificationClearAll();
        });
      }}
    >
      {pending ? '…' : label}
    </Button>
  );
}
