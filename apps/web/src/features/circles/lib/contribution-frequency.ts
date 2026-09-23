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
