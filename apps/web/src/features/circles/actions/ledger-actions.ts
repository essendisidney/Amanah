'use server';

import { revalidatePath } from 'next/cache';
import { callRpc } from '@/lib/supabase/rpc';
import {
  mapMoneyError,
  redirectWithCircleNotice,
} from '../lib/circle-notice';

function revalidateCircle(slug?: string) {
  revalidatePath('/dashboard');
  revalidatePath('/wallet');
  revalidatePath('/circles');
  revalidatePath('/notifications');
  if (slug) revalidatePath(`/circles/${slug}`);
}

export async function activateCircleAction(formData: FormData): Promise<void> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  if (!jamiyaId || !slug) return;

  const { data, error } = await callRpc('activate_jamiya', {
    p_jamiya_id: jamiyaId,
  });

  if (error) {
    redirectWithCircleNotice(slug, mapMoneyError(error.message) || error.message, 'error');
  }

  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    redirectWithCircleNotice(
      slug,
      mapMoneyError(result?.error) || result?.error || 'Could not activate circle.',
      'error',
    );
  }

  revalidateCircle(slug);
  redirectWithCircleNotice(
    slug,
    'Circle activated. Contribution and payout schedules are ready.',
    'success',
  );
}

export async function payContributionAction(formData: FormData): Promise<void> {
  const contributionId = String(formData.get('contributionId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const amountRaw = String(formData.get('amount') ?? '').trim();
  if (!contributionId) return;

  const p_amount = amountRaw ? Number(amountRaw) : null;
  if (amountRaw && (!Number.isFinite(p_amount) || (p_amount as number) <= 0)) {
    console.error('pay_contribution', 'INVALID_AMOUNT');
    return;
  }

  const { data, error } = await callRpc('pay_contribution', {
    p_contribution_id: contributionId,
    p_amount,
  });

  if (error) {
    if (slug) redirectWithCircleNotice(slug, mapMoneyError(error.message));
    return;
  }

  const result = data as { ok?: boolean; error?: string; status?: string } | null;
  if (!result?.ok) {
    if (slug) redirectWithCircleNotice(slug, mapMoneyError(result?.error));
    return;
  }

  if (result.status === 'paid') {
    await callRpc('charge_contribution_fee', {
      p_contribution_id: contributionId,
    });
  }

  revalidateCircle(slug || undefined);
  if (slug) redirectWithCircleNotice(slug, 'Contribution paid from your wallet.', 'success');
}

export async function payContributionAheadAction(formData: FormData): Promise<void> {
  const contributionId = String(formData.get('contributionId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const amountRaw = String(formData.get('amount') ?? '').trim();
  if (!contributionId) return;

  const p_amount = amountRaw ? Number(amountRaw) : null;
  if (amountRaw && (!Number.isFinite(p_amount) || (p_amount as number) <= 0)) {
    console.error('pay_contribution_ahead', 'INVALID_AMOUNT');
    return;
  }

  const { data, error } = await callRpc('pay_contribution_ahead', {
    p_contribution_id: contributionId,
    p_amount,
  });

  if (error) {
    if (slug) redirectWithCircleNotice(slug, mapMoneyError(error.message));
    return;
  }

  const result = data as { ok?: boolean; error?: string; status?: string } | null;
  if (!result?.ok) {
    if (slug) redirectWithCircleNotice(slug, mapMoneyError(result?.error));
    return;
  }

  if (result.status === 'paid') {
    await callRpc('charge_contribution_fee', {
      p_contribution_id: contributionId,
    });
  }

  revalidateCircle(slug || undefined);
  if (slug) redirectWithCircleNotice(slug, 'Contribution paid ahead from your wallet.', 'success');
}

/** Officer records a merry-go-round monthly contribution paid in cash (no wallet debit). */
export async function officerRecordContributionPaymentAction(
  formData: FormData,
): Promise<void> {
  const contributionId = String(formData.get('contributionId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const amountRaw = String(formData.get('amount') ?? '').trim();
  const notes = String(formData.get('notes') ?? '').trim() || null;
  if (!contributionId || !slug) return;

  const p_amount = amountRaw ? Number(amountRaw) : null;
  if (amountRaw && (!Number.isFinite(p_amount) || (p_amount as number) <= 0)) {
    redirectWithCircleNotice(slug, 'Enter a valid amount.', 'error');
  }

  const { data, error } = await callRpc('officer_record_contribution_payment', {
    p_contribution_id: contributionId,
    p_amount,
    p_notes: notes,
  });

  if (error) {
    redirectWithCircleNotice(slug, mapMoneyError(error.message) || error.message, 'error');
  }

  const result = data as { ok?: boolean; error?: string; status?: string } | null;
  if (!result?.ok) {
    redirectWithCircleNotice(
      slug,
      mapMoneyError(result?.error) || result?.error || 'Could not record payment.',
      'error',
    );
  }

  revalidateCircle(slug);
  redirectWithCircleNotice(
    slug,
    result?.status === 'partial'
      ? 'Partial contribution recorded (cash).'
      : 'Monthly contribution marked paid (cash).',
    'success',
  );
}

/** Officer saves merry-go-round month×member contribution grid (past or present). */
export async function saveMgrMonthlyPaymentsAction(formData: FormData): Promise<void> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const raw = String(formData.get('rows') ?? '[]');
  if (!jamiyaId || !slug) return;

  let rows: unknown;
  try {
    rows = JSON.parse(raw);
  } catch {
    redirectWithCircleNotice(slug, 'Could not read payment grid.', 'error');
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    redirectWithCircleNotice(slug, 'No changes to save.', 'error');
  }

  const safe = (rows as Array<Record<string, unknown>>)
    .filter(
      (r) =>
        r &&
        typeof r.member_id === 'string' &&
        Number.isFinite(Number(r.cycle_number)) &&
        Number.isFinite(Number(r.year)) &&
        Number.isFinite(Number(r.month)) &&
        Number.isFinite(Number(r.amount)) &&
        Number(r.amount) >= 0,
    )
    .map((r) => ({
      member_id: String(r.member_id),
      cycle_number: Number(r.cycle_number),
      year: Number(r.year),
      month: Number(r.month),
      amount: Number(r.amount),
    }));

  if (safe.length === 0) {
    redirectWithCircleNotice(slug, 'No valid payment rows to save.', 'error');
  }

  const { data, error } = await callRpc('officer_save_mgr_monthly_payments', {
    p_jamiya_id: jamiyaId,
    p_rows: safe,
  });

  if (error) {
    redirectWithCircleNotice(slug, mapMoneyError(error.message) || error.message, 'error');
  }

  const result = data as { ok?: boolean; error?: string; updated?: number } | null;
  if (!result?.ok) {
    redirectWithCircleNotice(
      slug,
      mapMoneyError(result?.error) || result?.error || 'Could not save monthly contributions.',
      'error',
    );
  }

  revalidateCircle(slug);
  redirectWithCircleNotice(
    slug,
    `Saved monthly contributions${result?.updated != null ? ` (${result.updated} updated)` : ''}.`,
    'success',
  );
}

export async function settlePayoutAction(formData: FormData): Promise<void> {
  const payoutId = String(formData.get('payoutId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  if (!payoutId) return;

  const { data, error } = await callRpc('propose_settle_payout', {
    p_payout_id: payoutId,
  });

  if (error) {
    if (slug) redirectWithCircleNotice(slug, mapMoneyError(error.message) || error.message, 'error');
    return;
  }

  const result = data as {
    ok?: boolean;
    error?: string;
    pending_dual_approval?: boolean;
  } | null;

  revalidateCircle(slug || undefined);

  if (slug && result?.pending_dual_approval) {
    redirectWithCircleNotice(
      slug,
      'Payout queued for second officer approval (dual control).',
      'info',
    );
  }

  if (!result?.ok) {
    if (slug) {
      redirectWithCircleNotice(
        slug,
        mapMoneyError(result?.error) || result?.error || 'Could not settle payout.',
        'error',
      );
    }
    return;
  }

  if (slug) redirectWithCircleNotice(slug, 'Payout settled to member wallet.', 'success');
}

export async function settlePayoutToMpesaAction(formData: FormData): Promise<void> {
  const payoutId = String(formData.get('payoutId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const phoneRaw = String(formData.get('phone') ?? '').trim();
  const { toE164Kenya } = await import('@jamiya/shared');
  const phone = phoneRaw ? toE164Kenya(phoneRaw) ?? phoneRaw : '';
  if (!payoutId) return;

  if (phoneRaw && !toE164Kenya(phoneRaw)) {
    if (slug) {
      redirectWithCircleNotice(
        slug,
        'Use a Kenya mobile, e.g. 0712345678 or +254712345678.',
        'error',
      );
    }
    return;
  }

  const { data, error } = await callRpc('settle_payout_to_mpesa', {
    p_payout_id: payoutId,
    p_phone: phone || null,
  });

  if (error) {
    if (slug) redirectWithCircleNotice(slug, mapMoneyError(error.message) || error.message, 'error');
    return;
  }

  const result = data as { ok?: boolean; error?: string } | null;
  revalidateCircle(slug || undefined);
  revalidatePath('/admin/withdrawals');
  revalidatePath('/wallet');

  if (!result?.ok) {
    if (slug) {
      redirectWithCircleNotice(
        slug,
        mapMoneyError(result?.error) || result?.error || 'Could not cash out payout.',
        'error',
      );
    }
    return;
  }

  if (slug) redirectWithCircleNotice(slug, 'Payout cash-out queued to M-Pesa.', 'success');
}
