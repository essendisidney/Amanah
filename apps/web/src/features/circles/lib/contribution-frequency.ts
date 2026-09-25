/**
 * Contribution cadence labels.
 * Schedules use fixed day intervals: start_date + (cycle - 1) * contribution_frequency_days.
 * That is not the same as calendar months (e.g. 1st of each month).
 */

export function contributionFrequencyLabel(days: number): string {
  const n = Math.trunc(days);
  if (!Number.isFinite(n) || n < 1) return 'Custom interval';
  if (n === 7) return 'Every 7 days';
  if (n === 30) return 'Every 30 days';
  return `Every ${n} days`;
}

export function contributionFrequencyHint(): string {
  return (
    'Due dates are spaced by a fixed number of days from the circle start date ' +
    '(for example, every 30 days). That is not the same as calendar months ' +
    '(the 1st of each month), which can be 28–31 days apart.'
  );
}

/** Date-only values stay on the UTC calendar so labels do not shift by timezone. */
export function parseUtcDateOnly(value: string | Date): Date {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return new Date(NaN);
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return new Date(NaN);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

/** Round 0 is the start date. Later rounds add a fixed number of days, not calendar months. */
export function addFrequencyDays(start: Date, cycleIndex: number, frequencyDays: number): Date {
  const freq = Math.max(Math.trunc(frequencyDays) || 30, 1);
  const due = parseUtcDateOnly(start);
  const index = Math.max(0, Math.trunc(cycleIndex));
  due.setUTCDate(due.getUTCDate() + index * freq);
  return due;
}

/** Include the day so two rounds in the same month are not both labeled "Dec 26". */
export function formatCycleDueLabel(due: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  }).format(due);
}
