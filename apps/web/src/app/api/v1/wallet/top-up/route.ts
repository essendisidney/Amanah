import { NextResponse } from 'next/server';
import { createApiClient } from '@/lib/supabase/api';

export async function POST(request: Request) {
  const supabase = await createApiClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: 'UNAUTHENTICATED' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    amount?: number;
    currency?: string;
    phone?: string;
  } | null;

  if (!body?.amount || body.amount < 100) {
    return NextResponse.json({ ok: false, error: 'INVALID_AMOUNT' }, { status: 400 });
  }

  const providerEnv = (process.env.PAYMENT_PROVIDER ?? 'simulated').toLowerCase();
  const provider =
    providerEnv === 'mpesa' || providerEnv === 'bank' ? providerEnv : 'simulated';

  const { data, error } = await supabase.rpc('create_payment_intent', {
    p_amount: body.amount,
    p_currency: (body.currency ?? 'KES').toUpperCase(),
    p_phone: body.phone ?? null,
    p_provider: provider,
    p_idempotency_key: `api-topup:${user.id}:${body.amount}:${Date.now()}`,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const created = data as { ok?: boolean; intent_id?: string; error?: string } | null;
  if (!created?.ok || !created.intent_id) {
    return NextResponse.json(
      { ok: false, error: created?.error ?? 'CREATE_FAILED' },
      { status: 400 },
    );
  }

  if (provider === 'simulated') {
    const { data: completed } = await supabase.rpc('complete_payment_intent', {
      p_intent_id: created.intent_id,
      p_provider_reference: `api-sim:${created.intent_id}`,
      p_metadata: { source: 'api_v1' },
    });
    return NextResponse.json({ ok: true, intent_id: created.intent_id, completed });
  }

  return NextResponse.json({
    ok: true,
    intent_id: created.intent_id,
    status: 'pending',
    provider,
  });
}
