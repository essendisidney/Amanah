/**
 * Strip control characters and normalize whitespace for plain-text fields.
 * Does not claim to be HTML-sanitization — use a dedicated library for HTML.
 */
const CONTROL_CHARS = new RegExp(
  `[${String.fromCharCode(0)}-${String.fromCharCode(8)}${String.fromCharCode(11)}${String.fromCharCode(12)}${String.fromCharCode(14)}-${String.fromCharCode(31)}${String.fromCharCode(127)}]`,
  'g',
);

export function sanitizePlainText(input: string, maxLength = 10_000): string {
  return input.replace(CONTROL_CHARS, '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}
