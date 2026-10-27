import { NextResponse } from 'next/server';
import { canSeeOpsDetails } from '@/lib/ops-access';
import { mpesaHealth } from '@/lib/payments/mpesa';
import { paymentProvider } from '@/lib/payments/provider';
import {
  requireRealProviders,
  shouldBlockSimulatedPayments,
} from '@/lib/production-cutover';

/** Ops probe: Daraja readiness on Edge `payments-mpesa` + Vercel payment flags. */
export async function GET(request: Request) {
  const health = await mpesaHealth();
  const payment_provider = paymentProvider();
  const mpesaRequired = payment_provider === 'mpesa';

  const body = {
    ok: mpesaRequired ? health.ok : true,
    service: 'jameiyah-mpesa',
    daraja_configured: health.daraja_configured ?? false,
    b2c_configured: health.b2c_configured ?? false,
    payment_provider,
    require_real: requireRealProviders(),
    simulated_blocked: shouldBlockSimulatedPayments(),
    mpesa_edge_ok: health.ok,
    error: health.error ?? null,
    hint: health.hint ?? null,
    note: mpesaRequired
      ? null
      : `App provider is ${payment_provider}; Daraja Edge probe is informational until PAYMENT_PROVIDER=mpesa.`,
    timestamp: new Date().toISOString(),
  };

  // 503 only when live M-Pesa is selected and the Edge auth/path is broken.
  if (mpesaRequired && (health.error === 'UNAUTHORIZED' || health.error === 'Missing Supabase env' || !health.ok)) {
    return respond(request, body, 503);
  }

  return respond(request, body, 200);
}

/** Everyone sees whether it is up; which keys and providers are set is for operators only. */
async function respond(request: Request, body: { ok?: boolean; service: string; timestamp: string }, status: number) {
  if (await canSeeOpsDetails(request)) return NextResponse.json(body, { status });
  return NextResponse.json({ ok: Boolean(body.ok), service: body.service, timestamp: body.timestamp }, { status });
}
