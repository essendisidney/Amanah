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
    otp?: string;
  } | null;

  if (!body?.amount || body.amount < 10) {
    return NextResponse.json({ ok: false, error: 'INVALID_AMOUNT' }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('phone')
    .eq('id', user.id)
    .maybeSingle();
  const { requireApiWalletStepUp } = await import('@/lib/wallet/step-up');
  const stepUp = await requireApiWalletStepUp({
    phoneRaw: String(
      (profile as { phone?: string | null } | null)?.phone ?? user.phone ?? body.phone ?? '',
    ),
    purpose: 'wallet_top_up',
    otp: body.otp,
  });
  if (!stepUp.ok) {
    return NextResponse.json(stepUp.body, { status: stepUp.status });
  }

  const providerEnv = (process.env.PAYMENT_PROVIDER ?? 'simulated').toLowerCase();
  const provider =
    providerEnv === 'mpesa' ||
    providerEnv === 'bank' ||
    providerEnv === 'paystack' ||
    providerEnv === 'intasend'
      ? providerEnv
      : 'simulated';

  const { data, error } = await supabase.rpc('create_payment_intent', {
    p_amount: body.amount,
    p_currency: (body.currency ?? 'KES').toUpperCase(),
    p_phone: body.phone ?? null,
    p_provider: provider,
    p_idempotency_key: `api-topup:${user.id}:${body.amount}:${Date.now()}`,
    p_metadata: { kind: 'wallet_top_up', source: 'api_v1' },
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

  if (provider === 'bank') {
    return NextResponse.json({
      ok: true,
      intent_id: created.intent_id,
      status: 'pending',
      provider,
    });
  }

  const { collectPayment } = await import('@/lib/payments/orchestrator');
  const collected = await collectPayment({
    intentId: created.intent_id,
    amount: body.amount,
    currency: (body.currency ?? 'KES').toUpperCase(),
    phone: body.phone ?? user.phone ?? null,
    email: user.email,
    userId: user.id,
    description: 'Jameiyah wallet top-up',
    metadata: { kind: 'wallet_top_up', source: 'api_v1' },
  });

  if (!collected.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: collected.error,
        intent_id: created.intent_id,
      },
      { status: collected.error.includes('phone') ? 400 : 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    intent_id: created.intent_id,
    status: collected.status,
    provider: collected.provider,
    fallback: collected.fallback ?? null,
    checkout_request_id: collected.checkoutRequestId ?? null,
    authorization_url: collected.redirectUrl ?? null,
    reference: collected.providerReference ?? null,
    message: collected.customerMessage ?? null,
  });
}
