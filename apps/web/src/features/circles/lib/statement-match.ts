/**
 * Reading a pasted bank or M-Pesa statement and matching each money-in line to a circle member.
 *
 * Officers copy rows from the DIB / bank statement (Excel, CSV or the PDF text) or an M-Pesa
 * statement. A header row, when present, says which column is the date, the details, the money in
 * and the reference. Without one, each line is read on its own: the M-Pesa receipt code, a phone
 * number (full or masked like 0712***678), the date and the amount.
 *
 * The same reader gives money out (payouts, withdrawals, loans, charges) with direction 'out'.
 */

export type StatementDirection = 'in' | 'out';

export type StatementLine = {
  /** The line as pasted, for the officer to check. */
  raw: string;
  /** ISO date (YYYY-MM-DD) when one was found. */
  date: string | null;
  /** Money in (or out, when reading money out), in shillings. */
  amount: number | null;
  /** M-Pesa / bank reference; falls back to a fingerprint of the line so it is never recorded twice. */
  reference: string;
  /** The payer's phone as 2547XXXXXXXX, when the full number is shown. */
  phone: string | null;
  /** Last three digits of a masked phone (2547******678). */
  phoneTail: string | null;
  /** Free text: the details / narrative, used to match a name. */
  details: string;
};

export type StatementMember = {
  id: string;
  name: string;
  phone: string | null;
};

export type StatementMatch = {
  memberId: string | null;
  how: 'phone' | 'phone_tail' | 'name' | null;
};

// M-Pesa receipt codes: 10 capitals and digits with at least one of each (SKB1XY2Z3A, UJALE9VMER).
const MPESA_CODE = /\b((?=[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])[A-Z0-9]{10})\b/;
const MONTHS: Record<string, string> = {
  JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
  JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
};

function splitCells(line: string): string[] {
  if (line.includes('\t')) return line.split('\t').map((c) => c.trim());
  if (line.includes('|')) return line.split('|').map((c) => c.trim());
  // CSV: split on commas that are not inside quotes and not thousands separators (1,000.00).
  const cells: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      quoted = !quoted;
      continue;
    }
    if (ch === ',' && !quoted && !(/\d/.test(line[i - 1] ?? '') && /^\d{3}(\D|$)/.test(line.slice(i + 1)))) {
      cells.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

export function parseMoney(raw: string): number | null {
  const cleaned = raw.replace(/(KES|KSH|Ksh|Kshs|\/=)/gi, '').replace(/,/g, '').trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function parseDate(raw: string): string | null {
  const s = raw.trim().toUpperCase();
  let m = s.match(/\b(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/);
  if (m) return `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
  m = s.match(/\b(\d{1,2})[\s-]([A-Z]{3})[A-Z]*[\s-,]+(\d{2,4})\b/);
  if (m && MONTHS[m[2]!]) {
    const year = m[3]!.length === 2 ? `20${m[3]}` : m[3]!;
    return `${year}-${MONTHS[m[2]!]}-${m[1]!.padStart(2, '0')}`;
  }
  return null;
}

/** 2547XXXXXXXX from any full Kenyan mobile in the text. */
export function findPhone(text: string): string | null {
  const m = text.replace(/(\d)[\s-]+(?=\d)/g, '$1').match(/(?<!\d)(?:\+?254|0)([17]\d{8})(?!\d)/);
  return m ? `254${m[1]}` : null;
}

/** Last three digits of a masked phone such as 2547******678 or 0712***678. */
export function findPhoneTail(text: string): string | null {
  const m = text.match(/(?:254|0)[17]\d{0,3}\*{2,}(\d{3})\b/);
  return m ? m[1]! : null;
}

function fingerprint(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  return `LINE-${h.toString(36).toUpperCase()}`;
}

type Columns = { date?: number; details?: number; amountIn?: number; amountOut?: number; reference?: number };

function headerColumns(cells: string[]): Columns | null {
  const cols: Columns = {};
  cells.forEach((cell, i) => {
    const c = cell.toLowerCase();
    if (cols.date === undefined && /(^|\s)(date|completion time|value date|posting date|trans(action)? date)/.test(c)) cols.date = i;
    else if (cols.reference === undefined && /(receipt|reference|ref\.?|transaction id|cheque)/.test(c)) cols.reference = i;
    else if (cols.amountOut === undefined && /(withdrawn|paid out|debit|withdrawal|money out|dr\b)/.test(c)) cols.amountOut = i;
    else if (cols.amountIn === undefined && /(paid in|credit|deposit|money in|cr\b|amount)/.test(c)) cols.amountIn = i;
    else if (cols.details === undefined && /(details|narration|narrative|description|particulars|remarks)/.test(c)) cols.details = i;
  });
  const hasAmount = cols.amountIn !== undefined || cols.amountOut !== undefined;
  return hasAmount && (cols.details !== undefined || cols.date !== undefined) ? cols : null;
}

const MONEY2 = String.raw`-?[\d,]+\.\d{2}`;
const DMY = String.raw`\d{1,2}\/\d{1,2}\/\d{4}`;
// Bank statements copied from a PDF (DIB and most Kenyan banks): each row is
//   date · reference · description (often wrapped over several lines) · [value date] · debit · credit · balance.
// Read as one stream so wrapped descriptions stay with their row.
const BANK_ROW_WITH_VALUE_DATE = new RegExp(
  String.raw`(${DMY})\s+(.*?)\s+(${DMY})\s+(${MONEY2})\s+(${MONEY2})\s+(${MONEY2})(?=\s|$)`,
  'g',
);
const BANK_ROW = new RegExp(String.raw`(${DMY})\s+(.*?)\s+(${MONEY2})\s+(${MONEY2})\s+(${MONEY2})(?=\s|$)`, 'g');

function parseBankRows(text: string, direction: StatementDirection): StatementLine[] | null {
  const stream = text.replace(/\s+/g, ' ').trim();
  const withValue = [...stream.matchAll(BANK_ROW_WITH_VALUE_DATE)];
  const rows = withValue.length >= 2
    ? withValue.map((m) => ({ raw: m[0], body: m[2]!, date: m[3]!, debit: m[4]!, credit: m[5]! }))
    : [...stream.matchAll(BANK_ROW)].map((m) => ({ raw: m[0], body: m[2]!, date: m[1]!, debit: m[3]!, credit: m[4]! }));
  if (rows.length < 2) return null;

  const out: StatementLine[] = [];
  for (const r of rows) {
    const amount = parseMoney(direction === 'in' ? r.credit : r.debit);
    if (amount === null || amount <= 0) continue;
    const bankRef = r.body.match(/^\S*\d\S*/)?.[0] ?? null;
    const code = r.body.match(MPESA_CODE)?.[1] ?? null;
    out.push({
      raw: r.raw,
      date: parseDate(r.date),
      amount,
      // The bank's own reference is the same however the statement is copied, so it comes first.
      reference: (bankRef ?? code ?? fingerprint(r.raw)).toUpperCase(),
      phone: findPhone(r.body),
      phoneTail: findPhoneTail(r.body),
      details: r.body,
    });
  }
  return out;
}

/**
 * Money-in lines of a pasted statement (or money-out lines with direction 'out'). Lines with
 * nothing in that direction (the other direction, balances, headers) are left out.
 */
export function parseStatement(text: string, direction: StatementDirection = 'in'): StatementLine[] {
  // A spreadsheet copy (tab-separated) is read by its header; a PDF copy is read row by row.
  if (!text.includes('\t')) {
    const bank = parseBankRows(text, direction);
    if (bank) return bank;
  }
  const lines = text.replace(/\r\n/g, '\n').split('\n').map((l) => l.trim()).filter(Boolean);
  let cols: Columns | null = null;
  const out: StatementLine[] = [];

  for (const line of lines) {
    const cells = splitCells(line);
    const asHeader = headerColumns(cells);
    if (asHeader && !cells.some((c) => parseMoney(c) !== null && parseMoney(c)! > 0)) {
      cols = asHeader;
      continue;
    }

    let amount: number | null = null;
    let date: string | null = null;
    let details = line;
    let reference: string | null = null;

    if (cols) {
      const col = direction === 'in' ? cols.amountIn : cols.amountOut;
      amount = col !== undefined ? parseMoney(cells[col] ?? '') : null;
      // M-Pesa shows withdrawals as negative numbers.
      if (amount !== null && direction === 'out') amount = Math.abs(amount);
      date = cols.date !== undefined ? parseDate(cells[cols.date] ?? '') : null;
      details = cols.details !== undefined ? (cells[cols.details] ?? '') : line;
      const ref = cols.reference !== undefined ? (cells[cols.reference] ?? '').trim() : '';
      reference = ref || null;
    } else {
      // No header: drop phones, codes and dates, then take the amount after KES or the last number.
      const rest = line
        .replace(/(?:\+?254|\b0)[17](?:[\s-]?[\d*]){6,10}(?![\d*])/g, ' ')
        .replace(new RegExp(MPESA_CODE.source, 'g'), ' ')
        .replace(/\b\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?/g, ' ')
        .replace(/\b\d{1,2}[/.-](?:\d{1,2}|[A-Za-z]{3,9})[/.-]\d{2,4}\b/g, ' ')
        .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, ' ');
      const kes = rest.match(/(?:KES|KSH|Kshs|Ksh)\.?\s*([\d,]+(?:\.\d{1,2})?)/i);
      const negative = rest.match(/(?<![\w.])-(\d[\d,]*(?:\.\d{1,2})?)/);
      if (direction === 'out') {
        // Without a header only a negative amount says the money went out.
        amount = negative ? parseMoney(negative[1]!) : null;
      } else if (negative && !kes) {
        amount = null;
      } else if (kes) {
        amount = parseMoney(kes[1]!);
      } else {
        const numbers = (rest.match(/\d[\d,]*(?:\.\d{1,2})?/g) ?? [])
          .map((n) => parseMoney(n))
          .filter((n): n is number => n !== null && n > 0);
        amount = numbers.length ? numbers[numbers.length - 1]! : null;
      }
      date = parseDate(line);
    }

    if (amount === null || amount <= 0) continue;
    const code = (reference ?? '').match(MPESA_CODE)?.[1] ?? line.match(MPESA_CODE)?.[1] ?? null;
    out.push({
      raw: line,
      date,
      amount,
      reference: (code ?? reference ?? fingerprint(line)).toUpperCase(),
      phone: findPhone(details) ?? findPhone(line),
      phoneTail: findPhoneTail(details) ?? findPhoneTail(line),
      details,
    });
  }
  return out;
}

function norm(value: string): string {
  return value.toUpperCase().replace(/[^A-Z\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function digits254(phone: string | null): string | null {
  if (!phone) return null;
  return findPhone(phone);
}

/** Which member paid: by full phone, then a masked phone's last digits plus a name word, then by name. */
export function matchMember(line: StatementLine, members: StatementMember[]): StatementMatch {
  if (line.phone) {
    const hit = members.find((m) => digits254(m.phone) === line.phone);
    if (hit) return { memberId: hit.id, how: 'phone' };
  }

  const text = ` ${norm(line.details || line.raw)} `;
  const nameHits = members.filter((m) => {
    const words = norm(m.name).split(' ').filter((w) => w.length >= 3);
    if (words.length === 0) return false;
    const found = words.filter((w) => text.includes(` ${w} `)).length;
    return words.length === 1 ? found === 1 : found >= 2;
  });

  if (line.phoneTail) {
    const tailHits = members.filter((m) => digits254(m.phone)?.endsWith(line.phoneTail!));
    if (tailHits.length === 1) return { memberId: tailHits[0]!.id, how: 'phone_tail' };
    const both = tailHits.filter((m) => nameHits.includes(m));
    if (both.length === 1) return { memberId: both[0]!.id, how: 'phone_tail' };
  }

  if (nameHits.length === 1) return { memberId: nameHits[0]!.id, how: 'name' };
  return { memberId: null, how: null };
}
