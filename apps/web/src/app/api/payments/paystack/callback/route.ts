import { NextResponse, type NextRequest } from 'next/server';
import { settlePaystackReference } from '@/lib/payments/paystack';
import { appBaseUrl } from '@/lib/payments/provider';
import { getSafeReturnPath, withNoticeQuery } from '@/features/auth/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Browser return URL after Paystack Checkout.
 * Verifies the reference server-side, then redirects to wallet or the stored return path.
 */
export async function GET(req: NextRequest) {
  const reference =
    req.nextUrl.searchParams.get('reference') ?? req.nextUrl.searchParams.get('trxref');
  const base = appBaseUrl();

  if (!reference) {
    return NextResponse.redirect(
      `${base}/wallet?notice=${encodeURIComponent('Missing Paystack reference.')}&noticeType=error`,
    );
  }

  const settled = await settlePaystackReference(reference);
  const returnPath = getSafeReturnPath(settled.returnPath ?? undefined) ?? '/wallet';

  if (!settled.ok) {
    return NextResponse.redirect(
      `${base}${withNoticeQuery(
        returnPath === '/wallet' ? '/wallet' : returnPath,
        settled.error ?? 'Payment verification failed.',
        'error',
      )}`,
    );
  }

  if (settled.status === 'success') {
    const dest = returnPath === '/wallet' ? '/wallet' : returnPath;
    const notice =
      dest === '/wallet'
        ? 'Paystack payment confirmed. Wallet updated.'
        : 'Wallet topped up. You can pay your contribution now.';
    return NextResponse.redirect(`${base}${withNoticeQuery(dest, notice, 'success')}`);
  }

  return NextResponse.redirect(
    `${base}${withNoticeQuery(
      returnPath === '/wallet' ? '/wallet' : returnPath,
      `Payment status: ${settled.status ?? 'pending'}.`,
      'info',
    )}`,
  );
}
