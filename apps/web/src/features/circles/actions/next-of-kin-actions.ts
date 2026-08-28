'use server';

import { revalidatePath } from 'next/cache';
import { callRpc } from '@/lib/supabase/rpc';
import { redirectWithCircleNotice } from '../lib/circle-notice';

export async function upsertMemberNextOfKinAction(formData: FormData): Promise<void> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const memberId = String(formData.get('memberId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const fullName = String(formData.get('fullName') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim() || null;
  const relationship = String(formData.get('relationship') ?? 'other').trim() || 'other';
  const notes = String(formData.get('notes') ?? '').trim() || null;
  const returnTo = String(formData.get('returnTo') ?? '').trim();

  if (!jamiyaId || !memberId || !slug) return;

  if (!fullName) {
    redirectWithCircleNotice(
      slug,
      'Enter the next of kin’s full name.',
      'error',
      returnTo === 'next-of-kin' ? '/next-of-kin' : '',
    );
  }

  const { data, error } = await callRpc('upsert_member_next_of_kin', {
    p_jamiya_id: jamiyaId,
    p_member_id: memberId,
    p_full_name: fullName,
    p_phone: phone,
    p_relationship: relationship,
    p_notes: notes,
  });

  const pathSuffix = returnTo === 'next-of-kin' ? '/next-of-kin' : '';

  if (error) {
    redirectWithCircleNotice(
      slug,
      error.message || 'Could not save next of kin.',
      'error',
      pathSuffix,
    );
  }

  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    const msg =
      result?.error === 'NAME_REQUIRED'
        ? 'Enter the next of kin’s full name.'
        : result?.error === 'FORBIDDEN'
          ? 'Only officers can save next of kin.'
          : result?.error === 'MEMBER_NOT_FOUND'
            ? 'Pick a member in this circle.'
            : result?.error || 'Could not save next of kin.';
    redirectWithCircleNotice(slug, msg, 'error', pathSuffix);
  }

  revalidatePath(`/circles/${slug}`);
  revalidatePath(`/circles/${slug}/next-of-kin`);
  redirectWithCircleNotice(slug, 'Next of kin saved.', 'success', pathSuffix);
}

export async function deleteMemberNextOfKinAction(formData: FormData): Promise<void> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const memberId = String(formData.get('memberId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const returnTo = String(formData.get('returnTo') ?? '').trim();
  if (!jamiyaId || !memberId || !slug) return;

  const pathSuffix = returnTo === 'next-of-kin' ? '/next-of-kin' : '';

  const { data, error } = await callRpc('delete_member_next_of_kin', {
    p_jamiya_id: jamiyaId,
    p_member_id: memberId,
  });

  if (error) {
    redirectWithCircleNotice(
      slug,
      error.message || 'Could not remove next of kin.',
      'error',
      pathSuffix,
    );
  }

  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    redirectWithCircleNotice(
      slug,
      result?.error === 'FORBIDDEN'
        ? 'Only officers can remove next of kin.'
        : result?.error || 'Could not remove next of kin.',
      'error',
      pathSuffix,
    );
  }

  revalidatePath(`/circles/${slug}`);
  revalidatePath(`/circles/${slug}/next-of-kin`);
  redirectWithCircleNotice(slug, 'Next of kin removed.', 'success', pathSuffix);
}
