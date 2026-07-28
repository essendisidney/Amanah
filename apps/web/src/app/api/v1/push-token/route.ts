import { NextResponse } from 'next/server';
import { createApiClient } from '@/lib/supabase/api';

export async function POST(request: Request) {
  const supabase = await createApiClient(request);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ ok: false, error: 'UNAUTHENTICATED' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    token?: string;
    platform?: string;
  } | null;

  const token = String(body?.token ?? '').trim();
  const platform = String(body?.platform ?? 'expo').trim() || 'expo';
  if (token.length < 10) {
    return NextResponse.json({ ok: false, error: 'INVALID_TOKEN' }, { status: 400 });
  }

  const { data, error: rpcError } = await supabase.rpc('register_push_token', {
    p_token: token,
    p_platform: platform,
  });

  if (rpcError) {
    return NextResponse.json({ ok: false, error: rpcError.message }, { status: 500 });
  }

  return NextResponse.json(data ?? { ok: true });
}
