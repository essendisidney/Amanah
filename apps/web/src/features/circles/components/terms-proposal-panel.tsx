import { formatCurrency, formatDate } from '@jamiya/shared';
import { Button, Input, Label } from '@jamiya/ui';
import {
  cancelTermsProposalAction,
  proposeTermsChangeAction,
} from '../actions/circle-terms-vote-actions';
import {
  diffCircleTerms,
  type CircleTerms,
  type CircleTermsProposal,
} from '../lib/circle-terms';

/**
 * Officers: raising a fee or penalty goes to a members' vote. Shows the live proposal, or the
 * form to make one. Lowering a fee needs no vote and stays in the penalty settings above.
 */
export function TermsProposalPanel({
  jamiyaId,
  slug,
  terms,
  proposal,
}: {
  jamiyaId: string;
  slug: string;
  terms: CircleTerms;
  proposal: CircleTermsProposal | null;
}) {
  const money = (n: number) => formatCurrency(n, terms.currency);
  const live = proposal && (proposal.status === 'open' || proposal.status === 'passed') ? proposal : null;

  return (
    <section className="jameiyah-surface space-y-4 px-5 py-5">
      <div>
        <h2 className="text-lg font-semibold">Fee changes</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Raising a fee or penalty needs a members’ vote: half the members must vote, and more must
          vote yes than no. An approved change takes effect 7 days later, and each member keeps
          their current terms until they accept the new ones. Lowering a fee needs no vote.
        </p>
      </div>

      {live ? (
        <div className="space-y-3 rounded-xl border border-border p-4">
          <p className="font-semibold">
            {live.status === 'open'
              ? `Members are voting until ${formatDate(live.voting_closes_at)}`
              : `Approved: takes effect on ${live.effective_at ? formatDate(live.effective_at) : 'soon'}`}
          </p>
          <ul className="space-y-1 text-sm">
            {diffCircleTerms(live.terms_before, live.terms_after, money).map((c) => (
              <li key={c.label}>
                <span className="font-medium">{c.label}:</span> {c.before} → {c.after}
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">
            {live.yes_votes} yes · {live.no_votes} no · {live.eligible_voters} members can vote ·{' '}
            {live.quorum} needed to decide
          </p>
          <form action={cancelTermsProposalAction}>
            <input type="hidden" name="proposalId" value={live.id} />
            <input type="hidden" name="slug" value={slug} />
            <Button type="submit" variant="outline">
              Withdraw proposal
            </Button>
          </form>
        </div>
      ) : (
        <form action={proposeTermsChangeAction} className="space-y-4">
          <input type="hidden" name="jamiyaId" value={jamiyaId} />
          <input type="hidden" name="slug" value={slug} />
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ['joinFeeAmount', 'Join fee', terms.join_fee_amount],
                ['transactionFeeAmount', 'Contribution fee', terms.transaction_fee_amount],
                ['earlySlotFeePct', 'Early payout slot fee (%)', terms.early_slot_fee_pct],
                ['lateContributionPenalty', 'Late contribution penalty', terms.late_contribution_penalty],
                ['missedContributionPenalty', 'Missed contribution penalty', terms.missed_contribution_penalty],
                ['lateLoanPenaltyFixed', 'Late loan penalty (fixed)', terms.late_loan_penalty_fixed],
                ['lateLoanPenaltyPct', 'Late loan penalty (%)', terms.late_loan_penalty_pct],
              ] as const
            ).map(([name, label, value]) => (
              <div key={name} className="space-y-1">
                <Label htmlFor={name}>{label}</Label>
                <Input
                  id={name}
                  name={name}
                  type="number"
                  min={0}
                  step="0.01"
                  defaultValue={Number(value ?? 0)}
                />
              </div>
            ))}
            <div className="space-y-1">
              <Label htmlFor="payoutComplianceMode">At payout</Label>
              <select
                id="payoutComplianceMode"
                name="payoutComplianceMode"
                defaultValue={terms.payout_compliance_mode ?? 'block'}
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="block">Payout waits until dues are paid</option>
                <option value="approve">Officers approve each payout</option>
                <option value="deduct">Take dues and penalties from payouts</option>
                <option value="allow">Pay out regardless of dues</option>
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="autoFineEnabled"
              className="h-4 w-4"
              defaultChecked={Boolean(terms.auto_fine_enabled)}
            />
            Automatic fines for late contributions
          </label>
          <div className="space-y-1">
            <Label htmlFor="reason">Why is this change needed?</Label>
            <textarea
              id="reason"
              name="reason"
              required
              minLength={5}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <Button type="submit">Ask members to vote</Button>
        </form>
      )}
    </section>
  );
}
