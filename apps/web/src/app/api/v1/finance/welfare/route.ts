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

  const [{ data: funds, error: fErr }, { data: claims, error: cErr }] = await Promise.all([
    supabase
      .from('welfare_funds')
      .select('id, jamiya_id, balance, currency, contribution_amount, created_at')
      .limit(40),
    supabase
      .from('welfare_claims')
      .select('id, jamiya_id, fund_id, amount, currency, reason, status, created_at')
      .order('created_at', { ascending: false })
      .limit(40),
  ]);

  if (fErr || cErr) {
    return NextResponse.json(
      { ok: false, error: fErr?.message ?? cErr?.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, funds: funds ?? [], claims: claims ?? [] });
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
    action?: 'ensure' | 'contribute' | 'claim' | 'decide';
    jamiyaId?: string;
    amount?: number;
    reason?: string;
    claimId?: string;
    approve?: boolean;
    category?: string;
  } | null;

  if (!body?.action) {
    return NextResponse.json({ ok: false, error: 'INVALID_PAYLOAD' }, { status: 400 });
  }

  if (body.action === 'ensure') {
    const { data, error } = await supabase.rpc('ensure_welfare_fund', {
      p_jamiya_id: body.jamiyaId,
      p_contribution_amount: body.amount ?? 0,
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, result: data });
  }

  if (body.action === 'contribute') {
    const { data, error } = await supabase.rpc('contribute_to_welfare', {
      p_jamiya_id: body.jamiyaId,
      p_amount: body.amount,
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    const result = data as { ok?: boolean; error?: string } | null;
    if (!result?.ok) {
      return NextResponse.json(
        { ok: false, error: result?.error ?? 'CONTRIBUTE_FAILED' },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true, result });
  }

  if (body.action === 'claim') {
    const { data, error } = await supabase.rpc('file_welfare_claim', {
      p_jamiya_id: body.jamiyaId,
      p_claim_type: body.category ?? 'other',
      p_amount: body.amount,
      p_reason: body.reason ?? 'Mobile claim',
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    const result = data as { ok?: boolean; error?: string } | null;
    if (!result?.ok) {
      return NextResponse.json({ ok: false, error: result?.error ?? 'CLAIM_FAILED' }, { status: 400 });
    }
    return NextResponse.json({ ok: true, result });
  }

  if (body.action === 'decide') {
    const { data, error } = await supabase.rpc('decide_welfare_claim', {
      p_claim_id: body.claimId,
      p_approve: body.approve !== false,
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    const result = data as { ok?: boolean; error?: string } | null;
    if (!result?.ok) {
      return NextResponse.json(
        { ok: false, error: result?.error ?? 'DECIDE_FAILED' },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true, result });
  }

  return NextResponse.json({ ok: false, error: 'UNKNOWN_ACTION' }, { status: 400 });
}
