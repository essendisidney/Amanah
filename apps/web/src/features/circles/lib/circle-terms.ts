/** A circle's money terms as members see and accept them (private.circle_terms). */
export type CircleTerms = {
  version: number;
  currency: string;
  contribution_amount: number | string;
  join_fee_amount: number | string;
  transaction_fee_amount: number | string;
  early_slot_fee_pct: number | string;
  early_slot_fee_amount: number | string;
  late_contribution_penalty: number | string;
  missed_contribution_penalty: number | string;
  late_loan_penalty_fixed: number | string;
  late_loan_penalty_pct: number | string;
  auto_fine_enabled: boolean;
  payout_compliance_mode: string | null;
};

/** get_circle_terms / preview_invitation_terms */
export type CircleTermsView = {
  ok: boolean;
  error?: string;
  jamiya_id?: string;
  terms?: CircleTerms;
  has_charges?: boolean;
  accepted_version?: number | null;
  accepted_at?: string | null;
  needs_acceptance?: boolean;
};

export type CircleTermsLine = { label: string; value: string };

function num(v: number | string | null | undefined): number {
  const n = typeof v === 'number' ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Plain-language lines for every fee and penalty a circle charges, for the member to read
 * before accepting. Empty when the circle charges nothing.
 */
export function describeCircleTerms(
  terms: CircleTerms,
  money: (amount: number) => string,
): CircleTermsLine[] {
  const lines: CircleTermsLine[] = [];

  const join = num(terms.join_fee_amount);
  if (join > 0) {
    lines.push({ label: 'Join fee', value: `${money(join)}, once, when you join` });
  }

  const perContribution = num(terms.transaction_fee_amount);
  if (perContribution > 0) {
    lines.push({
      label: 'Contribution fee',
      value: `${money(perContribution)} each time a contribution is fully paid`,
    });
  }

  const earlySlot = num(terms.early_slot_fee_amount);
  if (earlySlot > 0) {
    lines.push({
      label: 'Early payout slot fee',
      value: `${money(earlySlot)} (${num(terms.early_slot_fee_pct)}% of a contribution), once, only if you take a slot in the first half of the payout order`,
    });
  }

  const late = num(terms.late_contribution_penalty);
  if (late > 0) {
    lines.push({ label: 'Late contribution penalty', value: money(late) });
  }

  const missed = num(terms.missed_contribution_penalty);
  if (missed > 0) {
    lines.push({ label: 'Missed contribution penalty', value: money(missed) });
  }

  const loanFixed = num(terms.late_loan_penalty_fixed);
  const loanPct = num(terms.late_loan_penalty_pct);
  if (loanFixed > 0 || loanPct > 0) {
    const parts = [
      loanFixed > 0 ? money(loanFixed) : null,
      loanPct > 0 ? `${loanPct}% of the overdue amount` : null,
    ].filter(Boolean);
    lines.push({ label: 'Late loan repayment penalty', value: parts.join(' + ') });
  }

  if (lines.length > 0 && terms.payout_compliance_mode === 'deduct') {
    lines.push({
      label: 'At payout',
      value: 'Unpaid dues and penalties are taken from your payout',
    });
  }

  return lines;
}

export type CircleTermsChange = { label: string; before: string; after: string };

const COMPLIANCE_LABELS: Record<string, string> = {
  block: 'Payout waits until dues are paid',
  approve: 'Officers approve each payout',
  deduct: 'Dues and penalties taken from payouts',
  allow: 'Payout made regardless of dues',
};

/** What a proposal changes, line by line, in plain words. */
export function diffCircleTerms(
  before: CircleTerms,
  after: CircleTerms,
  money: (amount: number) => string,
): CircleTermsChange[] {
  const rows: Array<[string, string, string]> = [
    ['Join fee', money(num(before.join_fee_amount)), money(num(after.join_fee_amount))],
    [
      'Contribution fee',
      money(num(before.transaction_fee_amount)),
      money(num(after.transaction_fee_amount)),
    ],
    [
      'Early payout slot fee',
      `${num(before.early_slot_fee_pct)}%`,
      `${num(after.early_slot_fee_pct)}%`,
    ],
    [
      'Late contribution penalty',
      money(num(before.late_contribution_penalty)),
      money(num(after.late_contribution_penalty)),
    ],
    [
      'Missed contribution penalty',
      money(num(before.missed_contribution_penalty)),
      money(num(after.missed_contribution_penalty)),
    ],
    [
      'Late loan penalty',
      `${money(num(before.late_loan_penalty_fixed))} + ${num(before.late_loan_penalty_pct)}%`,
      `${money(num(after.late_loan_penalty_fixed))} + ${num(after.late_loan_penalty_pct)}%`,
    ],
    [
      'Automatic fines',
      before.auto_fine_enabled ? 'On' : 'Off',
      after.auto_fine_enabled ? 'On' : 'Off',
    ],
    [
      'At payout',
      COMPLIANCE_LABELS[before.payout_compliance_mode ?? 'block'] ?? String(before.payout_compliance_mode),
      COMPLIANCE_LABELS[after.payout_compliance_mode ?? 'block'] ?? String(after.payout_compliance_mode),
    ],
  ];
  return rows
    .filter(([, b, a]) => b !== a)
    .map(([label, b, a]) => ({ label, before: b, after: a }));
}

/** get_circle_terms_proposals */
export type CircleTermsProposal = {
  id: string;
  status: 'open' | 'passed' | 'rejected' | 'applied' | 'cancelled';
  reason: string;
  terms_before: CircleTerms;
  terms_after: CircleTerms;
  eligible_voters: number;
  quorum: number;
  yes_votes: number;
  no_votes: number;
  voting_closes_at: string;
  decided_at: string | null;
  effective_at: string | null;
  applied_at: string | null;
  created_at: string;
  my_vote: boolean | null;
  can_vote: boolean;
};
