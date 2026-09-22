'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import { withNoticeQuery } from '@/features/auth/lib/types';

function revalidateSettlements() {
  revalidatePath('/admin/finance/settlements');
  revalidatePath('/admin/finance/integrity');
  revalidatePath('/admin/finance');
}

export async function backfillMissingSettlementsAction(formData: FormData) {
  await requireAdminAccess('admin');
  const limitRaw = Number(formData.get('limit') ?? 50);
  const limit = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(200, Math.floor(limitRaw)))
    : 50;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('backfill_missing_settlements', {
    p_limit: limit,
  });

  const ok =
    !error &&
    data &&
    typeof data === 'object' &&
    (data as { ok?: boolean }).ok === true;

  const posted = (data as { posted?: number })?.posted ?? 0;
  const failed = (data as { failed?: number })?.failed ?? 0;

  revalidateSettlements();
  redirect(
    withNoticeQuery(
      '/admin/finance/settlements',
      ok
        ? `Settlement backfill: ${posted} posted, ${failed} failed.`
        : `Backfill failed: ${error?.message ?? (data as { error?: string })?.error ?? 'unknown'}`,
      ok ? 'success' : 'error',
    ),
  );
}

export async function backfillOneSettlementAction(formData: FormData) {
  await requireAdminAccess('admin');
  const intentId = String(formData.get('intentId') ?? '').trim();
  if (!intentId) {
    redirect(
      withNoticeQuery('/admin/finance/settlements', 'Missing payment intent.', 'error'),
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('record_settlement_for_intent', {
    p_intent_id: intentId,
    p_metadata: { source: 'settlement_ops_manual' },
  });

  const ok =
    !error &&
    data &&
    typeof data === 'object' &&
    (data as { ok?: boolean }).ok === true;

  revalidateSettlements();
  redirect(
    withNoticeQuery(
      '/admin/finance/settlements',
      ok
        ? 'Settlement mirrored.'
        : `Mirror failed: ${error?.message ?? (data as { error?: string })?.error ?? 'unknown'}`,
      ok ? 'success' : 'error',
    ),
  );
}

export async function markSettlementStatusAction(formData: FormData) {
  await requireAdminAccess('admin');
  const settlementId = String(formData.get('settlementId') ?? '').trim();
  const status = String(formData.get('status') ?? '').trim();
  const note = String(formData.get('note') ?? '').trim() || null;

  if (!settlementId || !['settled', 'failed', 'disputed'].includes(status)) {
    redirect(
      withNoticeQuery('/admin/finance/settlements', 'Invalid settlement update.', 'error'),
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('mark_settlement_status', {
    p_settlement_id: settlementId,
    p_status: status,
    p_note: note,
  });

  const ok =
    !error &&
    data &&
    typeof data === 'object' &&
    (data as { ok?: boolean }).ok === true;

  revalidateSettlements();
  redirect(
    withNoticeQuery(
      '/admin/finance/settlements',
      ok
        ? `Settlement marked ${status}.`
        : `Update failed: ${error?.message ?? (data as { error?: string })?.error ?? 'unknown'}`,
      ok ? 'success' : 'error',
    ),
  );
}
