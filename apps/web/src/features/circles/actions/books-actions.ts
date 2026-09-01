'use server';

import { revalidatePath } from 'next/cache';
import { callRpc } from '@/lib/supabase/rpc';
import { createClient } from '@/lib/supabase/server';
import { BOOKS_MEMBER_STATUSES } from '../lib/books-members';
import { redirectWithCircleNotice } from '../lib/circle-notice';
import type { GridSaveResult } from '../lib/action-state';

function booksPath(memberId: string, view: 'member' | 'grid' | 'import' = 'member') {
  const params = new URLSearchParams({ view, memberId });
  return `/books?${params.toString()}`;
}

function revalidateBooks(slug: string) {
  revalidatePath(`/circles/${slug}`);
  revalidatePath(`/circles/${slug}/books`);
  revalidatePath(`/circles/${slug}/statement`);
  revalidatePath(`/circles/${slug}/treasury`);
  revalidatePath(`/circles/${slug}/shares`);
  revalidatePath(`/circles/${slug}/report`);
}

async function importRows(
  jamiyaId: string,
  rows: Array<Record<string, string>>,
): Promise<{ ok: boolean; imported?: number; error?: string }> {
  const { data, error } = await callRpc('import_book_entries', {
    p_jamiya_id: jamiyaId,
    p_rows: rows,
  });
  if (error) return { ok: false, error: error.message };
  return (data as { ok?: boolean; imported?: number; error?: string } | null) ?? {
    ok: false,
    error: 'Import failed.',
  };
}

/** Record one past cashbook row for a member (savings / loan / repayment). */
export async function recordMemberBookEntryAction(formData: FormData): Promise<void> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const memberId = String(formData.get('memberId') ?? '');
  const entryType = String(formData.get('entryType') ?? '');
  const amount = Number(formData.get('amount'));
  const effectiveDate = String(formData.get('effectiveDate') ?? '');
  const notes = String(formData.get('notes') ?? '').trim();

  const allowed = new Set(['contribution', 'loan', 'loan_repayment']);
  if (
    !jamiyaId ||
    !slug ||
    !memberId ||
    !allowed.has(entryType) ||
    !effectiveDate ||
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    return;
  }

  const result = await importRows(jamiyaId, [
    {
      entry_type: entryType,
      amount: String(amount),
      effective_date: effectiveDate,
      member_id: memberId,
      notes: notes || entryType.replaceAll('_', ' '),
    },
  ]);

  if (!result.ok) {
    redirectWithCircleNotice(
      slug,
      result.error ?? 'Could not record entry.',
      'error',
      booksPath(memberId),
    );
  }

  revalidateBooks(slug);
  const label =
    entryType === 'contribution'
      ? 'Savings recorded.'
      : entryType === 'loan'
        ? 'Loan recorded.'
        : 'Loan repayment recorded.';
  redirectWithCircleNotice(slug, label, 'success', booksPath(memberId));
}

/** Backfill monthly savings in one go (e.g. Feb–Aug × 2000). */
export async function recordMonthlySavingsAction(formData: FormData): Promise<void> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const memberId = String(formData.get('memberId') ?? '');
  const amount = Number(formData.get('amount'));
  const startDate = String(formData.get('startDate') ?? '');
  const months = Number(formData.get('months') ?? 0);
  const notes = String(formData.get('notes') ?? '').trim() || 'Monthly savings';

  if (
    !jamiyaId ||
    !slug ||
    !memberId ||
    !startDate ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !Number.isFinite(months) ||
    months < 1 ||
    months > 36
  ) {
    return;
  }

  const start = new Date(`${startDate}T12:00:00`);
  if (Number.isNaN(start.getTime())) {
    redirectWithCircleNotice(slug, 'Invalid start date.', 'error', booksPath(memberId));
  }

  const rows: Array<Record<string, string>> = [];
  for (let i = 0; i < months; i += 1) {
    const d = new Date(start);
    d.setMonth(d.getMonth() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const monthLabel = d.toLocaleString('en-GB', { month: 'short', year: 'numeric' });
    rows.push({
      entry_type: 'contribution',
      amount: String(amount),
      effective_date: `${yyyy}-${mm}-${dd}`,
      member_id: memberId,
      notes: `${notes} · ${monthLabel}`,
    });
  }

  const result = await importRows(jamiyaId, rows);
  if (!result.ok) {
    redirectWithCircleNotice(
      slug,
      result.error ?? 'Could not record monthly savings.',
      'error',
      booksPath(memberId),
    );
  }

  revalidateBooks(slug);
  redirectWithCircleNotice(
    slug,
    `Recorded ${result.imported ?? rows.length} monthly savings entries.`,
    'success',
    booksPath(memberId),
  );
}

/** Share capital from the member books hub (amount or share count). */
export async function recordMemberSharesAction(formData: FormData): Promise<void> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const memberId = String(formData.get('memberId') ?? '');
  const purchasedOn = String(formData.get('purchasedOn') ?? '') || null;
  const notes = String(formData.get('notes') ?? '').trim() || null;
  const parValue = Number(formData.get('parValue') ?? 0);
  const amountRaw = String(formData.get('amount') ?? '').trim();
  const sharesRaw = String(formData.get('shares') ?? '').trim();

  let shares = sharesRaw ? Number(sharesRaw) : NaN;
  if ((!Number.isFinite(shares) || shares <= 0) && amountRaw && Number.isFinite(parValue) && parValue > 0) {
    const amount = Number(amountRaw);
    if (Number.isFinite(amount) && amount > 0) {
      shares = amount / parValue;
    }
  }

  if (!jamiyaId || !slug || !memberId || !Number.isFinite(shares) || shares <= 0) {
    redirectWithCircleNotice(
      slug,
      'Enter shares or an amount with a valid share par value.',
      'error',
      memberId ? booksPath(memberId) : '/books',
    );
  }

  const unitPrice =
    amountRaw && Number.isFinite(Number(amountRaw)) && Number(amountRaw) > 0
      ? Number(amountRaw) / shares
      : Number.isFinite(parValue) && parValue > 0
        ? parValue
        : null;

  const { data, error } = await callRpc('record_share_purchase', {
    p_jamiya_id: jamiyaId,
    p_member_id: memberId,
    p_shares: shares,
    p_unit_price: unitPrice,
    p_purchased_on: purchasedOn,
    p_bank_account_id: null,
    p_notes: notes ?? 'Share capital',
  });

  if (error) {
    redirectWithCircleNotice(slug, error.message, 'error', booksPath(memberId));
  }
  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    redirectWithCircleNotice(
      slug,
      result?.error ?? 'Could not record shares.',
      'error',
      booksPath(memberId),
    );
  }

  revalidateBooks(slug);
  redirectWithCircleNotice(slug, 'Share capital recorded.', 'success', booksPath(memberId));
}

function normalizeName(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Sheet nicknames → normalized tokens for fuzzy member match. */
function sheetNameAliases(rawName: string): string[] {
  const base = normalizeName(rawName);
  const aliases = new Set<string>([base]);
  if (/^JULLIET$/i.test(rawName.trim()) || base === 'JULLIET') aliases.add('JULIET');
  if (/^JULIET$/i.test(rawName.trim())) aliases.add('JULLIET');
  if (/ASHA\s*-?\s*RAALI/i.test(rawName) || base.includes('ASHA RAALI')) {
    aliases.add('AISHUNI');
    aliases.add('ASHA RASHID');
  }
  if (base.startsWith('KHADIJA ALADINA')) aliases.add('KHADIJA ALADINA');
  if (base.startsWith('KHADIJA SULEIMAN')) aliases.add('KHADIJA SULEIMAN');
  return [...aliases];
}

function isClosedCell(raw: string): boolean {
  return /^CLOSED$/i.test(raw.trim());
}

function parseMoney(raw: string): number | null {
  const cleaned = raw.replace(/,/g, '').replace(/[^\d.-]/g, '').trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function monthHeaderToDate(header: string, year: number): string | null {
  const h = header.toUpperCase().replace(/\./g, '').trim();
  const months: Array<[RegExp, number]> = [
    [/JAN/, 1],
    [/FEB/, 2],
    [/MAR/, 3],
    [/APR/, 4],
    [/MAY/, 5],
    [/JUN/, 6],
    [/JUL/, 7],
    [/AUG/, 8],
    [/SEP/, 9],
    [/OCT/, 10],
    [/NOV/, 11],
    [/DEC/, 12],
  ];
  for (const [re, month] of months) {
    if (re.test(h)) {
      const dayMatch = h.match(/(\d{1,2})(ST|ND|RD|TH)?/);
      const day = dayMatch ? Number(dayMatch[1]) : 5;
      const yyyy = year;
      const mm = String(month).padStart(2, '0');
      const dd = String(Number.isFinite(day) && day >= 1 && day <= 28 ? day : 5).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
  }
  const iso = h.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

function splitRow(line: string): string[] {
  if (line.includes('\t')) return line.split('\t').map((c) => c.trim());
  if (line.includes('|')) return line.split('|').map((c) => c.trim());
  // CSV with possible commas inside numbers like 5,000.00 — split on 2+ spaces or comma outside digits is hard;
  // prefer comma split then rejoin amount fragments by detecting pure name vs money.
  return line.split(',').map((c) => c.trim());
}

function matchMemberId(
  rawName: string,
  members: Array<{ id: string; label: string; norm: string }>,
): string | null {
  const targets = sheetNameAliases(rawName);
  for (const target of targets) {
    if (!target) continue;
    const exact = members.find((m) => m.norm === target);
    if (exact) return exact.id;
    const contains = members.filter(
      (m) => m.norm.includes(target) || target.includes(m.norm),
    );
    if (contains.length === 1) return contains[0]!.id;
    const first = target.split(' ')[0] ?? '';
    if (first.length >= 4) {
      const byFirst = members.filter(
        (m) => m.norm.startsWith(first) || m.norm.includes(` ${first} `),
      );
      if (byFirst.length === 1) return byFirst[0]!.id;
    }
  }
  return null;
}

/** Asha's Excel uses a 2-row header: NAME/SHARES on row 1, ONE OFF / 5TH FEB on row 2. */
function parseContributionHeaders(
  lines: string[],
  year: number,
): {
  nameIdx: number;
  sharesIdx: number;
  monthCols: Array<{ i: number; date: string }>;
  dataStart: number;
} | null {
  let headerIdx = lines.findIndex((l) => /NAME/i.test(l) && /SHARE/i.test(l));
  if (headerIdx < 0) headerIdx = lines.findIndex((l) => /NAME/i.test(l));
  if (headerIdx < 0) return null;

  const row1 = splitRow(lines[headerIdx]!);
  const row2 =
    headerIdx + 1 < lines.length && /ONE OFF|5TH/i.test(lines[headerIdx + 1] ?? '')
      ? splitRow(lines[headerIdx + 1]!)
      : null;

  const nameIdx = row1.findIndex((h) => /^NAME$/i.test(h.trim()) || /NAME/i.test(h));
  if (nameIdx < 0) return null;

  let sharesIdx = row1.findIndex((h) => /SHARE/i.test(h));
  if (sharesIdx < 0 && row2) {
    sharesIdx = row2.findIndex((h) => /ONE OFF/i.test(h));
  }
  if (sharesIdx < 0) sharesIdx = nameIdx + 1;

  const monthSource = row2 ?? row1;
  const monthCols = monthSource
    .map((h, i) => ({ i, date: monthHeaderToDate(h, year) }))
    .filter((c): c is { i: number; date: string } => Boolean(c.date));

  return {
    nameIdx,
    sharesIdx,
    monthCols,
    dataStart: row2 ? headerIdx + 2 : headerIdx + 1,
  };
}

/**
 * Paste Asha's TB contribution table + optional loans block.
 * Members must already exist (matched by name).
 */
export async function importTbSheetAction(formData: FormData): Promise<void> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const year = Number(formData.get('year') ?? 2026);
  const contribPaste = String(formData.get('contributionsPaste') ?? '');
  const loansPaste = String(formData.get('loansPaste') ?? '');
  const parValue = Number(formData.get('parValue') ?? 100);

  if (!jamiyaId || !slug) return;
  if (!contribPaste.trim() && !loansPaste.trim()) {
    redirectWithCircleNotice(slug, 'Paste the contribution table and/or loans first.', 'error', '/books?view=import');
  }

  const supabase = await createClient();
  const { data: memberRows } = await supabase
    .from('members')
    .select('id, user_id, status')
    .eq('jamiya_id', jamiyaId)
    .in('status', [...BOOKS_MEMBER_STATUSES]);

  const membersRaw = (memberRows ?? []) as Array<{
    id: string;
    user_id: string;
    status: string;
  }>;
  const userIds = membersRaw.map((m) => m.user_id);
  const { data: profiles } = userIds.length
    ? await supabase.from('profiles').select('id, full_name, email, phone').in('id', userIds)
    : { data: [] };

  const profileById = new Map(
    ((profiles ?? []) as Array<{
      id: string;
      full_name: string | null;
      email: string | null;
      phone: string | null;
    }>).map((p) => [p.id, p]),
  );

  const members = membersRaw.map((m) => {
    const p = profileById.get(m.user_id);
    const label = p?.full_name || p?.email || p?.phone || m.id.slice(0, 8);
    return { id: m.id, label, norm: normalizeName(label) };
  });

  let sharesDone = 0;
  const contribRows: Array<Record<string, string>> = [];
  const unmatched: string[] = [];

  const contribLines = contribPaste
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  if (contribLines.length) {
    const parsed = parseContributionHeaders(contribLines, year);
    if (!parsed) {
      redirectWithCircleNotice(
        slug,
        'Contribution paste needs a header row with NAME and SHARES (copy rows 1–2 from AMANAH TEST).',
        'error',
        '/books?view=import',
      );
    }

    const { nameIdx, sharesIdx, monthCols, dataStart } = parsed!;

    for (const line of contribLines.slice(dataStart)) {
      if (/^FEB\s+LOANS|^MARCH\s+LOANS|^APRIL\s+LOANS|^MAY\s+LOANS|^LOANS/i.test(line)) break;
      const cells = splitRow(line);
      const name = cells[nameIdx] ?? '';
      if (!name || /NEXT OF KIN/i.test(name)) continue;

      const memberId = matchMemberId(name, members);
      if (!memberId) {
        unmatched.push(name);
        continue;
      }

      if (sharesIdx >= 0) {
        const shareAmt = parseMoney(cells[sharesIdx] ?? '');
        if (shareAmt && Number.isFinite(parValue) && parValue > 0) {
          const shares = shareAmt / parValue;
          const { data } = await callRpc('record_share_purchase', {
            p_jamiya_id: jamiyaId,
            p_member_id: memberId,
            p_shares: shares,
            p_unit_price: parValue,
            p_purchased_on: `${year}-02-05`,
            p_bank_account_id: null,
            p_notes: 'Shares one off (sheet import)',
          });
          const ok = (data as { ok?: boolean } | null)?.ok;
          if (ok) sharesDone += 1;
        }
      }

      for (const col of monthCols) {
        const raw = cells[col.i] ?? '';
        if (isClosedCell(raw)) continue;
        const amt = parseMoney(raw);
        if (!amt) continue;
        contribRows.push({
          entry_type: 'contribution',
          amount: String(amt),
          effective_date: col.date,
          member_id: memberId,
          notes: `Monthly contribution · sheet import`,
        });
      }
    }
  }

  // Loans paste: DATE | NAME | AMOUNT | NOTES
  const loanRows: Array<Record<string, string>> = [];
  const repayRows: Array<Record<string, string>> = [];
  for (const line of loansPaste
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && !/LOANS/i.test(l))) {
    const cells = splitRow(line);
    if (cells.length < 3) continue;
    const dateRaw = cells[0] ?? '';
    let name = cells[1] ?? '';
    const amountRaw = cells[2] ?? '';
    const notes = cells.slice(3).join(' ').trim();

    // Allow "5TH FEB | NAME | 16000" or "NAME | 5TH FEB | 16000"
    let date = monthHeaderToDate(dateRaw, year);
    if (!date && monthHeaderToDate(name, year)) {
      date = monthHeaderToDate(name, year);
      name = dateRaw;
    }
    if (!date) {
      date = monthHeaderToDate(dateRaw.replace(/\s+/g, ' '), year);
    }
    const amount = parseMoney(amountRaw);
    if (!date || !amount || !name) continue;

    const memberId = matchMemberId(name, members);
    if (!memberId) {
      unmatched.push(name);
      continue;
    }

    loanRows.push({
      entry_type: 'loan',
      amount: String(amount),
      effective_date: date,
      member_id: memberId,
      notes: notes || 'Loan (sheet import)',
    });

    const paidFully = notes.match(/PAID\s+FULLY\s+([\d,.]+)/i);
    if (paidFully?.[1]) {
      const repaid = parseMoney(paidFully[1]);
      if (repaid) {
        repayRows.push({
          entry_type: 'loan_repayment',
          amount: String(repaid),
          effective_date: date,
          member_id: memberId,
          notes: 'Paid fully (sheet import)',
        });
      }
    }
  }

  const bookRows = [...contribRows, ...loanRows, ...repayRows];
  let imported = 0;
  if (bookRows.length) {
    const result = await importRows(jamiyaId, bookRows);
    if (!result.ok) {
      redirectWithCircleNotice(
        slug,
        result.error ?? 'Sheet import failed while saving book rows.',
        'error',
        '/books?view=grid',
      );
    }
    imported = result.imported ?? bookRows.length;
  }

  revalidateBooks(slug);
  const miss =
    unmatched.length > 0
      ? ` Unmatched (add on Members first): ${[...new Set(unmatched)].join(', ')}.`
      : '';
  const worked = sharesDone > 0 || imported > 0;
  redirectWithCircleNotice(
    slug,
    worked
      ? `Imported: ${sharesDone} share lots, ${imported} book rows.${miss}`
      : `Nothing imported.${miss || ' Check names match Members and paste includes a NAME header.'}`,
    worked && unmatched.length === 0 ? 'success' : worked ? 'success' : 'error',
    worked ? '/books' : '/books?view=import',
  );
}

export type TbImportPreview = {
  ok: boolean;
  matched: Array<{ sheetName: string; memberLabel: string }>;
  unmatched: string[];
  error?: string;
};

async function loadBooksMemberMatchers(jamiyaId: string) {
  const supabase = await createClient();
  const { data: memberRows } = await supabase
    .from('members')
    .select('id, user_id, status')
    .eq('jamiya_id', jamiyaId)
    .in('status', [...BOOKS_MEMBER_STATUSES]);

  const membersRaw = (memberRows ?? []) as Array<{
    id: string;
    user_id: string;
    status: string;
  }>;
  const userIds = membersRaw.map((m) => m.user_id);
  const { data: profiles } = userIds.length
    ? await supabase.from('profiles').select('id, full_name, email, phone').in('id', userIds)
    : { data: [] };

  const profileById = new Map(
    ((profiles ?? []) as Array<{
      id: string;
      full_name: string | null;
      email: string | null;
      phone: string | null;
    }>).map((p) => [p.id, p]),
  );

  return membersRaw.map((m) => {
    const p = profileById.get(m.user_id);
    const label = p?.full_name || p?.email || p?.phone || m.id.slice(0, 8);
    return { id: m.id, label, norm: normalizeName(label) };
  });
}

/** Dry-run TB sheet paste: show which names match members before import. */
export async function previewTbSheetImportAction(
  formData: FormData,
): Promise<TbImportPreview> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const contribPaste = String(formData.get('contributionsPaste') ?? '');
  const loansPaste = String(formData.get('loansPaste') ?? '');
  const year = Number(formData.get('year') ?? 2026);

  if (!jamiyaId) {
    return { ok: false, matched: [], unmatched: [], error: 'Missing circle.' };
  }
  if (!contribPaste.trim() && !loansPaste.trim()) {
    return { ok: false, matched: [], unmatched: [], error: 'Paste contributions and/or loans first.' };
  }

  const members = await loadBooksMemberMatchers(jamiyaId);
  const sheetNames = new Set<string>();

  const contribLines = contribPaste
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  if (contribLines.length) {
    const parsed = parseContributionHeaders(contribLines, year);
    if (!parsed) {
      return {
        ok: false,
        matched: [],
        unmatched: [],
        error: 'Contribution paste needs a header row with NAME and SHARES.',
      };
    }
    const { nameIdx, dataStart } = parsed;
    for (const line of contribLines.slice(dataStart)) {
      if (/^FEB\s+LOANS|^MARCH\s+LOANS|^APRIL\s+LOANS|^MAY\s+LOANS|^LOANS/i.test(line)) break;
      const cells = splitRow(line);
      const name = cells[nameIdx] ?? '';
      if (!name || /NEXT OF KIN/i.test(name)) continue;
      sheetNames.add(name.trim());
    }
  }

  for (const line of loansPaste
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && !/LOANS/i.test(l))) {
    const cells = splitRow(line);
    if (cells.length < 3) continue;
    let name = cells[1] ?? '';
    if (monthHeaderToDate(name, year) && !monthHeaderToDate(cells[0] ?? '', year)) {
      name = cells[0] ?? '';
    }
    if (name.trim()) sheetNames.add(name.trim());
  }

  const matched: TbImportPreview['matched'] = [];
  const unmatched: string[] = [];

  for (const sheetName of sheetNames) {
    const memberId = matchMemberId(sheetName, members);
    if (memberId) {
      const member = members.find((m) => m.id === memberId);
      matched.push({ sheetName, memberLabel: member?.label ?? sheetName });
    } else {
      unmatched.push(sheetName);
    }
  }

  return { ok: true, matched, unmatched };
}

type MonthGridCell = {
  member_id: string;
  year: number;
  month: number;
  amount: number;
};

type ShareGridCell = {
  member_id: string;
  amount: number;
  purchased_on: string;
};

/**
 * Save Member books grid: share capital column + monthly savings cells.
 * Payload JSON in form fields `monthRows` and `shareRows`.
 */
export async function saveMonthlyPaymentsGridAction(
  formData: FormData,
): Promise<GridSaveResult> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const monthRaw = String(formData.get('monthRows') ?? '[]');
  const shareRaw = String(formData.get('shareRows') ?? '[]');

  if (!jamiyaId || !slug) {
    return { success: false, message: 'Missing circle.' };
  }

  let monthRows: MonthGridCell[] = [];
  let shareRows: ShareGridCell[] = [];
  try {
    monthRows = JSON.parse(monthRaw) as MonthGridCell[];
    shareRows = JSON.parse(shareRaw) as ShareGridCell[];
  } catch {
    return { success: false, message: 'Could not read grid changes.' };
  }

  if (!Array.isArray(monthRows)) monthRows = [];
  if (!Array.isArray(shareRows)) shareRows = [];

  const safeMonths = monthRows
    .filter(
      (r) =>
        r &&
        typeof r.member_id === 'string' &&
        Number.isFinite(r.year) &&
        Number.isFinite(r.month) &&
        Number.isFinite(r.amount) &&
        r.amount >= 0,
    )
    .map((r) => ({
      member_id: r.member_id,
      year: String(r.year),
      month: String(r.month),
      amount: String(r.amount),
    }));

  const safeShares = shareRows
    .filter(
      (r) =>
        r &&
        typeof r.member_id === 'string' &&
        Number.isFinite(r.amount) &&
        r.amount >= 0 &&
        typeof r.purchased_on === 'string' &&
        r.purchased_on.length >= 8,
    )
    .map((r) => ({
      member_id: r.member_id,
      amount: String(r.amount),
      purchased_on: r.purchased_on,
    }));

  if (safeMonths.length === 0 && safeShares.length === 0) {
    return { success: false, message: 'No changes to save.' };
  }

  let shareUpdated = 0;
  let monthUpdated = 0;

  if (safeShares.length > 0) {
    const { data, error } = await callRpc('upsert_member_share_capital', {
      p_jamiya_id: jamiyaId,
      p_rows: safeShares,
    });
    if (error) {
      return { success: false, message: error.message };
    }
    const result = data as { ok?: boolean; error?: string; updated?: number } | null;
    if (!result?.ok) {
      return {
        success: false,
        message: result?.error ?? 'Could not save share capital.',
      };
    }
    shareUpdated = result.updated ?? safeShares.length;
  }

  if (safeMonths.length > 0) {
    const { data, error } = await callRpc('upsert_member_month_savings', {
      p_jamiya_id: jamiyaId,
      p_rows: safeMonths,
    });
    if (error) {
      return { success: false, message: error.message };
    }
    const result = data as { ok?: boolean; error?: string; updated?: number } | null;
    if (!result?.ok) {
      return {
        success: false,
        message: result?.error ?? 'Could not save monthly payments.',
      };
    }
    monthUpdated = result.updated ?? safeMonths.length;
  }

  revalidateBooks(slug);
  return {
    success: true,
    message: `Saved: ${shareUpdated} share capital, ${monthUpdated} monthly payments.`,
  };
}

/** Void a mistaken book entry, share lot, or loan ledger event. */
export async function voidLedgerLineAction(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '');
  const memberId = String(formData.get('memberId') ?? '');
  const kind = String(formData.get('kind') ?? '').trim().toLowerCase();
  const id = String(formData.get('id') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim() || null;

  if (
    !slug ||
    !id ||
    !['book_entry', 'share_lot', 'loan_event', 'contribution'].includes(kind)
  ) {
    return;
  }

  const customReturn = String(formData.get('returnPath') ?? '').trim();
  const returnPath =
    customReturn ||
    (kind === 'contribution' ? '' : memberId ? booksPath(memberId) : '/books');

  const { data, error } = await callRpc('officer_void_ledger_line', {
    p_kind: kind,
    p_id: id,
    p_reason: reason,
  });

  if (error) {
    redirectWithCircleNotice(slug, error.message || 'Could not void line.', 'error', returnPath);
  }

  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    const msg =
      result?.error === 'FORBIDDEN'
        ? 'Only officers can void ledger lines.'
        : result?.error === 'NOT_FOUND'
          ? 'That line was already removed.'
          : result?.error || 'Could not void line.';
    redirectWithCircleNotice(slug, msg, 'error', returnPath);
  }

  revalidateBooks(slug);
  redirectWithCircleNotice(slug, 'Line voided.', 'success', returnPath);
}
