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

  const [{ data: wallets, error: wErr }, { data: txs, error: tErr }, { data: pending }, { data: failed }] =
    await Promise.all([
      supabase
        .from('wallets')
        .select('id, currency, balance, available_balance, updated_at')
        .eq('user_id', user.id)
        .order('currency'),
      supabase
        .from('transactions')
        .select('id, type, status, amount, currency, direction, reference, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('payment_intents')
        .select('id, amount, currency, status, provider, phone, error_message, created_at')
        .eq('user_id', user.id)
        .in('status', ['pending', 'processing'])
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('payment_intents')
        .select('id, amount, currency, status, provider, phone, error_message, created_at')
        .eq('user_id', user.id)
        .in('status', ['failed', 'expired', 'cancelled'])
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

  if (wErr || tErr) {
    return NextResponse.json(
      { ok: false, error: wErr?.message ?? tErr?.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    wallets: wallets ?? [],
    transactions: txs ?? [],
    pendingIntents: pending ?? [],
    failedIntents: failed ?? [],
  });
}
