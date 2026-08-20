import { formatCurrency, formatDate } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import Link from 'next/link';
import type { Route } from 'next';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';
import {
  activateCircleAction,
  payContributionAction,
  payContributionAheadAction,
  settlePayoutAction,
  settlePayoutToMpesaAction,
} from '../actions/ledger-actions';
import { confirmPayoutReceiptAction } from '../actions/ops-actions';

export type ScheduleContribution = {
  id: string;
  cycleNumber: number;
  amount: number;
  amountPaid: number;
  currency: string;
  status: string;
  dueDate: string;
  isMine: boolean;
};

export type SchedulePayout = {
  id: string;
  cycleNumber: number;
  amount: number;
  currency: string;
  status: string;
  scheduledDate: string;
  memberLabel: string;
  isMine?: boolean;
  receiptConfirmedAt?: string | null;
};

export function ActivateCircleButton({
  jamiyaId,
  slug,
  canActivate,
}: {
  jamiyaId: string;
  slug: string;
  canActivate: boolean;
}) {
  if (!canActivate) return null;

  return (
    <form action={activateCircleAction} className="amanah-surface space-y-3 border-primary/25 px-4 py-4">
      <input type="hidden" name="jamiyaId" value={jamiyaId} />
      <input type="hidden" name="slug" value={slug} />
      <div>
        <p className="text-sm font-semibold text-foreground">Ready to activate</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Generates the contribution calendar and payout schedule for this circle.
        </p>
      </div>
      <Button type="submit" className="min-h-11">
        Activate circle &amp; generate schedule
      </Button>
    </form>
  );
}

export function ContributionCalendar({
  contributions,
  slug,
  walletAvailable = null,
  walletCurrency,
  canActivate = false,
  canManageOps = false,
  memberCount = 0,
}: {
  contributions: ScheduleContribution[];
  slug: string;
  walletAvailable?: number | null;
  walletCurrency?: string;
  canActivate?: boolean;
  canManageOps?: boolean;
  memberCount?: number;
}) {
  if (contributions.length === 0) {
    return (
      <div className="amanah-surface space-y-2 px-4 py-5 text-sm text-muted-foreground">
        {canActivate ? (
          <>
            <p className="font-medium text-foreground">No schedule yet — activate to generate it.</p>
            <p>Use Activate above to build contribution and payout rounds.</p>
          </>
        ) : canManageOps && memberCount < 2 ? (
          <>
            <p className="font-medium text-foreground">Invite at least one more person first.</p>
            <p>
              <a href="#invite-people" className="font-medium text-primary hover:underline">
                Invite people
              </a>{' '}
              , then activate when you have two or more members.
            </p>
          </>
        ) : canManageOps ? (
          <>
            <p className="font-medium text-foreground">Schedule appears after activation.</p>
            <p>Activate the circle when members are ready.</p>
          </>
        ) : (
          <>
            <p className="font-medium text-foreground">Waiting on the circle officer.</p>
            <p>Contribution dates show here after the circle is activated.</p>
          </>
        )}
      </div>
    );
  }

  const ordered = [...contributions].sort((a, b) => {
    if (a.isMine === b.isMine) return a.cycleNumber - b.cycleNumber;
    return a.isMine ? -1 : 1;
  });

  return (
    <ul className="amanah-surface divide-y divide-border/70 overflow-hidden p-0">
      {ordered.map((item) => {
        const paid = item.amountPaid ?? 0;
        const remaining = Math.max(item.amount - paid, 0);
        const payable =
          item.isMine &&
          (item.status === 'pending' ||
            item.status === 'late' ||
            item.status === 'partial');
        const ahead =
          new Date(item.dueDate) > new Date(new Date().toISOString().slice(0, 10));
        const currency = walletCurrency ?? item.currency;
        const canCover =
          walletAvailable != null &&
          currency === item.currency &&
          walletAvailable + 1e-9 >= remaining;
        const shortfall =
          walletAvailable != null && currency === item.currency
            ? Math.max(remaining - walletAvailable, 0)
            : remaining;
        const maxPartial =
          walletAvailable != null && currency === item.currency
            ? Math.min(remaining, walletAvailable)
            : remaining;

        return (
          <li
            key={item.id}
            id={item.isMine ? `contrib-${item.id}` : undefined}
            className={[
              'flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between',
              payable ? 'bg-secondary/35' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">Cycle {item.cycleNumber}</p>
                <StatusBadge status={item.status} />
                {item.isMine ? (
                  <span className="text-xs font-medium text-primary">Yours</span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Due {formatDate(item.dueDate)} ·{' '}
                {formatCurrency(item.amount, item.currency)}
                {paid > 0
                  ? ` · Paid ${formatCurrency(paid, item.currency)} · Remaining ${formatCurrency(remaining, item.currency)}`
                  : null}
              </p>
              {payable && !canCover ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {walletAvailable == null
                    ? 'Top up Money, then pay this cycle.'
                    : `Need about ${formatCurrency(shortfall, item.currency)} more in wallet.`}
                </p>
              ) : null}
            </div>
            {payable ? (
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
                {canCover ? (
                  <form
                    action={ahead ? payContributionAheadAction : payContributionAction}
                    className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end"
                  >
                    <input type="hidden" name="contributionId" value={item.id} />
                    <input type="hidden" name="slug" value={slug} />
                    <label className="block text-xs text-muted-foreground">
                      Amount (optional)
                      <input
                        name="amount"
                        type="number"
                        inputMode="decimal"
                        min={1}
                        step="0.01"
                        max={remaining}
                        placeholder={String(remaining)}
                        className="mt-1 block h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground sm:h-10 sm:w-36 sm:text-sm"
                      />
                    </label>
                    <Button type="submit" className="min-h-11 w-full sm:w-auto">
                      {ahead ? 'Pay ahead from wallet' : 'Pay from wallet'}
                    </Button>
                  </form>
                ) : (
                  <Button asChild className="min-h-11 w-full sm:w-auto">
                    <Link
                      href={
                        `/wallet?next=${encodeURIComponent(`/circles/${slug}#calendar`)}&amount=${Math.max(Math.ceil(shortfall), 100)}#top-up` as Route
                      }
                    >
                      {walletAvailable == null ? 'Open Money' : 'Top up, then pay'}
                    </Link>
                  </Button>
                )}
                {!canCover && walletAvailable != null && walletAvailable > 0 ? (
                  <form
                    action={ahead ? payContributionAheadAction : payContributionAction}
                    className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end"
                  >
                    <input type="hidden" name="contributionId" value={item.id} />
                    <input type="hidden" name="slug" value={slug} />
                    <label className="block text-xs text-muted-foreground">
                      Partial amount
                      <input
                        name="amount"
                        type="number"
                        inputMode="decimal"
                        min={1}
                        step="0.01"
                        max={maxPartial}
                        defaultValue={maxPartial}
                        className="mt-1 block h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground sm:h-10 sm:w-36 sm:text-sm"
                      />
                    </label>
                    <Button type="submit" variant="outline" className="min-h-11 w-full sm:w-auto">
                      Pay partial now
                    </Button>
                  </form>
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function PayoutSchedule({
  payouts,
  slug,
  isCircleAdmin,
  paymentProvider = 'simulated',
}: {
  payouts: SchedulePayout[];
  slug: string;
  isCircleAdmin: boolean;
  paymentProvider?: 'simulated' | 'mpesa' | 'bank' | 'paystack';
}) {
  if (payouts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Payout turns appear here after activation.
      </p>
    );
  }

  const phoneSettleLabel =
    paymentProvider === 'mpesa'
      ? 'Settle → M-Pesa'
      : paymentProvider === 'paystack'
        ? 'Settle → phone (demo)'
        : 'Settle → M-Pesa (sim)';

  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-card">
      {payouts.map((item) => (
        <li
          key={item.id}
          className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">
                Cycle {item.cycleNumber} · {item.memberLabel}
              </p>
              <StatusBadge status={item.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Scheduled {formatDate(item.scheduledDate)} ·{' '}
              {formatCurrency(item.amount, item.currency)}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            {isCircleAdmin &&
            (item.status === 'scheduled' || item.status === 'processing') ? (
              <>
                <form action={settlePayoutAction}>
                  <input type="hidden" name="payoutId" value={item.id} />
                  <input type="hidden" name="slug" value={slug} />
                  <Button type="submit" size="sm" variant="outline">
                    Settle to wallet
                  </Button>
                </form>
                <form action={settlePayoutToMpesaAction} className="flex flex-wrap gap-2">
                  <input type="hidden" name="payoutId" value={item.id} />
                  <input type="hidden" name="slug" value={slug} />
                  <input
                    name="phone"
                    type="tel"
                    placeholder="+2547…"
                    className="h-9 w-36 rounded-md border border-input bg-background px-2 text-sm"
                  />
                  <Button type="submit" size="sm">
                    {phoneSettleLabel}
                  </Button>
                </form>
              </>
            ) : null}
            {item.isMine && item.status === 'paid' && !item.receiptConfirmedAt ? (
              <form action={confirmPayoutReceiptAction}>
                <input type="hidden" name="payoutId" value={item.id} />
                <input type="hidden" name="slug" value={slug} />
                <Button type="submit" size="sm">
                  Confirm receipt
                </Button>
              </form>
            ) : null}
            {item.receiptConfirmedAt ? (
              <p className="text-xs text-muted-foreground">Receipt confirmed</p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
