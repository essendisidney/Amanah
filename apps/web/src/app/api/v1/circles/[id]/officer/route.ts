import { NextResponse } from 'next/server';
import { createApiClient } from '@/lib/supabase/api';

const OFFICER_ROLES = new Set(['circle_admin', 'chair', 'treasurer', 'secretary']);

type Membership = {
  id: string;
  role: string;
  status: string;
  user_id: string;
  jamiya_id: string;
};

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: jamiyaId } = await context.params;
  const supabase = await createApiClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'UNAUTHENTICATED' }, { status: 401 });
  }

  const { data: membership, error: mErr } = await supabase
    .from('members')
    .select('id, role, status, user_id, jamiya_id')
    .eq('jamiya_id', jamiyaId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (mErr) {
    return NextResponse.json({ ok: false, error: mErr.message }, { status: 500 });
  }
  if (!membership || !OFFICER_ROLES.has((membership as Membership).role)) {
    return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 });
  }

  const [{ data: lateDues }, { data: grace }, { data: payouts }, { data: members }] =
    await Promise.all([
      supabase
        .from('contributions')
        .select('id, member_id, amount, currency, status, due_date, cycle_number')
        .eq('jamiya_id', jamiyaId)
        .in('status', ['late', 'pending', 'partial'])
        .order('due_date', { ascending: true })
        .limit(40),
      supabase
        .from('grace_period_requests')
        .select('id, contribution_id, requester_id, status, reason, requested_days, created_at')
        .eq('jamiya_id', jamiyaId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('payouts')
        .select('id, cycle_number, member_id, amount, currency, scheduled_date, status')
        .eq('jamiya_id', jamiyaId)
        .in('status', ['scheduled', 'pending'])
        .order('scheduled_date', { ascending: true })
        .limit(5),
      supabase
        .from('members')
        .select('id, role, status, user_id')
        .eq('jamiya_id', jamiyaId)
        .order('created_at', { ascending: true })
        .limit(60),
    ]);

  const late = (lateDues ?? []) as Array<{ status: string }>;
  const lateCount = late.filter((d) => d.status === 'late').length;
  const memberRows = (members ?? []) as Array<{ user_id: string }>;
  const userIds = memberRows.map((m) => m.user_id);
  const { data: profiles } = userIds.length
    ? await supabase.from('profiles').select('id, full_name, email').in('id', userIds)
    : { data: [] };
  const profileMap = new Map(
    ((profiles ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>).map(
      (p) => [p.id, p],
    ),
  );

  return NextResponse.json({
    ok: true,
    role: (membership as Membership).role,
    lateCount,
    pendingGrace: (grace ?? []).length,
    lateDues: lateDues ?? [],
    graceRequests: grace ?? [],
    nextPayouts: payouts ?? [],
    members: memberRows.map((m) => ({
      ...m,
      profile: profileMap.get(m.user_id) ?? null,
    })),
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: jamiyaId } = await context.params;
  const supabase = await createApiClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'UNAUTHENTICATED' }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from('members')
    .select('id, role, status')
    .eq('jamiya_id', jamiyaId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (!membership || !OFFICER_ROLES.has((membership as { role: string }).role)) {
    return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    action?: 'set_role' | 'vouch' | 'decide_grace';
    memberId?: string;
    role?: string;
    approve?: boolean;
    notes?: string;
    requestId?: string;
  } | null;

  if (!body?.action) {
    return NextResponse.json({ ok: false, error: 'INVALID_PAYLOAD' }, { status: 400 });
  }

  if (body.action === 'set_role') {
    const { data, error } = await supabase.rpc('set_member_role', {
      p_member_id: body.memberId,
      p_role: body.role,
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    const result = data as { ok?: boolean; error?: string } | null;
    if (!result?.ok) {
      return NextResponse.json({ ok: false, error: result?.error ?? 'ROLE_FAILED' }, { status: 400 });
    }
    return NextResponse.json({ ok: true, result });
  }

  if (body.action === 'vouch') {
    const { data, error } = await supabase.rpc('vouch_for_member', {
      p_member_id: body.memberId,
      p_approve: body.approve !== false,
      p_notes: body.notes ?? null,
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    const result = data as { ok?: boolean; error?: string } | null;
    if (!result?.ok) {
      return NextResponse.json({ ok: false, error: result?.error ?? 'VOUCH_FAILED' }, { status: 400 });
    }
    return NextResponse.json({ ok: true, result });
  }

  if (body.action === 'decide_grace') {
    const { data, error } = await supabase.rpc('decide_grace_request', {
      p_request_id: body.requestId,
      p_approve: body.approve !== false,
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    const result = data as { ok?: boolean; error?: string } | null;
    if (!result?.ok) {
      return NextResponse.json({ ok: false, error: result?.error ?? 'GRACE_FAILED' }, { status: 400 });
    }
    return NextResponse.json({ ok: true, result });
  }

  return NextResponse.json({ ok: false, error: 'UNKNOWN_ACTION' }, { status: 400 });
}
