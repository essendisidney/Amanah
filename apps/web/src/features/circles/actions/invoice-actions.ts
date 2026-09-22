'use server';

import { revalidatePath } from 'next/cache';
import { callRpc } from '@/lib/supabase/rpc';
import { redirectWithCircleNotice } from '../lib/circle-notice';

function revalidateInvoices(slug: string) {
  revalidatePath(`/circles/${slug}`);
  revalidatePath(`/circles/${slug}/invoices`);
  revalidatePath(`/circles/${slug}/officer`);
  revalidatePath(`/circles/${slug}/arrears`);
  revalidatePath('/notifications');
  revalidatePath('/dashboard');
}

export async function issueInvoicesAction(formData: FormData): Promise<void> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const withinRaw = String(formData.get('dueWithinDays') ?? '').trim();
  const dueWithinDays = withinRaw === '' ? null : Number(withinRaw);
  if (!jamiyaId || !slug) return;

  const { data, error } = await callRpc('issue_contribution_invoices', {
    p_jamiya_id: jamiyaId,
    ...(dueWithinDays != null && Number.isFinite(dueWithinDays)
      ? { p_due_within_days: dueWithinDays }
      : {}),
  });
  if (error) {
    redirectWithCircleNotice(slug, error.message, 'error', '/invoices');
    return;
  }
  const result = data as {
    ok?: boolean;
    issued?: number;
    error?: string;
    due_within_days?: number | null;
  } | null;
  if (!result?.ok) {
    redirectWithCircleNotice(slug, result?.error ?? 'Could not issue invoices.', 'error', '/invoices');
    return;
  }

  revalidateInvoices(slug);
  const windowHint =
    result.due_within_days != null ? ` (due within ${result.due_within_days} days)` : '';
  redirectWithCircleNotice(
    slug,
    `Issued ${result.issued ?? 0} contribution invoice(s)${windowHint}.`,
    'success',
    '/invoices',
  );
}

export async function remindInvoicesAction(formData: FormData): Promise<void> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const userId = String(formData.get('userId') ?? '').trim();
  const returnTo = String(formData.get('returnTo') ?? 'invoices');
  if (!jamiyaId || !slug) return;

  const pathSuffix =
    returnTo === 'arrears' ? '/arrears' : returnTo === 'circle' ? '' : '/invoices';
  const { data, error } = await callRpc('remind_contribution_invoices', {
    p_jamiya_id: jamiyaId,
    ...(userId ? { p_user_id: userId } : {}),
  });
  if (error) {
    redirectWithCircleNotice(slug, error.message, 'error', pathSuffix || undefined);
    return;
  }
  const result = data as {
    ok?: boolean;
    reminded?: number;
    skipped_cooldown?: number;
    error?: string;
  } | null;
  if (!result?.ok) {
    redirectWithCircleNotice(
      slug,
      result?.error ?? 'Could not send reminders.',
      'error',
      pathSuffix || undefined,
    );
    return;
  }

  revalidateInvoices(slug);
  if (returnTo === 'arrears') {
    revalidatePath(`/circles/${slug}/arrears`);
  }
  const skipped = result.skipped_cooldown ?? 0;
  redirectWithCircleNotice(
    slug,
    skipped > 0
      ? `Sent ${result.reminded ?? 0} reminder(s); skipped ${skipped} (24h cooldown).`
      : `Sent ${result.reminded ?? 0} invoice reminder(s).`,
    'success',
    pathSuffix || undefined,
  );
}

/** Issue invoices for dues due soon, then remind members (Wave 8). */
export async function nudgeCircleDuesAction(formData: FormData): Promise<void> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const returnTo = String(formData.get('returnTo') ?? 'invoices');
  const withinRaw = String(formData.get('dueWithinDays') ?? '7').trim();
  const dueWithinDays = Number.isFinite(Number(withinRaw)) ? Number(withinRaw) : 7;
  if (!jamiyaId || !slug) return;

  const pathSuffix =
    returnTo === 'arrears' ? '/arrears' : returnTo === 'circle' ? '' : '/invoices';

  const { data, error } = await callRpc('nudge_circle_dues', {
    p_jamiya_id: jamiyaId,
    p_due_within_days: dueWithinDays,
  });
  if (error) {
    redirectWithCircleNotice(slug, error.message, 'error', pathSuffix || undefined);
    return;
  }
  const result = data as {
    ok?: boolean;
    issued?: number;
    reminded?: number;
    skipped_cooldown?: number;
    error?: string;
    due_within_days?: number;
  } | null;
  if (!result?.ok) {
    redirectWithCircleNotice(
      slug,
      result?.error ?? 'Could not nudge dues.',
      'error',
      pathSuffix || undefined,
    );
    return;
  }

  revalidateInvoices(slug);
  const skipped = result.skipped_cooldown ?? 0;
  const days = result.due_within_days ?? dueWithinDays;
  redirectWithCircleNotice(
    slug,
    skipped > 0
      ? `Nudged dues due within ${days}d: issued ${result.issued ?? 0}, reminded ${result.reminded ?? 0} (skipped ${skipped}).`
      : `Nudged dues due within ${days}d: issued ${result.issued ?? 0}, reminded ${result.reminded ?? 0}.`,
    'success',
    pathSuffix || undefined,
  );
}
