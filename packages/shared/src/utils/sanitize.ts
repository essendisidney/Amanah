/**
 * Strip control characters and normalize whitespace for plain-text fields.
 * Does not claim to be HTML-sanitization — use a dedicated library for HTML.
 */
export function sanitizePlainText(input: string, maxLength = 10_000): string {
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}
