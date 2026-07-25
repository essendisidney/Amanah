'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { callRpc } from '@/lib/supabase/rpc';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';

export type DisputeActionState = {
  success: boolean;
  message: string;
};

export async function openDisputeAction(
  _prev: DisputeActionState,
  formData: FormData,
): Promise<DisputeActionState> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const type = String(formData.get('type') ?? 'other');
  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();

  if (!jamiyaId || title.length < 3 || description.length < 10) {
    return {
      success: false,
      message: 'Provide a title (3+ chars) and description (10+ chars).',
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, message: 'Authentication required.' };

  // Simple risk score heuristic for Phase 3
  let riskScore = 20;
  if (type === 'incorrect_amount') riskScore = 45;
  if (type === 'missed_contribution') riskScore = 55;
  if (type === 'payout_delay') riskScore = 40;

  const { error } = await supabase.from('disputes').insert({
    jamiya_id: jamiyaId,
    opened_by: user.id,
    type,
    title,
    description,
    risk_score: riskScore,
    status: 'open',
  } as never);

  if (error) {
    return { success: false, message: error.message };
  }

  await supabase.from('audit_logs').insert({
    actor_id: user.id,
    action: 'create',
    entity_type: 'dispute',
    jamiya_id: jamiyaId,
    metadata: { type, title, risk_score: riskScore },
  } as never);

  if (slug) revalidatePath(`/jamiyas/${slug}`);
  revalidatePath('/admin/disputes');
  return { success: true, message: 'Dispute opened. Compliance will review it.' };
}

export async function resolveDisputeAction(formData: FormData): Promise<void> {
  await requireAdminAccess('compliance');
  const disputeId = String(formData.get('disputeId') ?? '');
  const status = String(formData.get('status') ?? '');
  const notes = String(formData.get('notes') ?? '');
  if (!disputeId || !['resolved', 'rejected', 'under_review'].includes(status)) {
    return;
  }

  await callRpc('resolve_dispute', {
    p_dispute_id: disputeId,
    p_status: status,
    p_resolution_notes: notes || null,
  });

  revalidatePath('/admin/disputes');
  revalidatePath('/admin');
}
