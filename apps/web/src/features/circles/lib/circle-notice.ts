import { redirect } from 'next/navigation';

/** Flash a notice on the circle detail page after a server action. */
export function redirectWithCircleNotice(
  slug: string,
  message: string,
  type: 'success' | 'error' = 'error',
): never {
  const params = new URLSearchParams({
    notice: message,
    noticeType: type,
  });
  redirect(`/circles/${slug}?${params.toString()}`);
}

export function mapMoneyError(code: string | undefined | null): string {
  const messages: Record<string, string> = {
    INSUFFICIENT_FUNDS: 'Not enough wallet balance. Top up your wallet, then try again.',
    INSUFFICIENT_POCKET: 'Not enough balance in this savings pocket.',
    INVALID_AMOUNT: 'Enter a valid amount.',
    FORBIDDEN: 'You do not have permission for this action.',
    NOT_FOUND: 'That item was not found.',
    UNAUTHENTICATED: 'Sign in again, then retry.',
    AGREEMENT_REQUIRED: 'Borrower must accept the facility agreement first.',
  };
  if (!code) return 'Something went wrong. Please try again.';
  if (messages[code]) return messages[code];
  if (code.toLowerCase().includes('insufficient')) {
    return messages.INSUFFICIENT_FUNDS;
  }
  return code;
}
