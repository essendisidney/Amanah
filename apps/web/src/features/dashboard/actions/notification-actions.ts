'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function markNotificationReadAction(formData: FormData): Promise<void> {
  const notificationId = String(formData.get('notificationId') ?? '');
  if (!notificationId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const payload = { read_at: new Date().toISOString() };
  await supabase
    .from('notifications')
    // Hand-authored Database types still need gen:types for perfect Update inference.
    .update(payload as never)
    .eq('id', notificationId)
    .eq('user_id', user.id)
    .is('read_at', null);

  revalidatePath('/notifications');
  revalidatePath('/dashboard');
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const payload = { read_at: new Date().toISOString() };
  await supabase
    .from('notifications')
    .update(payload as never)
    .eq('user_id', user.id)
    .is('read_at', null);

  revalidatePath('/notifications');
  revalidatePath('/dashboard');
}
