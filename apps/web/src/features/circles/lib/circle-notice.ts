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
  const base = pathSuffix
    ? `/circles/${slug}${pathSuffix.startsWith('/') ? pathSuffix : `/${pathSuffix}`}`
    : `/circles/${slug}`;
  redirect(`${base}?${params.toString()}`);
}

export function mapMoneyError(code: string | undefined | null): string {
  const messages: Record<string, string> = {
    INSUFFICIENT_FUNDS: 'Not enough wallet balance. Top up your wallet, then try again.',
    INSUFFICIENT_POCKET: 'Not enough balance in this savings pocket.',
    INSUFFICIENT_BALANCE: 'Not enough balance in that circle account.',
    INVALID_AMOUNT: 'Enter a valid amount.',
    FORBIDDEN: 'You do not have permission for this action.',
    NOT_FOUND: 'That item was not found.',
    UNAUTHENTICATED: 'Sign in again, then retry.',
    AGREEMENT_REQUIRED: 'Borrower must accept the facility agreement first.',
    GUARANTEES_PENDING: 'Wait until nominated guarantors accept or decline.',
    GUARANTEE_REQUIRED: 'At least one accepted guarantor is required for this request.',
  };
  if (!code) return 'Something went wrong. Please try again.';
  if (messages[code]) return messages[code];
  if (code.toLowerCase().includes('insufficient')) {
    return messages.INSUFFICIENT_FUNDS;
  }
  return code;
}
