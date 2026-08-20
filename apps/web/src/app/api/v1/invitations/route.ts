import { NextResponse } from 'next/server';
import { createApiClient } from '@/lib/supabase/api';
import {
  generateInvitationToken,
  generateInviteCode,
  getInvitationExpiry,
  hashInvitationToken,
} from '@/features/circles/lib/invitation-token';

function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'https://amanah-liart.vercel.app';
}

/** Pending invitations for the signed-in user (email/phone match or invitee_user_id). */
export async function GET(request: Request) {
  const supabase = await createApiClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: 'UNAUTHENTICATED' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('email, phone')
    .eq('id', user.id)
    .maybeSingle();

  const { data, error } = await supabase
    .from('invitations')
    .select(
      'id, email, phone, status, expires_at, created_at, jamiya_id, invite_code, jamiya:jamiyas(id, name, slug)',
    )
    .eq('status', 'pending')
    .or(
      [
        `invitee_user_id.eq.${user.id}`,
        profile?.email ? `email.eq.${profile.email}` : null,
        profile?.phone ? `phone.eq.${profile.phone}` : null,
      ]
        .filter(Boolean)
        .join(','),
    )
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, invitations: data ?? [] });
}

/** Create invitation (circle admin). Body: { jamiyaId, email?, phone? } */
export async function POST(request: Request) {
  const supabase = await createApiClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: 'UNAUTHENTICATED' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    jamiyaId?: string;
    email?: string;
    phone?: string;
  } | null;

  const jamiyaId = body?.jamiyaId?.trim();
  const email = (body?.email ?? '').trim().toLowerCase();
  const phone = (body?.phone ?? '').trim();

  if (!jamiyaId) {
    return NextResponse.json({ ok: false, error: 'JAMIYA_REQUIRED' }, { status: 400 });
  }
  if (!email && !phone) {
    return NextResponse.json({ ok: false, error: 'EMAIL_OR_PHONE_REQUIRED' }, { status: 400 });
  }
  if (phone && !/^\+[1-9]\d{7,14}$/.test(phone)) {
    return NextResponse.json({ ok: false, error: 'INVALID_PHONE' }, { status: 400 });
  }

  const { data: jamiya } = await supabase
    .from('jamiyas')
    .select('id, slug, name, status, member_count, max_members')
    .eq('id', jamiyaId)
    .maybeSingle();

  const circle = jamiya as {
    id: string;
    slug: string;
    name: string;
    member_count: number;
    max_members: number;
  } | null;

  if (!circle) {
    return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });
  }
  if (circle.member_count >= circle.max_members) {
    return NextResponse.json({ ok: false, error: 'CIRCLE_FULL' }, { status: 400 });
  }

  const { data: membership } = await supabase
    .from('members')
    .select('role, status')
    .eq('jamiya_id', jamiyaId)
    .eq('user_id', user.id)
    .maybeSingle();

  const member = membership as { role: string; status: string } | null;
  if (!member || member.role !== 'circle_admin' || member.status !== 'active') {
    return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 });
  }

  let inviteeUserId: string | null = null;
  if (email) {
    const { data: invitee } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    inviteeUserId = (invitee as { id: string } | null)?.id ?? null;

    if (inviteeUserId) {
      const { data: existing } = await supabase
        .from('members')
        .select('id, status')
        .eq('jamiya_id', jamiyaId)
        .eq('user_id', inviteeUserId)
        .maybeSingle();
      if ((existing as { status: string } | null)?.status === 'active') {
        return NextResponse.json({ ok: false, error: 'ALREADY_MEMBER' }, { status: 400 });
      }
    }
  }

  const token = generateInvitationToken();
  const tokenHash = hashInvitationToken(token);
  let inviteCode = generateInviteCode(8);
  let invitation: { id: string; invite_code: string } | null = null;
  let lastError: string | undefined;

  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase
      .from('invitations')
      .insert({
        jamiya_id: jamiyaId,
        invited_by: user.id,
        email: email || null,
        phone: phone || null,
        invitee_user_id: inviteeUserId,
        token_hash: tokenHash,
        invite_code: inviteCode,
        status: 'pending',
        expires_at: getInvitationExpiry(14),
      })
      .select('id, invite_code')
      .single();

    if (!error && data) {
      invitation = data as { id: string; invite_code: string };
      break;
    }
    lastError = error?.message;
    if (error?.code === '23505' || /invite_code|unique/i.test(error?.message ?? '')) {
      inviteCode = generateInviteCode(8);
      continue;
    }
    break;
  }

  if (!invitation) {
    return NextResponse.json(
      { ok: false, error: lastError ?? 'INVITE_FAILED' },
      { status: 500 },
    );
  }

  const invitePath = `/invitations/${invitation.invite_code}`;
  const inviteUrl = `${getSiteUrl()}${invitePath}`;

  if (inviteeUserId) {
    await supabase.from('notifications').insert({
      user_id: inviteeUserId,
      type: 'invitation',
      channel: 'in_app',
      title: `Invitation to ${circle.name}`,
      body: 'You have been invited to join a savings circle on Amanah.',
      data: {
        jamiya_id: circle.id,
        slug: circle.slug,
        invitation_id: invitation.id,
        invite_path: invitePath,
        invite_code: invitation.invite_code,
      },
    });
  }

  await supabase.from('audit_logs').insert({
    actor_id: user.id,
    action: 'invite',
    entity_type: 'invitation',
    entity_id: invitation.id,
    jamiya_id: jamiyaId,
    metadata: {
      email: email || null,
      phone: phone || null,
      source: 'api_v1',
      invite_code: invitation.invite_code,
    },
  });

  await supabase.rpc('queue_invitation_delivery', {
    p_invitation_id: invitation.id,
    p_invite_url: inviteUrl,
  });

  return NextResponse.json({
    ok: true,
    invitationId: invitation.id,
    inviteUrl,
    inviteCode: invitation.invite_code,
    token,
  });
}
