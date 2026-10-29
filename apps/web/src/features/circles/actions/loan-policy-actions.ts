'use server';

import { revalidatePath } from 'next/cache';
import { callRpc } from '@/lib/supabase/rpc';
import { friendlyError } from '@/lib/friendly-error';
import { redirectWithCircleNotice } from '@/features/circles/lib/circle-notice';

/** Save a circle's loan rules: N × deposits, guarantors, guarantor cover, officers to approve. */
export async function setLoanPolicyAction(formData: FormData): Promise<void> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  if (!jamiyaId || !slug) return;

  const rawMultiplier = String(formData.get('multiplier') ?? '').trim();
  const multiplier = rawMultiplier === '' ? null : Number(rawMultiplier);
  const minGuarantors = Number(formData.get('minGuarantors') ?? 0);
  const cover = formData.get('guarantorCover') === 'on';
  const approvals = String(formData.get('twoApprovals') ?? '') === 'on' ? 2 : 1;

  if (multiplier !== null && (!Number.isFinite(multiplier) || multiplier <= 0 || multiplier > 10)) {
    redirectWithCircleNotice(slug, 'The multiplier must be between 0.5 and 10, or empty for no limit.', 'error', '/loan-book');
  }

  const { data, error } = await callRpc('set_circle_loan_policy', {
    p_jamiya_id: jamiyaId,
    p_multiplier: multiplier,
    p_min_guarantors: Number.isFinite(minGuarantors) ? minGuarantors : 0,
    p_guarantor_cover: cover,
    p_approvals_required: approvals,
  });

  revalidatePath(`/circles/${slug}/loan-book`);
  revalidatePath(`/circles/${slug}/register`);

  if (error) redirectWithCircleNotice(slug, friendlyError(error.message), 'error', '/loan-book');
  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    redirectWithCircleNotice(
      slug,
      result?.error === 'FORBIDDEN' ? 'Only circle officers can change loan rules.' : 'Check the loan rules and try again.',
      'error',
      '/loan-book',
    );
  }
  redirectWithCircleNotice(slug, 'Loan rules saved. They apply to every new loan request.', 'success', '/loan-book');
}
