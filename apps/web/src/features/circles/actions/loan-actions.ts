'use server';

import { revalidatePath } from 'next/cache';
import { callRpc } from '@/lib/supabase/rpc';
import { redirectWithCircleNotice } from '../lib/circle-notice';
import { booksPath } from '../lib/books-path';

function revalidateBooks(slug: string) {
  revalidatePath(`/circles/${slug}/books`);
  revalidatePath(`/circles/${slug}/statement`);
  revalidatePath(`/circles/${slug}/treasury`);
}

type LoanEventType = 'disbursement' | 'profit' | 'repayment' | 'rollover';

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

  if (!jamiyaId || !slug || !memberId || !effectiveDate) return;

  const allowed: LoanEventType[] = ['disbursement', 'profit', 'repayment', 'rollover'];
  if (!allowed.includes(eventType)) {
    redirectWithCircleNotice(slug, 'Invalid loan event type.', 'error', booksPath(memberId));
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
    redirectWithCircleNotice(slug, error.message, 'error', booksPath(memberId));
  }

  const result = data as { ok?: boolean; error?: string; principal_outstanding?: number } | null;
  if (!result?.ok) {
    redirectWithCircleNotice(
      slug,
      result?.error ?? 'Could not save loan event.',
      'error',
      booksPath(memberId),
    );
  }

  revalidateBooks(slug);
  const balance =
    result.principal_outstanding != null
      ? ` Balance now ${result.principal_outstanding.toLocaleString()}.`
      : '';
  redirectWithCircleNotice(
    slug,
    `Loan ${eventType.replace('_', ' ')} recorded.${balance}`,
    'success',
    booksPath(memberId),
  );
}
