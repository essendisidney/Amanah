/** Safe admin finance return path from form returnTo field. */
export function financeReturnPath(
  formData: FormData,
  fallback: string,
): string {
  const next = String(formData.get('returnTo') ?? '').trim();
  if (
    next.startsWith('/admin/finance') &&
    !next.includes('://') &&
    !next.includes('\\') &&
    next.length < 200
  ) {
    return next;
  }
  return fallback;
}
