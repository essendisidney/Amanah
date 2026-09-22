'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import { runPaymentReconcile } from '@/lib/payments/reconcile';
import { withNoticeQuery } from '@/features/auth/lib/types';

export async function runReconcileNowAction(): Promise<void> {
  await requireAdminAccess('compliance');
  const result = await runPaymentReconcile();
  revalidatePath('/admin/observability');
  revalidatePath('/admin/finance');
  revalidatePath('/admin/finance/reconcile');
  redirect(
    withNoticeQuery(
      '/admin/finance/reconcile',
      result.ok
        ? `Reconcile finished. Settled ${result.summary.intents_settled + result.summary.withdrawals_settled}; flagged ${result.summary.needs_admin.length}.`
        : `Reconcile failed: ${result.error ?? 'unknown'}`,
      result.ok ? 'success' : 'error',
    ),
  );
}
