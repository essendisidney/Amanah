import { NextResponse } from 'next/server';
import { mpesaHealth } from '@/lib/payments/mpesa';
import { paymentProvider } from '@/lib/payments/provider';
import {
  requireRealProviders,
  shouldBlockSimulatedPayments,
} from '@/lib/production-cutover';

/** Ops probe: Daraja readiness on Edge `payments-mpesa` + Vercel payment flags. */
export async function GET() {
  const health = await mpesaHealth();
  const payment_provider = paymentProvider();
  const body = {
    ok: health.ok,
    service: 'amanah-mpesa',
    daraja_configured: health.daraja_configured ?? false,
    b2c_configured: health.b2c_configured ?? false,
    payment_provider,
    require_real: requireRealProviders(),
    simulated_blocked: shouldBlockSimulatedPayments(),
    error: health.error ?? null,
    hint: health.hint ?? null,
    timestamp: new Date().toISOString(),
  };

  // Structured probe: 200 when the Edge answers (even if Daraja is off);
  // 503 only when the function/auth path itself is broken.
  const authBroken = health.error === 'UNAUTHORIZED' || health.error === 'Missing Supabase env';
  return NextResponse.json(body, { status: authBroken || !health.ok ? 503 : 200 });
}
