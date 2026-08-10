import { NextResponse } from 'next/server';
import { createApiClient } from '@/lib/supabase/api';
import { invitationRpcArgs } from '@/features/circles/lib/invitation-token';

/** Accept or decline an invitation by raw invite token or short invite code. */
export async function POST(request: Request) {
  const supabase = await createApiClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: 'UNAUTHENTICATED' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    token?: string;
    inviteCode?: string;
    decision?: 'accept' | 'reject' | 'decline';
  } | null;

  const credential = (body?.inviteCode ?? body?.token ?? '').trim();
  if (!credential || !body?.decision) {
    return NextResponse.json(
      { ok: false, error: 'TOKEN_AND_DECISION_REQUIRED' },
      { status: 400 },
    );
  }

  const rpc =
    body.decision === 'accept' ? 'accept_invitation' : 'decline_invitation';

  const { data, error } = await supabase.rpc(rpc, invitationRpcArgs(credential));

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const result = data as { ok?: boolean; error?: string; slug?: string } | null;
  if (!result?.ok) {
    return NextResponse.json(
      { ok: false, error: result?.error ?? 'INVITE_FAILED' },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, result });
}
