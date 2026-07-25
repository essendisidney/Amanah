export function formatCurrency(
  amount: number,
  currency = 'KES',
  locale = 'en-KE',
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(
  value: string | Date,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  },
  locale = 'en-KE',
): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale, options).format(date);
}

export function formatRelativeTime(value: string | Date, locale = 'en'): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSeconds);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (abs < 60) return rtf.format(diffSeconds, 'second');
  if (abs < 3600) return rtf.format(Math.round(diffSeconds / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diffSeconds / 3600), 'hour');
  if (abs < 604800) return rtf.format(Math.round(diffSeconds / 86400), 'day');
  if (abs < 2592000) return rtf.format(Math.round(diffSeconds / 604800), 'week');
  if (abs < 31536000) return rtf.format(Math.round(diffSeconds / 2592000), 'month');
  return rtf.format(Math.round(diffSeconds / 31536000), 'year');
}
