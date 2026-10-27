import { NextResponse } from 'next/server';
import { canSeeOpsDetails } from '@/lib/ops-access';
import { orchestratorHealth } from '@/lib/payments/orchestrator';

/** Ops probe for payment routing. Which adapters are configured is for operators only. */
export async function GET(request: Request) {
  const base = { ok: true, service: 'jameiyah-payment-orchestrator', timestamp: new Date().toISOString() };
  if (!(await canSeeOpsDetails(request))) return NextResponse.json(base);
  return NextResponse.json({ ...base, ...orchestratorHealth() });
}
