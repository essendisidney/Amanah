import type { Route } from 'next';

type NotificationData = Record<string, unknown> | null | undefined;

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function circlePath(slug: string | null, hash?: string): Route | null {
  if (!slug) return null;
  return `${`/circles/${slug}`}${hash ?? ''}` as Route;
}

/** Map notification type + payload to an in-app destination for Activity deep links. */
export function notificationHref(
  type: string,
  data: NotificationData,
  slugByJamiyaId?: Map<string, string>,
): Route | null {
  const payload = data && typeof data === 'object' ? data : {};
  const invitePath = asString(payload.invite_path);
  if (invitePath?.startsWith('/') && !invitePath.startsWith('//')) {
    return invitePath as Route;
  }

  const slug =
    asString(payload.slug) ??
    (asString(payload.jamiya_id)
      ? (slugByJamiyaId?.get(asString(payload.jamiya_id)!) ?? null)
      : null);

  switch (type) {
    case 'invitation':
      return circlePath(slug) ?? ('/circles' as Route);
    case 'contribution_due':
    case 'contribution_received':
      return circlePath(slug, '#pay') ?? ('/wallet' as Route);
    case 'payout_scheduled':
    case 'payout_paid':
      return circlePath(slug) ?? ('/dashboard' as Route);
    case 'kyc_update':
      return '/profile#kyc-documents' as Route;
    case 'admin':
    case 'system':
      return '/dashboard' as Route;
    default:
      return circlePath(slug);
  }
}
