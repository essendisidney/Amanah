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

  const { data: memberships } = await supabase
    .from('members')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'active');

  const memberIds = ((memberships ?? []) as Array<{ id: string }>).map((m) => m.id);
  if (memberIds.length === 0) {
    return NextResponse.json({ ok: true, contributions: [] });
  }

  const { data, error } = await supabase
    .from('contributions')
    .select(
      'id, cycle_number, amount, currency, status, due_date, jamiya_id, member_id',
    )
    .in('member_id', memberIds)
    .in('status', ['pending', 'late'])
    .order('due_date', { ascending: true })
    .limit(50);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, contributions: data ?? [] });
}
