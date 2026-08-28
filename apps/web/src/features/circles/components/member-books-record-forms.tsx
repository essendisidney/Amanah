import { Button, Input, Label } from '@jamiya/ui';
import {
  recordMemberBookEntryAction,
  recordMemberSharesAction,
  recordMonthlySavingsAction,
} from '@/features/circles/actions/books-actions';

const todayIso = () => new Date().toISOString().slice(0, 10);

type Props = {
  jamiyaId: string;
  slug: string;
  memberId: string;
  currency: string;
  parValue: number;
};

export function MemberBooksRecordForms({
  jamiyaId,
  slug,
  memberId,
  currency,
  parValue,
}: Props) {
  const today = todayIso();
  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <form
        action={recordMemberSharesAction}
        className="space-y-3 rounded-xl border border-border bg-card p-5"
      >
        <h3 className="font-semibold">Shares one off</h3>
        <p className="text-sm text-muted-foreground">
          SHARES ONE OFF — usually 5,000 on 5 Feb.
        </p>
        <input type="hidden" name="jamiyaId" value={jamiyaId} />
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="memberId" value={memberId} />
        <input type="hidden" name="parValue" value={parValue || ''} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="shareAmount">Amount ({currency})</Label>
            <Input id="shareAmount" name="amount" type="number" min="1" step="0.01" defaultValue={5000} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sharesCount">Or shares</Label>
            <Input id="sharesCount" name="shares" type="number" min="0.0001" step="0.0001" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="purchasedOn">Date</Label>
            <Input id="purchasedOn" name="purchasedOn" type="date" defaultValue={today} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="shareNotes">Notes</Label>
            <Input id="shareNotes" name="notes" defaultValue="Shares one off" />
          </div>
        </div>
        <Button type="submit" className="min-h-11">
          Save share capital
        </Button>
      </form>

      <form
        action={recordMonthlySavingsAction}
        className="space-y-3 rounded-xl border border-border bg-card p-5"
      >
        <h3 className="font-semibold">Monthly contributions (bulk)</h3>
        <p className="text-sm text-muted-foreground">Same amount each month, e.g. 2,000 × 6 from Feb.</p>
        <input type="hidden" name="jamiyaId" value={jamiyaId} />
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="memberId" value={memberId} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="monthlyAmount">Each month</Label>
            <Input id="monthlyAmount" name="amount" type="number" min="1" step="0.01" defaultValue={2000} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="months">Months</Label>
            <Input id="months" name="months" type="number" min="1" max="36" defaultValue={6} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="startDate">First date</Label>
            <Input id="startDate" name="startDate" type="date" defaultValue={today} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="savingsNotes">Notes</Label>
            <Input id="savingsNotes" name="notes" defaultValue="Monthly contribution" />
          </div>
        </div>
        <Button type="submit" className="min-h-11">
          Save bulk months
        </Button>
      </form>

      <form
        action={recordMemberBookEntryAction}
        className="space-y-3 rounded-xl border border-border bg-card p-5"
      >
        <h3 className="font-semibold">One month only</h3>
        <p className="text-sm text-muted-foreground">If one month differs (e.g. Viola March 3,000).</p>
        <input type="hidden" name="jamiyaId" value={jamiyaId} />
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="memberId" value={memberId} />
        <input type="hidden" name="entryType" value="contribution" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="oneMonthAmount">Amount</Label>
            <Input id="oneMonthAmount" name="amount" type="number" min="1" step="0.01" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="oneMonthDate">Date</Label>
            <Input id="oneMonthDate" name="effectiveDate" type="date" required />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="oneMonthNotes">Notes</Label>
            <Input id="oneMonthNotes" name="notes" placeholder="e.g. March contribution" />
          </div>
        </div>
        <Button type="submit" className="min-h-11" variant="outline">
          Save this month
        </Button>
      </form>

      <form
        action={recordMemberBookEntryAction}
        className="space-y-3 rounded-xl border border-border bg-card p-5"
      >
        <h3 className="font-semibold">Loan</h3>
        <input type="hidden" name="jamiyaId" value={jamiyaId} />
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="memberId" value={memberId} />
        <input type="hidden" name="entryType" value="loan" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="loanAmount">Amount</Label>
            <Input id="loanAmount" name="amount" type="number" min="1" step="0.01" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="loanDate">Date</Label>
            <Input id="loanDate" name="effectiveDate" type="date" defaultValue={today} required />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="loanNotes">Notes</Label>
            <Input id="loanNotes" name="notes" placeholder="From sheet" />
          </div>
        </div>
        <Button type="submit" className="min-h-11">
          Save loan
        </Button>
      </form>

      <form
        action={recordMemberBookEntryAction}
        className="space-y-3 rounded-xl border border-border bg-card p-5 lg:col-span-2"
      >
        <h3 className="font-semibold">Loan repayment</h3>
        <input type="hidden" name="jamiyaId" value={jamiyaId} />
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="memberId" value={memberId} />
        <input type="hidden" name="entryType" value="loan_repayment" />
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="repayAmount">Amount paid</Label>
            <Input id="repayAmount" name="amount" type="number" min="1" step="0.01" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="repayDate">Date</Label>
            <Input id="repayDate" name="effectiveDate" type="date" defaultValue={today} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="repayNotes">Notes</Label>
            <Input id="repayNotes" name="notes" placeholder="Paid fully / installment" />
          </div>
        </div>
        <Button type="submit" className="min-h-11">
          Save repayment
        </Button>
      </form>
    </section>
  );
}
