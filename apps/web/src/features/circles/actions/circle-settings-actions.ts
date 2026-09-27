'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { redirectWithCircleNotice } from '../lib/circle-notice';
import { circleSettingsUpdate } from '../lib/circle-settings';
import { isCircleLeader } from '../lib/circle-mode';

export async function updateCircleSettingsAction(formData: FormData): Promise<void> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  if (!jamiyaId || !slug) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirectWithCircleNotice(slug, 'Sign in again, then retry.', 'error');
  }

  const { data: membership } = await supabase
    .from('members')
    .select('role, status')
    .eq('jamiya_id', jamiyaId)
    .eq('user_id', user.id)
    .maybeSingle();
  const member = membership as { role: string; status: string } | null;
  if (member?.status !== 'active' || !isCircleLeader(member.role)) {
    redirectWithCircleNotice(slug, 'Only a group leader can change these settings.', 'error');
  }

  const { data: circle } = await supabase
    .from('jamiyas')
    .select('member_count')
    .eq('id', jamiyaId)
    .maybeSingle();
  const memberCount = Number((circle as { member_count?: number } | null)?.member_count ?? 0);

  const parsed = circleSettingsUpdate({
    name: String(formData.get('name') ?? ''),
    description: String(formData.get('description') ?? ''),
    contributionAmount: Number(formData.get('contributionAmount')),
    frequencyDays: Number(formData.get('frequencyDays')),
    maxMembers: Number(formData.get('maxMembers')),
    memberCount,
  });
  if (!parsed.ok) {
    redirectWithCircleNotice(slug, parsed.message, 'error');
  }

  const { error } = await supabase.from('jamiyas').update(parsed.patch).eq('id', jamiyaId);
  if (error) {
    redirectWithCircleNotice(slug, error.message || 'Could not save group settings.', 'error');
  }

  revalidatePath(`/circles/${slug}`);
  revalidatePath('/circles');
  revalidatePath('/dashboard');
  redirectWithCircleNotice(slug, 'Group settings saved.', 'success');
}
