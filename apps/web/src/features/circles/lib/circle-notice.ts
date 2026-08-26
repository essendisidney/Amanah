import { redirect } from 'next/navigation';

/** Flash a notice on a circle page after a server action. */
export function redirectWithCircleNotice(
  slug: string,
  message: string,
  type: 'success' | 'error' = 'error',
  pathSuffix = '',
): never {
  const params = new URLSearchParams({
    notice: message,
    noticeType: type,
  });
  let path = `/circles/${slug}`;
  if (pathSuffix) {
    const suffix = pathSuffix.startsWith('/') ? pathSuffix : `/${pathSuffix}`;
    const q = suffix.indexOf('?');
    if (q >= 0) {
      path += suffix.slice(0, q);
      new URLSearchParams(suffix.slice(q + 1)).forEach((value, key) => {
        params.set(key, value);
      });
    } else {
      path += suffix;
    }
  }
  redirect(`${path}?${params.toString()}`);
}

export function mapMoneyError(code: string | undefined | null): string {
  const messages: Record<string, string> = {
    INSUFFICIENT_FUNDS: 'Not enough wallet balance. Top up your wallet, then try again.',
    WALLET_NOT_FOUND: 'Open Wallet once to create a KES balance, then retry.',
    MEMBER_LIMIT: 'This circle has more members than the selected plan allows.',
    PLAN_NOT_FOUND: 'That plan is not available.',
    INSUFFICIENT_POCKET: 'Not enough balance in this savings pocket.',
    INSUFFICIENT_BALANCE: 'Not enough balance in that circle account.',
    INVALID_AMOUNT: 'Enter a valid amount.',
    SECOND_APPROVER_MUST_DIFFER:
      'A different person must second-approve. You already gave the first approval.',
    FORBIDDEN: 'You do not have permission for this action.',
    NOT_FOUND: 'That item was not found.',
    UNAUTHENTICATED: 'Sign in again, then retry.',
    NOT_PENDING: 'This request is no longer pending.',
    AGREEMENT_REQUIRED: 'Borrower must accept the facility agreement first.',
    GUARANTEES_PENDING: 'Wait until nominated guarantors accept or decline.',
    GUARANTEE_REQUIRED: 'At least one accepted guarantor is required for this request.',
  };
  if (!code) return 'Something went wrong. Please try again.';
  const mapped = messages[code];
  if (mapped) return mapped;
  if (code.toLowerCase().includes('insufficient')) {
    return messages.INSUFFICIENT_FUNDS;
  }
  return code;
}
