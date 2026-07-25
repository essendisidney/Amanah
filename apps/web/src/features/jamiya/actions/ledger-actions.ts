'use server';

import { revalidatePath } from 'next/cache';
import { callRpc } from '@/lib/supabase/rpc';

function revalidateCircle(slug?: string) {
  revalidatePath('/dashboard');
  revalidatePath('/wallet');
  revalidatePath('/jamiyas');
  revalidatePath('/notifications');
  if (slug) revalidatePath(`/jamiyas/${slug}`);
}

export async function activateJamiyaAction(formData: FormData): Promise<void> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  if (!jamiyaId) return;

  const { data, error } = await callRpc('activate_jamiya', {
    p_jamiya_id: jamiyaId,
  });

  if (error) {
    console.error('activate_jamiya', error.message);
    return;
  }

  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    console.error('activate_jamiya', result?.error);
  }

  revalidateCircle(slug || undefined);
}

export async function payContributionAction(formData: FormData): Promise<void> {
  const contributionId = String(formData.get('contributionId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  if (!contributionId) return;

  const { data, error } = await callRpc('pay_contribution', {
    p_contribution_id: contributionId,
  });

  if (error) {
    console.error('pay_contribution', error.message);
    return;
  }

  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    console.error('pay_contribution', result?.error);
  }

  revalidateCircle(slug || undefined);
}

export async function settlePayoutAction(formData: FormData): Promise<void> {
  const payoutId = String(formData.get('payoutId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  if (!payoutId) return;

  const { data, error } = await callRpc('settle_payout', {
    p_payout_id: payoutId,
  });

  if (error) {
    console.error('settle_payout', error.message);
    return;
  }

  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    console.error('settle_payout', result?.error);
  }

  revalidateCircle(slug || undefined);
}
