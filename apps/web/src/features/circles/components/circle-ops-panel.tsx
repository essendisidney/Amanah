import Link from 'next/link';
import type { Route } from 'next';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { Button, Input, Label, Textarea } from '@jamiya/ui';
import {
  assessPenaltiesAction,
  broadcastAnnouncementAction,
  createBookEntryAction,
  createSavingsPocketAction,
  moveSavingsPocketAction,
  updatePenaltySettingsAction,
} from '../actions/ops-actions';

export type PenaltySettings = {
  lateContributionPenalty: number;
  missedContributionPenalty: number;
  lateLoanPenaltyFixed: number;
  lateLoanPenaltyPct: number;
  payoutComplianceMode: string;
};

export type BookEntryRow = {
  id: string;
  entryType: string;
  amount: number;
  currency: string;
  effectiveDate: string;
  notes: string | null;
};

export type AnnouncementRow = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
};

export type TableBankingFund = {
  memberContributions: number;
  penaltiesReceived: number;
  lentOut: number;
  repaid: number;
  outstanding: number;
  overdue: number;
  availableToLend: number;
  portfolioAtRiskPct: number;
};

export type MemberOption = {
  id: string;
  label: string;
  memberCode: string | null;
};

export type SavingsPocketRow = {
  id: string;
  category: string;
  label: string | null;
  balance: number;
  targetAmount: number | null;
  durationMonths: number | null;
  currency: string;
};

const POCKET_LABELS: Record<string, string> = {
  hajj: 'Hajj',
  umrah: 'Umra',
  udhiyah: 'Udhiyah',
  regular: 'Regular',
  emergency: 'Emergency',
  school: 'School',
  holiday: 'Holiday',
  investment: 'Investment',
  goal: 'Custom goal',
};

const ENTRY_TYPES = [
  'opening_balance',
  'contribution',
  'payout',
  'loan',
  'loan_repayment',
  'penalty',
  'withdrawal',
  'adjustment',
  'merry_go_round',
] as const;

const POCKET_CATEGORIES = [
  { value: 'hajj', label: 'Hajj' },
  { value: 'umrah', label: 'Umra' },
  { value: 'udhiyah', label: 'Udhiyah' },
  { value: 'regular', label: 'Regular' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'school', label: 'School' },
  { value: 'holiday', label: 'Holiday' },
  { value: 'investment', label: 'Investment' },
  { value: 'goal', label: 'Custom goal' },
] as const;

export function CircleOpsPanel({
  jamiyaId,
  slug,
  currency,
  settings,
  fund,
  bookEntries,
  announcements,
  members,
  myMemberId,
  pockets = [],
  canManage = true,
}: {
  jamiyaId: string;
  slug: string;
  currency: string;
  settings: PenaltySettings;
  fund: TableBankingFund | null;
  bookEntries: BookEntryRow[];
  announcements: AnnouncementRow[];
  members: MemberOption[];
  myMemberId: string | null;
  pockets?: SavingsPocketRow[];
  canManage?: boolean;
}) {
  return (
    <div className="space-y-10">
      {fund ? (
        <section className="space-y-3">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
            Table banking fund
          </h2>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Available to lend
              </dt>
              <dd className="mt-1 text-lg font-semibold">
                {formatCurrency(fund.availableToLend, currency)}
              </dd>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Outstanding
              </dt>
              <dd className="mt-1 text-lg font-semibold">
                {formatCurrency(fund.outstanding, currency)}
              </dd>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Overdue</dt>
              <dd className="mt-1 text-lg font-semibold">
                {formatCurrency(fund.overdue, currency)}
              </dd>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">PAR %</dt>
              <dd className="mt-1 text-lg font-semibold">{fund.portfolioAtRiskPct}%</dd>
            </div>
          </dl>
          <p className="text-sm text-muted-foreground">
            Contributions {formatCurrency(fund.memberContributions, currency)} · penalties{' '}
            {formatCurrency(fund.penaltiesReceived, currency)} · lent{' '}
            {formatCurrency(fund.lentOut, currency)} · repaid{' '}
            {formatCurrency(fund.repaid, currency)}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button asChild size="sm">
              <Link href={'/finance/qard' as Route}>Request / repay loan</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={'/finance/welfare' as Route}>Welfare fund</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={'/wallet' as Route}>Top up Money</Link>
            </Button>
          </div>
        </section>
      ) : null}

      {canManage ? (
        <section className="space-y-3">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
            Penalties & payout compliance
          </h2>
          <form
            action={updatePenaltySettingsAction}
            className="grid max-w-2xl gap-3 rounded-xl border border-border bg-card p-5 sm:grid-cols-2"
          >
            <input type="hidden" name="jamiyaId" value={jamiyaId} />
            <input type="hidden" name="slug" value={slug} />
            <div className="space-y-1">
              <Label htmlFor="lateContributionPenalty">Late contribution penalty</Label>
              <Input
                id="lateContributionPenalty"
                name="lateContributionPenalty"
                type="number"
                min="0"
                step="0.01"
                defaultValue={settings.lateContributionPenalty}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="missedContributionPenalty">Missed contribution penalty</Label>
              <Input
                id="missedContributionPenalty"
                name="missedContributionPenalty"
                type="number"
                min="0"
                step="0.01"
                defaultValue={settings.missedContributionPenalty}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="lateLoanPenaltyFixed">Late loan penalty (fixed)</Label>
              <Input
                id="lateLoanPenaltyFixed"
                name="lateLoanPenaltyFixed"
                type="number"
                min="0"
                step="0.01"
                defaultValue={settings.lateLoanPenaltyFixed}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="lateLoanPenaltyPct">Late loan penalty (%)</Label>
              <Input
                id="lateLoanPenaltyPct"
                name="lateLoanPenaltyPct"
                type="number"
                min="0"
                max="100"
                step="0.01"
                defaultValue={settings.lateLoanPenaltyPct}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="payoutComplianceMode">Payout compliance mode</Label>
              <select
                id="payoutComplianceMode"
                name="payoutComplianceMode"
                defaultValue={settings.payoutComplianceMode}
                className="h-10 w-full border border-input bg-background px-3"
              >
                <option value="block">Block if member has arrears</option>
                <option value="approve">Officer may approve despite arrears</option>
                <option value="deduct">Deduct arrears/penalties from payout</option>
                <option value="allow">Allow payout regardless</option>
              </select>
            </div>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <Button type="submit">Save settings</Button>
            </div>
          </form>
          <form action={assessPenaltiesAction}>
            <input type="hidden" name="jamiyaId" value={jamiyaId} />
            <input type="hidden" name="slug" value={slug} />
            <Button type="submit" variant="outline" size="sm">
              Assess late contribution penalties now
            </Button>
          </form>
        </section>
      ) : null}

      {canManage ? (
        <section className="space-y-3">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
            Backdated / migration book entry
          </h2>
          <form
            action={createBookEntryAction}
            className="grid max-w-2xl gap-3 rounded-xl border border-border bg-card p-5 sm:grid-cols-2"
          >
            <input type="hidden" name="jamiyaId" value={jamiyaId} />
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="currency" value={currency} />
            <div className="space-y-1">
              <Label htmlFor="entryType">Type</Label>
              <select
                id="entryType"
                name="entryType"
                required
                className="h-10 w-full border border-input bg-background px-3"
              >
                {ENTRY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" name="amount" type="number" step="0.01" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="effectiveDate">Transaction date</Label>
              <Input id="effectiveDate" name="effectiveDate" type="date" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="memberId">Member (optional)</Label>
              <select
                id="memberId"
                name="memberId"
                className="h-10 w-full border border-input bg-background px-3"
                defaultValue=""
              >
                <option value="">Circle-level</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.memberCode ? `${m.memberCode} · ` : ''}
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={2} />
            </div>
            <Button type="submit" className="sm:col-span-2 w-fit">
              Record book entry
            </Button>
          </form>
          {bookEntries.length ? (
            <ul className="divide-y divide-border rounded-xl border border-border bg-card">
              {bookEntries.map((row) => (
                <li key={row.id} className="px-4 py-3 text-sm">
                  <p className="font-medium">
                    {row.entryType.replaceAll('_', ' ')} ·{' '}
                    {formatCurrency(row.amount, row.currency)}
                  </p>
                  <p className="text-muted-foreground">
                    Effective {formatDate(row.effectiveDate)}
                    {row.notes ? ` · ${row.notes}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No migration entries yet.</p>
          )}
        </section>
      ) : null}

      {canManage ? (
        <section className="space-y-3">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
            Announcements
          </h2>
          <form
            action={broadcastAnnouncementAction}
            className="max-w-2xl space-y-3 rounded-xl border border-border bg-card p-5"
          >
            <input type="hidden" name="jamiyaId" value={jamiyaId} />
            <input type="hidden" name="slug" value={slug} />
            <div className="space-y-1">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="body">Message</Label>
              <Textarea id="body" name="body" rows={3} required />
            </div>
            <Button type="submit">Broadcast to members</Button>
          </form>
          {announcements.length ? (
            <ul className="divide-y divide-border rounded-xl border border-border bg-card">
              {announcements.map((row) => (
                <li key={row.id} className="px-4 py-3">
                  <p className="text-sm font-medium">{row.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{row.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDate(row.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : announcements.length ? (
        <section className="space-y-3">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
            Announcements
          </h2>
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {announcements.map((row) => (
              <li key={row.id} className="px-4 py-3">
                <p className="text-sm font-medium">{row.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{row.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatDate(row.createdAt)}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {myMemberId ? (
        <section className="space-y-3">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
            Savings pockets
          </h2>
          <p className="text-sm text-muted-foreground">
            Popular picks: Hajj, Umra, and Udhiyah — deposit from your wallet, withdraw back.
          </p>

          {pockets.length ? (
            <ul className="divide-y divide-border rounded-xl border border-border bg-card">
              {pockets.map((pocket) => (
                <li key={pocket.id} className="space-y-3 p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {POCKET_LABELS[pocket.category] ?? pocket.category}
                        {pocket.label ? ` · ${pocket.label}` : ''}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {pocket.targetAmount
                          ? `Target ${formatCurrency(pocket.targetAmount, pocket.currency)}`
                          : 'No target'}
                        {pocket.durationMonths ? ` · ${pocket.durationMonths} months` : ''}
                      </p>
                    </div>
                    <p className="text-lg font-semibold">
                      {formatCurrency(pocket.balance, pocket.currency)}
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <form action={moveSavingsPocketAction} className="flex gap-2">
                      <input type="hidden" name="pocketId" value={pocket.id} />
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="direction" value="deposit" />
                      <Input
                        name="amount"
                        type="number"
                        inputMode="decimal"
                        min="1"
                        step="0.01"
                        required
                        placeholder="Deposit"
                        className="h-10"
                      />
                      <Button type="submit" size="sm" className="min-h-10 shrink-0">
                        Deposit
                      </Button>
                    </form>
                    <form action={moveSavingsPocketAction} className="flex gap-2">
                      <input type="hidden" name="pocketId" value={pocket.id} />
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="direction" value="withdraw" />
                      <Input
                        name="amount"
                        type="number"
                        inputMode="decimal"
                        min="1"
                        step="0.01"
                        required
                        placeholder="Withdraw"
                        className="h-10"
                      />
                      <Button type="submit" size="sm" variant="outline" className="min-h-10 shrink-0">
                        Withdraw
                      </Button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No pockets yet — create one below.</p>
          )}

          <form
            action={createSavingsPocketAction}
            className="grid max-w-xl gap-3 rounded-xl border border-border bg-card p-5 sm:grid-cols-2"
          >
            <input type="hidden" name="jamiyaId" value={jamiyaId} />
            <input type="hidden" name="memberId" value={myMemberId} />
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="currency" value={currency} />
            <div className="space-y-1">
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                name="category"
                className="h-10 w-full border border-input bg-background px-3"
                defaultValue="hajj"
              >
                {POCKET_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="label">Label (optional)</Label>
              <Input id="label" name="label" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="targetAmount">Target amount (optional)</Label>
              <Input
                id="targetAmount"
                name="targetAmount"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="durationMonths">Goal period (Hajj / Umra / Udhiyah / custom)</Label>
              <select
                id="durationMonths"
                name="durationMonths"
                className="h-10 w-full border border-input bg-background px-3"
                defaultValue="12"
              >
                <option value="1">1 month</option>
                <option value="3">3 months</option>
                <option value="6">6 months</option>
                <option value="12">12 months</option>
              </select>
            </div>
            <Button type="submit" className="min-h-11 w-full sm:w-fit sm:col-span-2">
              Create pocket
            </Button>
          </form>
        </section>
      ) : null}
    </div>
  );
}

export function NextPayoutBoard({
  next,
  currency,
}: {
  next: {
    memberLabel: string;
    memberCode: string | null;
    cycleNumber: number;
    amount: number;
    scheduledDate: string;
    status: string;
  } | null;
  currency: string;
}) {
  if (!next) {
    return (
      <section className="amanah-surface border-dashed px-5 py-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Merry-go-round
        </p>
        <h2 className="mt-1 font-[family-name:var(--font-display)] text-xl font-semibold">
          NEXT
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">No upcoming payout scheduled.</p>
      </section>
    );
  }

  return (
    <section className="amanah-surface border-accent/25 px-5 py-5">
      <p className="text-xs font-medium uppercase tracking-wide text-accent">Merry-go-round</p>
      <h2 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold">
        NEXT · {next.memberLabel}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {next.memberCode ? `${next.memberCode} · ` : ''}Cycle {next.cycleNumber} ·{' '}
        {formatCurrency(next.amount, currency)} · {formatDate(next.scheduledDate)} ·{' '}
        {next.status}
      </p>
    </section>
  );
}
