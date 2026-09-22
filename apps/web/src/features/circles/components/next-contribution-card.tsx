import Link from 'next/link';
import type { Route } from 'next';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import {
  payContributionAction,
  payContributionAheadAction,
  payContributionStkAction,
} from '@/features/circles/actions/ledger-actions';
import type { Dictionary } from '@/i18n/dictionaries';
import { t } from '@/i18n/dictionaries';

type Props = {
  contributionId: string;
  slug: string;
  amount: number;
  amountPaid: number;
  currency: string;
  dueDate: string;
  status: string;
  walletAvailable: number | null;
  walletCurrency: string;
  circleName?: string;
  /** Linked M-Pesa / profile phone for STK (prefilled, often hidden). */
  defaultPhone?: string | null;
  /** When false, omit id="pay" (use for stacked lists). Default true. */
  showAnchor?: boolean;
  labels: Dictionary['contributionCard'];
};

export function NextContributionCard({
  contributionId,
  slug,
  amount,
  amountPaid,
  currency,
  dueDate,
  status,
  walletAvailable,
  walletCurrency,
  circleName,
  defaultPhone = '',
  showAnchor = true,
  labels,
}: Props) {
  const remaining = Math.max(amount - amountPaid, 0);
  const ahead = new Date(dueDate) > new Date(new Date().toISOString().slice(0, 10));
  const canCover =
    walletAvailable != null &&
    walletCurrency === currency &&
    walletAvailable + 1e-9 >= remaining;
  const shortfall =
    walletAvailable != null && walletCurrency === currency
      ? Math.max(remaining - walletAvailable, 0)
      : remaining;
  const maxPartial =
    walletAvailable != null && walletCurrency === currency
      ? Math.min(remaining, walletAvailable)
      : remaining;
  const linkedPhone = (defaultPhone ?? '').trim();
  const hasLinkedPhone = /^\+[1-9]\d{7,14}$/.test(linkedPhone);
  const payLabel = ahead
    ? t(labels.payAmountAhead, { amount: formatCurrency(remaining, currency) })
    : t(labels.payAmount, { amount: formatCurrency(remaining, currency) });

  const dueMeta = [
    circleName,
    `${labels.due} ${formatDate(dueDate)}`,
    status === 'late' ? labels.overdue : ahead ? labels.payAheadAvailable : null,
    amountPaid > 0
      ? t(labels.alreadyPaid, { amount: formatCurrency(amountPaid, currency) })
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <section
      id={showAnchor ? 'pay' : undefined}
      className="amanah-surface space-y-4 border-primary/20 px-4 py-4 md:px-5 md:py-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {labels.nextTitle}
          </p>
          <p className="amanah-money mt-1 text-2xl font-bold tracking-tight">
            {formatCurrency(remaining, currency)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{dueMeta}</p>
        </div>
        {walletAvailable != null ? (
          <div className="rounded-xl bg-secondary/70 px-3 py-2 text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {labels.moneyAvailable}
            </p>
            <p className="mt-0.5 text-sm font-semibold">
              {formatCurrency(walletAvailable, walletCurrency)}
            </p>
          </div>
        ) : null}
      </div>

      {canCover ? (
        <form action={ahead ? payContributionAheadAction : payContributionAction}>
          <input type="hidden" name="contributionId" value={contributionId} />
          <input type="hidden" name="slug" value={slug} />
          <Button type="submit" className="min-h-12 w-full text-base">
            {payLabel}
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {labels.paysFromBalanceShort}
          </p>
        </form>
      ) : (
        <form action={payContributionStkAction} className="space-y-3">
          <input type="hidden" name="contributionId" value={contributionId} />
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="amount" value={String(remaining)} />
          {hasLinkedPhone ? (
            <input type="hidden" name="phone" value={linkedPhone} />
          ) : (
            <label className="block text-xs text-muted-foreground">
              {labels.mpesaPhone}
              <input
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                required
                placeholder="07…"
                className="mt-1 block h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground"
              />
            </label>
          )}
          <Button type="submit" className="min-h-12 w-full text-base">
            {payLabel}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            {hasLinkedPhone
              ? t(labels.stkToLinked, { phone: linkedPhone })
              : labels.stkApproveHint}
          </p>
        </form>
      )}

      <details className="text-sm">
        <summary className="cursor-pointer font-medium text-muted-foreground">
          {labels.moreOptions}
        </summary>
        <div className="mt-3 space-y-3 border-t border-border/60 pt-3">
          {canCover ? (
            <>
              <form
                action={ahead ? payContributionAheadAction : payContributionAction}
                className="flex flex-col gap-2 sm:flex-row sm:items-end"
              >
                <input type="hidden" name="contributionId" value={contributionId} />
                <input type="hidden" name="slug" value={slug} />
                <label className="block flex-1 text-xs text-muted-foreground">
                  {labels.amountOptional}
                  <input
                    name="amount"
                    type="number"
                    inputMode="decimal"
                    min={1}
                    step="0.01"
                    max={remaining}
                    placeholder={String(remaining)}
                    className="mt-1 block h-11 w-full rounded-md border border-input bg-background px-3 text-base sm:h-10 sm:text-sm"
                  />
                </label>
                <Button type="submit" variant="outline" className="min-h-11">
                  {labels.payPartial}
                </Button>
              </form>
              <form action={payContributionStkAction} className="space-y-2">
                <input type="hidden" name="contributionId" value={contributionId} />
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="amount" value={String(remaining)} />
                {hasLinkedPhone ? (
                  <input type="hidden" name="phone" value={linkedPhone} />
                ) : (
                  <label className="block text-xs text-muted-foreground">
                    {labels.mpesaPhone}
                    <input
                      name="phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      required
                      placeholder="07…"
                      className="mt-1 block h-11 w-full rounded-md border border-input bg-background px-3 text-base sm:h-10 sm:text-sm"
                    />
                  </label>
                )}
                <Button type="submit" variant="outline" className="min-h-11 w-full">
                  {labels.payPhoneInstead}
                </Button>
              </form>
            </>
          ) : (
            <>
              {walletAvailable != null && walletAvailable > 0 ? (
                <form
                  action={ahead ? payContributionAheadAction : payContributionAction}
                  className="flex flex-col gap-2 sm:flex-row sm:items-end"
                >
                  <input type="hidden" name="contributionId" value={contributionId} />
                  <input type="hidden" name="slug" value={slug} />
                  <label className="block flex-1 text-xs text-muted-foreground">
                    {labels.partialAmount}
                    <input
                      name="amount"
                      type="number"
                      inputMode="decimal"
                      min={1}
                      step="0.01"
                      max={maxPartial}
                      defaultValue={maxPartial}
                      className="mt-1 block h-11 w-full rounded-md border border-input bg-background px-3 text-base sm:h-10 sm:text-sm"
                    />
                  </label>
                  <Button type="submit" variant="outline" className="min-h-11">
                    {labels.payPartial}
                  </Button>
                </form>
              ) : null}
              <Button asChild variant="outline" className="min-h-11 w-full">
                <Link
                  href={
                    `/wallet?next=${encodeURIComponent(`/circles/${slug}#pay-due`)}&amount=${Math.max(Math.ceil(shortfall), 10)}#top-up` as Route
                  }
                >
                  {walletAvailable == null ? labels.addMoney : labels.addMoneyToPay}
                </Link>
              </Button>
            </>
          )}

          <p className="text-xs text-muted-foreground">{labels.paidTreasurerHint}</p>

          <Button asChild variant="ghost" size="sm" className="min-h-11 w-full justify-start px-0">
            <Link href={`#calendar` as Route}>{labels.calendar}</Link>
          </Button>
        </div>
      </details>
    </section>
  );
}
