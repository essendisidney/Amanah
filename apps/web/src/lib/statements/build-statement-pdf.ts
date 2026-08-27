import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { formatCurrency } from '@jamiya/shared';

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

/** Server-rendered branded member statement PDF. */
export async function buildStatementPdf(opts: {
  circleName: string;
  currency: string;
  memberLabel: string;
  generatedAt: string;
  stmt: Stmt;
}): Promise<Uint8Array> {
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
  line(page, font, `Member statement · ${opts.memberLabel}`, 50, y, 11);
  y -= 14;
  line(page, font, `Generated ${opts.generatedAt}`, 50, y, 9);
  y -= 24;

  line(page, bold, 'At a glance', 50, y, 12);
  y -= 16;
  const glance = [
    `Share capital: ${money(summary.share_capital, opts.currency)}`,
    `Contributions so far: ${money(summary.contributions_so_far, opts.currency)}`,
    `Penalties (total): ${money(summary.penalties_total, opts.currency)} · open ${money(summary.penalties_open, opts.currency)}`,
    `Loan outstanding: ${money(summary.loan_outstanding, opts.currency)}`,
    `Savings pockets: ${money(summary.savings_total, opts.currency)}`,
  ];
  for (const g of glance) {
    line(page, font, g, 50, y, 10);
    y -= 13;
  }
  y -= 12;

  const books = opts.stmt.book_entries ?? [];
  const bookContrib = books.filter((b) => b.entry_type === 'contribution');

  const sections: Array<{
    title: string;
    rows: Array<Record<string, unknown>>;
    format: (row: Record<string, unknown>) => string;
  }> = [
    {
      title: 'Share capital',
      rows: opts.stmt.share_lots ?? [],
      format: (row) =>
        `${row.shares ?? 0} shares · ${money(row.amount, opts.currency)} · ${row.purchased_on ?? '—'}`,
    },
    {
      title: 'Schedule contributions',
      rows: opts.stmt.contributions ?? [],
      format: (row) =>
        `Cycle ${row.cycle ?? row.cycle_number ?? '—'} · paid ${money(row.amount_paid, opts.currency)} / ${money(row.amount, opts.currency)} · ${row.status ?? '—'} · due ${row.due_date ?? '—'}`,
    },
    {
      title: 'Monthly contributions (books)',
      rows: bookContrib,
      format: (row) =>
        `${money(row.amount, opts.currency)} · ${row.effective_date ?? '—'} · ${row.notes ?? 'contribution'}`,
    },
    {
      title: 'Fines & penalties',
      rows: opts.stmt.penalties ?? [],
      format: (row) =>
        `${String(row.kind ?? 'fine').replaceAll('_', ' ')} · ${money(row.amount, opts.currency)} · ${row.status ?? '—'}`,
    },
    {
      title: 'Loans (Qard)',
      rows: opts.stmt.loans ?? [],
      format: (row) =>
        `${row.purpose ?? 'Loan'} · ${money(row.amount, opts.currency)} · repaid ${money(row.amount_repaid, opts.currency)} · ${row.status ?? '—'}`,
    },
    {
      title: 'Savings pockets',
      rows: opts.stmt.savings_pockets ?? [],
      format: (row) =>
        `${row.label ?? row.category ?? 'Pocket'} · ${money(row.balance, opts.currency)}`,
    },
  ];

  for (const section of sections) {
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
  line(page, font, 'Shariah-compliant rotating savings · amanah.app', 50, y, 8);

  return doc.save();
}
