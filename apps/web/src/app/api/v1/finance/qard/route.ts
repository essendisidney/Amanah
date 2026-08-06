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
    .from('qard_loans')
    .select(
      'id, jamiya_id, borrower_id, amount, currency, status, purpose, installment_count, amount_repaid, due_date, created_at',
    )
    .eq('borrower_id', user.id)
    .order('created_at', { ascending: false })
    .limit(40);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, loans: data ?? [] });
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
    action?: 'request' | 'repay' | 'decide';
    jamiyaId?: string;
    amount?: number;
    purpose?: string;
    installments?: number;
    loanId?: string;
    approve?: boolean;
  } | null;

  if (!body?.action) {
    return NextResponse.json({ ok: false, error: 'INVALID_PAYLOAD' }, { status: 400 });
  }

  if (body.action === 'request') {
    const { data, error } = await supabase.rpc('request_qard', {
      p_jamiya_id: body.jamiyaId,
      p_amount: body.amount,
      p_purpose: body.purpose,
      p_installments: body.installments ?? 4,
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    const result = data as { ok?: boolean; error?: string } | null;
    if (!result?.ok) {
      return NextResponse.json(
        { ok: false, error: result?.error ?? 'REQUEST_FAILED' },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true, result });
  }

  if (body.action === 'repay') {
    const { data, error } = await supabase.rpc('repay_qard', {
      p_loan_id: body.loanId,
      p_amount: body.amount,
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    const result = data as { ok?: boolean; error?: string } | null;
    if (!result?.ok) {
      return NextResponse.json({ ok: false, error: result?.error ?? 'REPAY_FAILED' }, { status: 400 });
    }
    return NextResponse.json({ ok: true, result });
  }

  if (body.action === 'decide') {
    const { data, error } = await supabase.rpc('decide_qard', {
      p_loan_id: body.loanId,
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
