'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { callRpc } from '@/lib/supabase/rpc';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import { withNoticeQuery } from '@/features/auth/lib/types';
import { friendlyError } from '@/lib/friendly-error';
import type { BillingPeriod } from '@/features/circles/lib/plan-price';

const PAGE = '/admin/finance/plan-payments';

export type PlanPaymentInput = {
  reference: string;
  paid_on: string | null;
  amount: number;
  jamiya_id: string;
  plan_id: string;
  period: BillingPeriod;
  details: string;
};

export type RecordPlanPaymentsResult = {
  ok: boolean;
  message: string;
  recorded?: number;
  activated?: number;
  duplicates?: number;
  held?: number;
};

/** Record payments to Jameiyah read from its bank statement; full payments switch plans on. */
export async function recordPlanPaymentsAction(rows: PlanPaymentInput[]): Promise<RecordPlanPaymentsResult> {
  await requireAdminAccess('admin');
  if (rows.length === 0) return { ok: false, message: 'Tick at least one payment with a circle.' };

  const { data, error } = await callRpc('admin_record_plan_payments', { p_rows: rows });
  if (error) return { ok: false, message: friendlyError(error.message) };
  const result = data as {
    ok?: boolean;
    error?: string;
    recorded?: number;
    activated?: number;
    duplicates?: number;
    results?: Array<{ status: string }>;
  } | null;
  if (!result?.ok) {
    return {
      ok: false,
      message: result?.error === 'FORBIDDEN' ? 'Only platform admins can record payments.' : 'Could not record these payments.',
    };
  }
  revalidatePath(PAGE);
  revalidatePath('/admin/finance/revenue');
  return {
    ok: true,
    message: '',
    recorded: Number(result.recorded ?? 0),
    activated: Number(result.activated ?? 0),
    duplicates: Number(result.duplicates ?? 0),
    held: (result.results ?? []).filter((r) => r.status === 'held').length,
  };
}

/** Where circles pay Jameiyah. "{ref}" in the M-Pesa account is replaced by each circle's reference. */
export async function setJameiyahPaymentDetailsAction(formData: FormData): Promise<void> {
  await requireAdminAccess('admin');
  const field = (name: string) => String(formData.get(name) ?? '');
  const { data, error } = await callRpc('admin_set_jameiyah_payment_details', {
    p_account_name: field('account_name'),
    p_bank: field('bank'),
    p_branch: field('branch'),
    p_account: field('account'),
    p_paybill: field('paybill'),
    p_mpesa_account: field('mpesa_account'),
  });
  revalidatePath(PAGE);
  const ok = !error && (data as { ok?: boolean } | null)?.ok === true;
  redirect(
    withNoticeQuery(
      PAGE,
      ok
        ? 'Payment details saved. Officers see them on the Circle plan card.'
        : error
          ? friendlyError(error.message)
          : 'Keep each field under 80 characters.',
      ok ? 'success' : 'error',
    ),
  );
}
