import type { Route } from 'next';

type NotificationData = Record<string, unknown> | null | undefined;

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asUuid(value: unknown): string | null {
  const s = asString(value);
  if (!s) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s,
  )
    ? s
    : null;
}

function circlePath(slug: string | null, hash?: string): Route | null {
  if (!slug) return null;
  return `${`/circles/${slug}`}${hash ?? ''}` as Route;
}

function safeInternalPath(value: string | null): Route | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  if (value.includes('\\') || value.includes('://')) return null;
  return value as Route;
}

/** Map notification type + payload to an in-app destination for Activity / toast deep links. */
export function notificationHref(
  type: string,
  data: NotificationData,
  slugByJamiyaId?: Map<string, string>,
  title?: string | null,
): Route | null {
  const payload = data && typeof data === 'object' ? data : {};
  const titleLc = (title ?? '').toLowerCase();

  const explicit =
    safeInternalPath(asString(payload.href)) ??
    safeInternalPath(asString(payload.path)) ??
    safeInternalPath(asString(payload.admin_path)) ??
    safeInternalPath(asString(payload.invite_path));
  if (explicit) return explicit;

  const campaignId = asUuid(payload.campaign_id);
  const campaignSlug = asString(payload.slug);
  if (campaignId) {
    // Platform admins get “pending review”; creators get approve/reject/live updates.
    if (
      titleLc.includes('pending review') ||
      titleLc.includes('awaits approval')
    ) {
      return '/admin/sadaka' as Route;
    }
    if (campaignSlug) {
      return `/sadaka/${campaignSlug}` as Route;
    }
    return '/sadaka/my' as Route;
  }

  if (asUuid(payload.dual_approval_id)) {
    return '/admin/withdrawals' as Route;
  }

  if (asUuid(payload.withdrawal_id)) {
    return '/wallet' as Route;
  }

  if (asUuid(payload.dispute_id)) {
    if (type === 'admin') return '/admin/disputes' as Route;
    const jamiyaId = asString(payload.jamiya_id);
    const disputeSlug =
      asString(payload.slug) ??
      (jamiyaId ? (slugByJamiyaId?.get(jamiyaId) ?? null) : null);
    return circlePath(disputeSlug) ?? ('/notifications' as Route);
  }

  if (asUuid(payload.document_id) && type === 'kyc_update') {
    if (titleLc.includes('circle')) {
      const jamiyaId = asString(payload.jamiya_id);
      const slug =
        asString(payload.slug) ??
        (jamiyaId ? (slugByJamiyaId?.get(jamiyaId) ?? null) : null);
      return circlePath(slug, '#registration') ?? ('/admin/kyc' as Route);
    }
    return '/profile#kyc-documents' as Route;
  }

  if (asUuid(payload.document_id) && (type === 'admin' || type === 'system')) {
    return '/admin/kyc' as Route;
  }

  if (type === 'admin' && asUuid(payload.application_id)) {
    return '/admin/tawarruq' as Route;
  }

  if (asUuid(payload.application_id)) {
    return '/finance/tawarruq' as Route;
  }

  if (asString(payload.kind) === 'qard_guarantee' || asUuid(payload.loan_id)) {
    const jamiyaId = asString(payload.jamiya_id);
    const slug =
      asString(payload.slug) ??
      (jamiyaId ? (slugByJamiyaId?.get(jamiyaId) ?? null) : null);
    return circlePath(slug) ?? ('/circles' as Route);
  }

  if (asUuid(payload.payment_intent_id) || asUuid(payload.transaction_id)) {
    return '/wallet' as Route;
  }

  if (asString(payload.receipt) || asUuid(payload.donation_id)) {
    const receipt = asString(payload.receipt);
    return receipt
      ? (`/sadaka/receipt/${receipt}` as Route)
      : ('/sadaka/my' as Route);
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
      return '/admin' as Route;
    case 'system':
      return circlePath(slug) ?? ('/dashboard' as Route);
    default:
      return circlePath(slug);
  }
}
