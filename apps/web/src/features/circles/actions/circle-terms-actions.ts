'use server';

import { revalidatePath } from 'next/cache';
import { callRpc } from '@/lib/supabase/rpc';
import type { ActionState } from '../lib/action-state';

/**
 * Record that the member accepted this version of the circle's terms, then charge the one-off
 * fees those terms include (join fee, early-slot fee). Both charges are idempotent and the
 * database charges only what the member accepted.
 */
export async function acceptAndChargeCircleTerms(
  jamiyaId: string,
  version: number,
): Promise<{ accepted: boolean; changed: boolean; error?: string }> {
  const { data, error } = await callRpc('accept_circle_terms', {
    p_jamiya_id: jamiyaId,
    p_version: version,
  });
  const result = data as { ok?: boolean; error?: string } | null;
  if (error || !result?.ok) {
    return {
      accepted: false,
      changed: result?.error === 'TERMS_CHANGED',
      error: error?.message ?? result?.error,
    };
  }

  await callRpc('charge_early_slot_fee', { p_jamiya_id: jamiyaId });
  await callRpc('charge_join_fee', { p_jamiya_id: jamiyaId });
  return { accepted: true, changed: false };
}

export async function acceptCircleTermsAction(
  jamiyaId: string,
  version: number,
  slug: string,
): Promise<ActionState> {
  if (!jamiyaId || !Number.isInteger(version)) {
    return { success: false, message: 'Something went wrong. Reload the page and try again.' };
  }

  const outcome = await acceptAndChargeCircleTerms(jamiyaId, version);

  revalidatePath(`/circles/${slug}`);
  revalidatePath('/wallet');

  if (!outcome.accepted) {
    return {
      success: false,
      message: outcome.changed
        ? 'The circle’s fees changed while you were reading them. Review the new terms below.'
        : outcome.error === 'NOT_A_MEMBER'
          ? 'Only members of this circle can accept its terms.'
          : 'Could not record your acceptance. Try again.',
    };
  }
  return { success: true, message: 'Thank you. You accepted the circle’s terms.' };
}
