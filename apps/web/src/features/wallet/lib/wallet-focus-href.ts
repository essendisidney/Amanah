/** Canonical Money deep-links so top-up / withdraw never open both forms. */

export function walletTopUpHref(opts?: {
  amount?: number;
  next?: string;
}): `/wallet?${string}` {
  const q = new URLSearchParams();
  q.set('focus', 'top-up');
  if (opts?.amount != null && Number.isFinite(opts.amount) && opts.amount > 0) {
    q.set('amount', String(Math.ceil(opts.amount)));
  }
  if (opts?.next) q.set('next', opts.next);
  return `/wallet?${q.toString()}#top-up`;
}

export function walletWithdrawHref(): `/wallet?${string}` {
  return '/wallet?focus=withdraw#withdraw';
}
