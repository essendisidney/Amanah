'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { callRpc } from '@/lib/supabase/rpc';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import { withNoticeQuery } from '@/features/auth/lib/types';

export async function confirmFinanceDualApprovalAction(formData: FormData) {
  await requireAdminAccess('compliance');
  const requestId = String(formData.get('requestId') ?? '').trim();
  const approve = String(formData.get('approve') ?? 'true') === 'true';

  if (!requestId) {
    redirect(
      withNoticeQuery('/admin/finance/approvals', 'Missing approval request.', 'error'),
    );
  }

  const { data, error } = await callRpc('confirm_dual_approval', {
    p_request_id: requestId,
    p_approve: approve,
  });

  revalidatePath('/admin/finance');
  revalidatePath('/admin/finance/approvals');
  revalidatePath('/admin/finance/refunds');
  revalidatePath('/admin/finance/journal');
  revalidatePath('/wallet');

  if (error) {
    redirect(withNoticeQuery('/admin/finance/approvals', error.message, 'error'));
  }

  const result = data as {
    ok?: boolean;
    error?: string;
    status?: string;
  } | null;

  if (!result?.ok) {
    const code = result?.error ?? 'Could not complete second approval.';
    const message =
      code === 'SECOND_APPROVER_MUST_DIFFER'
        ? 'A different admin must second-approve. You already gave the first approval.'
        : code;
    redirect(withNoticeQuery('/admin/finance/approvals', message, 'error'));
  }

  redirect(
    withNoticeQuery(
      '/admin/finance/approvals',
      approve
        ? result.status === 'executed'
          ? 'Approved and executed.'
          : 'Approved.'
        : 'Rejected.',
      'success',
    ),
  );
}
