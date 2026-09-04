'use server';

import { revalidatePath } from 'next/cache';
import { callRpc } from '@/lib/supabase/rpc';
import { redirectWithCircleNotice } from '../lib/circle-notice';

export async function claimPayoutSlotAction(formData: FormData): Promise<void> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const position = Number(formData.get('payoutPosition'));
  if (!jamiyaId || !slug || !Number.isFinite(position) || position < 1) return;

  const { data, error } = await callRpc('claim_payout_slot', {
    p_jamiya_id: jamiyaId,
    p_payout_position: position,
  });

  if (error) {
    redirectWithCircleNotice(slug, error.message, 'error');
  }
  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    const messages: Record<string, string> = {
      SLOT_TAKEN: 'That slot was taken — pick another.',
      INVALID_SLOT: 'Invalid payout slot.',
      CIRCLE_ALREADY_ACTIVE: 'Slots are locked after the circle is activated.',
      NOT_ROTATING: 'Payout slots apply to rotating circles only.',
      NOT_MEMBER: 'Join this circle first.',
    };
    redirectWithCircleNotice(
      slug,
      messages[result?.error ?? ''] ?? result?.error ?? 'Could not claim slot.',
      'error',
    );
  }

  await callRpc('charge_early_slot_fee', { p_jamiya_id: jamiyaId });
  revalidatePath(`/circles/${slug}`);
  redirectWithCircleNotice(slug, `Payout slot #${position} reserved.`, 'success');
}

export async function assignPayoutSlotAction(formData: FormData): Promise<void> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const memberId = String(formData.get('memberId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const position = Number(formData.get('payoutPosition'));
  if (!jamiyaId || !memberId || !slug || !Number.isFinite(position) || position < 1) return;

  const { data, error } = await callRpc('officer_assign_payout_slot', {
    p_jamiya_id: jamiyaId,
    p_member_id: memberId,
    p_payout_position: position,
  });

  if (error) {
    redirectWithCircleNotice(slug, error.message, 'error');
  }
  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    const messages: Record<string, string> = {
      SLOT_TAKEN: 'That slot is already taken — pick another.',
      INVALID_SLOT: 'Invalid payout slot.',
      CIRCLE_ALREADY_ACTIVE: 'Slots lock after the circle is activated.',
      NOT_ROTATING: 'Payout slots apply to merry-go-round circles only.',
      MEMBER_NOT_FOUND: 'Pick a member in this circle.',
      FORBIDDEN: 'Only officers can assign slots for members.',
    };
    redirectWithCircleNotice(
      slug,
      messages[result?.error ?? ''] ?? result?.error ?? 'Could not assign slot.',
      'error',
    );
  }

  revalidatePath(`/circles/${slug}`);
  redirectWithCircleNotice(slug, `Assigned payout slot #${position}.`, 'success');
}
