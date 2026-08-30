import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { formatCurrency } from '@jamiya/shared';

export type StatementChallengeKind = 'rotating' | 'share_dividend' | 'savings' | string | null;

type Stmt = {
  member_code?: string | null;
  role?: string;
  status?: string;
  payout_position?: number | null;
  summary?: Record<string, unknown>;
  share_lots?: Array<Record<string, unknown>>;
  contributions?: Array<Record<string, unknown>>;
  penalties?: Array<Record<string, unknown>>;
  loans?: Array<Record<string, unknown>>;
  savings_pockets?: Array<Record<string, unknown>>;
  book_entries?: Array<Record<string, unknown>>;
};

type PdfSection = {
  title: string;
  rows: Array<Record<string, unknown>>;
  format: (row: Record<string, unknown>) => string;
  /** Skip entirely when empty (mode-specific noise). */
  omitIfEmpty?: boolean;
};

function money(amount: unknown, currency: string): string {
  const n = typeof amount === 'number' ? amount : Number(amount ?? 0);
  return formatCurrency(Number.isFinite(n) ? n : 0, currency);
}

function line(
  page: ReturnType<PDFDocument['addPage']>,
  font: Awaited<ReturnType<PDFDocument['embedFont']>>,
  text: string,
  x: number,
  y: number,
  size = 10,
) {
  page.drawText(text.slice(0, 110), {
    x,
    y,
    size,
    font,
    color: rgb(0.1, 0.12, 0.14),
  });
}

function modeMeta(kind: StatementChallengeKind): {
  label: string;
  tagline: string;
} {
  if (kind === 'share_dividend') {
    return {
      label: 'Table banking statement',
      tagline: 'Share capital · monthly books · loans',
    };
  }
  if (kind === 'savings') {
    return {
      label: 'Savings circle statement',
      tagline: 'Monthly savings · pockets · loans',
    };
  }
  return {
    label: 'Merry-go-round statement',
    tagline: 'Cycles · pot slot · contributions',
  };
}

function buildGlanceLines(
  kind: StatementChallengeKind,
  summary: Record<string, unknown>,
  stmt: Stmt,
  currency: string,
): string[] {
  const isTb = kind === 'share_dividend';
  const isSavings = kind === 'savings';

  if (isTb) {
    return [
      `Share capital: ${money(summary.share_capital, currency)}${
        Number(summary.share_units ?? 0) > 0
          ? ` (${Number(summary.share_units).toLocaleString()} units)`
          : ''
      }`,
      `Monthly books contributions: ${money(summary.book_contributions, currency)}`,
      `Contributions so far: ${money(summary.contributions_so_far, currency)}`,
      `Penalties: ${money(summary.penalties_total, currency)} · open ${money(summary.penalties_open, currency)}`,
      `Loan outstanding: ${money(summary.loan_outstanding, currency)}`,
    ];
  }

  if (isSavings) {
    return [
      `Contributions so far: ${money(summary.contributions_so_far, currency)}`,
      `Schedule paid / due: ${money(summary.schedule_contributions_paid, currency)} / ${money(summary.schedule_contributions_due, currency)}`,
      `Savings pockets: ${money(summary.savings_total, currency)}`,
      `Penalties: ${money(summary.penalties_total, currency)} · open ${money(summary.penalties_open, currency)}`,
      `Loan outstanding: ${money(summary.loan_outstanding, currency)}`,
    ];
  }

  // Merry-go-round
  const slot =
    stmt.payout_position != null ? `Payout slot: ${stmt.payout_position}` : 'Payout slot: not assigned';
  return [
    `Contributions so far: ${money(summary.contributions_so_far, currency)}`,
    `Cycles paid / open: ${summary.cycles_paid ?? 0} / ${summary.cycles_open ?? 0}`,
    `Schedule paid / due: ${money(summary.schedule_contributions_paid, currency)} / ${money(summary.schedule_contributions_due, currency)}`,
    slot,
    `Penalties: ${money(summary.penalties_total, currency)} · open ${money(summary.penalties_open, currency)}`,
    `Loan outstanding: ${money(summary.loan_outstanding, currency)}`,
  ];
}

function buildSections(
  kind: StatementChallengeKind,
  stmt: Stmt,
  currency: string,
): PdfSection[] {
  const books = stmt.book_entries ?? [];
  const bookContrib = books.filter((b) => b.entry_type === 'contribution');
  const isTb = kind === 'share_dividend';
  const isSavings = kind === 'savings';
  const isMgr = !isTb && !isSavings;

  const share: PdfSection = {
    title: 'Share capital',
    rows: stmt.share_lots ?? [],
    omitIfEmpty: isMgr || isSavings,
    format: (row) =>
      `${row.shares ?? 0} shares · ${money(row.amount, currency)} · ${row.purchased_on ?? '—'}`,
  };

  const schedule: PdfSection = {
    title: isMgr ? 'Merry-go-round cycles' : 'Schedule contributions',
    rows: stmt.contributions ?? [],
    omitIfEmpty: isTb,
    format: (row) =>
      `Cycle ${row.cycle ?? row.cycle_number ?? '—'} · paid ${money(row.amount_paid, currency)} / ${money(row.amount, currency)} · ${row.status ?? '—'} · due ${row.due_date ?? '—'}`,
  };

  const monthlyBooks: PdfSection = {
    title: isTb ? 'Monthly contributions (books)' : 'Monthly books contributions',
    rows: bookContrib,
    omitIfEmpty: isMgr,
    format: (row) =>
      `${money(row.amount, currency)} · ${row.effective_date ?? '—'} · ${row.notes ?? 'contribution'}`,
  };

  const penalties: PdfSection = {
    title: 'Fines & penalties',
    rows: stmt.penalties ?? [],
    format: (row) =>
      `${String(row.kind ?? 'fine').replaceAll('_', ' ')} · ${money(row.amount, currency)} · ${row.status ?? '—'}`,
  };

  const loans: PdfSection = {
    title: 'Loans (Qard)',
    rows: stmt.loans ?? [],
    format: (row) =>
      `${row.purpose ?? 'Loan'} · ${money(row.amount, currency)} · repaid ${money(row.amount_repaid, currency)} · ${row.status ?? '—'}`,
  };

  const pockets: PdfSection = {
    title: 'Savings pockets',
    rows: stmt.savings_pockets ?? [],
    omitIfEmpty: isMgr || isTb,
    format: (row) =>
      `${row.label ?? row.category ?? 'Pocket'} · ${money(row.balance, currency)}`,
  };

  if (isTb) {
    return [share, monthlyBooks, schedule, penalties, loans, pockets];
  }
  if (isSavings) {
    return [schedule, monthlyBooks, pockets, share, penalties, loans];
  }
  // MGR: cycles first, then fines/loans; hide empty share/books noise
  return [schedule, share, monthlyBooks, penalties, loans, pockets];
}

/** Server-rendered branded member statement PDF (layout varies by circle mode). */
export async function buildStatementPdf(opts: {
  circleName: string;
  currency: string;
  memberLabel: string;
  generatedAt: string;
  stmt: Stmt;
  challengeKind?: StatementChallengeKind;
}): Promise<Uint8Array> {
  const kind = opts.challengeKind ?? 'rotating';
  const { label, tagline } = modeMeta(kind);
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([595, 842]);
  let y = 800;

  const ensureSpace = (need = 40) => {
    if (y < need) {
      page = doc.addPage([595, 842]);
      y = 800;
    }
  };

  const summary = opts.stmt.summary ?? {};

  line(page, bold, 'Amanah', 50, y, 18);
  y -= 22;
  line(page, bold, opts.circleName, 50, y, 14);
  y -= 16;
  line(page, bold, label, 50, y, 11);
  y -= 14;
  line(page, font, tagline, 50, y, 9);
  y -= 14;
  line(page, font, `Member · ${opts.memberLabel}`, 50, y, 11);
  y -= 14;
  line(page, font, `Generated ${opts.generatedAt}`, 50, y, 9);
  y -= 24;

  line(page, bold, 'At a glance', 50, y, 12);
  y -= 16;
  for (const g of buildGlanceLines(kind, summary, opts.stmt, opts.currency)) {
    line(page, font, g, 50, y, 10);
    y -= 13;
  }
  y -= 12;

  const sections = buildSections(kind, opts.stmt, opts.currency);

  for (const section of sections) {
    if (section.omitIfEmpty && !section.rows.length) continue;
    ensureSpace(60);
    line(page, bold, section.title, 50, y, 12);
    y -= 16;
    if (!section.rows.length) {
      line(page, font, 'None recorded.', 50, y, 10);
      y -= 18;
      continue;
    }
    for (const row of section.rows.slice(0, 50)) {
      ensureSpace(28);
      line(page, font, section.format(row), 50, y, 9);
      y -= 13;
    }
    y -= 10;
  }

  ensureSpace(40);
  const footer =
    kind === 'share_dividend'
      ? 'Shariah-compliant table banking · amanah.app'
      : kind === 'savings'
        ? 'Shariah-compliant savings circle · amanah.app'
        : 'Shariah-compliant merry-go-round · amanah.app';
  line(page, font, footer, 50, y, 8);

  return doc.save();
}
