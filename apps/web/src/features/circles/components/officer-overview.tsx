import Link from 'next/link';
import type { Route } from 'next';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import {
  nudgeCircleDuesAction,
  remindInvoicesAction,
} from '@/features/circles/actions/invoice-actions';

export type UnpaidOwing = {
  label: string;
  remaining: number;
  currency: string;
  userId?: string | null;
  phone?: string | null;
};

export function OfficerOverviewStrip({
  slug,
  jamiyaId,
  lateCount,
  pendingGrace,
  pendingQard = 0,
  pendingDual = 0,
  openCases = 0,
  nextPayoutLabel,
  nextPayoutDate,
  nextPayoutAmount,
  currency,
  unpaidMemberLabels = [],
  unpaidOwing = [],
  openPenaltyCount = 0,
  recordPaymentHref,
  recordPaymentLabel = 'Record payment',
  finesHref,
  cycleLabel,
}: {
  slug: string;
  jamiyaId?: string;
  lateCount: number;
  pendingGrace: number;
  pendingQard?: number;
  pendingDual?: number;
  openCases?: number;
  nextPayoutLabel: string | null;
  nextPayoutDate: string | null;
  nextPayoutAmount: number | null;
  currency: string;
  /** @deprecated Prefer unpaidOwing with amounts. */
  unpaidMemberLabels?: string[];
  unpaidOwing?: UnpaidOwing[];
  openPenaltyCount?: number;
  recordPaymentHref?: string;
  recordPaymentLabel?: string;
  finesHref?: string;
  cycleLabel?: string | null;
}) {
  const owing =
    unpaidOwing.length > 0
      ? unpaidOwing
      : unpaidMemberLabels.map((label) => ({
          label,
          remaining: 0,
          currency,
          userId: null,
          phone: null,
        }));
  const attention =
    lateCount + pendingGrace + pendingQard + pendingDual + openCases + openPenaltyCount;
  const unpaidPreview = owing.slice(0, 6);

  return (
    <section className="amanah-surface px-5 py-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Today
          </p>
          <h2 className="mt-1 font-[family-name:var(--font-display)] text-xl font-semibold">
            Officer snapshot
          </h2>
          {cycleLabel ? (
            <p className="mt-1 text-sm text-muted-foreground">{cycleLabel}</p>
          ) : null}
          {attention > 0 ? (
            <p className="mt-1 text-sm font-medium text-accent">
              {attention} item{attention === 1 ? '' : 's'} need attention
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">All caught up for now</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {jamiyaId ? (
            <form action={nudgeCircleDuesAction}>
              <input type="hidden" name="jamiyaId" value={jamiyaId} />
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="dueWithinDays" value="7" />
              <input type="hidden" name="returnTo" value="circle" />
              <Button type="submit" size="sm" variant="outline" className="min-h-11 rounded-full">
                Nudge dues
              </Button>
            </form>
          ) : null}
          {recordPaymentHref ? (
            <Button asChild size="sm" className="min-h-11 rounded-full">
              <Link href={recordPaymentHref as Route}>{recordPaymentLabel}</Link>
            </Button>
          ) : null}
        </div>
      </div>

      {owing.length > 0 ? (
        <div className="mt-4 space-y-2 rounded-xl border border-accent/25 bg-accent/5 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Still owing ({owing.length})
          </p>
          <ul className="space-y-2">
            {unpaidPreview.map((row) => {
              const smsBody = encodeURIComponent(
                row.remaining > 0
                  ? `Hi ${row.label}, reminder: ${formatCurrency(row.remaining, row.currency)} is due for our circle on Jameiyah.`
                  : `Hi ${row.label}, kindly settle your circle due on Jameiyah.`,
              );
              const smsHref = row.phone
                ? (`sms:${row.phone}?body=${smsBody}` as Route)
                : null;
              return (
                <li
                  key={`${row.label}-${row.userId ?? ''}`}
                  className="flex flex-wrap items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{row.label}</p>
                    {row.remaining > 0 ? (
                      <p className="amanah-money text-xs text-muted-foreground">
                        {formatCurrency(row.remaining, row.currency)}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {jamiyaId && row.userId ? (
                      <form action={remindInvoicesAction}>
                        <input type="hidden" name="jamiyaId" value={jamiyaId} />
                        <input type="hidden" name="slug" value={slug} />
                        <input type="hidden" name="userId" value={row.userId} />
                        <input type="hidden" name="returnTo" value="circle" />
                        <Button
                          type="submit"
                          size="sm"
                          variant="outline"
                          className="h-8 rounded-full px-3 text-xs"
                        >
                          Remind
                        </Button>
                      </form>
                    ) : null}
                    {smsHref ? (
                      <Button asChild size="sm" variant="ghost" className="h-8 rounded-full px-3 text-xs">
                        <a href={smsHref}>SMS</a>
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
          {owing.length > unpaidPreview.length ? (
            <p className="text-xs text-muted-foreground">
              +{owing.length - unpaidPreview.length} more
            </p>
          ) : null}
        </div>
      ) : null}

      {attention > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {owing.length > 0 && recordPaymentHref ? (
            <Link
              href={recordPaymentHref as Route}
              className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
            >
              Collect {owing.length}
            </Link>
          ) : null}
          {lateCount > 0 ? (
            <a
              href="#calendar"
              className="rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs font-semibold"
            >
              Late {lateCount}
            </a>
          ) : null}
          {openPenaltyCount > 0 ? (
            <Link
              href={(finesHref ?? `/circles/${slug}/treasury`) as Route}
              className="rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs font-semibold"
            >
              Fines {openPenaltyCount}
            </Link>
          ) : null}
          {pendingGrace > 0 ? (
            <a
              href="#officer-grace"
              className="rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs font-semibold"
            >
              Grace {pendingGrace}
            </a>
          ) : null}
          {pendingQard > 0 ? (
            <a
              href="#officer-qard"
              className="rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs font-semibold"
            >
              Qard {pendingQard}
            </a>
          ) : null}
        </div>
      ) : null}

      <dl className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Open dues</dt>
          <dd className="mt-1 text-2xl font-semibold">{owing.length || lateCount}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Next payout</dt>
          <dd className="mt-1 text-sm font-semibold">
            {nextPayoutLabel ?? '—'}
            {nextPayoutDate ? (
              <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                {formatDate(nextPayoutDate)}
              </span>
            ) : null}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Amount</dt>
          <dd className="amanah-money mt-1 text-2xl font-semibold">
            {nextPayoutAmount != null ? formatCurrency(nextPayoutAmount, currency) : '—'}
          </dd>
        </div>
      </dl>
    </section>
  );
}
