'use server';

import { revalidatePath } from 'next/cache';
import { callRpc } from '@/lib/supabase/rpc';
import { createClient } from '@/lib/supabase/server';
import { redirectWithCircleNotice } from '../lib/circle-notice';

function revalidateShares(slug: string) {
  revalidatePath(`/circles/${slug}`);
  revalidatePath(`/circles/${slug}/shares`);
  revalidatePath(`/circles/${slug}/treasury`);
  revalidatePath(`/circles/${slug}/report`);
  revalidatePath(`/circles/${slug}/statement`);
  revalidatePath(`/circles/${slug}/journal`);
  revalidatePath('/wallet');
}

export async function updateShareParValueAction(formData: FormData): Promise<void> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const par = Number(formData.get('shareParValue') ?? 0);
  if (!jamiyaId || !slug || !Number.isFinite(par) || par <= 0) return;

  const supabase = await createClient();
  await supabase
    .from('jamiyas')
    .update({ share_par_value: par, updated_at: new Date().toISOString() } as never)
    .eq('id', jamiyaId);

  revalidateShares(slug);
  redirectWithCircleNotice(slug, 'Share par value updated.', 'success', '/shares');
}

export async function recordSharePurchaseAction(formData: FormData): Promise<void> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const memberId = String(formData.get('memberId') ?? '');
  const shares = Number(formData.get('shares') ?? 0);
  const unitPriceRaw = String(formData.get('unitPrice') ?? '').trim();
  const unitPrice = unitPriceRaw ? Number(unitPriceRaw) : null;
  const purchasedOn = String(formData.get('purchasedOn') ?? '') || null;
  const bankAccountId = String(formData.get('bankAccountId') ?? '').trim() || null;
  const notes = String(formData.get('notes') ?? '').trim() || null;

  if (!jamiyaId || !slug || !memberId || !Number.isFinite(shares) || shares <= 0) return;

  const { data, error } = await callRpc('record_share_purchase', {
    p_jamiya_id: jamiyaId,
    p_member_id: memberId,
    p_shares: shares,
    p_unit_price: unitPrice !== null && Number.isFinite(unitPrice) ? unitPrice : null,
    p_purchased_on: purchasedOn,
    p_bank_account_id: bankAccountId,
    p_notes: notes,
  });

  if (error) {
    redirectWithCircleNotice(slug, error.message, 'error', '/shares');
    return;
  }
  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    redirectWithCircleNotice(slug, result?.error ?? 'Could not record shares.', 'error', '/shares');
    return;
  }

  revalidateShares(slug);
  redirectWithCircleNotice(slug, 'Share purchase recorded.', 'success', '/shares');
}

export async function allocateDividendAction(formData: FormData): Promise<void> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const label = String(formData.get('label') ?? '').trim();
  const total = Number(formData.get('totalAmount') ?? 0);
  const periodStart = String(formData.get('periodStart') ?? '') || null;
  const periodEnd = String(formData.get('periodEnd') ?? '') || null;
  const notes = String(formData.get('notes') ?? '').trim() || null;

  if (!jamiyaId || !slug || !label || !Number.isFinite(total) || total <= 0) return;

  const { data, error } = await callRpc('allocate_circle_dividend', {
    p_jamiya_id: jamiyaId,
    p_label: label,
    p_total_amount: total,
    p_period_start: periodStart,
    p_period_end: periodEnd,
    p_notes: notes,
  });

  if (error) {
    redirectWithCircleNotice(slug, error.message, 'error', '/shares');
    return;
  }
  const result = data as { ok?: boolean; error?: string; allocations?: number } | null;
  if (!result?.ok) {
    const msg =
      result?.error === 'NO_SHARES'
        ? 'Record share capital before allocating dividends.'
        : (result?.error ?? 'Dividend allocation failed.');
    redirectWithCircleNotice(slug, msg, 'error', '/shares');
    return;
  }

  revalidateShares(slug);
  redirectWithCircleNotice(
    slug,
    `Dividend allocated across ${result.allocations ?? 0} members.`,
    'success',
    '/shares',
  );
}

export async function payDividendAction(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '');
  const dividendId = String(formData.get('dividendId') ?? '');
  const bankAccountId = String(formData.get('bankAccountId') ?? '');
  if (!slug || !dividendId || !bankAccountId) return;

  const { data, error } = await callRpc('pay_circle_dividend', {
    p_dividend_id: dividendId,
    p_bank_account_id: bankAccountId,
  });

  if (error) {
    redirectWithCircleNotice(slug, error.message, 'error', '/shares');
    return;
  }
  const result = data as { ok?: boolean; error?: string; paid?: number } | null;
  if (!result?.ok) {
    const msg =
      result?.error === 'INSUFFICIENT_BALANCE'
        ? 'Circle account balance is too low to pay this dividend.'
        : (result?.error ?? 'Dividend payout failed.');
    redirectWithCircleNotice(slug, msg, 'error', '/shares');
    return;
  }

  revalidateShares(slug);
  revalidatePath('/wallet');
  redirectWithCircleNotice(
    slug,
    `Paid ${result.paid ?? 0} dividend allocation(s) to member wallets.`,
    'success',
    '/shares',
  );
}

export async function matchBankAlertsAction(formData: FormData): Promise<void> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  if (!jamiyaId || !slug) return;

  const { data, error } = await callRpc('match_bank_alerts', {
    p_jamiya_id: jamiyaId,
    p_limit: 50,
  });
  if (error) {
    redirectWithCircleNotice(slug, error.message, 'error', '/treasury');
    return;
  }
  const result = data as { ok?: boolean; matched?: number; error?: string } | null;
  if (!result?.ok) {
    redirectWithCircleNotice(slug, result?.error ?? 'Auto-match failed.', 'error', '/treasury');
    return;
  }

  revalidatePath(`/circles/${slug}/treasury`);
  revalidatePath(`/circles/${slug}/journal`);
  redirectWithCircleNotice(
    slug,
    `Matched ${result.matched ?? 0} bank alert(s) to cashbook rows.`,
    'success',
    '/treasury',
  );
}

export async function setBankAlertStatusAction(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '');
  const alertId = String(formData.get('alertId') ?? '');
  const status = String(formData.get('status') ?? '');
  const bookEntryId = String(formData.get('bookEntryId') ?? '').trim() || null;
  if (!slug || !alertId || !status) return;

  const { data, error } = await callRpc('set_bank_alert_status', {
    p_alert_id: alertId,
    p_status: status,
    p_book_entry_id: bookEntryId,
  });
  if (error) {
    redirectWithCircleNotice(slug, error.message, 'error', '/treasury');
    return;
  }
  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    redirectWithCircleNotice(slug, result?.error ?? 'Could not update alert.', 'error', '/treasury');
    return;
  }

  revalidatePath(`/circles/${slug}/treasury`);
  redirectWithCircleNotice(slug, `Alert marked ${status}.`, 'success', '/treasury');
}

export async function importBankAlertAction(formData: FormData): Promise<void> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const amount = Number(formData.get('amount') ?? 0);
  const direction = String(formData.get('direction') ?? 'credit');
  const alertText = String(formData.get('alertText') ?? '').trim();
  const provider = String(formData.get('provider') ?? 'manual');
  const bankAccountId = String(formData.get('bankAccountId') ?? '').trim() || null;
  const currency = String(formData.get('currency') ?? 'KES');

  if (!jamiyaId || !slug || !Number.isFinite(amount) || amount <= 0) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase.from('circle_bank_alerts').insert({
    jamiya_id: jamiyaId,
    bank_account_id: bankAccountId,
    provider: ['manual', 'equity', 'mpesa', 'other'].includes(provider) ? provider : 'manual',
    alert_text: alertText || null,
    amount,
    currency,
    direction: direction === 'debit' ? 'debit' : 'credit',
    occurred_at: new Date().toISOString(),
    status: 'pending',
    created_by: user.id,
  } as never);

  if (error) {
    redirectWithCircleNotice(slug, error.message, 'error', '/treasury');
    return;
  }

  revalidatePath(`/circles/${slug}/treasury`);
  redirectWithCircleNotice(
    slug,
    'Bank alert saved as pending (auto-reconcile comes later).',
    'success',
    '/treasury',
  );
}
