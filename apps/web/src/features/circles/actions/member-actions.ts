'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { callRpc } from '@/lib/supabase/rpc';
import { withNoticeQuery } from '@/features/auth/lib/types';
import { redirectWithCircleNotice } from '../lib/circle-notice';

export async function setMemberRoleAction(formData: FormData): Promise<void> {
  const memberId = String(formData.get('memberId') ?? '');
  const role = String(formData.get('role') ?? '');
  const slug = String(formData.get('slug') ?? '');
  if (!memberId || !role) return;

  await callRpc('set_member_role', {
    p_member_id: memberId,
    p_role: role,
  });

  if (slug) revalidatePath(`/circles/${slug}`);
}

export async function vouchMemberAction(formData: FormData): Promise<void> {
  const memberId = String(formData.get('memberId') ?? '');
  const approve = String(formData.get('approve') ?? 'true') === 'true';
  const notes = String(formData.get('notes') ?? '').trim();
  const slug = String(formData.get('slug') ?? '');
  if (!memberId || !slug) return;

  const { data, error } = await callRpc('vouch_for_member', {
    p_member_id: memberId,
    p_approve: approve,
    p_notes: notes || null,
  });

  if (error) {
    redirectWithCircleNotice(slug, error.message || 'Could not save vouch.', 'error');
  }

  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    const messages: Record<string, string> = {
      FORBIDDEN: 'Only circle admins can vouch for members.',
      NOT_FOUND: 'Member not found.',
      UNAUTHENTICATED: 'Sign in again, then retry.',
    };
    redirectWithCircleNotice(
      slug,
      messages[result?.error ?? ''] ?? result?.error ?? 'Could not save vouch.',
      'error',
    );
  }

  revalidatePath(`/circles/${slug}`);
  revalidatePath(`/circles/${slug}/officer`);
  redirectWithCircleNotice(
    slug,
    approve ? 'Member vouched.' : 'Vouch rejected.',
    'success',
  );
}

function isNextRedirectError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    typeof (error as { digest?: unknown }).digest === 'string' &&
    String((error as { digest: string }).digest).startsWith('NEXT_REDIRECT')
  );
}

/** Remove a member from the circle (no WhatsApp required). */
export async function removeMemberAction(formData: FormData): Promise<void> {
  const memberId = String(formData.get('memberId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  if (!memberId || !slug) return;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      redirect(withNoticeQuery(`/circles/${slug}`, 'Sign in again.', 'error'));
    }

    const { data: row, error: readError } = await supabase
      .from('members')
      .select('id, user_id, role, status, jamiya_id')
      .eq('id', memberId)
      .maybeSingle();

    if (readError || !row) {
      redirect(withNoticeQuery(`/circles/${slug}`, 'Member not found.', 'error'));
    }

    const member = row as {
      id: string;
      user_id: string;
      role: string;
      status: string;
      jamiya_id: string;
    };

    if (member.user_id === user.id) {
      redirect(
        withNoticeQuery(
          `/circles/${slug}`,
          'You cannot remove yourself. Transfer admin first.',
          'error',
        ),
      );
    }

    if (member.status === 'removed' || member.status === 'left') {
      redirect(withNoticeQuery(`/circles/${slug}`, 'Member already removed.', 'info'));
    }

    let removed = false;
    const { error } = await supabase
      .from('members')
      .update({
        status: 'removed',
        left_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', memberId);

    if (!error) {
      removed = true;
    } else {
      const { createServiceRoleClient } = await import('@/lib/supabase/service');
      const admin = createServiceRoleClient();
      const { data: me } = await admin
        .from('members')
        .select('role, status')
        .eq('jamiya_id', member.jamiya_id)
        .eq('user_id', user.id)
        .maybeSingle();
      const { data: profile } = await admin
        .from('profiles')
        .select('platform_role')
        .eq('id', user.id)
        .maybeSingle();
      const myRole = (me as { role?: string; status?: string } | null)?.role;
      const myStatus = (me as { role?: string; status?: string } | null)?.status;
      const platformRole = (profile as { platform_role?: string } | null)?.platform_role;
      const canManage =
        platformRole === 'platform_admin' ||
        platformRole === 'super_admin' ||
        (myStatus === 'active' &&
          ['circle_admin', 'chair', 'secretary', 'treasurer'].includes(myRole ?? ''));
      if (!canManage) {
        redirect(
          withNoticeQuery(`/circles/${slug}`, 'Only circle officers can remove members.', 'error'),
        );
      }
      const { error: adminError } = await admin
        .from('members')
        .update({
          status: 'removed',
          left_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as never)
        .eq('id', memberId);
      if (adminError) {
        redirect(
          withNoticeQuery(
            `/circles/${slug}`,
            adminError.message || 'Could not remove member.',
            'error',
          ),
        );
      }
      removed = true;
    }

    if (removed) {
      await supabase.from('audit_logs').insert({
        actor_id: user.id,
        action: 'member_remove',
        entity_type: 'member',
        entity_id: memberId,
        jamiya_id: member.jamiya_id,
        metadata: { previous_status: member.status, previous_role: member.role },
      } as never);
    }

    revalidatePath(`/circles/${slug}`);
    revalidatePath('/circles');
    revalidatePath('/dashboard');
    redirect(withNoticeQuery(`/circles/${slug}`, 'Member removed from the circle.', 'success'));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(
      withNoticeQuery(
        `/circles/${slug}`,
        error instanceof Error ? error.message : 'Could not remove member.',
        'error',
      ),
    );
  }
}

/** Correct a member phone / display name (works without WhatsApp). */
export async function correctMemberContactAction(formData: FormData): Promise<void> {
  const memberId = String(formData.get('memberId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const fullName = String(formData.get('fullName') ?? '').trim();
  const phoneRaw = String(formData.get('phone') ?? '').trim();
  if (!memberId || !slug) return;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      redirect(withNoticeQuery(`/circles/${slug}`, 'Sign in again.', 'error'));
    }

    const { data: row } = await supabase
      .from('members')
      .select('id, user_id, jamiya_id')
      .eq('id', memberId)
      .maybeSingle();
    if (!row) {
      redirect(withNoticeQuery(`/circles/${slug}`, 'Member not found.', 'error'));
    }
    const member = row as { id: string; user_id: string; jamiya_id: string };

    const { createServiceRoleClient } = await import('@/lib/supabase/service');
    const admin = createServiceRoleClient();
    const { data: me } = await admin
      .from('members')
      .select('role, status')
      .eq('jamiya_id', member.jamiya_id)
      .eq('user_id', user.id)
      .maybeSingle();
    const { data: profile } = await admin
      .from('profiles')
      .select('platform_role')
      .eq('id', user.id)
      .maybeSingle();
    const myRole = (me as { role?: string; status?: string } | null)?.role;
    const myStatus = (me as { role?: string; status?: string } | null)?.status;
    const platformRole = (profile as { platform_role?: string } | null)?.platform_role;
    const canManage =
      platformRole === 'platform_admin' ||
      platformRole === 'super_admin' ||
      (myStatus === 'active' &&
        ['circle_admin', 'chair', 'secretary', 'treasurer'].includes(myRole ?? ''));
    if (!canManage) {
      redirect(
        withNoticeQuery(
          `/circles/${slug}`,
          'Only circle officers can correct member details.',
          'error',
        ),
      );
    }

    const patch: Record<string, string> = {};
    if (fullName) patch.full_name = fullName.slice(0, 120);
    if (phoneRaw) {
      const { toE164Kenya } = await import('@jamiya/shared');
      const normalized = toE164Kenya(phoneRaw) ?? phoneRaw;
      patch.phone = normalized;
    }
    if (Object.keys(patch).length === 0) {
      redirect(withNoticeQuery(`/circles/${slug}`, 'Enter a name or phone to correct.', 'error'));
    }

    const { error } = await admin.from('profiles').update(patch as never).eq('id', member.user_id);
    if (error) {
      redirect(
        withNoticeQuery(`/circles/${slug}`, error.message || 'Could not update contact.', 'error'),
      );
    }

    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'member_contact_correct',
      entity_type: 'member',
      entity_id: memberId,
      jamiya_id: member.jamiya_id,
      metadata: patch,
    } as never);

    revalidatePath(`/circles/${slug}`);
    redirect(withNoticeQuery(`/circles/${slug}`, 'Member details updated.', 'success'));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(
      withNoticeQuery(
        `/circles/${slug}`,
        error instanceof Error ? error.message : 'Could not update contact.',
        'error',
      ),
    );
  }
}
