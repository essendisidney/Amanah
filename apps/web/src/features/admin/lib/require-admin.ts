import { redirect } from 'next/navigation';
import type { PlatformRole } from '@jamiya/types';
import { isAdminRole, isComplianceRole } from '@jamiya/auth';
import { getAuthUser, getUserProfile } from '@/lib/supabase/auth';

export type AdminAccess = {
  userId: string;
  email: string | null;
  role: PlatformRole;
  profile: {
    platform_role: PlatformRole;
    full_name: string | null;
    email: string | null;
  } | null;
};

export async function requireAdminAccess(
  mode: 'admin' | 'compliance' = 'admin',
  returnTo = '/admin',
): Promise<AdminAccess> {
  const { user } = await getAuthUser();

  if (!user) {
    const dest =
      returnTo.startsWith('/') && !returnTo.startsWith('//') && !returnTo.includes('://')
        ? returnTo
        : '/admin';
    redirect(`/phone?next=${encodeURIComponent(dest)}`);
  }

  const profile = await getUserProfile(user.id);

  const role = profile?.platform_role ?? 'member';
  const allowed = mode === 'compliance' ? isComplianceRole(role) : isAdminRole(role);

  if (!allowed) {
    redirect('/dashboard');
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    role,
    profile: profile
      ? {
          platform_role: profile.platform_role,
          full_name: profile.full_name,
          email: profile.email,
        }
      : null,
  };
}
