'use server';

import { revalidatePath } from 'next/cache';
import { callRpc } from '@/lib/supabase/rpc';
import { redirectWithCircleNotice } from '@/features/circles/lib/circle-notice';

export async function recordGoalContributionAction(formData: FormData): Promise<void> {
  const goalId = String(formData.get('goalId') ?? '');
  const memberId = String(formData.get('memberId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const amount = Number(formData.get('amount'));
  const effectiveDate = String(formData.get('effectiveDate') ?? '');
  const notes = String(formData.get('notes') ?? '').trim();

  const back = `/goals/${goalId}`;
  if (!goalId || !memberId || !slug) {
    if (slug) redirectWithCircleNotice(slug, 'Missing goal or member.', 'error', back);
    return;
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    redirectWithCircleNotice(slug, 'Enter a valid amount greater than zero.', 'error', back);
  }

  const { data, error } = await callRpc('record_goal_contribution', {
    p_goal_id: goalId,
    p_member_id: memberId,
    p_amount: amount,
    p_effective_date: effectiveDate || null,
    p_notes: notes || null,
  });

  if (error) {
    redirectWithCircleNotice(slug, error.message, 'error', back);
  }

  const result = data as { ok?: boolean; error?: string; saved_amount?: number } | null;
  if (!result?.ok) {
    const code = result?.error ?? 'Could not save contribution.';
    const friendly: Record<string, string> = {
      FORBIDDEN: 'Only officers can record goal savings for members.',
      GOAL_NOT_LINKED_TO_CIRCLE: 'Link this goal to a circle first.',
      MEMBER_NOT_IN_CIRCLE: 'That person is not in this circle.',
      INVALID_AMOUNT: 'Enter a valid amount.',
      GOAL_NOT_FOUND: 'Goal not found.',
    };
    redirectWithCircleNotice(slug, friendly[code] ?? code, 'error', back);
  }

  revalidatePath(`/circles/${slug}`);
  revalidatePath(`/circles/${slug}/goals/${goalId}`);
  revalidatePath('/finance/goals');
  redirectWithCircleNotice(
    slug,
    `Saved. Circle total toward this goal is now ${Number(result?.saved_amount ?? 0).toLocaleString()}.`,
    'success',
    back,
  );
}
