'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import { withNoticeQuery } from '@/features/auth/lib/types';
import { createServiceRoleClient } from '@/lib/supabase/service';
import { mirrorSettlementAfterComplete } from '@/lib/finance/settlements';

export async function reprocessWebhookAction(formData: FormData) {
  await requireAdminAccess('admin');
  const eventId = String(formData.get('eventId') ?? '').trim();
  if (!eventId) {
    redirect(withNoticeQuery('/admin/finance', 'Missing webhook event.', 'error'));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('reprocess_webhook_event', {
    p_event_id: eventId,
  });

  const ok =
    !error &&
    data &&
    typeof data === 'object' &&
    (data as { ok?: boolean }).ok === true;

  if (ok && (data as { action?: string }).action === 'settled') {
    const admin = createServiceRoleClient();
    const intentId =
      (data as { result?: { payment_intent_id?: string } }).result?.payment_intent_id ??
      null;
    // Prefer intent from event row
    const { data: ev } = await supabase
      .from('webhook_events')
      .select('payment_intent_id')
      .eq('id', eventId)
      .maybeSingle();
    const id =
      (ev as { payment_intent_id?: string } | null)?.payment_intent_id ?? intentId;
    if (id) {
      await mirrorSettlementAfterComplete(admin, id, {
        source: 'webhook_reprocess',
      });
    }
  }

  revalidatePath('/admin/finance');
  revalidatePath('/admin/finance/integrity');
  revalidatePath('/admin/finance/journal');

  redirect(
    withNoticeQuery(
      '/admin/finance',
      ok
        ? `Webhook reprocessed (${(data as { action?: string }).action ?? 'ok'}).`
        : `Reprocess failed: ${error?.message ?? (data as { error?: string })?.error ?? 'unknown'}`,
      ok ? 'success' : 'error',
    ),
  );
}
