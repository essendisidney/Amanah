'use server';

import { revalidatePath } from 'next/cache';
import { callRpc } from '@/lib/supabase/rpc';
import { createClient } from '@/lib/supabase/server';
import { redirectWithCircleNotice } from '../lib/circle-notice';
import type { ActionState } from '../lib/action-state';
import { initialActionState } from '../lib/action-state';
import { NOK_BULK_MAX_ROWS, parseNokBulkLines } from '../lib/parse-nok-bulk';
import { BOOKS_MEMBER_STATUSES } from '../lib/books-members';

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

function normalizeMemberKey(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Officers paste many next-of-kin rows (member code or name + NOK details). */
export async function bulkUpsertNextOfKinAction(
  _prev: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const paste = String(formData.get('rowsPaste') ?? '');

  if (!jamiyaId || !slug) {
    return { success: false, message: 'Missing circle.' };
  }

  const { rows, errors } = parseNokBulkLines(paste);
  if (errors.length) {
    return { success: false, message: errors.slice(0, 3).join(' ') };
  }
  if (!rows.length) {
    return { success: false, message: 'Paste at least one row.' };
  }
  if (rows.length > NOK_BULK_MAX_ROWS) {
    return { success: false, message: `Paste at most ${NOK_BULK_MAX_ROWS} rows at a time.` };
  }

  const supabase = await createClient();
  const { data: memberRows } = await supabase
    .from('members')
    .select('id, user_id, member_code, status')
    .eq('jamiya_id', jamiyaId)
    .in('status', [...BOOKS_MEMBER_STATUSES]);

  const members = (memberRows ?? []) as Array<{
    id: string;
    user_id: string;
    member_code: string | null;
  }>;
  const userIds = members.map((m) => m.user_id);
  const { data: profiles } = userIds.length
    ? await supabase.from('profiles').select('id, full_name, email, phone').in('id', userIds)
    : { data: [] };
  const profileById = new Map(
    ((profiles ?? []) as Array<{
      id: string;
      full_name: string | null;
      email: string | null;
      phone: string | null;
    }>).map((p) => [p.id, p]),
  );

  const matchers = members.map((m) => {
    const p = profileById.get(m.user_id);
    const label = p?.full_name || p?.email || p?.phone || '';
    return {
      id: m.id,
      code: (m.member_code ?? '').toUpperCase(),
      norm: normalizeMemberKey(label),
    };
  });

  let saved = 0;
  const failed: string[] = [];

  for (const row of rows) {
    const key = row.memberKey.trim();
    const keyNorm = normalizeMemberKey(key);
    const member =
      matchers.find((m) => m.code && m.code === key.toUpperCase()) ??
      matchers.find((m) => m.norm === keyNorm) ??
      matchers.find((m) => m.norm.includes(keyNorm) || keyNorm.includes(m.norm));

    if (!member) {
      failed.push(key);
      continue;
    }

    const { data, error } = await callRpc('upsert_member_next_of_kin', {
      p_jamiya_id: jamiyaId,
      p_member_id: member.id,
      p_full_name: row.fullName,
      p_phone: row.phone,
      p_relationship: row.relationship,
      p_notes: row.notes,
    });

    if (error) {
      failed.push(key);
      continue;
    }
    const result = data as { ok?: boolean } | null;
    if (!result?.ok) {
      failed.push(key);
      continue;
    }
    saved += 1;
  }

  revalidatePath(`/circles/${slug}`);
  revalidatePath(`/circles/${slug}/next-of-kin`);

  if (!saved) {
    return {
      success: false,
      message:
        failed.length > 0
          ? `No rows saved. Check member names/codes: ${failed.slice(0, 5).join(', ')}.`
          : 'Nothing to save.',
    };
  }

  const failNote =
    failed.length > 0 ? ` ${failed.length} row(s) skipped (member not found).` : '';
  return {
    success: true,
    message: `Saved next of kin for ${saved} member${saved === 1 ? '' : 's'}.${failNote}`,
  };
}
