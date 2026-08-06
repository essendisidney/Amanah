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
    .from('savings_goals')
    .select('id, title, target_amount, saved_amount, currency, target_date, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(40);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, goals: data ?? [] });
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
    action?: 'create' | 'update';
    title?: string;
    targetAmount?: number;
    targetDate?: string;
    goalId?: string;
    savedAmount?: number;
  } | null;

  if (body?.action === 'update' && body.goalId) {
    const patch: Record<string, unknown> = {};
    if (typeof body.savedAmount === 'number') patch.saved_amount = body.savedAmount;
    if (body.title) patch.title = body.title;
    if (typeof body.targetAmount === 'number') patch.target_amount = body.targetAmount;
    if (body.targetDate !== undefined) patch.target_date = body.targetDate || null;

    const { error } = await supabase
      .from('savings_goals')
      .update(patch)
      .eq('id', body.goalId)
      .eq('user_id', user.id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (!body?.title || !body.targetAmount || body.targetAmount <= 0) {
    return NextResponse.json({ ok: false, error: 'INVALID_PAYLOAD' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('savings_goals')
    .insert({
      user_id: user.id,
      title: body.title.trim(),
      target_amount: body.targetAmount,
      saved_amount: 0,
      currency: 'KES',
      target_date: body.targetDate || null,
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, goal: data });
}
