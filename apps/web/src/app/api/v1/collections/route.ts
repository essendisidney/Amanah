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
    .from('collection_cases')
    .select(
      'id, status, severity, amount_due, currency, days_overdue, jamiya_id, created_at',
    )
    .eq('user_id', user.id)
    .in('status', ['open', 'contacted', 'promised', 'partially_paid'])
    .order('days_overdue', { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, cases: data ?? [] });
}
