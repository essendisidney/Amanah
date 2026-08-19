import { cache } from 'react';
import type { PlatformRole } from '@jamiya/types';
import { createClient } from './server';

/** One Supabase auth lookup per request (layout + pages share this). */
export const getAuthUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
});

export type UserProfileRow = {
  platform_role: PlatformRole;
  full_name: string | null;
  email: string | null;
  kyc_status: string;
  profile_completed: boolean;
};

/** Profile row cached per request for the signed-in user. */
export const getUserProfile = cache(async (userId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('platform_role, full_name, email, kyc_status, profile_completed')
    .eq('id', userId)
    .maybeSingle();
  return (data as unknown as UserProfileRow | null) ?? null;
});

export const getUnreadNotificationCount = cache(async (userId: string) => {
  const supabase = await createClient();
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);
  return count ?? 0;
});
