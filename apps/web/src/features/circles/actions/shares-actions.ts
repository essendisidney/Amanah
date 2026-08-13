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
