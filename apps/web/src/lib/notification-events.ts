export const NOTIFICATION_INSERT_EVENT = 'amanah:notification-insert';
export const NOTIFICATION_READ_EVENT = 'amanah:notification-read';
export const NOTIFICATION_CLEAR_EVENT = 'amanah:notification-clear';

export function dispatchNotificationInsert() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(NOTIFICATION_INSERT_EVENT));
}

export function dispatchNotificationRead(count = 1) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(NOTIFICATION_READ_EVENT, { detail: { count } }),
  );
}

export function dispatchNotificationClearAll() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(NOTIFICATION_CLEAR_EVENT));
}
