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
  const durationRaw = Number(formData.get('durationMonths') ?? 0);
  const durationMonths = [1, 3, 6, 12].includes(durationRaw) ? durationRaw : null;
  const currency = String(formData.get('currency') ?? 'KES');
  if (!jamiyaId || !memberId) return;

  const allowed = [
    'regular',
    'emergency',
    'school',
    'holiday',
    'investment',
    'goal',
    'hajj',
    'umrah',
    'udhiyah',
  ];
  if (!allowed.includes(category)) return;

  const usesHorizon = ['goal', 'hajj', 'umrah', 'udhiyah'].includes(category);

  const supabase = await createClient();
  const { error } = await supabase.from('savings_pockets').insert({
    jamiya_id: jamiyaId,
    member_id: memberId,
    category,
    label: label || null,
    target_amount: Number.isFinite(target) && target > 0 ? target : null,
    duration_months: usesHorizon ? durationMonths : null,
    balance: 0,
    currency,
  } as never);
  if (error) {
    console.error('[createSavingsPocket]', error.message);
    return;
  }

  revalidateCircle(slug || undefined);
}

export async function moveSavingsPocketAction(formData: FormData): Promise<void> {
  const pocketId = String(formData.get('pocketId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const direction = String(formData.get('direction') ?? '');
  const amount = Number(formData.get('amount') ?? 0);
  if (!pocketId || !['deposit', 'withdraw'].includes(direction)) return;
  if (!Number.isFinite(amount) || amount <= 0) return;

  const { data, error } = await callRpc('move_savings_pocket', {
    p_pocket_id: pocketId,
    p_amount: amount,
    p_direction: direction,
  });
  if (error) {
    console.error('[moveSavingsPocket]', error.message);
    return;
  }
  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    console.error('[moveSavingsPocket]', result?.error ?? 'FAILED');
    return;
  }

  revalidateCircle(slug || undefined);
  revalidatePath('/wallet');
}
