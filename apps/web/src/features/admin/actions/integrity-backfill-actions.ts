'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import { withNoticeQuery } from '@/features/auth/lib/types';
import { createServiceRoleClient } from '@/lib/supabase/service';
import { mirrorSettlementAfterComplete } from '@/lib/finance/settlements';
import { financeReturnPath } from '@/features/admin/lib/finance-return-path';

function revalidateIntegrity(intentId?: string) {
  revalidatePath('/admin/finance/integrity');
  revalidatePath('/admin/finance');
  revalidatePath('/admin/finance/journal');
  revalidatePath('/admin/finance/accounts');
  if (intentId) revalidatePath(`/admin/finance/intents/${intentId}`);
}

export async function backfillIntentJournalAction(formData: FormData) {
  await requireAdminAccess('admin');
  const intentId = String(formData.get('intentId') ?? '').trim();
  const dest = financeReturnPath(formData, '/admin/finance/integrity');
  if (!intentId) {
    redirect(withNoticeQuery(dest, 'Missing payment intent.', 'error'));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('backfill_payment_intent_journal', {
    p_intent_id: intentId,
  });

  const ok =
    !error &&
    data &&
    typeof data === 'object' &&
    (data as { ok?: boolean }).ok === true;

  if (ok) {
    const admin = createServiceRoleClient();
    await mirrorSettlementAfterComplete(admin, intentId, {
      source: 'integrity_backfill',
    });
  }

  revalidateIntegrity(intentId);
  redirect(
    withNoticeQuery(
      dest,
      ok
        ? `Journal ${(data as { action?: string }).action ?? 'posted'} for intent.`
        : `Backfill failed: ${error?.message ?? (data as { error?: string })?.error ?? 'unknown'}`,
      ok ? 'success' : 'error',
    ),
  );
}

export async function backfillMissingJournalsAction(formData: FormData) {
  await requireAdminAccess('admin');
  const limitRaw = Number(formData.get('limit') ?? 50);
  const limit = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(200, Math.floor(limitRaw)))
    : 50;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('backfill_missing_payment_journals', {
    p_limit: limit,
  });

  const ok =
    !error &&
    data &&
    typeof data === 'object' &&
    (data as { ok?: boolean }).ok === true;

  if (ok) {
    const ids = (data as { payment_intent_ids?: string[] }).payment_intent_ids ?? [];
    const admin = createServiceRoleClient();
    for (const id of ids) {
      if (typeof id === 'string' && id) {
        await mirrorSettlementAfterComplete(admin, id, {
          source: 'integrity_backfill_batch',
        });
      }
    }
  }

  const posted = (data as { posted?: number })?.posted ?? 0;
  const skipped = (data as { skipped?: number })?.skipped ?? 0;
  const failed = (data as { failed?: number })?.failed ?? 0;

  revalidateIntegrity();
  redirect(
    withNoticeQuery(
      '/admin/finance/integrity',
      ok
        ? `Backfill done: ${posted} posted, ${skipped} already present, ${failed} failed.`
        : `Batch backfill failed: ${error?.message ?? (data as { error?: string })?.error ?? 'unknown'}`,
      ok ? 'success' : 'error',
    ),
  );
}

export async function backfillMissingWithdrawalJournalsAction(formData: FormData) {
  await requireAdminAccess('admin');
  const limitRaw = Number(formData.get('limit') ?? 50);
  const limit = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(200, Math.floor(limitRaw)))
    : 50;
  const dest = financeReturnPath(formData, '/admin/finance/integrity');

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('backfill_missing_withdrawal_journals', {
    p_limit: limit,
  });

  const ok =
    !error &&
    data &&
    typeof data === 'object' &&
    (data as { ok?: boolean }).ok === true;

  const posted = (data as { posted?: number })?.posted ?? 0;
  const skipped = (data as { skipped?: number })?.skipped ?? 0;
  const failed = (data as { failed?: number })?.failed ?? 0;

  revalidateIntegrity();
  revalidatePath('/admin/finance/accounts');
  redirect(
    withNoticeQuery(
      dest,
      ok
        ? `Withdrawal journals: ${posted} posted, ${skipped} present, ${failed} failed.`
        : `Withdrawal backfill failed: ${error?.message ?? (data as { error?: string })?.error ?? 'unknown'}`,
      ok ? 'success' : 'error',
    ),
  );
}
