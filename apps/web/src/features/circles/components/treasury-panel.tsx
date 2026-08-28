import { formatCurrency, formatDate } from '@jamiya/shared';
import Link from 'next/link';
import type { Route } from 'next';
import { Button, Input, Label, Textarea } from '@jamiya/ui';
import {
  importBankAlertAction,
  matchBankAlertsAction,
  setBankAlertStatusAction,
} from '../actions/shares-actions';
import {
  createBankAccountAction,
  createFineCategoryAction,
  createInvestmentAction,
  createLedgerCategoryAction,
  ensureTreasuryAction,
  importBookEntriesAction,
  levyFineAction,
  recordTreasuryEntryAction,
} from '../actions/treasury-actions';
import {
  OpenPenaltiesPanel,
  type OpenPenaltyRow,
} from './open-penalties-panel';

export type TreasuryAccount = {
  id: string;
  name: string;
  accountKind: string;
  accountNumber: string | null;
  balance: number;
  currency: string;
};

export type TreasuryCategory = {
  id: string;
  kind: string;
  name: string;
};

export type FineCategory = {
  id: string;
  name: string;
  defaultAmount: number;
  currency: string;
};

export type TreasuryInvestment = {
  id: string;
  name: string;
  status: string;
  principal: number;
  currentValue: number;
  currency: string;
  startedOn: string | null;
};

export type TreasuryMember = {
  id: string;
  label: string;
  memberCode: string | null;
};

export type TreasurySnapshot = {
  cashAvailable: number;
  incomeTotal: number;
  expenseTotal: number;
  finesOpen: number;
  finesPaid: number;
  loansDisbursed: number;
  loansRepaid: number;
  investmentsValue: number;
  contributionsPaid: number;
  contributionsOutstanding: number;
};

export type CashbookRow = {
  id: string;
  entryType: string;
  amount: number;
  currency: string;
  effectiveDate: string;
  notes: string | null;
};

export type BankAlertRow = {
  id: string;
  provider: string;
  amount: number | null;
  currency: string;
  direction: string | null;
  status: string;
  alertText: string | null;
  createdAt: string;
};

export function TreasuryPanel({
  jamiyaId,
  slug,
  currency,
  canManage,
  snapshot,
  accounts,
  categories,
  fineCategories,
  investments,
  members,
  recentEntries,
  bankAlerts = [],
  openPenalties = [],
}: {
  jamiyaId: string;
  slug: string;
  currency: string;
  canManage: boolean;
  snapshot: TreasurySnapshot | null;
  accounts: TreasuryAccount[];
  categories: TreasuryCategory[];
  fineCategories: FineCategory[];
  investments: TreasuryInvestment[];
  members: TreasuryMember[];
  recentEntries: CashbookRow[];
  bankAlerts?: BankAlertRow[];
  openPenalties?: OpenPenaltyRow[];
}) {
  const today = new Date().toISOString().slice(0, 10);
  const incomeCats = categories.filter((c) => c.kind === 'income');
  const expenseCats = categories.filter((c) => c.kind === 'expense');

  return (
    <div className="space-y-10">
      {snapshot ? (
        <section className="space-y-3">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
            Group overview
          </h2>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Cash available', snapshot.cashAvailable],
              ['Contributions paid', snapshot.contributionsPaid],
              ['Contributions outstanding', snapshot.contributionsOutstanding],
              ['Open fines', snapshot.finesOpen],
              ['Income', snapshot.incomeTotal],
              ['Expenses', snapshot.expenseTotal],
              ['Loans disbursed', snapshot.loansDisbursed],
              ['Investments value', snapshot.investmentsValue],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border border-border bg-card p-4">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {label}
                </dt>
                <dd className="mt-1 text-lg font-semibold">
                  {formatCurrency(Number(value), currency)}
                </dd>
                {label === 'Contributions outstanding' &&
                canManage &&
                Number(value) > 0 ? (
                  <Link
                    href={`/circles/${slug}/arrears` as Route}
                    className="mt-2 inline-block text-xs text-accent underline-offset-4 hover:underline"
                  >
                    Open arrears
                  </Link>
                ) : null}
              </div>
            ))}
          </dl>
          <p className="text-sm text-muted-foreground">
            Fines paid {formatCurrency(snapshot.finesPaid, currency)} · Loans repaid{' '}
            {formatCurrency(snapshot.loansRepaid, currency)}
          </p>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          Account balances
        </h2>
        {accounts.length === 0 ? (
          <div className="space-y-3 rounded-xl border border-dashed border-border bg-muted/40 px-5 py-6">
            <p className="text-sm font-medium text-foreground">
              {canManage ? 'No accounts yet' : 'Treasury accounts not set up'}
            </p>
            <p className="text-sm text-muted-foreground">
              {canManage
                ? 'Seed Petty cash, M-Pesa, and Main bank defaults to start the cashbook.'
                : 'Ask an officer (chair, treasurer, or admin) to set up treasury accounts.'}
            </p>
            {canManage ? (
              <form action={ensureTreasuryAction}>
                <input type="hidden" name="jamiyaId" value={jamiyaId} />
                <input type="hidden" name="slug" value={slug} />
                <Button type="submit" className="min-h-11">
                  Seed defaults
                </Button>
              </form>
            ) : null}
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {accounts.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 px-5 py-4"
              >
                <div>
                  <p className="font-medium">{a.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.accountKind.replaceAll('_', ' ')}
                    {a.accountNumber ? ` · ${a.accountNumber}` : ''}
                  </p>
                </div>
                <p className="font-semibold">{formatCurrency(a.balance, a.currency)}</p>
              </li>
            ))}
          </ul>
        )}
        {canManage ? (
          <form
            action={createBankAccountAction}
            className="grid max-w-2xl gap-3 rounded-xl border border-border bg-card p-5 sm:grid-cols-2"
          >
            <input type="hidden" name="jamiyaId" value={jamiyaId} />
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="currency" value={currency} />
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="acctName">Add account</Label>
              <Input id="acctName" name="name" required minLength={2} placeholder="Equity Bank" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="acctKind">Type</Label>
              <select
                id="acctKind"
                name="accountKind"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                defaultValue="bank"
              >
                <option value="bank">Bank</option>
                <option value="mpesa">M-Pesa</option>
                <option value="petty_cash">Petty cash</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="acctNumber">Account / till (optional)</Label>
              <Input id="acctNumber" name="accountNumber" placeholder="01xxx / till" />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" size="sm">
                Add account
              </Button>
            </div>
          </form>
        ) : null}
      </section>

      {canManage ? (
        <section className="space-y-3">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
            Record payment / expense
          </h2>
          <p className="text-sm text-muted-foreground">
            Online treasurer cashbook — deposits, withdrawals, income, expenses, and transfers.
          </p>
          <form
            action={recordTreasuryEntryAction}
            className="grid max-w-2xl gap-3 rounded-xl border border-border bg-card p-5 sm:grid-cols-2"
          >
            <input type="hidden" name="jamiyaId" value={jamiyaId} />
            <input type="hidden" name="slug" value={slug} />
            <div className="space-y-1">
              <Label htmlFor="entryType">Type</Label>
              <select
                id="entryType"
                name="entryType"
                required
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                defaultValue="bank_deposit"
              >
                <option value="bank_deposit">Deposit</option>
                <option value="bank_withdrawal">Withdrawal</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
                <option value="bank_transfer">Transfer between accounts</option>
                <option value="investment">Investment funding</option>
                <option value="opening_balance">Opening balance</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="amount">Amount ({currency})</Label>
              <Input id="amount" name="amount" type="number" min="1" step="0.01" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="effectiveDate">Date</Label>
              <Input
                id="effectiveDate"
                name="effectiveDate"
                type="date"
                required
                defaultValue={today}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bankAccountId">Account</Label>
              <select
                id="bankAccountId"
                name="bankAccountId"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                defaultValue={accounts[0]?.id ?? ''}
              >
                <option value="">Select…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="counterpartyAccountId">To account (transfers)</Label>
              <select
                id="counterpartyAccountId"
                name="counterpartyAccountId"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                defaultValue=""
              >
                <option value="">—</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="categoryId">Category</Label>
              <select
                id="categoryId"
                name="categoryId"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                defaultValue=""
              >
                <option value="">—</option>
                {[...incomeCats, ...expenseCats].map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.kind}: {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="investmentId">Investment (optional)</Label>
              <select
                id="investmentId"
                name="investmentId"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                defaultValue=""
              >
                <option value="">—</option>
                {investments.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="memberId">Member (optional)</Label>
              <select
                id="memberId"
                name="memberId"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                defaultValue=""
              >
                <option value="">—</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                    {m.memberCode ? ` (${m.memberCode})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Input id="notes" name="notes" placeholder="Payment reference / memo" />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">Record entry</Button>
            </div>
          </form>
        </section>
      ) : null}

      {canManage ? (
        <section className="space-y-3">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
            Member fining
          </h2>
          <div id="open-fines" className="space-y-2 scroll-mt-24">
            <h3 className="text-sm font-medium text-foreground">Open fines</h3>
            <OpenPenaltiesPanel slug={slug} rows={openPenalties} returnPath="/treasury" />
          </div>
          <form
            action={levyFineAction}
            className="grid max-w-2xl gap-3 rounded-xl border border-border bg-card p-5 sm:grid-cols-2"
          >
            <input type="hidden" name="jamiyaId" value={jamiyaId} />
            <input type="hidden" name="slug" value={slug} />
            <div className="space-y-1">
              <Label htmlFor="fineMember">Member</Label>
              <select
                id="fineMember"
                name="memberId"
                required
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                defaultValue=""
              >
                <option value="" disabled>
                  Select member…
                </option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                    {m.memberCode ? ` (${m.memberCode})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="fineCategoryId">Fine category</Label>
              <select
                id="fineCategoryId"
                name="fineCategoryId"
                required
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                defaultValue={fineCategories[0]?.id ?? ''}
              >
                {fineCategories.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({formatCurrency(f.defaultAmount, f.currency)})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="fineAmount">Override amount (optional)</Label>
              <Input id="fineAmount" name="amount" type="number" min="0" step="0.01" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="fineNotes">Notes</Label>
              <Input id="fineNotes" name="notes" placeholder="Meeting of …" />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" size="sm">
                Levy fine
              </Button>
            </div>
          </form>
          <form
            action={createFineCategoryAction}
            className="grid max-w-xl gap-3 rounded-xl border border-dashed border-border p-4 sm:grid-cols-3"
          >
            <input type="hidden" name="jamiyaId" value={jamiyaId} />
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="currency" value={currency} />
            <Input name="name" placeholder="New fine category" required minLength={2} />
            <Input name="defaultAmount" type="number" min="0" step="0.01" placeholder="Amount" />
            <Button type="submit" size="sm" variant="outline">
              Add category
            </Button>
          </form>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          Investments & projects
        </h2>
        {investments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No investments tracked yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {investments.map((inv) => (
              <li
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-2 px-5 py-4"
              >
                <div>
                  <p className="font-medium">{inv.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {inv.status}
                    {inv.startedOn ? ` · started ${formatDate(inv.startedOn)}` : ''}
                  </p>
                </div>
                <p className="text-sm font-semibold">
                  {formatCurrency(inv.currentValue, inv.currency)}
                  <span className="block text-xs font-normal text-muted-foreground">
                    principal {formatCurrency(inv.principal, inv.currency)}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        )}
        {canManage ? (
          <form
            action={createInvestmentAction}
            className="grid max-w-2xl gap-3 rounded-xl border border-border bg-card p-5 sm:grid-cols-2"
          >
            <input type="hidden" name="jamiyaId" value={jamiyaId} />
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="currency" value={currency} />
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="invName">Project / investment name</Label>
              <Input id="invName" name="name" required minLength={2} placeholder="Plot in Kitengela" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="principal">Initial value</Label>
              <Input id="principal" name="principal" type="number" min="0" step="0.01" defaultValue={0} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="startedOn">Started</Label>
              <Input id="startedOn" name="startedOn" type="date" defaultValue={today} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={2} />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" size="sm">
                Add investment
              </Button>
            </div>
          </form>
        ) : null}
      </section>

      {canManage ? (
        <section className="space-y-3">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
            Income & expense categories
          </h2>
          <ul className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            {categories.map((c) => (
              <li key={c.id} className="rounded-full border border-border px-3 py-1">
                {c.kind}: {c.name}
              </li>
            ))}
          </ul>
          <form
            action={createLedgerCategoryAction}
            className="flex max-w-xl flex-wrap items-end gap-2"
          >
            <input type="hidden" name="jamiyaId" value={jamiyaId} />
            <input type="hidden" name="slug" value={slug} />
            <div className="space-y-1">
              <Label htmlFor="catKind">Kind</Label>
              <select
                id="catKind"
                name="kind"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                defaultValue="expense"
              >
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </div>
            <div className="min-w-[12rem] flex-1 space-y-1">
              <Label htmlFor="catName">Name</Label>
              <Input id="catName" name="name" required minLength={2} />
            </div>
            <Button type="submit" size="sm" variant="outline">
              Add
            </Button>
          </form>
        </section>
      ) : null}

      {canManage ? (
        <section className="space-y-3">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
            Bank SMS / alerts (scaffold)
          </h2>
          <p className="text-sm text-muted-foreground">
            Paste Equity/M-Pesa style alerts, then auto-match by amount, direction, account, and date
            window (±3 days).
          </p>
          <form action={matchBankAlertsAction} className="flex flex-wrap gap-2">
            <input type="hidden" name="jamiyaId" value={jamiyaId} />
            <input type="hidden" name="slug" value={slug} />
            <Button type="submit" size="sm">
              Auto-match pending alerts
            </Button>
          </form>
          <form
            action={importBankAlertAction}
            className="grid max-w-2xl gap-3 rounded-xl border border-border bg-card p-5 sm:grid-cols-2"
          >
            <input type="hidden" name="jamiyaId" value={jamiyaId} />
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="currency" value={currency} />
            <div className="space-y-1">
              <Label htmlFor="alertAmount">Amount</Label>
              <Input id="alertAmount" name="amount" type="number" min="1" step="0.01" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="direction">Direction</Label>
              <select
                id="direction"
                name="direction"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                defaultValue="credit"
              >
                <option value="credit">Credit</option>
                <option value="debit">Debit</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="provider">Provider</Label>
              <select
                id="provider"
                name="provider"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                defaultValue="manual"
              >
                <option value="manual">Manual</option>
                <option value="equity">Equity</option>
                <option value="mpesa">M-Pesa</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="alertAccount">Account</Label>
              <select
                id="alertAccount"
                name="bankAccountId"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                defaultValue=""
              >
                <option value="">—</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="alertText">Alert text</Label>
              <Textarea id="alertText" name="alertText" rows={2} placeholder="Raw SMS body…" />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" size="sm" variant="outline">
                Queue alert
              </Button>
            </div>
          </form>
          {bankAlerts.length > 0 ? (
            <ul className="divide-y divide-border rounded-xl border border-border bg-card">
              {bankAlerts.map((alert) => (
                <li key={alert.id} className="space-y-2 px-5 py-3 text-sm">
                  <div>
                    <p className="font-medium">
                      {alert.direction ?? '—'}{' '}
                      {alert.amount != null
                        ? formatCurrency(alert.amount, alert.currency)
                        : 'amount n/a'}{' '}
                      · {alert.provider} · {alert.status}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(alert.createdAt)}
                      {alert.alertText ? ` · ${alert.alertText}` : ''}
                    </p>
                  </div>
                  {alert.status === 'pending' ? (
                    <form action={setBankAlertStatusAction}>
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="alertId" value={alert.id} />
                      <input type="hidden" name="status" value="ignored" />
                      <Button type="submit" size="sm" variant="ghost">
                        Ignore
                      </Button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {canManage ? (
        <section className="space-y-3">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
            Backdate records (CSV)
          </h2>
          <p className="text-sm text-muted-foreground">
            Columns: entry_type, amount, effective_date, member_id (optional), notes
          </p>
          <form action={importBookEntriesAction} className="max-w-2xl space-y-3">
            <input type="hidden" name="jamiyaId" value={jamiyaId} />
            <input type="hidden" name="slug" value={slug} />
            <Textarea
              name="csv"
              rows={5}
              placeholder={`entry_type,amount,effective_date,member_id,notes\ncontribution,5000,2024-01-15,,Jan dues\nopening_balance,100000,2024-01-01,,migrated`}
              required
            />
            <Button type="submit" size="sm" variant="outline">
              Import rows
            </Button>
          </form>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          Recent cashbook
        </h2>
        {recentEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No treasury entries yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {recentEntries.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 px-5 py-3"
              >
                <div>
                  <p className="font-medium capitalize">
                    {row.entryType.replaceAll('_', ' ')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(row.effectiveDate)}
                    {row.notes ? ` · ${row.notes}` : ''}
                  </p>
                </div>
                <p className="font-semibold">{formatCurrency(row.amount, row.currency)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
