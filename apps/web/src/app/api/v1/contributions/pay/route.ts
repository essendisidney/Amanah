import { NextResponse } from 'next/server';
import { createApiClient } from '@/lib/supabase/api';

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
  } | null;

  if (!body?.contributionId) {
    return NextResponse.json(
      { ok: false, error: 'CONTRIBUTION_ID_REQUIRED' },
      { status: 400 },
    );
  }

  const { data, error } = await supabase.rpc('pay_contribution', {
    p_contribution_id: body.contributionId,
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

  return NextResponse.json({ ok: true, result });
}
