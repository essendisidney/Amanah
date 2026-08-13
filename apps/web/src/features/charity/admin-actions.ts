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
    const code = result?.error ?? 'Update failed.';
    if (code === 'DECISION_REFERENCE_REQUIRED') {
      return {
        success: false,
        message: 'Decision reference is required to mark Sharia board endorsed.',
      };
    }
    return { success: false, message: code };
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

export async function reviewCampaignAction(formData: FormData): Promise<CharityAdminState> {
  const campaignId = String(formData.get('campaignId') ?? '');
  const approve = String(formData.get('approve') ?? '') === '1';
  const reason = String(formData.get('rejectionReason') ?? '').trim() || null;
  const endorsed = String(formData.get('shariaEndorsed') ?? '') === 'true';
  if (!campaignId) return { success: false, message: 'Missing campaign.' };

  const { data, error } = await callRpc('review_sadaka_campaign', {
    p_campaign_id: campaignId,
    p_approve: approve,
    p_rejection_reason: reason,
    p_sharia_endorsed: endorsed,
  });
  if (error) return { success: false, message: error.message };
  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    return { success: false, message: result?.error ?? 'Review failed.' };
  }
  revalidatePath('/admin/sadaka');
  revalidatePath('/sadaka');
  return {
    success: true,
    message: approve ? 'Campaign approved and live.' : 'Campaign rejected.',
  };
}

export async function reviewCampaignFormAction(formData: FormData): Promise<void> {
  await reviewCampaignAction(formData);
}

export async function disburseCampaignAction(formData: FormData): Promise<CharityAdminState> {
  const campaignId = String(formData.get('campaignId') ?? '');
  const amountRaw = String(formData.get('amount') ?? '').trim();
  const notes = String(formData.get('notes') ?? '').trim() || null;
  if (!campaignId) return { success: false, message: 'Missing campaign.' };
  const amount = amountRaw ? Number(amountRaw) : null;

  const { data, error } = await callRpc('disburse_sadaka_campaign', {
    p_campaign_id: campaignId,
    p_amount: amount,
    p_notes: notes,
  });
  if (error) return { success: false, message: error.message };
  const result = data as { ok?: boolean; error?: string; net?: number } | null;
  if (!result?.ok) {
    return { success: false, message: result?.error ?? 'Disbursement failed.' };
  }
  revalidatePath('/admin/sadaka');
  revalidatePath('/sadaka');
  return {
    success: true,
    message: `Disbursement queued (KES ${result.net ?? ''}). Cron completes via B2C or sim.`,
  };
}

export async function disburseCampaignFormAction(formData: FormData): Promise<void> {
  await disburseCampaignAction(formData);
}

export async function verifyInstitutionAction(formData: FormData): Promise<CharityAdminState> {
  const institutionId = String(formData.get('institutionId') ?? '');
  const approve = String(formData.get('approve') ?? '') === '1';
  const reason = String(formData.get('rejectionReason') ?? '').trim() || null;
  if (!institutionId) return { success: false, message: 'Missing institution.' };

  const { data, error } = await callRpc('verify_sadaka_institution', {
    p_institution_id: institutionId,
    p_approve: approve,
    p_rejection_reason: reason,
  });
  if (error) return { success: false, message: error.message };
  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    return { success: false, message: result?.error ?? 'Verification failed.' };
  }
  revalidatePath('/admin/sadaka');
  revalidatePath('/sadaka/adopt');
  return {
    success: true,
    message: approve ? 'Institution verified.' : 'Institution rejected.',
  };
}

export async function verifyInstitutionFormAction(formData: FormData): Promise<void> {
  await verifyInstitutionAction(formData);
}
