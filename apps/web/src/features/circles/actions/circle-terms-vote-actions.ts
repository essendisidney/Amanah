'use server';

import { revalidatePath } from 'next/cache';
import { callRpc } from '@/lib/supabase/rpc';
import type { ActionState } from '../lib/action-state';
import type { CircleTermsView } from '../lib/circle-terms';
import { mapMoneyError, redirectWithCircleNotice } from '../lib/circle-notice';

const PROPOSAL_ERRORS: Record<string, string> = {
  FORBIDDEN: 'Only circle officers can propose a fee change.',
  REASON_REQUIRED: 'Explain to members why the change is needed.',
  INVALID_CHANGE: 'Check the amounts: they must be zero or more, and percentages at most 100.',
  NO_VOTE_NEEDED:
    'No vote is needed: either nothing goes up, or no member has accepted the circle’s terms yet. Change it directly in the penalty settings.',
  PROPOSAL_IN_PROGRESS: 'Members are already voting on a change. Wait for it to finish.',
};

const NUMBER_FIELDS: Array<[string, string]> = [
  ['joinFeeAmount', 'join_fee_amount'],
  ['transactionFeeAmount', 'transaction_fee_amount'],
  ['earlySlotFeePct', 'early_slot_fee_pct'],
  ['lateContributionPenalty', 'late_contribution_penalty'],
  ['missedContributionPenalty', 'missed_contribution_penalty'],
  ['lateLoanPenaltyFixed', 'late_loan_penalty_fixed'],
  ['lateLoanPenaltyPct', 'late_loan_penalty_pct'],
];

/** Officers propose new fees or penalties; members vote (propose_circle_terms_change). */
export async function proposeTermsChangeAction(formData: FormData): Promise<void> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const reason = String(formData.get('reason') ?? '');
  if (!jamiyaId || !slug) return;

  const { data: termsData } = await callRpc('get_circle_terms', { p_jamiya_id: jamiyaId });
  const current = (termsData as CircleTermsView | null)?.terms;
  if (!current) {
    redirectWithCircleNotice(slug, 'Could not load the circle’s current terms.', 'error', '/treasury');
    return;
  }

  // Send only what the officer changed.
  const changes: Record<string, number | boolean | string> = {};
  for (const [field, key] of NUMBER_FIELDS) {
    const raw = formData.get(field);
    if (raw === null || String(raw).trim() === '') continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    if (value !== Number((current as Record<string, unknown>)[key] ?? 0)) changes[key] = value;
  }
  if (changes.early_slot_fee_pct !== undefined) {
    changes.slot_pricing_enabled = Number(changes.early_slot_fee_pct) > 0;
  }
  const autoFine = formData.get('autoFineEnabled') === 'on';
  if (autoFine !== Boolean(current.auto_fine_enabled)) changes.auto_fine_enabled = autoFine;
  const mode = String(formData.get('payoutComplianceMode') ?? current.payout_compliance_mode ?? 'block');
  if (mode !== (current.payout_compliance_mode ?? 'block')) changes.payout_compliance_mode = mode;

  if (Object.keys(changes).length === 0) {
    redirectWithCircleNotice(slug, 'Change at least one fee or penalty.', 'error', '/treasury');
    return;
  }

  const { data, error } = await callRpc('propose_circle_terms_change', {
    p_jamiya_id: jamiyaId,
    p_changes: changes,
    p_reason: reason,
  });
  revalidatePath(`/circles/${slug}`);
  revalidatePath(`/circles/${slug}/treasury`);

  const result = data as { ok?: boolean; error?: string } | null;
  if (error || !result?.ok) {
    const code = result?.error ?? error?.message;
    redirectWithCircleNotice(
      slug,
      (code && PROPOSAL_ERRORS[code]) ?? mapMoneyError(code),
      'error',
      '/treasury',
    );
    return;
  }
  redirectWithCircleNotice(
    slug,
    'Proposal sent. Members have 7 days to vote; if it passes it takes effect 7 days later.',
    'success',
    '/treasury',
  );
}

export async function cancelTermsProposalAction(formData: FormData): Promise<void> {
  const proposalId = String(formData.get('proposalId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  if (!proposalId || !slug) return;
  const { data, error } = await callRpc('cancel_circle_terms_proposal', { p_proposal_id: proposalId });
  revalidatePath(`/circles/${slug}`);
  revalidatePath(`/circles/${slug}/treasury`);
  const result = data as { ok?: boolean; error?: string } | null;
  if (error || !result?.ok) {
    redirectWithCircleNotice(slug, mapMoneyError(result?.error ?? error?.message), 'error', '/treasury');
    return;
  }
  redirectWithCircleNotice(slug, 'Proposal withdrawn.', 'success', '/treasury');
}

export async function castTermsVoteAction(
  proposalId: string,
  yes: boolean,
  slug: string,
): Promise<ActionState> {
  const { data, error } = await callRpc('cast_circle_terms_vote', {
    p_proposal_id: proposalId,
    p_yes: yes,
  });
  revalidatePath(`/circles/${slug}`);
  const result = data as { ok?: boolean; error?: string; status?: string } | null;
  if (error || !result?.ok) {
    const messages: Record<string, string> = {
      VOTING_CLOSED: 'Voting on this change has closed.',
      NOT_ELIGIBLE: 'Only members who were in the circle when the change was proposed can vote.',
    };
    return {
      success: false,
      message: messages[result?.error ?? ''] ?? mapMoneyError(result?.error ?? error?.message),
    };
  }
  return {
    success: true,
    message:
      result.status === 'passed'
        ? 'Thank you. Your vote decided it: the change was approved.'
        : result.status === 'rejected'
          ? 'Thank you. Your vote decided it: the change was not approved.'
          : 'Thank you. Your vote is recorded. You can change it until voting closes.',
  };
}
