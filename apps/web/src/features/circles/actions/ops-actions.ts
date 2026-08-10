'use server';

import { revalidatePath } from 'next/cache';
import { callRpc } from '@/lib/supabase/rpc';
import { createClient } from '@/lib/supabase/server';

function revalidateCircle(slug?: string) {
  revalidatePath('/dashboard');
  revalidatePath('/circles');
  revalidatePath('/notifications');
  revalidatePath('/finance/qard');
  if (slug) {
    revalidatePath(`/circles/${slug}`);
    revalidatePath(`/circles/${slug}/officer`);
  }
}

export async function updatePenaltySettingsAction(formData: FormData): Promise<void> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  if (!jamiyaId) return;

  const late = Number(formData.get('lateContributionPenalty') ?? 0);
  const missed = Number(formData.get('missedContributionPenalty') ?? 0);
  const loanFixed = Number(formData.get('lateLoanPenaltyFixed') ?? 0);
  const loanPct = Number(formData.get('lateLoanPenaltyPct') ?? 0);
  const mode = String(formData.get('payoutComplianceMode') ?? 'block');

  const supabase = await createClient();
  await supabase
    .from('jamiyas')
    .update({
      late_contribution_penalty: Number.isFinite(late) ? late : 0,
      missed_contribution_penalty: Number.isFinite(missed) ? missed : 0,
      late_loan_penalty_fixed: Number.isFinite(loanFixed) ? loanFixed : 0,
      late_loan_penalty_pct: Number.isFinite(loanPct) ? loanPct : 0,
      payout_compliance_mode: ['block', 'approve', 'deduct', 'allow'].includes(mode)
        ? mode
        : 'block',
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', jamiyaId);

  revalidateCircle(slug || undefined);
}

export async function assessPenaltiesAction(formData: FormData): Promise<void> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  if (!jamiyaId) return;
  await callRpc('assess_contribution_penalties', { p_jamiya_id: jamiyaId });
  revalidateCircle(slug || undefined);
}

export async function createBookEntryAction(formData: FormData): Promise<void> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const entryType = String(formData.get('entryType') ?? '');
  const amount = Number(formData.get('amount'));
  const effectiveDate = String(formData.get('effectiveDate') ?? '');
  const notes = String(formData.get('notes') ?? '').trim();
  const memberId = String(formData.get('memberId') ?? '').trim();
  const currency = String(formData.get('currency') ?? 'KES');

  if (!jamiyaId || !entryType || !effectiveDate || !Number.isFinite(amount)) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from('book_entries').insert({
    jamiya_id: jamiyaId,
    member_id: memberId || null,
    entry_type: entryType,
    amount,
    currency,
    effective_date: effectiveDate,
    entered_by: user.id,
    notes: notes || null,
  } as never);

  revalidateCircle(slug || undefined);
}

export async function broadcastAnnouncementAction(formData: FormData): Promise<void> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  if (!jamiyaId || !title || !body) return;

  await callRpc('broadcast_announcement', {
    p_jamiya_id: jamiyaId,
    p_title: title,
    p_body: body,
  });
  revalidateCircle(slug || undefined);
}

export async function confirmPayoutReceiptAction(formData: FormData): Promise<void> {
  const payoutId = String(formData.get('payoutId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  if (!payoutId) return;
  await callRpc('confirm_payout_receipt', { p_payout_id: payoutId });
  revalidateCircle(slug || undefined);
}

export async function createSavingsPocketAction(formData: FormData): Promise<void> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const memberId = String(formData.get('memberId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const category = String(formData.get('category') ?? 'regular');
  const label = String(formData.get('label') ?? '').trim();
  const target = Number(formData.get('targetAmount') ?? 0);
  const currency = String(formData.get('currency') ?? 'KES');
  if (!jamiyaId || !memberId) return;

  const supabase = await createClient();
  await supabase.from('savings_pockets').insert({
    jamiya_id: jamiyaId,
    member_id: memberId,
    category,
    label: label || null,
    target_amount: Number.isFinite(target) && target > 0 ? target : null,
    balance: 0,
    currency,
  } as never);

  revalidateCircle(slug || undefined);
}
