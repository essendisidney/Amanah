import { NextResponse, type NextRequest } from 'next/server';
import { settlePaystackReference } from '@/lib/payments/paystack';
import { appBaseUrl } from '@/lib/payments/provider';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Browser return URL after Paystack Checkout.
 * Verifies the reference server-side, then redirects to wallet.
 */
export async function GET(req: NextRequest) {
  const reference = req.nextUrl.searchParams.get('reference')
    ?? req.nextUrl.searchParams.get('trxref');
  const base = appBaseUrl();

  if (!reference) {
    return NextResponse.redirect(
      `${base}/wallet?notice=${encodeURIComponent('Missing Paystack reference.')}&noticeType=error`,
    );
  }

  const settled = await settlePaystackReference(reference);
  if (!settled.ok) {
    return NextResponse.redirect(
      `${base}/wallet?notice=${encodeURIComponent(settled.error ?? 'Payment verification failed.')}&noticeType=error`,
    );
  }

  if (settled.status === 'success') {
    return NextResponse.redirect(
      `${base}/wallet?notice=${encodeURIComponent('Paystack payment confirmed. Wallet updated.')}&noticeType=success`,
    );
  }

  return NextResponse.redirect(
    `${base}/wallet?notice=${encodeURIComponent(`Payment status: ${settled.status ?? 'pending'}.`)}&noticeType=info`,
  );
}
