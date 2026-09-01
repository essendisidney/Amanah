export type NokBulkRow = {
  memberKey: string;
  fullName: string;
  phone: string | null;
  relationship: string;
  notes: string | null;
  line: number;
};

const RELATIONSHIPS = new Set([
  'spouse',
  'parent',
  'sibling',
  'child',
  'guardian',
  'friend',
  'other',
]);

/** Parse CSV/TSV: member_code or member name, NOK name, phone, relationship, notes */
export function parseNokBulkLines(text: string): {
  rows: NokBulkRow[];
  errors: string[];
} {
  const errors: string[] = [];
  const rows: NokBulkRow[] = [];
  const lines = text.replace(/\r\n/g, '\n').trim().split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line || line.startsWith('#')) continue;
    if (/^member/i.test(line) && /name/i.test(line) && i === 0) continue;

    const cells = line.includes('\t')
      ? line.split('\t').map((c) => c.trim())
      : line.split(',').map((c) => c.trim());

    if (cells.length < 2) {
      errors.push(`Line ${i + 1}: need at least member and next-of-kin name.`);
      continue;
    }

    const memberKey = cells[0] ?? '';
    const fullName = cells[1] ?? '';
    const phone = cells[2]?.trim() || null;
    const relationshipRaw = (cells[3]?.trim().toLowerCase() || 'other').replace(/\s+/g, '_');
    const relationship = RELATIONSHIPS.has(relationshipRaw) ? relationshipRaw : 'other';
    const notes = cells.slice(4).join(' ').trim() || null;

    if (!memberKey || !fullName) {
      errors.push(`Line ${i + 1}: member and next-of-kin name are required.`);
      continue;
    }

    rows.push({
      memberKey,
      fullName,
      phone,
      relationship,
      notes,
      line: i + 1,
    });
  }

  return { rows, errors };
}

export const NOK_BULK_MAX_ROWS = 100;
