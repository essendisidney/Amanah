'use server';

import { createInvitationSchema } from '@jamiya/shared';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { callRpc } from '@/lib/supabase/rpc';
import {
  generateInvitationToken,
  getInvitationExpiry,
  hashInvitationToken,
} from '../lib/invitation-token';
import { mapZodFieldErrors, type ActionState } from '../lib/action-state';

function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
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

  const { jamiyaId, email, phone } = parsed.data;

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
  if (!member || member.role !== 'circle_admin' || member.status !== 'active') {
    return { success: false, message: 'Only circle admins can invite members.' };
  }

  let inviteeUserId: string | null = null;
  if (email) {
    const { data: invitee } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    inviteeUserId = (invitee as unknown as { id: string } | null)?.id ?? null;

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
  }

  const token = generateInvitationToken();
  const tokenHash = hashInvitationToken(token);

  const { data: invitation, error } = await supabase
    .from('invitations')
    .insert({
      jamiya_id: jamiyaId,
      invited_by: user.id,
      email: email || null,
      phone: phone || null,
      invitee_user_id: inviteeUserId,
      token_hash: tokenHash,
      status: 'pending',
      expires_at: getInvitationExpiry(14),
    } as never)
    .select('id')
    .single();

  if (error || !invitation) {
    return {
      success: false,
      message: error?.message ?? 'Failed to create invitation.',
    };
  }

  const invite = invitation as unknown as { id: string };
  const inviteUrl = `${getSiteUrl()}/invitations/${token}`;

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
        invite_path: `/invitations/${token}`,
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

  revalidatePath(`/jamiyas/${circle.slug}`);
  revalidatePath('/notifications');

  return {
    success: true,
    message:
      'Invitation created. Delivery queued for email/SMS when configured; share the link as fallback.',
    inviteUrl,
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

  if (slug) revalidatePath(`/jamiyas/${slug}`);
}

export async function acceptInvitationAction(token: string): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, message: 'Sign in to accept this invitation.' };
  }

  const tokenHash = hashInvitationToken(token);
  const { data, error } = await callRpc('accept_invitation', {
    p_token_hash: tokenHash,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  const result = data as unknown as { ok?: boolean; error?: string; slug?: string };
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

  revalidatePath('/dashboard');
  revalidatePath('/jamiyas');
  if (result.slug) revalidatePath(`/jamiyas/${result.slug}`);

  return {
    success: true,
    message: 'Welcome to the circle.',
    inviteUrl: result.slug ? `/jamiyas/${result.slug}` : '/jamiyas',
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

  const tokenHash = hashInvitationToken(token);
  const { data, error } = await callRpc('decline_invitation', {
    p_token_hash: tokenHash,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  const result = data as unknown as { ok?: boolean; error?: string };
  if (!result?.ok) {
    return { success: false, message: 'Could not decline invitation.' };
  }

  return { success: true, message: 'Invitation declined.' };
}
