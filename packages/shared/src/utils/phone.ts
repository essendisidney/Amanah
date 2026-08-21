/** Kenya mobile helpers — same pattern as Creda / Savr / Taifa (254XXXXXXXXX). */

/** Shared form placeholder — both local and E.164 accepted. */
export const KE_PHONE_PLACEHOLDER = '07… or +254…';

/** Normalize to digits-only Kenya format 254XXXXXXXXX (12 digits). */
export function normalizePhone254(input: string): string {
  let d = String(input ?? '')
    .trim()
    .replace(/\D/g, '');
  if (!d) return d;

  if (d.startsWith('2540') && d.length >= 11) {
    d = `254${d.slice(4)}`;
  } else if (d.startsWith('0') && d.length >= 10) {
    d = `254${d.slice(1)}`;
  } else if (d.length === 9 && (d.startsWith('7') || d.startsWith('1'))) {
    d = `254${d}`;
  } else if (!d.startsWith('254')) {
    d = `254${d.replace(/^0+/, '')}`;
  }

  if (d.length > 12) d = d.slice(0, 12);
  return d;
}

export function isValidKeMobile(input: string): boolean {
  return /^254[17]\d{8}$/.test(normalizePhone254(input));
}

/** E.164 for Supabase Auth / profiles, e.g. +254712345678 */
export function toE164Kenya(raw: string): string | null {
  if (!isValidKeMobile(raw)) return null;
  return `+${normalizePhone254(raw)}`;
}

/** Pretty display, e.g. +254 712 345 678 */
export function formatPhoneHint(raw: string): string {
  const e164 = toE164Kenya(raw);
  if (!e164) return raw.trim();
  const d = e164.slice(1);
  const rest = d.slice(3);
  return `+254 ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6, 9)}`;
}
