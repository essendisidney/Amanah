'use server';

import { revalidatePath } from 'next/cache';
import { callRpc } from '@/lib/supabase/rpc';

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
  if (!memberId) return;

  await callRpc('vouch_for_member', {
    p_member_id: memberId,
    p_approve: approve,
    p_notes: notes || null,
  });

  if (slug) revalidatePath(`/circles/${slug}`);
}
