'use server';

import { revalidatePath } from 'next/cache';
import { callRpc } from '@/lib/supabase/rpc';
import { redirectWithCircleNotice } from '../lib/circle-notice';

function revalidateInvoices(slug: string) {
  revalidatePath(`/circles/${slug}`);
  revalidatePath(`/circles/${slug}/invoices`);
  revalidatePath(`/circles/${slug}/officer`);
  revalidatePath('/notifications');
  revalidatePath('/dashboard');
}

export async function issueInvoicesAction(formData: FormData): Promise<void> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  if (!jamiyaId || !slug) return;

  const { data, error } = await callRpc('issue_contribution_invoices', {
    p_jamiya_id: jamiyaId,
  });
  if (error) {
    redirectWithCircleNotice(slug, error.message, 'error', '/invoices');
    return;
  }
  const result = data as { ok?: boolean; issued?: number; error?: string } | null;
  if (!result?.ok) {
    redirectWithCircleNotice(slug, result?.error ?? 'Could not issue invoices.', 'error', '/invoices');
    return;
  }

  revalidateInvoices(slug);
  redirectWithCircleNotice(
    slug,
    `Issued ${result.issued ?? 0} contribution invoice(s).`,
    'success',
    '/invoices',
  );
}

export async function remindInvoicesAction(formData: FormData): Promise<void> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  if (!jamiyaId || !slug) return;

  const { data, error } = await callRpc('remind_contribution_invoices', {
    p_jamiya_id: jamiyaId,
  });
  if (error) {
    redirectWithCircleNotice(slug, error.message, 'error', '/invoices');
    return;
  }
  const result = data as {
    ok?: boolean;
    reminded?: number;
    skipped_cooldown?: number;
    error?: string;
  } | null;
  if (!result?.ok) {
    redirectWithCircleNotice(slug, result?.error ?? 'Could not send reminders.', 'error', '/invoices');
    return;
  }

  revalidateInvoices(slug);
  const skipped = result.skipped_cooldown ?? 0;
  redirectWithCircleNotice(
    slug,
    skipped > 0
      ? `Sent ${result.reminded ?? 0} reminder(s); skipped ${skipped} (24h cooldown).`
      : `Sent ${result.reminded ?? 0} invoice reminder(s).`,
    'success',
    '/invoices',
  );
}
