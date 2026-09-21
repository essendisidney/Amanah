'use server';

import { revalidatePath } from 'next/cache';
import { callRpc } from '@/lib/supabase/rpc';
import { redirectWithCircleNotice, mapMoneyError } from '../lib/circle-notice';
import { booksPath } from '../lib/books-path';

function revalidateBooks(slug: string) {
  revalidatePath(`/circles/${slug}/books`);
  revalidatePath(`/circles/${slug}/statement`);
  revalidatePath(`/circles/${slug}/treasury`);
}

type LoanEventType = 'disbursement' | 'profit' | 'repayment' | 'rollover';

const LOAN_EVENT_ERRORS: Record<string, string> = {
  REPAYMENT_EXCEEDS_PRINCIPAL:
    'Repayment is more than the facility balance. Save a New facility first (or lower the amount).',
  REPAYMENT_AMOUNT_REQUIRED: 'Enter a repayment amount.',
  DISBURSEMENT_AMOUNT_REQUIRED: 'Enter the new facility amount.',
  PROFIT_AMOUNT_REQUIRED: 'Enter the profit amount.',
  PROFIT_EXCEEDS_REPAYMENT: 'Profit portion cannot be more than the total repayment.',
  INVALID_NEW_PRINCIPAL: 'Enter a valid new facility balance for the rollover.',
  INVALID_EVENT_TYPE: 'Invalid facility event type.',
  INVALID_AMOUNT: 'Enter a valid amount.',
  INVALID_DATE: 'Pick a valid date.',
  FORBIDDEN: 'Only circle officers can record facility ledger events.',
  UNAUTHENTICATED: 'Sign in again, then retry.',
};

export async function recordMemberLoanEventAction(formData: FormData): Promise<void> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const memberId = String(formData.get('memberId') ?? '');
  const eventType = String(formData.get('eventType') ?? '') as LoanEventType;
  const amount = Number(formData.get('amount'));
  const profitAmount = Number(formData.get('profitAmount') ?? 0);
  const newPrincipal = formData.get('newPrincipal');
  const effectiveDate = String(formData.get('effectiveDate') ?? '');
  const notes = String(formData.get('notes') ?? '').trim();
  const returnPathRaw = String(formData.get('returnPath') ?? '').trim();
  const back =
    returnPathRaw && returnPathRaw.startsWith('/')
      ? returnPathRaw.replace(`/circles/${slug}`, '') || '/statement'
      : booksPath(memberId);

  if (!jamiyaId || !slug || !memberId) {
    return;
  }
  if (!effectiveDate) {
    redirectWithCircleNotice(slug, 'Pick a date for this facility event.', 'error', back);
  }

  const allowed: LoanEventType[] = ['disbursement', 'profit', 'repayment', 'rollover'];
  if (!allowed.includes(eventType)) {
    redirectWithCircleNotice(slug, 'Invalid facility event type.', 'error', back);
  }

  if (eventType !== 'rollover' && (!Number.isFinite(amount) || amount <= 0)) {
    redirectWithCircleNotice(
      slug,
      'Enter an amount greater than zero.',
      'error',
      back,
    );
  }

  const { data, error } = await callRpc('record_member_loan_event', {
    p_jamiya_id: jamiyaId,
    p_member_id: memberId,
    p_event_type: eventType,
    p_amount: Number.isFinite(amount) ? amount : 0,
    p_effective_date: effectiveDate,
    p_notes: notes || null,
    p_profit_amount: Number.isFinite(profitAmount) ? profitAmount : 0,
    p_new_principal:
      newPrincipal != null && String(newPrincipal).trim() !== ''
        ? Number(newPrincipal)
        : null,
  });

  if (error) {
    redirectWithCircleNotice(slug, error.message, 'error', back);
  }

  const result = data as {
    ok?: boolean;
    error?: string;
    principal_outstanding?: number;
  } | null;
  if (!result?.ok) {
    const code = result?.error ?? 'FAILED';
    redirectWithCircleNotice(
      slug,
      LOAN_EVENT_ERRORS[code] ?? mapMoneyError(code) ?? `Could not save facility event (${code}).`,
      'error',
      back,
    );
  }

  revalidateBooks(slug);
  const balance =
    result.principal_outstanding != null
      ? ` Balance now ${Number(result.principal_outstanding).toLocaleString()}.`
      : '';
  const label =
    eventType === 'disbursement'
      ? 'New facility'
      : eventType === 'repayment'
        ? 'Repayment'
        : eventType === 'profit'
          ? 'Profit'
          : 'Rollover';
  redirectWithCircleNotice(slug, `${label} recorded.${balance}`, 'success', back);
}
