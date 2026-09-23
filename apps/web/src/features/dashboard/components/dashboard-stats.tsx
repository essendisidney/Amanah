import { Badge } from '@jamiya/ui';
import { formatCurrency } from '@jamiya/shared';
import type { Dictionary } from '@/i18n/dictionaries';
import { t } from '@/i18n/dictionaries';
import type { DashboardData } from '../types';

export function DashboardStats({
  data,
  labels,
}: {
  data: DashboardData;
  labels: Dictionary['dashboard'];
}) {
  const membershipHint =
    data.reservedSeatCount > 0
      ? `${
          data.jamiyas.length === 1
            ? t(labels.membershipsHintOne, { count: data.jamiyas.length })
            : t(labels.membershipsHint, { count: data.jamiyas.length })
        } · ${data.reservedSeatCount} reserved seat${
          data.reservedSeatCount === 1 ? '' : 's'
        }`
      : data.jamiyas.length === 1
        ? t(labels.membershipsHintOne, { count: data.jamiyas.length })
        : t(labels.membershipsHint, { count: data.jamiyas.length });

  const items = [
    {
      label: labels.activeCircles,
      value: String(data.stats.activeCircles),
      hint: membershipHint,
    },
    {
      label: labels.pendingContributions,
      value: String(data.stats.pendingContributions),
      hint: labels.dueOrOverdue,
    },
    {
      label: labels.upcomingPayouts,
      value: String(data.stats.upcomingPayouts),
      hint: labels.scheduledForYou,
    },
    {
      label: labels.wallet,
      value: data.wallet
        ? formatCurrency(data.wallet.availableBalance, data.wallet.currency)
        : '—',
      hint: data.wallet
        ? t(labels.availableHint, { currency: data.wallet.currency })
        : labels.noWalletYet,
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl border border-border/80 bg-card/90 px-4 py-4 shadow-[0_1px_0_rgba(26,31,28,0.04)]"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {item.label}
          </p>
          <p className="mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-foreground">
            {item.value}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{item.hint}</p>
        </div>
      ))}
    </div>
  );
}

export function StatusBadge({
  status,
}: {
  status: string;
}) {
  const normalized = status.trim().toLowerCase();
  const variant =
    normalized === 'active' ||
    normalized === 'paid' ||
    normalized === 'approved' ||
    normalized === 'completed' ||
    normalized === 'vouch:approved'
      ? 'success'
      : normalized === 'late' ||
          normalized === 'failed' ||
          normalized === 'rejected' ||
          normalized === 'vouch:rejected' ||
          normalized === 'cancelled'
        ? 'destructive'
        : normalized === 'suspended' ||
            normalized === 'paused' ||
            normalized === 'simulated' ||
            normalized === 'demo verification'
          ? 'secondary'
          : normalized === 'open' ||
              normalized === 'scheduled' ||
              normalized === 'pending' ||
              normalized === 'pending_review' ||
              normalized === 'under_review' ||
              normalized === 'not_started' ||
              normalized === 'vouch:pending'
            ? 'accent'
            : 'secondary';

  const label =
    normalized === 'not_started'
      ? 'Not started'
      : normalized === 'pending_review'
        ? 'Under review'
        : normalized === 'simulated'
          ? 'Demo verification'
          : status.replaceAll('_', ' ').replace('vouch:', 'vouch ');

  return (
    <Badge variant={variant} className="capitalize">
      {label}
    </Badge>
  );
}
