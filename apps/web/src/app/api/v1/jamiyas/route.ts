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
    .from('members')
    .select(
      `
      id, role, status, payout_position,
      jamiya:jamiyas (
        id, name, slug, status, contribution_amount, currency,
        member_count, max_members, current_cycle, cycle_count
      )
    `,
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, memberships: data ?? [] });
}
