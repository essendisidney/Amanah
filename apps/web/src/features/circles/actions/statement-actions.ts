'use server';

import { revalidatePath } from 'next/cache';
import { callRpc } from '@/lib/supabase/rpc';
import { friendlyError } from '@/lib/friendly-error';
import { redirectWithCircleNotice } from '@/features/circles/lib/circle-notice';

export type StatementRowInput = {
  reference: string;
  paid_on: string | null;
  amount: number;
  member_id: string;
  details: string;
};

export type RecordStatementResult = {
  ok: boolean;
  message: string;
  recorded?: number;
  duplicates?: number;
  unallocated?: number;
};

/** Record the statement lines the officer confirmed against members' open contributions. */
export async function recordStatementPaymentsAction(
  jamiyaId: string,
  slug: string,
  rows: StatementRowInput[],
): Promise<RecordStatementResult> {
  if (!jamiyaId || rows.length === 0) {
    return { ok: false, message: 'Tick at least one payment with a member.' };
  }
  const { data, error } = await callRpc('record_statement_payments', {
    p_jamiya_id: jamiyaId,
    p_rows: rows,
  });
  if (error) return { ok: false, message: friendlyError(error.message) };
  const result = data as {
    ok?: boolean;
    error?: string;
    recorded?: number;
    duplicates?: number;
    results?: Array<{ status: string; unallocated?: number | string }>;
  } | null;
  if (!result?.ok) {
    return {
      ok: false,
      message:
        result?.error === 'FORBIDDEN'
          ? 'Only circle officers can record bank payments.'
          : 'Could not record these payments. Check the amounts and try again.',
    };
  }

  revalidatePath(`/circles/${slug}`);
  revalidatePath(`/circles/${slug}/bank-payments`);
  revalidatePath(`/circles/${slug}/officer`);

  const recorded = Number(result.recorded ?? 0);
  const duplicates = Number(result.duplicates ?? 0);
  const unallocated = (result.results ?? []).reduce((sum, r) => sum + Number(r.unallocated ?? 0), 0);
  const parts = [`Recorded ${recorded} payment${recorded === 1 ? '' : 's'}.`];
  if (duplicates > 0) {
    parts.push(`${duplicates} ${duplicates === 1 ? 'was' : 'were'} already recorded and skipped.`);
  }
  if (unallocated > 0) {
    parts.push(
      `KES ${unallocated.toLocaleString('en-KE')} was more than what those members owed; it is listed below for you to record in Books.`,
    );
  }
  return { ok: true, message: parts.join(' '), recorded, duplicates, unallocated };
}

export type PayoutKind = 'payout' | 'withdrawal' | 'loan' | 'expense';

export type StatementPayoutInput = {
  reference: string;
  paid_on: string | null;
  amount: number;
  kind: PayoutKind;
  member_id: string | null;
  details: string;
};

/** Record the money-out lines the officer confirmed into Books (and loans into the loan book). */
export async function recordStatementPayoutsAction(
  jamiyaId: string,
  slug: string,
  rows: StatementPayoutInput[],
): Promise<RecordStatementResult> {
  if (!jamiyaId || rows.length === 0) {
    return { ok: false, message: 'Tick at least one payment out.' };
  }
  const { data, error } = await callRpc('record_statement_payouts', {
    p_jamiya_id: jamiyaId,
    p_rows: rows,
  });
  if (error) return { ok: false, message: friendlyError(error.message) };
  const result = data as {
    ok?: boolean;
    error?: string;
    recorded?: number;
    duplicates?: number;
    results?: Array<{ status: string }>;
  } | null;
  if (!result?.ok) {
    return {
      ok: false,
      message:
        result?.error === 'FORBIDDEN'
          ? 'Only circle officers can record bank payments.'
          : 'Could not record these payments. Check the amounts and try again.',
    };
  }

  revalidatePath(`/circles/${slug}`);
  revalidatePath(`/circles/${slug}/bank-payments`);
  revalidatePath(`/circles/${slug}/books`);
  revalidatePath(`/circles/${slug}/officer`);

  const recorded = Number(result.recorded ?? 0);
  const duplicates = Number(result.duplicates ?? 0);
  const invalid = (result.results ?? []).filter((r) => r.status === 'invalid' || r.status === 'not_a_member').length;
  const parts = [`Recorded ${recorded} payment${recorded === 1 ? '' : 's'} out in Books.`];
  if (duplicates > 0) {
    parts.push(`${duplicates} ${duplicates === 1 ? 'was' : 'were'} already recorded and skipped.`);
  }
  if (invalid > 0) {
    parts.push(`${invalid} could not be recorded; payouts, withdrawals and loans need a member.`);
  }
  return { ok: true, message: parts.join(' '), recorded, duplicates };
}

/** Save the paybill, account, bank and note members see under "How to pay". */
export async function setCirclePaymentDetailsAction(formData: FormData): Promise<void> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  if (!jamiyaId || !slug) return;

  const { data, error } = await callRpc('set_circle_payment_details', {
    p_jamiya_id: jamiyaId,
    p_paybill: String(formData.get('paybill') ?? ''),
    p_account: String(formData.get('account') ?? ''),
    p_bank: String(formData.get('bank') ?? ''),
    p_note: String(formData.get('note') ?? ''),
  });

  revalidatePath(`/circles/${slug}`);
  revalidatePath(`/circles/${slug}/bank-payments`);

  if (error) {
    redirectWithCircleNotice(slug, friendlyError(error.message), 'error', '/bank-payments');
  }
  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    redirectWithCircleNotice(
      slug,
      result?.error === 'FORBIDDEN'
        ? 'Only circle officers can change how members pay.'
        : 'Keep the paybill under 20 characters, the account under 40 and the note under 280.',
      'error',
      '/bank-payments',
    );
  }
  redirectWithCircleNotice(slug, 'Payment details saved. Members now see them on the circle page.', 'success', '/bank-payments');
}
