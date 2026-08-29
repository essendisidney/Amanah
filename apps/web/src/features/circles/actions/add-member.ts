'use server';

import { addCircleMemberSchema } from '@jamiya/shared';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { callRpc } from '@/lib/supabase/rpc';
import { createServiceRoleClient } from '@/lib/supabase/service';
import {
  generateInvitationToken,
  generateInviteCode,
  getInvitationExpiry,
  hashInvitationToken,
} from '../lib/invitation-token';
import { mapZodFieldErrors, type ActionState, type BulkAddResultRow } from '../lib/action-state';
import { getSiteUrl } from '@/lib/site-url';
import { BULK_PHONE_MAX_ROWS, parseBulkPhoneLines } from '../lib/parse-bulk-phones';

async function createClaimInvitation(args: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  writer: Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createServiceRoleClient>;
  jamiyaId: string;
  invitedBy: string;
  email: string | null;
  phone: string | null;
  inviteeUserId: string;
  circleName: string;
  slug: string;
}): Promise<{ inviteUrl: string; inviteCode: string } | { error: string }> {
  if (!args.email && !args.phone) {
    return { error: 'Email or phone required for claim invitation.' };
  }
  const token = generateInvitationToken();
  const tokenHash = hashInvitationToken(token);
  let inviteCode = generateInviteCode(8);
  const email = args.email || null;
  const phone = args.phone || null;

  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await args.writer
      .from('invitations')
      .insert({
        jamiya_id: args.jamiyaId,
        invited_by: args.invitedBy,
        email,
        phone,
        invitee_user_id: args.inviteeUserId,
        token_hash: tokenHash,
        invite_code: inviteCode,
        status: 'pending',
        expires_at: getInvitationExpiry(14),
      } as never)
      .select('id, invite_code')
      .single();

    if (!error && data) {
      const invite = data as { id: string; invite_code: string };
      const invitePath = `/invitations/${invite.invite_code}`;
      const inviteUrl = `${getSiteUrl()}${invitePath}`;

      await args.writer.from('notifications').insert({
        user_id: args.inviteeUserId,
        type: 'invitation',
        channel: 'in_app',
        title: `Invitation to ${args.circleName}`,
        body: 'You were added to this Amanah circle. Use the invite link or code to sign in.',
        data: {
          jamiya_id: args.jamiyaId,
          slug: args.slug,
          invitation_id: invite.id,
          invite_path: invitePath,
          invite_code: invite.invite_code,
        },
      } as never);

      await args.supabase.rpc('queue_invitation_delivery', {
        p_invitation_id: invite.id,
        p_invite_url: inviteUrl,
      });

      return { inviteUrl, inviteCode: invite.invite_code };
    }

    if (error?.code === '23505' || /invite_code|unique/i.test(error?.message ?? '')) {
      inviteCode = generateInviteCode(8);
      continue;
    }
    return { error: error?.message ?? 'Failed to create claim invitation.' };
  }

  return { error: 'Failed to create claim invitation.' };
}

function mapAddError(code?: string): string {
  const messages: Record<string, string> = {
    ALREADY_MEMBER: 'That person is already an active member.',
    CIRCLE_FULL: 'This circle is full.',
    FORBIDDEN: 'Only circle admins, chairs, or treasurers can add members.',
    USER_NOT_FOUND: 'User not found.',
    UNAUTHENTICATED: 'Sign in to continue.',
  };
  return messages[code ?? ''] ?? 'Could not add member.';
}

export type AddOneMemberResult = {
  success: boolean;
  message: string;
  inviteUrl?: string;
  inviteCode?: string;
  mode?: 'added' | 'invited';
  fieldErrors?: Record<string, string[]>;
};

/** Shared add-or-invite path for one contact (used by single + bulk forms). */
export async function addOneCircleMember(args: {
  jamiyaId: string;
  email?: string | null;
  phone?: string | null;
  fullName?: string | null;
}): Promise<AddOneMemberResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: 'Authentication required.' };
  }

  const jamiyaId = args.jamiyaId;
  const email = (args.email || '').trim().toLowerCase();
  const phone = (args.phone || '').trim() || null;
  const fullName = (args.fullName || '').trim() || null;

  const { data: jamiya } = await supabase
    .from('jamiyas')
    .select('id, slug, name')
    .eq('id', jamiyaId)
    .maybeSingle();

  const circle = jamiya as { id: string; slug: string; name: string } | null;
  if (!circle) {
    return { success: false, message: 'Circle not found.' };
  }

  const { data: existingData, error: existingErr } = await callRpc(
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
    return { success: false, message: existingErr.message };
  }

  const existing = existingData as {
    ok?: boolean;
    error?: string;
    fee_warning?: boolean;
  } | null;

  if (existing?.ok) {
    return {
      success: true,
      mode: 'added',
      message: existing.fee_warning
        ? 'Member added. Join fee could not be charged yet — they should top up their wallet.'
        : 'Member added to the circle.',
    };
  }

  if (existing?.error && existing.error !== 'USER_NOT_FOUND') {
    return { success: false, message: mapAddError(existing.error) };
  }

  if (!email && !phone) {
    return {
      success: false,
      message: 'Provide an email or phone number.',
      fieldErrors: { email: ['Email or phone is required'] },
    };
  }

  let service;
  try {
    service = createServiceRoleClient();
  } catch {
    return {
      success: false,
      message:
        'Server is not configured to provision new members (missing service role key).',
    };
  }

  let newUserId: string | null = null;
  let provisionError: string | undefined;

  if (email) {
    const redirectTo = `${getSiteUrl()}/login`;
    const { data: invited, error: inviteErr } = await service.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo,
        data: {
          full_name: fullName ?? undefined,
          phone: phone ?? undefined,
        },
      },
    );
    newUserId = invited?.user?.id ?? null;
    if (!newUserId) {
      const { data: created, error: createErr } = await service.auth.admin.createUser({
        email,
        phone: phone ?? undefined,
        email_confirm: false,
        phone_confirm: Boolean(phone),
        user_metadata: {
          full_name: fullName ?? undefined,
          phone: phone ?? undefined,
        },
      });
      newUserId = created?.user?.id ?? null;
      provisionError = inviteErr?.message ?? createErr?.message;
    }
  } else if (phone) {
    const { data: created, error: createErr } = await service.auth.admin.createUser({
      phone,
      phone_confirm: true,
      user_metadata: {
        full_name: fullName ?? undefined,
      },
    });
    newUserId = created?.user?.id ?? null;
    provisionError = createErr?.message;

    if (!newUserId) {
      const { data: byPhone } = await service
        .from('profiles')
        .select('id')
        .eq('phone', phone)
        .maybeSingle();
      newUserId = (byPhone as { id: string } | null)?.id ?? null;
    }
  }

  if (!newUserId) {
    return {
      success: false,
      message:
        provisionError ??
        'Could not create an Amanah account. For phone-only members, enable Phone auth in Supabase.',
    };
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

  const { data: existingProfile } = await service
    .from('profiles')
    .select('id')
    .eq('id', newUserId)
    .maybeSingle();

  if (!existingProfile) {
    await service.from('profiles').insert({
      id: newUserId,
      email: email || null,
      phone,
      full_name: fullName,
    } as never);
  } else {
    await service
      .from('profiles')
      .update({
        ...(fullName ? { full_name: fullName } : {}),
        ...(phone ? { phone } : {}),
        ...(email ? { email } : {}),
      })
      .eq('id', newUserId);
  }

  const { data, error } = await callRpc('admin_add_circle_member', {
    p_jamiya_id: jamiyaId,
    p_user_id: newUserId,
    p_status: 'active',
    p_email: null,
    p_phone: null,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    return { success: false, message: mapAddError(result?.error) };
  }

  const claim = await createClaimInvitation({
    supabase,
    writer: service,
    jamiyaId,
    invitedBy: user.id,
    email: email || null,
    phone,
    inviteeUserId: newUserId,
    circleName: circle.name,
    slug: circle.slug,
  });

  if ('error' in claim) {
    return {
      success: true,
      mode: 'added',
      message: `Member added. Invite link could not be created (${claim.error}). Send a new invite from Pending invitations so they can sign in.`,
    };
  }

  const phoneHint =
    !email && phone
      ? ' They can sign in with phone OTP on Amanah, then paste the code.'
      : '';

  return {
    success: true,
    mode: 'added',
    message: `Member added. Share the claim link or invite code so they can sign in.${phoneHint}`,
    inviteUrl: claim.inviteUrl,
    inviteCode: claim.inviteCode,
  };
}

export async function addMemberAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = addCircleMemberSchema.safeParse({
    jamiyaId: formData.get('jamiyaId'),
    email: formData.get('email') || '',
    phone: formData.get('phone') || '',
    fullName: formData.get('fullName') || '',
  });

  if (!parsed.success) {
    return {
      success: false,
      message: 'Please fix the errors below.',
      fieldErrors: mapZodFieldErrors(parsed.error),
    };
  }

  const result = await addOneCircleMember({
    jamiyaId: parsed.data.jamiyaId,
    email: parsed.data.email || '',
    phone: parsed.data.phone || '',
    fullName: parsed.data.fullName || '',
  });

  if (result.success) {
    const { data: jamiya } = await (await createClient())
      .from('jamiyas')
      .select('slug')
      .eq('id', parsed.data.jamiyaId)
      .maybeSingle();
    const slug = (jamiya as { slug: string } | null)?.slug;
    if (slug) {
      revalidatePath(`/circles/${slug}`);
      revalidatePath('/circles');
    }
  }

  return result;
}

export type BulkAddMembersState = ActionState & {
  results?: BulkAddResultRow[];
};

export const initialBulkAddState: BulkAddMembersState = { success: false };

export async function bulkAddMembersByPhoneAction(
  _prev: BulkAddMembersState,
  formData: FormData,
): Promise<BulkAddMembersState> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '').trim();
  const phonesText = String(formData.get('phones') ?? '');

  if (!jamiyaId) {
    return { success: false, message: 'Circle is required.' };
  }

  const rows = parseBulkPhoneLines(phonesText);
  if (rows.length === 0) {
    return {
      success: false,
      message: 'Paste at least one Kenya mobile number.',
      fieldErrors: { phones: ['Paste phone numbers (one per line).'] },
    };
  }

  if (rows.length > BULK_PHONE_MAX_ROWS) {
    return {
      success: false,
      message: `Paste at most ${BULK_PHONE_MAX_ROWS} numbers at a time.`,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, message: 'Authentication required.' };
  }

  const { data: jamiya } = await supabase
    .from('jamiyas')
    .select('id, slug')
    .eq('id', jamiyaId)
    .maybeSingle();
  const circle = jamiya as { id: string; slug: string } | null;
  if (!circle) {
    return { success: false, message: 'Circle not found.' };
  }

  const results: BulkAddResultRow[] = [];

  for (const row of rows) {
    if (!row.phone) {
      results.push({
        phone: row.raw,
        fullName: row.fullName,
        success: false,
        message: 'Invalid Kenya mobile (use 07… or +254…).',
      });
      continue;
    }

    const outcome = await addOneCircleMember({
      jamiyaId,
      phone: row.phone,
      fullName: row.fullName,
    });

    results.push({
      phone: row.phone,
      fullName: row.fullName,
      success: outcome.success,
      message: outcome.message,
      inviteUrl: outcome.inviteUrl,
      inviteCode: outcome.inviteCode,
    });
  }

  const okCount = results.filter((r) => r.success).length;
  const failCount = results.length - okCount;

  revalidatePath(`/circles/${circle.slug}`);
  revalidatePath('/circles');

  return {
    success: okCount > 0,
    message:
      failCount === 0
        ? `Added ${okCount} member${okCount === 1 ? '' : 's'}.`
        : `Added ${okCount}, ${failCount} failed. Check the list below.`,
    results,
  };
}
