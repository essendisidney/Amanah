'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import { withNoticeQuery } from '@/features/auth/lib/types';

export async function updateRefundDualApprovalAction(formData: FormData) {
  await requireAdminAccess('admin');
  const enabled = String(formData.get('enabled') ?? '') === 'on';
  const thresholdRaw = String(formData.get('threshold') ?? '10000').trim();
  const threshold = Number(thresholdRaw);

  if (!Number.isFinite(threshold) || threshold < 0) {
    redirect(
      withNoticeQuery(
        '/admin/finance/approvals',
        'Invalid refund dual-approval threshold.',
        'error',
      ),
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('set_platform_setting', {
    p_key: 'dual_approval_refunds',
    p_value: { enabled, threshold },
  });

  const ok =
    !error &&
    data &&
    typeof data === 'object' &&
    (data as { ok?: boolean }).ok === true;

  revalidatePath('/admin/finance/approvals');
  revalidatePath('/admin/finance');
  revalidatePath('/admin/architecture');

  redirect(
    withNoticeQuery(
      '/admin/finance/approvals',
      ok
        ? `Refund dual-approval ${enabled ? 'on' : 'off'} · threshold KES ${threshold}.`
        : `Update failed: ${error?.message ?? (data as { error?: string })?.error ?? 'unknown'}`,
      ok ? 'success' : 'error',
    ),
  );
}
