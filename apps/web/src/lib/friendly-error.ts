/**
 * Turns what the database or a provider said into something a member can read. Sentences we
 * wrote ourselves pass through; bare error codes become words, and database internals
 * ("duplicate key value violates…") never reach the screen.
 */
const INTERNAL =
  /violates|duplicate key|relation "|column "|function .*does not exist|syntax error|permission denied|JWT|PGRST|null value|invalid input syntax|deadlock|statement timeout|fetch failed|Failed to fetch|ECONNREFUSED|ETIMEDOUT|row-level security|Could not find the function|schema cache|The resource already exists|Payload too large|exceeded the maximum allowed size/i;

export function friendlyError(message: string | null | undefined): string {
  const text = (message ?? '').trim();
  if (!text) return 'That did not go through. Please try again.';
  if (/^[A-Z][A-Z0-9_]{2,}$/.test(text)) {
    return `That did not go through (${text.toLowerCase().replace(/_/g, ' ')}). Please try again, or ask your circle officer.`;
  }
  if (INTERNAL.test(text)) {
    return 'We could not complete that just now. Please try again in a moment; if it keeps happening, contact us from Help.';
  }
  return text;
}
