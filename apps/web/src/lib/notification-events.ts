export const NOTIFICATION_INSERT_EVENT = 'amanah:notification-insert';

export function dispatchNotificationInsert() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(NOTIFICATION_INSERT_EVENT));
}
