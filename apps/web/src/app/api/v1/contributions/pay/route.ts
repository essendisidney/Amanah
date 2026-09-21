import { NextResponse } from 'next/server';
import { toE164Kenya } from '@jamiya/shared';
import { createApiClient } from '@/lib/supabase/api';
import { paymentProvider } from '@/lib/payments/provider';

export async function POST(request: Request) {
  const supabase = await createApiClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: 'UNAUTHENTICATED' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    contributionId?: string;
    amount?: number;
    /** wallet (default) | stk */
    method?: string;
    phone?: string;
  } | null;

  if (!body?.contributionId) {
    return NextResponse.json(
      { ok: false, error: 'CONTRIBUTION_ID_REQUIRED' },
      { status: 400 },
    );
  }

  const method = (body.method ?? 'wallet').toLowerCase();

  if (method === 'stk' || method === 'phone' || method === 'mpesa') {
    const provider = paymentProvider();
    const phoneRaw = (body.phone ?? user.phone ?? '').trim();
    const phone = phoneRaw ? toE164Kenya(phoneRaw) ?? phoneRaw : '';

    const { data: row, error: loadError } = await supabase
      .from('contributions')
      .select('id, amount, amount_paid, currency, status, members!inner(user_id)')
      .eq('id', body.contributionId)
      .maybeSingle();

    if (loadError || !row) {
      return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });
    }

    const contrib = row as {
      id: string;
      amount: number;
      amount_paid: number;
      currency: string;
      status: string;
      members: { user_id: string } | { user_id: string }[];
    };
    const memberUserId = Array.isArray(contrib.members)
      ? contrib.members[0]?.user_id
      : contrib.members?.user_id;
    if (memberUserId !== user.id) {
      return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 });
    }

    const remaining = Math.max(Number(contrib.amount) - Number(contrib.amount_paid ?? 0), 0);
    if (remaining <= 0) {
      return NextResponse.json({ ok: false, error: 'ALREADY_PAID' }, { status: 400 });
    }

    let amount = body.amount ?? remaining;
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ ok: false, error: 'INVALID_AMOUNT' }, { status: 400 });
    }
    amount = Math.min(amount, remaining);

    if (
      (provider === 'mpesa' || provider === 'intasend' || provider === 'tendepay') &&
      !/^\+[1-9]\d{7,14}$/.test(phone)
    ) {
      return NextResponse.json({ ok: false, error: 'PHONE_REQUIRED' }, { status: 400 });
    }

    const { data: created, error: intentError } = await supabase.rpc('create_payment_intent', {
      p_amount: amount,
      p_currency: contrib.currency || 'KES',
      p_phone: phone || null,
      p_provider: provider,
      p_idempotency_key: `contrib-api:${body.contributionId}:${amount}:${Date.now()}`,
      p_metadata: {
        kind: 'contribution',
        contribution_id: body.contributionId,
        source: 'api_contributions_pay',
      },
    });

    if (intentError) {
      return NextResponse.json({ ok: false, error: intentError.message }, { status: 500 });
    }

    const intent = created as { ok?: boolean; error?: string; intent_id?: string } | null;
    if (!intent?.ok || !intent.intent_id) {
      return NextResponse.json(
        { ok: false, error: intent?.error ?? 'CREATE_FAILED' },
        { status: 400 },
      );
    }

    const { collectPayment } = await import('@/lib/payments/orchestrator');
    const collected = await collectPayment({
      intentId: intent.intent_id,
      amount,
      currency: contrib.currency || 'KES',
      phone: phone || null,
      email: user.email,
      userId: user.id,
      description: 'Jameiyah contribution',
      metadata: { kind: 'contribution', contribution_id: body.contributionId },
    });

    if (!collected.ok) {
      return NextResponse.json({ ok: false, error: collected.error }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      method: 'stk',
      intentId: intent.intent_id,
      status: collected.status,
      redirectUrl: collected.redirectUrl ?? null,
      customerMessage: collected.customerMessage ?? null,
    });
  }

  const { data, error } = await supabase.rpc('pay_contribution', {
    p_contribution_id: body.contributionId,
    p_amount: body.amount ?? null,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    return NextResponse.json(
      { ok: false, error: result?.error ?? 'PAY_FAILED' },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, method: 'wallet', result });
}
