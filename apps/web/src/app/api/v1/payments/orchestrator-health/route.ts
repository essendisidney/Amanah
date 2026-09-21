import { NextResponse } from 'next/server';
import { orchestratorHealth } from '@/lib/payments/orchestrator';

/** Public-ish ops probe for payment routing (no secrets). */
export async function GET() {
  const health = orchestratorHealth();
  return NextResponse.json({
    ok: true,
    service: 'jameiyah-payment-orchestrator',
    ...health,
    timestamp: new Date().toISOString(),
  });
}
