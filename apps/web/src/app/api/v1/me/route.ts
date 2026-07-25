import { NextResponse } from 'next/server';
import { createApiClient } from '@/lib/supabase/api';

export async function GET(request: Request) {
  const supabase = await createApiClient(request);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ ok: false, error: 'UNAUTHENTICATED' }, { status: 401 });
  }

  const [{ data: profile }, { data: wallet }, { data: risk }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, email, phone, platform_role, kyc_status, country_code')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('wallets')
      .select('currency, balance, available_balance')
      .eq('user_id', user.id)
      .order('currency'),
    supabase
      .from('member_risk_scores')
      .select('score, band, computed_at')
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  return NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email },
    profile,
    wallets: wallet ?? [],
    risk: risk ?? null,
  });
}
