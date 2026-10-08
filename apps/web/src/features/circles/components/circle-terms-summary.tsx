import { formatCurrency } from '@jamiya/shared';
import { describeCircleTerms, type CircleTerms } from '../lib/circle-terms';

/** The circle's fees and penalties, in plain words, for a member to read before accepting. */
export function CircleTermsSummary({ terms }: { terms: CircleTerms }) {
  const lines = describeCircleTerms(terms, (amount) => formatCurrency(amount, terms.currency));

  if (lines.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        This circle charges no fees or penalties.
      </p>
    );
  }

  return (
    <dl className="space-y-2 text-sm">
      {lines.map((line) => (
        <div key={line.label} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
          <dt className="font-semibold sm:w-48 sm:shrink-0">{line.label}</dt>
          <dd className="text-muted-foreground">{line.value}</dd>
        </div>
      ))}
    </dl>
  );
}
