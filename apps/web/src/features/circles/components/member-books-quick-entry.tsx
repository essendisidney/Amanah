import { Button, Input, Label } from '@jamiya/ui';
import {
  recordMemberBookEntryAction,
  recordMemberSharesAction,
  recordMonthlySavingsAction,
} from '@/features/circles/actions/books-actions';

type Props = {
  jamiyaId: string;
  slug: string;
  memberId: string;
  memberLabel: string;
  currency: string;
  parValue: number;
  defaultShareAmount?: number;
  defaultMonthAmount?: number;
  defaultShareDate?: string;
  defaultStartDate?: string;
  defaultMonths?: number;
};

export function MemberBooksQuickEntry({
  jamiyaId,
  slug,
  memberId,
  memberLabel,
  currency,
  parValue,
  defaultShareAmount = 5000,
  defaultMonthAmount = 2000,
  defaultShareDate = '2026-02-05',
  defaultStartDate = '2026-02-05',
  defaultMonths = 6,
}: Props) {
  return (
    <section className="space-y-4 rounded-xl border border-accent/30 bg-accent/5 p-5">
      <div>
        <h2 className="text-lg font-semibold">Enter payments for {memberLabel}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Share buy-in (usually {defaultShareAmount.toLocaleString()} on 5 Feb), then monthly
          savings (usually {defaultMonthAmount.toLocaleString()} each month). Add a loan if needed.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <form
          action={recordMemberSharesAction}
          className="space-y-3 rounded-xl border border-border bg-card p-4"
        >
          <h3 className="font-semibold">1. Share buy-in</h3>
          <input type="hidden" name="jamiyaId" value={jamiyaId} />
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="memberId" value={memberId} />
          <input type="hidden" name="parValue" value={parValue || ''} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="shareAmount">Amount ({currency})</Label>
              <Input
                id="shareAmount"
                name="amount"
                type="number"
                min="1"
                step="1"
                defaultValue={defaultShareAmount}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="purchasedOn">Date</Label>
              <Input
                id="purchasedOn"
                name="purchasedOn"
                type="date"
                defaultValue={defaultShareDate}
                required
              />
            </div>
          </div>
          <Button type="submit" className="min-h-11 w-full sm:w-auto">
            Save share buy-in
          </Button>
        </form>

        <form
          action={recordMonthlySavingsAction}
          className="space-y-3 rounded-xl border border-border bg-card p-4"
        >
          <h3 className="font-semibold">2. Monthly savings</h3>
          <input type="hidden" name="jamiyaId" value={jamiyaId} />
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="memberId" value={memberId} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="monthlyAmount">Each month</Label>
              <Input
                id="monthlyAmount"
                name="amount"
                type="number"
                min="1"
                step="1"
                defaultValue={defaultMonthAmount}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="months">How many months</Label>
              <Input
                id="months"
                name="months"
                type="number"
                min="1"
                max="36"
                defaultValue={defaultMonths}
                required
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="startDate">First month date</Label>
              <Input
                id="startDate"
                name="startDate"
                type="date"
                defaultValue={defaultStartDate}
                required
              />
            </div>
          </div>
          <Button type="submit" className="min-h-11 w-full sm:w-auto">
            Save monthly savings
          </Button>
        </form>

        <form
          action={recordMemberBookEntryAction}
          className="space-y-3 rounded-xl border border-border bg-card p-4 lg:col-span-2"
        >
          <h3 className="font-semibold">3. Loan (optional)</h3>
          <input type="hidden" name="jamiyaId" value={jamiyaId} />
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="memberId" value={memberId} />
          <input type="hidden" name="entryType" value="loan" />
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="loanAmount">Amount</Label>
              <Input id="loanAmount" name="amount" type="number" min="1" step="1" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="loanDate">Date</Label>
              <Input
                id="loanDate"
                name="effectiveDate"
                type="date"
                defaultValue={defaultShareDate}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="loanNotes">Notes</Label>
              <Input id="loanNotes" name="notes" placeholder="Optional" />
            </div>
          </div>
          <Button type="submit" variant="outline" className="min-h-11 w-full sm:w-auto">
            Save loan
          </Button>
        </form>
      </div>
    </section>
  );
}
