import { NextResponse } from 'next/server';
import { createApiClient } from '@/lib/supabase/api';
import { createServiceRoleClient } from '@/lib/supabase/service';
import {
  generateInvitationToken,
  generateInviteCode,
  getInvitationExpiry,
  hashInvitationToken,
} from '@/features/circles/lib/invitation-token';

function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'https://amanah-liart.vercel.app';
}

/** POST — circle admin adds member (existing → active; new → provision + invited). */
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

  const body = (await request.json().catch(() => null)) as {
    email?: string;
    phone?: string;
    fullName?: string;
  } | null;

  const email = (body?.email ?? '').trim().toLowerCase();
  const phone = (body?.phone ?? '').trim() || null;
  const fullName = (body?.fullName ?? '').trim() || null;

  if (!email && !phone) {
    return NextResponse.json({ ok: false, error: 'EMAIL_OR_PHONE_REQUIRED' }, { status: 400 });
  }

  const { data: existingData, error: existingErr } = await supabase.rpc(
    'admin_add_circle_member',
    {
      p_jamiya_id: jamiyaId,
      p_user_id: null,
      p_status: 'active',
      p_email: email || null,
      p_phone: phone,
    },
  );

  if (existingErr) {
    return NextResponse.json({ ok: false, error: existingErr.message }, { status: 500 });
  }

  const existing = existingData as { ok?: boolean; error?: string; fee_warning?: boolean } | null;
  if (existing?.ok) {
    return NextResponse.json({
      ok: true,
      mode: 'added',
      feeWarning: existing.fee_warning ?? false,
    });
  }
  if (existing?.error && existing.error !== 'USER_NOT_FOUND') {
    return NextResponse.json({ ok: false, error: existing.error }, { status: 400 });
  }

  if (!email) {
    return NextResponse.json({ ok: false, error: 'EMAIL_REQUIRED_FOR_NEW' }, { status: 400 });
  }

  let service;
  try {
    service = createServiceRoleClient();
  } catch {
    return NextResponse.json({ ok: false, error: 'SERVICE_ROLE_MISSING' }, { status: 500 });
  }

  const { data: invited, error: inviteErr } = await service.auth.admin.inviteUserByEmail(
    email,
    {
      redirectTo: `${getSiteUrl()}/login`,
      data: { full_name: fullName ?? undefined, phone: phone ?? undefined },
    },
  );

  let newUserId = invited?.user?.id ?? null;
  if (inviteErr || !newUserId) {
    const { data: created, error: createErr } = await service.auth.admin.createUser({
      email,
      email_confirm: false,
      user_metadata: { full_name: fullName ?? undefined, phone: phone ?? undefined },
    });
    if (createErr || !created.user) {
      return NextResponse.json(
        { ok: false, error: inviteErr?.message ?? createErr?.message ?? 'PROVISION_FAILED' },
        { status: 500 },
      );
    }
    newUserId = created.user.id;
  }

  for (let i = 0; i < 8; i++) {
    const { data: profile } = await service
      .from('profiles')
      .select('id')
      .eq('id', newUserId)
      .maybeSingle();
    if (profile) break;
    await new Promise((r) => setTimeout(r, 150));
  }

  await service
    .from('profiles')
    .update({
      ...(fullName ? { full_name: fullName } : {}),
      ...(phone ? { phone } : {}),
      email,
    })
    .eq('id', newUserId);

  const { data, error } = await supabase.rpc('admin_add_circle_member', {
    p_jamiya_id: jamiyaId,
    p_user_id: newUserId,
    p_status: 'invited',
    p_email: null,
    p_phone: null,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    return NextResponse.json({ ok: false, error: result?.error ?? 'ADD_FAILED' }, { status: 400 });
  }

  const token = generateInvitationToken();
  const tokenHash = hashInvitationToken(token);
  const inviteCode = generateInviteCode(8);
  const { data: invitation, error: invErr } = await supabase
    .from('invitations')
    .insert({
      jamiya_id: jamiyaId,
      invited_by: user.id,
      email,
      phone,
      invitee_user_id: newUserId,
      token_hash: tokenHash,
      invite_code: inviteCode,
      status: 'pending',
      expires_at: getInvitationExpiry(14),
    })
    .select('id, invite_code')
    .single();

  if (invErr || !invitation) {
    return NextResponse.json({
      ok: true,
      mode: 'invited',
      inviteUrl: null,
      inviteCode: null,
      warning: invErr?.message ?? 'CLAIM_INVITE_FAILED',
    });
  }

  const inviteUrl = `${getSiteUrl()}/invitations/${token}`;
  await supabase.rpc('queue_invitation_delivery', {
    p_invitation_id: invitation.id,
    p_invite_url: inviteUrl,
  });

  return NextResponse.json({
    ok: true,
    mode: 'invited',
    inviteUrl,
    inviteCode: invitation.invite_code,
  });
}
