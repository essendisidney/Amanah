import { NextResponse } from 'next/server';
import { bankHealth } from '@/lib/payments/bank';
import { paymentProvider } from '@/lib/payments/provider';
import {
  requireRealProviders,
  shouldBlockSimulatedPayments,
} from '@/lib/production-cutover';

/** Ops probe: bank Edge readiness + Vercel payment flags. */
export async function GET() {
  const health = await bankHealth();
  const payment_provider = paymentProvider();
  const bankRequired = payment_provider === 'bank';
  const webhookSecret = Boolean(process.env.BANK_ALERT_WEBHOOK_SECRET?.trim());

  const body = {
    ok: bankRequired ? health.ok && (health.bank_configured || health.simulated_fallback) : true,
    service: 'amanah-bank',
    bank_configured: health.bank_configured ?? false,
    simulated_fallback: health.simulated_fallback ?? false,
    bank_alert_webhook: webhookSecret,
    payment_provider,
    require_real: requireRealProviders(),
    simulated_blocked: shouldBlockSimulatedPayments(),
    bank_edge_ok: health.ok,
    error: health.error ?? null,
    hint: health.hint ?? null,
    note: bankRequired
      ? null
      : `App provider is ${payment_provider}; bank Edge probe is informational until PAYMENT_PROVIDER=bank.`,
    timestamp: new Date().toISOString(),
  };

  if (bankRequired && (health.error === 'UNAUTHORIZED' || health.error === 'Missing Supabase env' || !health.ok)) {
    return NextResponse.json(body, { status: 503 });
  }

  return NextResponse.json(body, { status: 200 });
}
