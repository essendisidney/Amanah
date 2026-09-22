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
