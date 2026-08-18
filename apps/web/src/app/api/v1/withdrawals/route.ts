import { NextResponse } from 'next/server';
import { createApiClient } from '@/lib/supabase/api';

export async function GET(request: Request) {
  const supabase = await createApiClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: 'UNAUTHENTICATED' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('withdrawal_requests')
    .select(
      'id, amount, currency, status, destination_type, created_at, processed_at, failure_reason',
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, withdrawals: data ?? [] });
}

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
    destinationType?: 'mpesa' | 'bank';
    mpesaPhone?: string;
    bankName?: string;
    bankAccountName?: string;
    bankAccountNumber?: string;
    otp?: string;
  } | null;

  if (!body?.amount || body.amount <= 0 || !body.destinationType) {
    return NextResponse.json({ ok: false, error: 'INVALID_PAYLOAD' }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('phone')
    .eq('id', user.id)
    .maybeSingle();
  const { requireApiWalletStepUp } = await import('@/lib/wallet/step-up');
  const stepUp = await requireApiWalletStepUp({
    phoneRaw: String(
      (profile as { phone?: string | null } | null)?.phone ??
        user.phone ??
        body.mpesaPhone ??
        '',
    ),
    purpose: 'wallet_withdraw',
    otp: body.otp,
  });
  if (!stepUp.ok) {
    return NextResponse.json(stepUp.body, { status: stepUp.status });
  }

  const { data, error } = await supabase.rpc('request_withdrawal', {
    p_amount: body.amount,
    p_currency: (body.currency ?? 'KES').toUpperCase(),
    p_destination_type: body.destinationType,
    p_destination_phone: body.mpesaPhone ?? null,
    p_bank_name: body.bankName ?? null,
    p_bank_account_name: body.bankAccountName ?? null,
    p_bank_account_number: body.bankAccountNumber ?? null,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const result = data as { ok?: boolean; error?: string; withdrawal_id?: string } | null;
  if (!result?.ok) {
    return NextResponse.json(
      { ok: false, error: result?.error ?? 'WITHDRAWAL_FAILED' },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, result });
}
