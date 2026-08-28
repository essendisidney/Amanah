'use server';

import { revalidatePath } from 'next/cache';
import { callRpc } from '@/lib/supabase/rpc';
import { createClient } from '@/lib/supabase/server';
import { redirectWithCircleNotice } from '../lib/circle-notice';

function revalidateTreasury(slug: string) {
  revalidatePath(`/circles/${slug}`);
  revalidatePath(`/circles/${slug}/treasury`);
  revalidatePath(`/circles/${slug}/statement`);
  revalidatePath(`/circles/${slug}/report`);
  revalidatePath(`/circles/${slug}/officer`);
}

export async function ensureTreasuryAction(formData: FormData): Promise<void> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  if (!jamiyaId || !slug) return;
  await callRpc('ensure_circle_treasury', { p_jamiya_id: jamiyaId });
  revalidateTreasury(slug);
}

export async function createBankAccountAction(formData: FormData): Promise<void> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const accountKind = String(formData.get('accountKind') ?? 'bank');
  const accountNumber = String(formData.get('accountNumber') ?? '').trim();
  const currency = String(formData.get('currency') ?? 'KES');
  if (!jamiyaId || !slug || name.length < 2) return;

  const supabase = await createClient();
  const { error } = await supabase.from('circle_bank_accounts').insert({
    jamiya_id: jamiyaId,
    name,
    account_kind: ['bank', 'mpesa', 'petty_cash', 'other'].includes(accountKind)
      ? accountKind
      : 'bank',
    account_number: accountNumber || null,
    currency,
    balance: 0,
  } as never);

  if (error) {
    redirectWithCircleNotice(slug, error.message, 'error', '/treasury');
    return;
  }
  revalidateTreasury(slug);
  redirectWithCircleNotice(slug, 'Account added.', 'success', '/treasury');
}

export async function createLedgerCategoryAction(formData: FormData): Promise<void> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const kind = String(formData.get('kind') ?? 'expense');
  const name = String(formData.get('name') ?? '').trim();
  if (!jamiyaId || !slug || name.length < 2) return;

  const supabase = await createClient();
  const { error } = await supabase.from('circle_ledger_categories').insert({
    jamiya_id: jamiyaId,
    kind: kind === 'income' ? 'income' : 'expense',
    name,
  } as never);

  if (error) {
    redirectWithCircleNotice(slug, error.message, 'error', '/treasury');
    return;
  }
  revalidateTreasury(slug);
}

export async function createFineCategoryAction(formData: FormData): Promise<void> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const amount = Number(formData.get('defaultAmount') ?? 0);
  const currency = String(formData.get('currency') ?? 'KES');
  if (!jamiyaId || !slug || name.length < 2) return;

  const supabase = await createClient();
  const { error } = await supabase.from('fine_categories').insert({
    jamiya_id: jamiyaId,
    name,
    default_amount: Number.isFinite(amount) && amount >= 0 ? amount : 0,
    currency,
  } as never);

  if (error) {
    redirectWithCircleNotice(slug, error.message, 'error', '/treasury');
    return;
  }
  revalidateTreasury(slug);
}

export async function createInvestmentAction(formData: FormData): Promise<void> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const principal = Number(formData.get('principal') ?? 0);
  const currency = String(formData.get('currency') ?? 'KES');
  const startedOn = String(formData.get('startedOn') ?? '') || null;
  if (!jamiyaId || !slug || name.length < 2) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const value = Number.isFinite(principal) && principal >= 0 ? principal : 0;
  const { error } = await supabase.from('circle_investments').insert({
    jamiya_id: jamiyaId,
    name,
    description: description || null,
    status: 'active',
    principal: value,
    current_value: value,
    currency,
    started_on: startedOn,
    created_by: user.id,
  } as never);

  if (error) {
    redirectWithCircleNotice(slug, error.message, 'error', '/treasury');
    return;
  }
  revalidateTreasury(slug);
  redirectWithCircleNotice(slug, 'Investment / project recorded.', 'success', '/treasury');
}

export async function recordTreasuryEntryAction(formData: FormData): Promise<void> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const entryType = String(formData.get('entryType') ?? '');
  const amount = Number(formData.get('amount'));
  const effectiveDate = String(formData.get('effectiveDate') ?? '');
  const bankAccountId = String(formData.get('bankAccountId') ?? '').trim() || null;
  const counterpartyAccountId =
    String(formData.get('counterpartyAccountId') ?? '').trim() || null;
  const categoryId = String(formData.get('categoryId') ?? '').trim() || null;
  const investmentId = String(formData.get('investmentId') ?? '').trim() || null;
  const memberId = String(formData.get('memberId') ?? '').trim() || null;
  const notes = String(formData.get('notes') ?? '').trim() || null;

  if (!jamiyaId || !slug || !entryType || !effectiveDate || !Number.isFinite(amount)) return;

  const { data, error } = await callRpc('record_treasury_entry', {
    p_jamiya_id: jamiyaId,
    p_entry_type: entryType,
    p_amount: amount,
    p_effective_date: effectiveDate,
    p_bank_account_id: bankAccountId,
    p_counterparty_account_id: counterpartyAccountId,
    p_category_id: categoryId,
    p_investment_id: investmentId,
    p_member_id: memberId,
    p_notes: notes,
  });

  if (error) {
    redirectWithCircleNotice(slug, error.message, 'error', '/treasury');
    return;
  }
  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    redirectWithCircleNotice(slug, result?.error ?? 'Could not record entry.', 'error', '/treasury');
    return;
  }

  revalidateTreasury(slug);
  redirectWithCircleNotice(slug, 'Cashbook entry recorded.', 'success', '/treasury');
}

export async function levyFineAction(formData: FormData): Promise<void> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const memberId = String(formData.get('memberId') ?? '');
  const fineCategoryId = String(formData.get('fineCategoryId') ?? '');
  const amountRaw = String(formData.get('amount') ?? '').trim();
  const amount = amountRaw ? Number(amountRaw) : null;
  const notes = String(formData.get('notes') ?? '').trim() || null;
  if (!jamiyaId || !slug || !memberId || !fineCategoryId) return;

  const { data, error } = await callRpc('levy_member_fine', {
    p_jamiya_id: jamiyaId,
    p_member_id: memberId,
    p_fine_category_id: fineCategoryId,
    p_amount: amount !== null && Number.isFinite(amount) ? amount : null,
    p_notes: notes,
  });

  if (error) {
    redirectWithCircleNotice(slug, error.message, 'error', '/treasury');
    return;
  }
  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    redirectWithCircleNotice(slug, result?.error ?? 'Could not levy fine.', 'error', '/treasury');
    return;
  }

  revalidateTreasury(slug);
  redirectWithCircleNotice(slug, 'Fine added to member statement.', 'success', '/treasury');
}

export async function resolveMemberPenaltyAction(formData: FormData): Promise<void> {
  const penaltyId = String(formData.get('penaltyId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const action = String(formData.get('action') ?? '').trim().toLowerCase();
  const notes = String(formData.get('notes') ?? '').trim() || null;
  const returnPath = String(formData.get('returnPath') ?? '/treasury').trim() || '/treasury';
  if (!penaltyId || !slug) return;

  if (action !== 'paid' && action !== 'waived') {
    redirectWithCircleNotice(slug, 'Choose mark paid or waive.', 'error', returnPath);
  }

  const { data, error } = await callRpc('resolve_member_penalty', {
    p_penalty_id: penaltyId,
    p_action: action,
    p_notes: notes,
  });

  if (error) {
    redirectWithCircleNotice(slug, error.message || 'Could not update fine.', 'error', returnPath);
  }

  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    const msg =
      result?.error === 'NOT_OPEN'
        ? 'That fine is no longer open.'
        : result?.error === 'FORBIDDEN'
          ? 'Only officers can resolve fines.'
          : result?.error || 'Could not update fine.';
    redirectWithCircleNotice(slug, msg, 'error', returnPath);
  }

  revalidateTreasury(slug);
  redirectWithCircleNotice(
    slug,
    action === 'paid' ? 'Fine marked paid.' : 'Fine waived.',
    'success',
    returnPath,
  );
}

export async function importBookEntriesAction(formData: FormData): Promise<void> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const csv = String(formData.get('csv') ?? '');
  if (!jamiyaId || !slug || !csv.trim()) return;

  const rows: Array<Record<string, string>> = [];
  for (const line of csv.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.toLowerCase().startsWith('entry_type')) continue;
    const parts = trimmed.split(',').map((p) => p.trim());
    if (parts.length < 3) continue;
    rows.push({
      entry_type: parts[0] ?? '',
      amount: parts[1] ?? '',
      effective_date: parts[2] ?? '',
      member_id: parts[3] ?? '',
      notes: parts.slice(4).join(','),
    });
  }

  if (!rows.length) {
    redirectWithCircleNotice(slug, 'No valid CSV rows found.', 'error', '/treasury');
    return;
  }

  const { data, error } = await callRpc('import_book_entries', {
    p_jamiya_id: jamiyaId,
    p_rows: rows,
  });

  if (error) {
    redirectWithCircleNotice(slug, error.message, 'error', '/treasury');
    return;
  }
  const result = data as { ok?: boolean; imported?: number; error?: string } | null;
  if (!result?.ok) {
    redirectWithCircleNotice(slug, result?.error ?? 'Import failed.', 'error', '/treasury');
    return;
  }

  revalidateTreasury(slug);
  redirectWithCircleNotice(
    slug,
    `Imported ${result.imported ?? 0} backdated rows.`,
    'success',
    '/treasury',
  );
}
