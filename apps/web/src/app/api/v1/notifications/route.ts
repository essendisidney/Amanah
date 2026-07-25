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
    .from('notifications')
    .select('id, type, title, body, read_at, created_at, data')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(40);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, notifications: data ?? [] });
}
