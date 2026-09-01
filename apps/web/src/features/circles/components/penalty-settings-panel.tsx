import { Button, Input, Label } from '@jamiya/ui';
import {
  assessPenaltiesAction,
  updatePenaltySettingsAction,
} from '../actions/ops-actions';

export type PenaltySettings = {
  lateContributionPenalty: number;
  missedContributionPenalty: number;
  lateLoanPenaltyFixed: number;
  lateLoanPenaltyPct: number;
  payoutComplianceMode: string;
};

/** Officer controls for automatic fines and payout compliance. */
export function PenaltySettingsPanel({
  jamiyaId,
  slug,
  settings,
}: {
  jamiyaId: string;
  slug: string;
  settings: PenaltySettings;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          Penalties & payout compliance
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Set default fine amounts and how merry-go-round payouts handle members in arrears.
        </p>
      </div>
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
          <Button type="submit" className="min-h-11">
            Save settings
          </Button>
        </div>
      </form>
      <form action={assessPenaltiesAction}>
        <input type="hidden" name="jamiyaId" value={jamiyaId} />
        <input type="hidden" name="slug" value={slug} />
        <Button type="submit" variant="outline" size="sm" className="min-h-11">
          Assess late contribution penalties now
        </Button>
      </form>
    </section>
  );
}
