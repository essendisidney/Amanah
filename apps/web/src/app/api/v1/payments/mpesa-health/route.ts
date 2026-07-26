import { NextResponse } from 'next/server';
import { mpesaHealth } from '@/lib/payments/mpesa';

/** Ops probe: Daraja readiness on Edge `payments-mpesa`. */
export async function GET() {
  const health = await mpesaHealth();
  return NextResponse.json(
    {
      ok: health.ok,
      service: 'amanah-mpesa',
      daraja_configured: health.daraja_configured ?? false,
      payment_provider: process.env.PAYMENT_PROVIDER ?? 'simulated',
      require_real: process.env.REQUIRE_REAL_PROVIDERS === 'true',
      error: health.error ?? null,
      timestamp: new Date().toISOString(),
    },
    { status: health.ok ? 200 : 503 },
  );
}
