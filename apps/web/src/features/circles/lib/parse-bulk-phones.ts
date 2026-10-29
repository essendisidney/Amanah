import { isValidKeMobile, toE164Kenya } from '@jamiya/shared';

export type BulkPhoneRow = {
  raw: string;
  phone: string | null;
  fullName: string | null;
};

const MAX_ROWS = 100;

/**
 * Parse pasted phone lists.
 * Accepts one per line, Name + phone separated by comma / pipe, or rows copied from Excel
 * (tab-separated, any column order, header rows skipped).
 * Also accepts comma-separated phones on a single line (no names).
 */
export function parseBulkPhoneLines(text: string): BulkPhoneRow[] {
  const trimmed = text.replace(/\r\n/g, '\n').trim();
  if (!trimmed) return [];

  const lines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean);
  const rows: BulkPhoneRow[] = [];

  for (const line of lines) {
    if (rows.length >= MAX_ROWS) break;

    // A row copied from Excel: tab-separated cells such as "1 | Asha Rashid | 0721… | Treasurer".
    if (line.includes('\t')) {
      const cells = line.split('\t').map((c) => c.trim()).filter(Boolean);
      const phoneCell = cells.find((c) => toE164Kenya(c));
      if (!phoneCell) {
        // Header rows ("No. | Name | Phone") and blank sheet rows carry no number: skip them.
        continue;
      }
      const nameCell = cells.find((c) => c !== phoneCell && /[A-Za-z]{2}/.test(c));
      rows.push({ raw: line, phone: toE164Kenya(phoneCell), fullName: nameCell ?? null });
      continue;
    }

    // Name, phone | Name | phone
    const named = line.match(/^(.+?)[,|\t]\s*(.+)$/);
    if (named) {
      const left = named[1]!.trim();
      const right = named[2]!.trim();
      const leftPhone = toE164Kenya(left);
      const rightPhone = toE164Kenya(right);
      if (rightPhone && !leftPhone) {
        rows.push({ raw: line, phone: rightPhone, fullName: left || null });
        continue;
      }
      if (leftPhone && !rightPhone) {
        rows.push({ raw: line, phone: leftPhone, fullName: right || null });
        continue;
      }
      if (leftPhone && rightPhone) {
        // Both look like phones — treat as two phones, no name
        rows.push({ raw: left, phone: leftPhone, fullName: null });
        if (rows.length < MAX_ROWS) {
          rows.push({ raw: right, phone: rightPhone, fullName: null });
        }
        continue;
      }
    }

    // Single-line comma-separated phones (no names)
    if (line.includes(',') && !line.includes('|') && !line.includes('\t')) {
      const parts = line.split(',').map((p) => p.trim()).filter(Boolean);
      const allPhones = parts.every((p) => isValidKeMobile(p));
      if (allPhones && parts.length > 1) {
        for (const p of parts) {
          if (rows.length >= MAX_ROWS) break;
          rows.push({ raw: p, phone: toE164Kenya(p), fullName: null });
        }
        continue;
      }
    }

    const phone = toE164Kenya(line);
    rows.push({
      raw: line,
      phone,
      fullName: null,
    });
  }

  // Dedupe by phone (keep first)
  const seen = new Set<string>();
  const unique: BulkPhoneRow[] = [];
  for (const row of rows) {
    const key = row.phone ?? `invalid:${row.raw}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
  }
  return unique;
}

export { MAX_ROWS as BULK_PHONE_MAX_ROWS };
