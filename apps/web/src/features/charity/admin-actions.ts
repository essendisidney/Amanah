'use server';

import { revalidatePath } from 'next/cache';
import { callRpc } from '@/lib/supabase/rpc';

export type CharityAdminState = { success: boolean; message: string };

export async function setCampaignFeePolicyAction(
  formData: FormData,
): Promise<CharityAdminState> {
  const campaignId = String(formData.get('campaignId') ?? '');
  const feeMode = String(formData.get('feeMode') ?? '');
  const feeBps = Number(formData.get('feeBps'));
  const endorsed = String(formData.get('shariaBoardEndorsed') ?? '') === 'true';
  const status = String(formData.get('status') ?? '') || null;
  const decisionReference = String(formData.get('decisionReference') ?? '').trim() || null;
  const notes = String(formData.get('notes') ?? '').trim() || null;

  if (!campaignId || !['donation_addon', 'donation_deduct'].includes(feeMode)) {
    return { success: false, message: 'Invalid campaign or fee mode.' };
  }
  if (!Number.isFinite(feeBps) || feeBps < 0 || feeBps > 2000) {
    return { success: false, message: 'Fee bps must be 0–2000.' };
  }

  const { data, error } = await callRpc('set_campaign_fee_policy', {
    p_campaign_id: campaignId,
    p_fee_mode: feeMode,
    p_fee_bps: feeBps,
    p_sharia_board_endorsed: endorsed,
    p_decision_reference: decisionReference,
    p_notes: notes,
    p_status: status,
  });

  if (error) return { success: false, message: error.message };
  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    return { success: false, message: result?.error ?? 'Update failed.' };
  }

  revalidatePath('/admin/sadaka');
  revalidatePath('/sadaka');
  return {
    success: true,
    message: endorsed
      ? 'Fee policy saved and marked Sharia-board endorsed.'
      : 'Fee policy saved (pending Sharia board endorsement).',
  };
}

export async function setCampaignFeePolicyFormAction(formData: FormData): Promise<void> {
  await setCampaignFeePolicyAction(formData);
}
