'use server';

import { revalidatePath } from 'next/cache';
import { callRpc } from '@/lib/supabase/rpc';
import {
  mapMoneyError,
  redirectWithCircleNotice,
} from '../lib/circle-notice';
import type { GridSaveResult } from '../lib/action-state';

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

/**
 * Pay a contribution via STK / checkout (orchestrator), not wallet balance.
 * Webhooks settle via complete_payment_intent kind=contribution → books PAID.
 */
export async function payContributionStkAction(formData: FormData): Promise<void> {
  const contributionId = String(formData.get('contributionId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const amountRaw = String(formData.get('amount') ?? '').trim();
  const phoneRaw = String(formData.get('phone') ?? '').trim();
  if (!contributionId || !slug) return;

  const { toE164Kenya } = await import('@jamiya/shared');
  const { createClient } = await import('@/lib/supabase/server');
  const { paymentProvider } = await import('@/lib/payments/provider');
  const { redirect } = await import('next/navigation');

  const provider = paymentProvider();
  const phone = phoneRaw ? toE164Kenya(phoneRaw) ?? phoneRaw : '';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirectWithCircleNotice(slug, 'Sign in again, then retry.');
  }

  const { data: row, error: loadError } = await supabase
    .from('contributions')
    .select('id, amount, amount_paid, currency, status, member_id, members!inner(user_id)')
    .eq('id', contributionId)
    .maybeSingle();

  if (loadError || !row) {
    redirectWithCircleNotice(slug, 'That contribution was not found.');
  }

  const contrib = row as {
    id: string;
    amount: number;
    amount_paid: number;
    currency: string;
    status: string;
    members: { user_id: string } | { user_id: string }[];
  };

  const memberUserId = Array.isArray(contrib.members)
    ? contrib.members[0]?.user_id
    : contrib.members?.user_id;
  if (memberUserId !== user.id) {
    redirectWithCircleNotice(slug, 'You can only pay your own contribution.');
  }

  if (!['pending', 'late', 'partial'].includes(contrib.status)) {
    redirectWithCircleNotice(slug, 'That contribution is not open for payment.');
  }

  const remaining = Math.max(Number(contrib.amount) - Number(contrib.amount_paid ?? 0), 0);
  if (remaining <= 0) {
    redirectWithCircleNotice(slug, 'That contribution is already paid.');
  }

  let amount = amountRaw ? Number(amountRaw) : remaining;
  if (!Number.isFinite(amount) || amount <= 0) {
    redirectWithCircleNotice(slug, 'Enter a valid amount.');
  }
  amount = Math.min(amount, remaining);

  const resolvedPhone = phone || user.phone || '';
  if (
    (provider === 'mpesa' || provider === 'intasend' || provider === 'tendepay') &&
    !/^\+[1-9]\d{7,14}$/.test(resolvedPhone)
  ) {
    redirectWithCircleNotice(
      slug,
      'Enter a Kenya mobile for M-Pesa, e.g. 07… or +254….',
    );
  }

  try {
    const { assertProviderConfigured, shouldBlockSimulatedPayments } = await import(
      '@/lib/production-cutover'
    );
    if (provider === 'simulated' && shouldBlockSimulatedPayments()) {
      redirectWithCircleNotice(slug, 'Simulated payments disabled in this environment.');
    }
    assertProviderConfigured(provider);
  } catch (err) {
    redirectWithCircleNotice(
      slug,
      err instanceof Error ? err.message : 'Payment provider misconfigured.',
    );
  }

  const { data, error } = await callRpc('create_payment_intent', {
    p_amount: amount,
    p_currency: contrib.currency || 'KES',
    p_phone: resolvedPhone || null,
    p_provider: provider,
    p_idempotency_key: `contrib:${contributionId}:${amount}:${Date.now()}`,
    p_metadata: {
      kind: 'contribution',
      contribution_id: contributionId,
      source: 'circle_pay_stk',
      slug,
    },
  });

  if (error) {
    redirectWithCircleNotice(slug, mapMoneyError(error.message) || error.message);
  }

  const created = data as {
    ok?: boolean;
    error?: string;
    intent_id?: string;
  } | null;

  if (!created?.ok || !created.intent_id) {
    redirectWithCircleNotice(
      slug,
      mapMoneyError(created?.error) || 'Could not start payment.',
    );
  }

  const { collectPayment } = await import('@/lib/payments/orchestrator');
  const collected = await collectPayment({
    intentId: created.intent_id,
    amount,
    currency: contrib.currency || 'KES',
    phone: resolvedPhone || null,
    email: user.email,
    userId: user.id,
    description: 'Jameiyah contribution',
    metadata: {
      kind: 'contribution',
      contribution_id: contributionId,
    },
  });

  if (!collected.ok) {
    redirectWithCircleNotice(slug, collected.error);
  }

  if (collected.redirectUrl) {
    redirect(collected.redirectUrl);
  }

  revalidateCircle(slug);
  if (collected.status === 'completed') {
    redirectWithCircleNotice(
      slug,
      collected.fallback === 'simulated'
        ? 'Contribution paid (simulated).'
        : (collected.customerMessage ?? 'Contribution paid.'),
      'success',
    );
  }

  redirectWithCircleNotice(
    slug,
    collected.customerMessage ??
      'Payment started. Approve on your phone if prompted — the due marks paid when confirmed.',
    'info',
  );
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
export async function saveMgrMonthlyPaymentsAction(
  formData: FormData,
): Promise<GridSaveResult> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const raw = String(formData.get('rows') ?? '[]');
  if (!jamiyaId || !slug) {
    return { success: false, message: 'Missing circle.' };
  }

  let rows: unknown;
  try {
    rows = JSON.parse(raw);
  } catch {
    return { success: false, message: 'Could not read payment grid.' };
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return { success: false, message: 'No changes to save.' };
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
    return { success: false, message: 'No valid payment rows to save.' };
  }

  const { data, error } = await callRpc('officer_save_mgr_monthly_payments', {
    p_jamiya_id: jamiyaId,
    p_rows: safe,
  });

  if (error) {
    return { success: false, message: mapMoneyError(error.message) || error.message };
  }

  const result = data as { ok?: boolean; error?: string; updated?: number } | null;
  if (!result?.ok) {
    return {
      success: false,
      message:
        mapMoneyError(result?.error) || result?.error || 'Could not save monthly contributions.',
    };
  }

  revalidateCircle(slug);
  return {
    success: true,
    message: `Saved monthly contributions${result?.updated != null ? ` (${result.updated} updated)` : ''}.`,
  };
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

  const { shouldUseLiveDisburse, runWithdrawalDisbursement } = await import(
    '@/lib/payments/disburse-withdrawal'
  );
  const autoSimulate = !shouldUseLiveDisburse();

  const { data, error } = await callRpc('settle_payout_to_mpesa', {
    p_payout_id: payoutId,
    p_phone: phone || null,
    p_auto_simulate: autoSimulate,
  });

  if (error) {
    if (slug) redirectWithCircleNotice(slug, mapMoneyError(error.message) || error.message, 'error');
    return;
  }

  const result = data as {
    ok?: boolean;
    error?: string;
    withdrawal_id?: string;
    auto_simulated?: boolean;
  } | null;
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

  if (!autoSimulate && result.withdrawal_id) {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const { data: row } = await supabase
      .from('withdrawal_requests')
      .select(
        'id, user_id, amount, currency, status, destination_type, destination_phone, provider_reference, metadata',
      )
      .eq('id', result.withdrawal_id)
      .maybeSingle();

    if (row) {
      const sent = await runWithdrawalDisbursement(
        row as {
          id: string;
          user_id: string;
          amount: number;
          currency: string;
          status: string;
          destination_type: string;
          destination_phone: string | null;
          provider_reference: string | null;
          metadata: Record<string, unknown> | null;
        },
        { narrative: 'Jameiyah circle payout to M-Pesa' },
      );
      revalidateCircle(slug || undefined);
      revalidatePath('/admin/withdrawals');
      revalidatePath('/wallet');
      if (!sent.ok) {
        if (slug) redirectWithCircleNotice(slug, sent.error, 'error');
        return;
      }
      if (slug) {
        redirectWithCircleNotice(
          slug,
          sent.message,
          sent.status === 'completed' ? 'success' : 'info',
        );
      }
      return;
    }
  }

  if (slug) {
    redirectWithCircleNotice(
      slug,
      autoSimulate
        ? 'Payout cash-out completed (simulated M-Pesa).'
        : 'Payout cash-out queued to M-Pesa.',
      'success',
    );
  }
}
