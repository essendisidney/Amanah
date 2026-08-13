import { NextResponse } from 'next/server';
import {
  settlePaystackReference,
  verifyPaystackSignature,
} from '@/lib/payments/paystack';
import { logger } from '@/lib/observability';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Paystack webhook — configure in dashboard:
 * https://amanah-liart.vercel.app/api/webhooks/paystack
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-paystack-signature');

  if (!verifyPaystackSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 401 });
  }

  let event: { event?: string; data?: { reference?: string } };
  try {
    event = JSON.parse(rawBody) as typeof event;
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const reference = event.data?.reference;
  if (!reference) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  // charge.success is the primary settlement event; also settle on verify-worthy events.
  if (event.event && !['charge.success', 'paymentrequest.success'].includes(event.event)) {
    return NextResponse.json({ ok: true, ignored: true, event: event.event });
  }

  const settled = await settlePaystackReference(reference);
  if (!settled.ok) {
    logger.warn('paystack webhook settle failed', {
      reference,
      error: settled.error,
    });
    return NextResponse.json({ error: settled.error ?? 'SETTLE_FAILED' }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    intentId: settled.intentId,
    status: settled.status,
  });
}
