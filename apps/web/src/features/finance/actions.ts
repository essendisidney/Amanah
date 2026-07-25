'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { callRpc } from '@/lib/supabase/rpc';

export type FinanceActionState = { success: boolean; message: string };

function rpcState(data: unknown, fallback: string): FinanceActionState {
  const result = data as { ok?: boolean; error?: string } | null;
  return result?.ok
    ? { success: true, message: 'Request recorded.' }
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
  if (state.success) revalidatePath('/finance/qard');
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
  if (state.success) revalidatePath('/finance/qard');
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
  if (state.success) revalidatePath('/finance/tawarruq');
  return state;
}

export async function createGoalAction(formData: FormData): Promise<FinanceActionState> {
  const title = String(formData.get('title') ?? '').trim();
  const target = Number(formData.get('targetAmount'));
  if (title.length < 2 || !Number.isFinite(target) || target <= 0) {
    return { success: false, message: 'Provide a title and positive target.' };
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: 'Sign in to manage goals.' };
  const { error } = await supabase.from('savings_goals').insert({
    user_id: user.id, title, target_amount: target, saved_amount: 0, currency: 'KES',
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
  const { error } = await supabase.from('savings_goals').update({ saved_amount: saved } as never).eq('id', goalId);
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

export async function contributeWelfareAction(formData: FormData): Promise<FinanceActionState> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const amount = Number(formData.get('amount'));
  if (!jamiyaId || !Number.isFinite(amount) || amount <= 0) {
    return { success: false, message: 'Choose a circle and enter a valid amount.' };
  }
  const { data, error } = await callRpc('contribute_to_welfare', {
    p_jamiya_id: jamiyaId, p_amount: amount,
  });
  if (error) return { success: false, message: error.message };
  const state = rpcState(data, 'Could not contribute to welfare.');
  if (state.success) revalidatePath('/finance');
  return state;
}

/** Form-action adapters deliberately return void; use the stateful actions in client forms. */
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
