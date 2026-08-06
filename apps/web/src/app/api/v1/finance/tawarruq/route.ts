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
    .from('tawarruq_applications')
    .select(
      'id, amount, currency, purpose, status, partner_status, partner_reference, jamiya_id, created_at',
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(40);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, applications: data ?? [] });
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
    purpose?: string;
    jamiyaId?: string;
  } | null;

  if (!body?.amount || !body.purpose || body.purpose.trim().length < 5) {
    return NextResponse.json({ ok: false, error: 'INVALID_PAYLOAD' }, { status: 400 });
  }

  const { data, error } = await supabase.rpc('submit_tawarruq_application', {
    p_amount: body.amount,
    p_purpose: body.purpose.trim(),
    p_jamiya_id: body.jamiyaId ?? null,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    return NextResponse.json(
      { ok: false, error: result?.error ?? 'SUBMIT_FAILED' },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, result });
}
