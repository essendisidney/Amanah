'use server';

import { createInvitationSchema, normalizePhone254, toE164Kenya } from '@jamiya/shared';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { callRpc } from '@/lib/supabase/rpc';
import { createServiceRoleClient } from '@/lib/supabase/service';
import {
  generateInvitationToken,
  generateInviteCode,
  getInvitationExpiry,
  hashInvitationToken,
  invitationRpcArgs,
} from '../lib/invitation-token';
import { mapZodFieldErrors, type ActionState } from '../lib/action-state';
import { getSiteUrl } from '@/lib/site-url';

async function findInviteeUserId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  email: string | undefined,
  phone: string | undefined,
): Promise<string | null> {
  if (email) {
    const { data: byEmail } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    const id = (byEmail as unknown as { id: string } | null)?.id;
    if (id) return id;
  }

  if (!phone) return null;
  const e164 = toE164Kenya(phone);
  const normalized = normalizePhone254(phone);
  const candidates = Array.from(
    new Set([e164, normalized, normalized ? `+${normalized}` : null].filter(Boolean)),
  ) as string[];

  for (const candidate of candidates) {
    const { data: byPhone } = await supabase
      .from('profiles')
      .select('id')
      .eq('phone', candidate)
      .maybeSingle();
    const id = (byPhone as unknown as { id: string } | null)?.id;
    if (id) return id;
  }
  return null;
}

export async function createInvitationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createInvitationSchema.safeParse({
    jamiyaId: formData.get('jamiyaId'),
    email: formData.get('email') || '',
    phone: formData.get('phone') || '',
  });

  if (!parsed.success) {
    return {
      success: false,
      message: 'Please fix the errors below.',
      fieldErrors: mapZodFieldErrors(parsed.error),
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: 'Authentication required.' };
  }

  const { jamiyaId, email, phone: rawPhone } = parsed.data;
  const phone = rawPhone ? toE164Kenya(rawPhone) ?? rawPhone : '';

  const { data: jamiya } = await supabase
    .from('jamiyas')
    .select('id, slug, name, status, member_count, max_members')
    .eq('id', jamiyaId)
    .maybeSingle();

  const circle = jamiya as unknown as {
    id: string;
    slug: string;
    name: string;
    status: string;
    member_count: number;
    max_members: number;
  } | null;

  if (!circle) {
    return { success: false, message: 'Circle not found.' };
  }

  if (circle.member_count >= circle.max_members) {
    return { success: false, message: 'This circle is already full.' };
  }

  const { data: membership } = await supabase
    .from('members')
    .select('role, status')
    .eq('jamiya_id', jamiyaId)
    .eq('user_id', user.id)
    .maybeSingle();

  const member = membership as unknown as { role: string; status: string } | null;
  const canInvite =
    member?.status === 'active' &&
    ['circle_admin', 'chair', 'treasurer'].includes(member.role);
  if (!canInvite) {
    return {
      success: false,
      message: 'Only circle admins, chairs, or treasurers can invite members.',
    };
  }

  const inviteeUserId = await findInviteeUserId(supabase, email || undefined, phone || undefined);

  if (inviteeUserId) {
    const { data: existing } = await supabase
      .from('members')
      .select('id, status')
      .eq('jamiya_id', jamiyaId)
      .eq('user_id', inviteeUserId)
      .maybeSingle();
    const existingMember = existing as unknown as { status: string } | null;
    if (existingMember?.status === 'active') {
      return { success: false, message: 'That user is already an active member.' };
    }
  }

  const token = generateInvitationToken();
  const tokenHash = hashInvitationToken(token);
  let inviteCode = generateInviteCode(8);
  let invite: { id: string; invite_code: string } | null = null;
  let lastError: string | undefined;

  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await callRpc('create_circle_invitation', {
      p_jamiya_id: jamiyaId,
      p_email: email || null,
      p_phone: phone || null,
      p_invitee_user_id: inviteeUserId,
      p_token_hash: tokenHash,
      p_invite_code: inviteCode,
      p_expires_at: getInvitationExpiry(14),
    });

    const result = data as { ok?: boolean; error?: string; id?: string; invite_code?: string } | null;

    if (!error && result?.ok && result.id && result.invite_code) {
      invite = { id: result.id, invite_code: result.invite_code };
      break;
    }

    lastError = error?.message ?? result?.error;
    if (lastError && /invite_code|unique|23505/i.test(lastError)) {
      inviteCode = generateInviteCode(8);
      continue;
    }
    break;
  }

  if (!invite) {
    try {
      const service = createServiceRoleClient();
      for (let attempt = 0; attempt < 5; attempt++) {
        const { data: invitation, error } = await service
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
          } as never)
          .select('id, invite_code')
          .single();

        if (!error && invitation) {
          invite = invitation as unknown as { id: string; invite_code: string };
          break;
        }
        lastError = error?.message ?? lastError;
        if (error?.code === '23505' || /invite_code|unique/i.test(error?.message ?? '')) {
          inviteCode = generateInviteCode(8);
          continue;
        }
        break;
      }
    } catch {
      // Service role unavailable — fall through to lastError.
    }
  }

  if (!invite) {
    return {
      success: false,
      message: lastError ?? 'Failed to create invitation.',
    };
  }

  // Prefer short invite codes in share URLs — long tokens cannot be rebuilt after refresh.
  const invitePath = `/invitations/${invite.invite_code}`;
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
        invitation_id: invite.id,
        invite_path: invitePath,
        invite_code: invite.invite_code,
      },
    } as never);
  }

  await supabase.from('audit_logs').insert({
    actor_id: user.id,
    action: 'invite',
    entity_type: 'invitation',
    entity_id: invite.id,
    jamiya_id: jamiyaId,
    metadata: { email: email || null, phone: phone || null },
  } as never);

  await callRpc('queue_invitation_delivery', {
    p_invitation_id: invite.id,
    p_invite_url: inviteUrl,
  });

  revalidatePath(`/circles/${circle.slug}`);
  revalidatePath('/notifications');

  return {
    success: true,
    message:
      'Invitation created. Share the link, QR, WhatsApp, or short invite code below.',
    inviteUrl,
    inviteCode: invite.invite_code,
  };
}

export async function revokeInvitationAction(formData: FormData): Promise<void> {
  const invitationId = String(formData.get('invitationId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  if (!invitationId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('invitations')
    .update({ status: 'revoked' } as never)
    .eq('id', invitationId);

  await supabase.from('audit_logs').insert({
    actor_id: user.id,
    action: 'reject',
    entity_type: 'invitation',
    entity_id: invitationId,
    metadata: { revoked: true },
  } as never);

  if (slug) revalidatePath(`/circles/${slug}`);
}

export async function acceptInvitationAction(token: string): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, message: 'Sign in to accept this invitation.' };
  }

  const { data, error } = await callRpc(
    'accept_invitation',
    invitationRpcArgs(token),
  );

  if (error) {
    return { success: false, message: error.message };
  }

  const result = data as unknown as {
    ok?: boolean;
    error?: string;
    slug?: string;
    jamiya_id?: string;
  };
  if (!result?.ok) {
    const messages: Record<string, string> = {
      NOT_FOUND: 'Invitation not found.',
      NOT_PENDING: 'This invitation is no longer pending.',
      EXPIRED: 'This invitation has expired.',
      CIRCLE_FULL: 'This circle is full.',
      UNAUTHENTICATED: 'Sign in to continue.',
    };
    return {
      success: false,
      message: messages[result?.error ?? ''] ?? 'Could not accept invitation.',
    };
  }

  if (result.jamiya_id) {
    const fee = await callRpc('charge_join_fee', { p_jamiya_id: result.jamiya_id });
    if (fee.error) {
      // Membership already created; surface fee issue without rolling back join
      revalidatePath('/dashboard');
      revalidatePath('/circles');
      if (result.slug) revalidatePath(`/circles/${result.slug}`);
      return {
        success: true,
        message:
          'Joined the circle, but join fee could not be charged yet — top up your wallet and retry from the circle page.',
        inviteUrl: result.slug ? `/circles/${result.slug}` : '/circles',
      };
    }
  }

  revalidatePath('/dashboard');
  revalidatePath('/circles');
  revalidatePath('/wallet');
  if (result.slug) revalidatePath(`/circles/${result.slug}`);

  return {
    success: true,
    message: 'Welcome to the circle.',
    inviteUrl: result.slug ? `/circles/${result.slug}` : '/circles',
  };
}

export async function declineInvitationAction(token: string): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, message: 'Sign in to decline this invitation.' };
  }

  const { data, error } = await callRpc(
    'decline_invitation',
    invitationRpcArgs(token),
  );

  if (error) {
    return { success: false, message: error.message };
  }

  const result = data as unknown as { ok?: boolean; error?: string };
  if (!result?.ok) {
    return { success: false, message: 'Could not decline invitation.' };
  }

  return { success: true, message: 'Invitation declined.' };
}
