'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { callRpc } from '@/lib/supabase/rpc';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import { withNoticeQuery } from '@/features/auth/lib/types';

const PAGE = '/admin/finance/fees-owed';

function rpcError(error: { message: string } | null, data: unknown): string | null {
  if (error) return error.message;
  const result = data as { ok?: boolean; error?: string } | null;
  return result?.ok ? null : (result?.error ?? 'unknown');
}

/** Take whatever owed fees the member's spendable balance covers right now. */
export async function collectFeesOwedAction(formData: FormData) {
  await requireAdminAccess('admin');
  const userId = String(formData.get('userId') ?? '').trim();
  if (!userId) redirect(withNoticeQuery(PAGE, 'Missing member.', 'error'));

  const { data, error } = await callRpc('admin_collect_fees_owed', { p_user_id: userId });
  const failed = rpcError(error, data);
  revalidatePath(PAGE);

  if (failed) redirect(withNoticeQuery(PAGE, `Collect failed: ${failed}`, 'error'));

  const { collected = 0, still_owed: stillOwed = 0 } = data as {
    collected?: number;
    still_owed?: number;
  };
  redirect(
    withNoticeQuery(
      PAGE,
      collected > 0
        ? `Collected ${collected} fee${collected === 1 ? '' : 's'}.${stillOwed ? ` ${stillOwed} still owed.` : ''}`
        : 'Nothing collected: the wallet does not cover the fee yet.',
      collected > 0 ? 'success' : 'info',
    ),
  );
}

/** Forgive one owed fee. The reason is stored, audit-logged and the member is told. */
export async function waiveFeeOwedAction(formData: FormData) {
  await requireAdminAccess('admin');
  const feeId = String(formData.get('feeId') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  if (!feeId) redirect(withNoticeQuery(PAGE, 'Missing fee.', 'error'));
  if (reason.length < 3) {
    redirect(withNoticeQuery(PAGE, 'Give a reason to waive a fee.', 'error'));
  }

  const { data, error } = await callRpc('admin_waive_fee_owed', {
    p_fee_id: feeId,
    p_reason: reason,
  });
  const failed = rpcError(error, data);
  revalidatePath(PAGE);

  redirect(
    withNoticeQuery(
      PAGE,
      failed ? `Waive failed: ${failed}` : 'Fee waived. The member has been told.',
      failed ? 'error' : 'success',
    ),
  );
}
