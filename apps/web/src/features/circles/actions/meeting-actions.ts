'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

function revalidateMeetings(slug: string) {
  revalidatePath(`/circles/${slug}`);
  revalidatePath(`/circles/${slug}/community`);
}

export async function scheduleMeetingAction(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '');
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const startsAt = String(formData.get('startsAt') ?? '');
  const endsAt = String(formData.get('endsAt') ?? '');
  const location = String(formData.get('location') ?? '').trim();
  const notes = String(formData.get('notes') ?? '').trim();
  if (!jamiyaId || !title || !startsAt) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from('circle_meetings').insert({
    jamiya_id: jamiyaId,
    title,
    location: location || null,
    notes: notes || null,
    starts_at: new Date(startsAt).toISOString(),
    ends_at: endsAt ? new Date(endsAt).toISOString() : null,
    created_by: user.id,
    status: 'scheduled',
  } as never);

  revalidateMeetings(slug);
}

export async function updateMeetingStatusAction(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '');
  const meetingId = String(formData.get('meetingId') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!meetingId || !['scheduled', 'completed', 'cancelled'].includes(status)) return;

  const supabase = await createClient();
  await supabase
    .from('circle_meetings')
    .update({ status } as never)
    .eq('id', meetingId);

  revalidateMeetings(slug);
}
