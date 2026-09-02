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

  const { parseBankSms } = await import('@/lib/bank-sms-parse');
  const { normalizeBankProvider } = await import('../lib/split-bank-sms');
  const parsed = alertText ? parseBankSms(alertText) : null;

  const { data, error } = await callRpc('ingest_bank_alert', {
    p_jamiya_id: jamiyaId,
    p_provider: normalizeBankProvider(provider || parsed?.provider || 'manual'),
    p_alert_text: alertText || null,
    p_amount: amount || parsed?.amount || null,
    p_direction: direction === 'debit' ? 'debit' : 'credit',
    p_currency: currency || parsed?.currency || 'KES',
    p_external_ref: parsed?.externalRef ?? null,
    p_bank_account_id: bankAccountId,
    p_occurred_at: new Date().toISOString(),
  });

  if (error) {
    redirectWithCircleNotice(slug, error.message, 'error', '/treasury');
    return;
  }
  const result = data as { ok?: boolean; error?: string; duplicate?: boolean } | null;
  if (!result?.ok) {
    redirectWithCircleNotice(slug, result?.error ?? 'Could not save alert.', 'error', '/treasury');
    return;
  }

  revalidatePath(`/circles/${slug}/treasury`);
  redirectWithCircleNotice(
    slug,
    result.duplicate
      ? 'Alert already queued (same reference).'
      : 'Bank alert queued. Run auto-match when ready.',
    'success',
    '/treasury',
  );
}

/** Officers paste one or many Kenya bank / M-Pesa SMS bodies; parse + ingest with dedupe. */
export async function bulkImportBankSmsAction(
  formData: FormData,
): Promise<{ success: boolean; message: string }> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const paste = String(formData.get('smsPaste') ?? '');
  const bankAccountId = String(formData.get('bankAccountId') ?? '').trim() || null;
  const currency = String(formData.get('currency') ?? 'KES');

  if (!jamiyaId || !slug) {
    return { success: false, message: 'Missing circle.' };
  }

  const { splitAndParseBankSms, normalizeBankProvider } = await import('../lib/split-bank-sms');
  const chunks = splitAndParseBankSms(paste);
  if (!chunks.length) {
    return { success: false, message: 'Paste at least one SMS message.' };
  }
  if (chunks.length > 50) {
    return { success: false, message: 'Paste at most 50 SMS messages at a time.' };
  }

  let saved = 0;
  let duplicates = 0;
  let skipped = 0;

  for (const chunk of chunks) {
    if (chunk.parsed.amount == null || chunk.parsed.amount <= 0) {
      skipped += 1;
      continue;
    }
    const { data, error } = await callRpc('ingest_bank_alert', {
      p_jamiya_id: jamiyaId,
      p_provider: normalizeBankProvider(chunk.parsed.provider),
      p_alert_text: chunk.text,
      p_amount: chunk.parsed.amount,
      p_direction: chunk.parsed.direction,
      p_currency: chunk.parsed.currency || currency,
      p_external_ref: chunk.parsed.externalRef,
      p_bank_account_id: bankAccountId,
      p_occurred_at: new Date().toISOString(),
    });
    if (error) {
      skipped += 1;
      continue;
    }
    const result = data as { ok?: boolean; duplicate?: boolean } | null;
    if (!result?.ok) {
      skipped += 1;
      continue;
    }
    if (result.duplicate) duplicates += 1;
    else saved += 1;
  }

  revalidatePath(`/circles/${slug}/treasury`);
  revalidatePath(`/circles/${slug}/journal`);

  if (!saved && !duplicates) {
    return {
      success: false,
      message:
        skipped > 0
          ? `No alerts saved. ${skipped} message(s) missing a clear amount.`
          : 'Nothing to save.',
    };
  }

  const parts = [
    saved > 0 ? `Queued ${saved}` : null,
    duplicates > 0 ? `${duplicates} duplicate(s) skipped` : null,
    skipped > 0 ? `${skipped} without amount skipped` : null,
  ].filter(Boolean);
  return { success: true, message: `${parts.join(' · ')}. Run auto-match when ready.` };
}
