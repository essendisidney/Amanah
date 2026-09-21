import Link from 'next/link';
import type { Route } from 'next';
import { formatCurrency } from '@jamiya/shared';

export type CircleBooksGlanceData = {
  members_active?: number;
  share_capital?: number;
  book_contributions?: number;
  schedule_contributions_paid?: number;
  schedule_contributions_outstanding?: number;
  facility_disbursed?: number;
  facility_repaid?: number;
  facility_outstanding?: number;
  profit_paid?: number;
  fines_open?: number;
  fines_paid?: number;
  fines_total?: number;
  qard_outstanding?: number;
};

function n(v: unknown) {
  const x = typeof v === 'number' ? v : Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
}

/** Whole-chama At a glance — mirrors member statement cards for officers. */
export function CircleBooksGlance({
  slug,
  currency,
  data,
}: {
  slug: string;
  currency: string;
  data: CircleBooksGlanceData;
}) {
  const cards = [
    {
      label: 'Members',
      value: String(n(data.members_active)),
      hint: 'Active + suspended',
      href: `/circles/${slug}/statement` as Route,
    },
    {
      label: 'Share capital',
      value: formatCurrency(n(data.share_capital), currency),
      hint: 'All member buy-ins',
      href: `/circles/${slug}/books?view=grid` as Route,
    },
    {
      label: 'Books contributions',
      value: formatCurrency(n(data.book_contributions), currency),
      hint: 'Monthly member books total',
      href: `/circles/${slug}/books?view=grid` as Route,
    },
    {
      label: 'Schedule paid',
      value: formatCurrency(n(data.schedule_contributions_paid), currency),
      hint:
        n(data.schedule_contributions_outstanding) > 0
          ? `${formatCurrency(n(data.schedule_contributions_outstanding), currency)} still owing`
          : 'No open schedule dues',
      href: `/circles/${slug}/arrears` as Route,
    },
    {
      label: 'Facilities issued',
      value: formatCurrency(n(data.facility_disbursed), currency),
      hint: `Repaid ${formatCurrency(n(data.facility_repaid), currency)}`,
      href: `/circles/${slug}/books` as Route,
    },
    {
      label: 'Facility outstanding',
      value: formatCurrency(n(data.facility_outstanding), currency),
      hint:
        n(data.qard_outstanding) > 0
          ? `+ Qard ${formatCurrency(n(data.qard_outstanding), currency)}`
          : 'Across all members',
      href: `/circles/${slug}/books` as Route,
    },
    {
      label: 'Profit paid',
      value: formatCurrency(n(data.profit_paid), currency),
      hint: 'Facility profit recorded',
      href: `/circles/${slug}/books` as Route,
    },
    {
      label: 'Fines',
      value: formatCurrency(n(data.fines_total), currency),
      hint:
        n(data.fines_open) > 0
          ? `${formatCurrency(n(data.fines_open), currency)} still open`
          : n(data.fines_total) > 0
            ? 'All settled'
            : 'No fines recorded',
      href: `/circles/${slug}/treasury#member-fining` as Route,
    },
  ];

  return (
    <section id="chama-glance" className="scroll-mt-24 space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
            Chama at a glance
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Whole-group totals — same picture as each member&apos;s 360, rolled up for officers.
          </p>
        </div>
        <Link
          href={`/circles/${slug}/statement` as Route}
          className="text-sm font-medium text-accent underline-offset-4 hover:underline"
        >
          Open a member statement →
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="amanah-surface block px-4 py-4 transition-colors hover:border-primary/30"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {card.label}
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{card.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{card.hint}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
