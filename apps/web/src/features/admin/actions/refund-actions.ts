'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import { withNoticeQuery } from '@/features/auth/lib/types';

export async function requestRefundAction(formData: FormData) {
  await requireAdminAccess('admin');
  const intentId = String(formData.get('intentId') ?? '').trim();
  const amountRaw = String(formData.get('amount') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim() || null;
  const amount = Number(amountRaw);

  if (!intentId || !Number.isFinite(amount) || amount <= 0) {
    redirect(
      withNoticeQuery('/admin/finance/refunds', 'Invalid refund request.', 'error'),
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('request_refund', {
    p_payment_intent_id: intentId,
    p_amount: amount,
    p_reason: reason,
    p_metadata: { source: 'admin_finance_refunds' },
  });

  const ok =
    !error &&
    data &&
    typeof data === 'object' &&
    (data as { ok?: boolean }).ok === true;

  revalidatePath('/admin/finance');
  revalidatePath('/admin/finance/refunds');
  revalidatePath('/admin/finance/reconcile');

  redirect(
    withNoticeQuery(
      '/admin/finance/refunds',
      ok
        ? `Refund queued ${(data as { refund_id?: string }).refund_id ?? ''}`.trim()
        : `Refund failed: ${error?.message ?? (data as { error?: string })?.error ?? 'unknown'}`,
      ok ? 'success' : 'error',
    ),
  );
}

export async function completeRefundAction(formData: FormData) {
  await requireAdminAccess('admin');
  const refundId = String(formData.get('refundId') ?? '').trim();
  if (!refundId) {
    redirect(withNoticeQuery('/admin/finance/refunds', 'Missing refund id.', 'error'));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('complete_refund', {
    p_refund_id: refundId,
    p_provider_reference: null,
  });

  const ok =
    !error &&
    data &&
    typeof data === 'object' &&
    (data as { ok?: boolean }).ok === true;

  const pendingDual = Boolean(
    ok && (data as { pending_dual_approval?: boolean }).pending_dual_approval,
  );

  revalidatePath('/admin/finance');
  revalidatePath('/admin/finance/refunds');
  revalidatePath('/admin/finance/journal');
  revalidatePath('/admin/finance/approvals');
  revalidatePath('/wallet');

  if (pendingDual) {
    redirect(
      withNoticeQuery(
        '/admin/finance/approvals',
        'Refund needs a second admin approval (≥ threshold).',
        'info',
      ),
    );
  }

  redirect(
    withNoticeQuery(
      '/admin/finance/refunds',
      ok
        ? 'Refund completed (journal reverse posted).'
        : `Complete failed: ${error?.message ?? (data as { error?: string })?.error ?? 'unknown'}`,
      ok ? 'success' : 'error',
    ),
  );
}

export async function cancelRefundAction(formData: FormData) {
  await requireAdminAccess('admin');
  const refundId = String(formData.get('refundId') ?? '').trim();
  if (!refundId) {
    redirect(withNoticeQuery('/admin/finance/refunds', 'Missing refund id.', 'error'));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('cancel_refund', {
    p_refund_id: refundId,
    p_reason: 'admin_cancel',
  });

  const ok =
    !error &&
    data &&
    typeof data === 'object' &&
    (data as { ok?: boolean }).ok === true;

  revalidatePath('/admin/finance/refunds');

  redirect(
    withNoticeQuery(
      '/admin/finance/refunds',
      ok
        ? 'Refund cancelled.'
        : `Cancel failed: ${error?.message ?? (data as { error?: string })?.error ?? 'unknown'}`,
      ok ? 'success' : 'error',
    ),
  );
}
