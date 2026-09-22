'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import { withNoticeQuery } from '@/features/auth/lib/types';
import { financeReturnPath } from '@/features/admin/lib/finance-return-path';

export async function resolveIntentExceptionAction(formData: FormData) {
  await requireAdminAccess('admin');
  const intentId = String(formData.get('intentId') ?? '').trim();
  const action = String(formData.get('action') ?? 'match').trim();
  const note = String(formData.get('note') ?? '').trim() || null;
  const dest = financeReturnPath(formData, '/admin/finance');

  if (!intentId || !['match', 'manual', 'waive'].includes(action)) {
    redirect(withNoticeQuery(dest, 'Invalid resolve request.', 'error'));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('resolve_payment_intent_exception', {
    p_intent_id: intentId,
    p_action: action,
    p_note: note,
  });

  const ok =
    !error &&
    data &&
    typeof data === 'object' &&
    (data as { ok?: boolean }).ok === true;

  revalidatePath('/admin/finance');
  revalidatePath('/admin/finance/reconcile');
  revalidatePath('/admin/finance/settlements');
  revalidatePath('/admin/finance/integrity');
  revalidatePath(`/admin/finance/intents/${intentId}`);

  redirect(
    withNoticeQuery(
      dest,
      ok
        ? `Exception ${action} applied.`
        : `Resolve failed: ${error?.message ?? (data as { error?: string })?.error ?? 'unknown'}`,
      ok ? 'success' : 'error',
    ),
  );
}
