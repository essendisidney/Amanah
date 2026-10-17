/** Leaving a circle (request_circle_exit and friends). */

export type CircleExitStatus =
  | 'awaiting_recipient'
  | 'awaiting_approval'
  | 'approved'
  | 'rejected'
  | 'declined'
  | 'cancelled';

const ERRORS: Record<string, string> = {
  NOT_A_MEMBER: 'Only active members can leave a circle.',
  NOT_ACTIVE: 'Only active members can leave a circle.',
  ALREADY_REQUESTED: 'You have already asked to leave. Withdraw that request first.',
  OPEN_LOAN: 'Repay your loan first. Nobody can leave with a loan open.',
  UNPAID_DUES: 'Pay your overdue contributions first.',
  OPEN_PENALTIES: 'Pay or settle your open penalties first.',
  PAID_OUT_OWES_ROTATION:
    'You have already received your payout, so you owe the rest of the rotation. Finish your contributions, or agree a settlement with the officers.',
  LAST_ADMIN: 'You are the only circle admin. Make another member admin first.',
  SHARES_NEED_RECIPIENT: 'You hold shares. Choose the member who will take them over.',
  INVALID_RECIPIENT: 'Choose another active member of this circle.',
  NOT_FOUND: 'That request was not found.',
  NOT_AWAITING: 'That request has already moved on. Refresh the page.',
  OWN_REQUEST: 'Another officer has to approve your own request to leave.',
  RECIPIENT_GONE: 'The member taking the shares has left. Ask the leaver to choose someone else.',
};

export function exitErrorMessage(code: string | undefined | null): string {
  return (code && ERRORS[code]) ?? 'Something went wrong. Try again.';
}

/** Why a member cannot leave yet, in plain words; null when they can. */
export function exitBlockerMessage(code: string | null | undefined): string | null {
  return code ? exitErrorMessage(code) : null;
}

export function exitStatusLabel(status: CircleExitStatus): string {
  switch (status) {
    case 'awaiting_recipient':
      return 'Waiting for the member taking the shares to agree';
    case 'awaiting_approval':
      return 'Waiting for an officer to approve';
    case 'approved':
      return 'Approved: left the circle';
    case 'rejected':
      return 'Not approved';
    case 'declined':
      return 'The member declined the shares';
    case 'cancelled':
      return 'Withdrawn';
  }
}
