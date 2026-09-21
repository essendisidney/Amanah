import { Button, Input, Label } from '@jamiya/ui';
import { formatCurrency } from '@jamiya/shared';
import { levyFineAction } from '@/features/circles/actions/treasury-actions';
import { recordMemberLoanEventAction } from '@/features/circles/actions/loan-actions';
import { FacilityRepayPreview } from './facility-repay-preview';

type FineCategory = {
  id: string;
  name: string;
  default_amount: number | string;
  currency: string;
};

type Props = {
  jamiyaId: string;
  slug: string;
  memberId: string;
  memberLabel: string;
  currency: string;
  facilityBalance: number;
  fineCategories: FineCategory[];
  returnPath: string;
};

const today = () => new Date().toISOString().slice(0, 10);

/** Officer money actions on the member 360 statement — fine + facility. */
export function StatementOfficerMoney({
  jamiyaId,
  slug,
  memberId,
  memberLabel,
  currency,
  facilityBalance,
  fineCategories,
  returnPath,
}: Props) {
  return (
    <section
      id="record-money"
      className="space-y-4 rounded-xl border border-border bg-card p-5 print:hidden"
    >
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          Record for {memberLabel}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Fine, new facility, or repayment — stays on this statement after save. Fines are here
          (not on Member payments).
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <form action={levyFineAction} className="space-y-3 rounded-lg border border-accent/30 bg-accent/5 p-4">
          <h3 className="font-semibold">Record fine</h3>
          <p className="text-xs text-muted-foreground">
            Late meeting, missed duty, etc. Needs a fine category from Treasury first.
          </p>
          <input type="hidden" name="jamiyaId" value={jamiyaId} />
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="memberId" value={memberId} />
          <input type="hidden" name="returnPath" value={returnPath} />
          {fineCategories.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No fine categories yet. Create one under Treasury → Member fining first.
            </p>
          ) : (
            <>
              <div className="space-y-1">
                <Label htmlFor="stmt-fine-cat">Fine category</Label>
                <select
                  id="stmt-fine-cat"
                  name="fineCategoryId"
                  required
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  defaultValue={fineCategories[0]?.id ?? ''}
                >
                  {fineCategories.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({formatCurrency(Number(f.default_amount), f.currency || currency)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="stmt-fine-amount">Override amount (optional)</Label>
                <Input id="stmt-fine-amount" name="amount" type="number" min={0} step="1" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="stmt-fine-notes">Notes</Label>
                <Input id="stmt-fine-notes" name="notes" placeholder="Meeting of …" />
              </div>
              <Button type="submit" className="min-h-10 w-full sm:w-auto">
                Save fine
              </Button>
            </>
          )}
        </form>

        <form
          action={recordMemberLoanEventAction}
          className="space-y-3 rounded-lg border border-border p-4"
        >
          <h3 className="font-semibold">New facility</h3>
          <p className="text-xs text-muted-foreground">
            Current balance {formatCurrency(facilityBalance, currency)}.
          </p>
          <input type="hidden" name="jamiyaId" value={jamiyaId} />
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="memberId" value={memberId} />
          <input type="hidden" name="eventType" value="disbursement" />
          <input type="hidden" name="returnPath" value={returnPath} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="stmt-fac-amount">Amount</Label>
              <Input id="stmt-fac-amount" name="amount" type="number" min={1} step="1" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="stmt-fac-date">Date</Label>
              <Input
                id="stmt-fac-date"
                name="effectiveDate"
                type="date"
                defaultValue={today()}
                required
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="stmt-fac-notes">Notes</Label>
              <Input id="stmt-fac-notes" name="notes" placeholder="Optional" />
            </div>
          </div>
          <Button type="submit" variant="outline" className="min-h-10 w-full sm:w-auto">
            Save facility
          </Button>
        </form>

        <form
          action={recordMemberLoanEventAction}
          className="space-y-3 rounded-lg border border-border p-4 lg:col-span-2"
        >
          <h3 className="font-semibold">Facility repayment</h3>
          <p className="text-xs text-muted-foreground">
            Balance now {formatCurrency(facilityBalance, currency)}. Enter total paid; put any
            profit in the profit field.
          </p>
          <input type="hidden" name="jamiyaId" value={jamiyaId} />
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="memberId" value={memberId} />
          <input type="hidden" name="eventType" value="repayment" />
          <input type="hidden" name="returnPath" value={returnPath} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="stmt-repay-amount">Amount paid</Label>
              <Input
                id="stmt-repay-amount"
                name="amount"
                type="number"
                min={1}
                step="1"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="stmt-repay-profit">Profit portion</Label>
              <Input
                id="stmt-repay-profit"
                name="profitAmount"
                type="number"
                min={0}
                step="1"
                defaultValue={0}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="stmt-repay-date">Date</Label>
              <Input
                id="stmt-repay-date"
                name="effectiveDate"
                type="date"
                defaultValue={today()}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="stmt-repay-notes">Notes</Label>
              <Input id="stmt-repay-notes" name="notes" placeholder="Optional" />
            </div>
          </div>
          <FacilityRepayPreview currency={currency} facilityBalance={facilityBalance} />
          <Button type="submit" variant="outline" className="min-h-10 w-full sm:w-auto">
            Save repayment
          </Button>
        </form>
      </div>
    </section>
  );
}
