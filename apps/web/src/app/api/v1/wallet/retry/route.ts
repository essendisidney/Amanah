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

  const body = (await request.json().catch(() => null)) as { intentId?: string } | null;
  if (!body?.intentId) {
    return NextResponse.json({ ok: false, error: 'INVALID_PAYLOAD' }, { status: 400 });
  }

  const { data, error } = await supabase.rpc('retry_payment_intent', {
    p_intent_id: body.intentId,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const result = data as { ok?: boolean; error?: string; intent_id?: string } | null;
  if (!result?.ok) {
    return NextResponse.json(
      { ok: false, error: result?.error ?? 'RETRY_FAILED' },
      { status: 400 },
    );
  }

  const providerEnv = (process.env.PAYMENT_PROVIDER ?? 'simulated').toLowerCase();
  if (providerEnv === 'simulated' || providerEnv === '') {
    const intentId = result.intent_id ?? body.intentId;
    const { data: completed } = await supabase.rpc('complete_payment_intent', {
      p_intent_id: intentId,
      p_provider_reference: `api-retry-sim:${intentId}`,
      p_metadata: { source: 'api_v1_retry' },
    });
    return NextResponse.json({ ok: true, intent_id: intentId, completed });
  }

  return NextResponse.json({ ok: true, result });
}
