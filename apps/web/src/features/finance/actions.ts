'use server';

import { revalidatePath } from 'next/cache';
import { callRpc } from '@/lib/supabase/rpc';
import { createClient } from '@/lib/supabase/server';

export type FinanceActionState = { success: boolean; message: string };

function rpcState(data: unknown, fallback: string): FinanceActionState {
  const result = data as { ok?: boolean; error?: string } | null;
  return result?.ok
    ? { success: true, message: 'Done.' }
    : { success: false, message: result?.error ?? fallback };
}

export async function requestQardAction(formData: FormData): Promise<FinanceActionState> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const amount = Number(formData.get('amount'));
  const purpose = String(formData.get('purpose') ?? '').trim();
  const installments = Number(formData.get('installments') ?? 4);
  if (!jamiyaId || !Number.isFinite(amount) || purpose.length < 5) {
    return { success: false, message: 'Select a circle and provide a valid amount and purpose.' };
  }
  const { data, error } = await callRpc('request_qard', {
    p_jamiya_id: jamiyaId,
    p_amount: amount,
    p_purpose: purpose,
    p_installments: installments,
  });
  if (error) return { success: false, message: error.message };
  const state = rpcState(data, 'Could not submit Qard request.');
  if (state.success) {
    state.message = 'Qard request submitted.';
    revalidatePath('/finance/qard');
  }
  return state;
}

export async function repayQardAction(formData: FormData): Promise<FinanceActionState> {
  const loanId = String(formData.get('loanId') ?? '');
  const amount = Number(formData.get('amount'));
  if (!loanId || !Number.isFinite(amount) || amount <= 0) {
    return { success: false, message: 'Enter a valid repayment amount.' };
  }
  const { data, error } = await callRpc('repay_qard', { p_loan_id: loanId, p_amount: amount });
  if (error) return { success: false, message: error.message };
  const state = rpcState(data, 'Could not record repayment.');
  if (state.success) {
    state.message = 'Repayment recorded.';
    revalidatePath('/finance/qard');
  }
  return state;
}

export async function submitTawarruqAction(formData: FormData): Promise<FinanceActionState> {
  const amount = Number(formData.get('amount'));
  const purpose = String(formData.get('purpose') ?? '').trim();
  if (!Number.isFinite(amount) || purpose.length < 5) {
    return { success: false, message: 'Enter a valid amount and purpose.' };
  }
  const { data, error } = await callRpc('submit_tawarruq_application', {
    p_amount: amount,
    p_purpose: purpose,
    p_jamiya_id: String(formData.get('jamiyaId') ?? '') || null,
  });
  if (error) return { success: false, message: error.message };
  const state = rpcState(data, 'Could not submit application.');
  if (state.success) {
    state.message = 'Application submitted.';
    revalidatePath('/finance/tawarruq');
  }
  return state;
}

export async function createGoalAction(formData: FormData): Promise<FinanceActionState> {
  const title = String(formData.get('title') ?? '').trim();
  const target = Number(formData.get('targetAmount'));
  if (title.length < 2 || !Number.isFinite(target) || target <= 0) {
    return { success: false, message: 'Provide a title and positive target.' };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, message: 'Sign in to manage goals.' };
  const { error } = await supabase.from('savings_goals').insert({
    user_id: user.id,
    title,
    target_amount: target,
    saved_amount: 0,
    currency: 'KES',
    target_date: String(formData.get('targetDate') ?? '') || null,
  } as never);
  if (error) return { success: false, message: error.message };
  revalidatePath('/finance/goals');
  return { success: true, message: 'Goal created.' };
}

export async function updateGoalAction(formData: FormData): Promise<FinanceActionState> {
  const goalId = String(formData.get('goalId') ?? '');
  const saved = Number(formData.get('savedAmount'));
  if (!goalId || !Number.isFinite(saved) || saved < 0) {
    return { success: false, message: 'Enter a valid saved amount.' };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from('savings_goals')
    .update({ saved_amount: saved } as never)
    .eq('id', goalId);
  if (error) return { success: false, message: error.message };
  revalidatePath('/finance/goals');
  return { success: true, message: 'Goal updated.' };
}

export async function deleteGoalAction(formData: FormData): Promise<void> {
  const goalId = String(formData.get('goalId') ?? '');
  if (!goalId) return;
  const supabase = await createClient();
  await supabase.from('savings_goals').delete().eq('id', goalId);
  revalidatePath('/finance/goals');
}

export async function ensureWelfareFundAction(formData: FormData): Promise<FinanceActionState> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const contributionAmount = Number(formData.get('contributionAmount') ?? 0);
  if (!jamiyaId) return { success: false, message: 'Choose a circle.' };
  const { data, error } = await callRpc('ensure_welfare_fund', {
    p_jamiya_id: jamiyaId,
    p_contribution_amount: Number.isFinite(contributionAmount) ? contributionAmount : 0,
  });
  if (error) return { success: false, message: error.message };
  const state = rpcState(data, 'Could not create welfare fund.');
  if (state.success) {
    state.message = 'Welfare fund ready.';
    revalidatePath('/finance');
    revalidatePath('/finance/welfare');
  }
  return state;
}

export async function contributeWelfareAction(formData: FormData): Promise<FinanceActionState> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const amount = Number(formData.get('amount'));
  if (!jamiyaId || !Number.isFinite(amount) || amount <= 0) {
    return { success: false, message: 'Choose a circle and enter a valid amount.' };
  }
  const { data, error } = await callRpc('contribute_to_welfare', {
    p_jamiya_id: jamiyaId,
    p_amount: amount,
  });
  if (error) return { success: false, message: error.message };
  const state = rpcState(data, 'Could not contribute to welfare.');
  if (state.success) {
    state.message = 'Welfare contribution recorded.';
    revalidatePath('/finance');
    revalidatePath('/finance/welfare');
    revalidatePath('/wallet');
  }
  return state;
}

export async function fileWelfareClaimAction(formData: FormData): Promise<FinanceActionState> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const claimType = String(formData.get('claimType') ?? 'medical');
  const amount = Number(formData.get('amount'));
  const reason = String(formData.get('reason') ?? '').trim();
  if (!jamiyaId || !Number.isFinite(amount) || reason.length < 5) {
    return { success: false, message: 'Provide circle, amount (≥100), and a reason.' };
  }
  const { data, error } = await callRpc('file_welfare_claim', {
    p_jamiya_id: jamiyaId,
    p_claim_type: claimType,
    p_amount: amount,
    p_reason: reason,
  });
  if (error) return { success: false, message: error.message };
  const state = rpcState(data, 'Could not file claim.');
  if (state.success) {
    state.message = 'Claim submitted for review.';
    revalidatePath('/finance/welfare');
  }
  return state;
}

export async function decideWelfareClaimAction(formData: FormData): Promise<FinanceActionState> {
  const claimId = String(formData.get('claimId') ?? '');
  const approve = String(formData.get('approve') ?? '') === 'true';
  const notes = String(formData.get('notes') ?? '').trim();
  if (!claimId) return { success: false, message: 'Missing claim.' };
  const { data, error } = await callRpc('decide_welfare_claim', {
    p_claim_id: claimId,
    p_approve: approve,
    p_notes: notes || null,
  });
  if (error) return { success: false, message: error.message };
  const state = rpcState(data, 'Could not decide claim.');
  if (state.success) {
    state.message = approve ? 'Claim paid to member wallet.' : 'Claim rejected.';
    revalidatePath('/finance/welfare');
    revalidatePath('/wallet');
  }
  return state;
}

export async function requestQardFormAction(formData: FormData): Promise<void> {
  await requestQardAction(formData);
}
export async function repayQardFormAction(formData: FormData): Promise<void> {
  await repayQardAction(formData);
}
export async function submitTawarruqFormAction(formData: FormData): Promise<void> {
  await submitTawarruqAction(formData);
}
export async function createGoalFormAction(formData: FormData): Promise<void> {
  await createGoalAction(formData);
}
export async function updateGoalFormAction(formData: FormData): Promise<void> {
  await updateGoalAction(formData);
}
export async function contributeWelfareFormAction(formData: FormData): Promise<void> {
  await contributeWelfareAction(formData);
}
export async function ensureWelfareFundFormAction(formData: FormData): Promise<void> {
  await ensureWelfareFundAction(formData);
}
export async function fileWelfareClaimFormAction(formData: FormData): Promise<void> {
  await fileWelfareClaimAction(formData);
}
export async function decideWelfareClaimFormAction(formData: FormData): Promise<void> {
  await decideWelfareClaimAction(formData);
}
