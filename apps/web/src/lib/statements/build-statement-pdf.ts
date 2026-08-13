import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { formatCurrency } from '@jamiya/shared';

type Stmt = {
  member_code?: string | null;
  role?: string;
  status?: string;
  contributions?: Array<Record<string, unknown>>;
  penalties?: Array<Record<string, unknown>>;
  loans?: Array<Record<string, unknown>>;
  savings_pockets?: Array<Record<string, unknown>>;
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

  line(page, bold, 'Amanah', 50, y, 18);
  y -= 22;
  line(page, bold, opts.circleName, 50, y, 14);
  y -= 16;
  line(page, font, `Member statement · ${opts.memberLabel}`, 50, y, 11);
  y -= 14;
  line(page, font, `Generated ${opts.generatedAt}`, 50, y, 9);
  y -= 24;

  const loans = opts.stmt.loans ?? [];
  const pockets = opts.stmt.savings_pockets ?? [];
  const loanTotal = loans.reduce((s, r) => s + Number(r.amount ?? r.principal ?? 0), 0);
  const savingsTotal = pockets.reduce((s, r) => s + Number(r.balance ?? 0), 0);

  line(page, bold, `Loan book: ${money(loanTotal, opts.currency)}`, 50, y, 11);
  y -= 14;
  line(page, bold, `Savings book: ${money(savingsTotal, opts.currency)}`, 50, y, 11);
  y -= 22;

  const sections: Array<{ title: string; rows: Array<Record<string, unknown>>; cols: string[] }> = [
    {
      title: 'Contributions',
      rows: opts.stmt.contributions ?? [],
      cols: ['cycle_number', 'amount', 'status', 'due_date'],
    },
    {
      title: 'Penalties',
      rows: opts.stmt.penalties ?? [],
      cols: ['amount', 'status', 'kind'],
    },
    {
      title: 'Loans (Qard)',
      rows: loans,
      cols: ['amount', 'status', 'purpose'],
    },
    {
      title: 'Savings pockets',
      rows: pockets,
      cols: ['name', 'balance', 'status'],
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
    for (const row of section.rows.slice(0, 40)) {
      ensureSpace(28);
      const parts = section.cols.map((c) => {
        const v = row[c];
        if (c === 'amount' || c === 'balance') return money(v, opts.currency);
        return String(v ?? '—');
      });
      line(page, font, parts.join(' · '), 50, y, 9);
      y -= 13;
    }
    y -= 10;
  }

  ensureSpace(40);
  line(page, font, 'Shariah-compliant rotating savings · amanah.app', 50, y, 8);

  return doc.save();
}
