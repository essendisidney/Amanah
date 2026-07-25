import { redirect } from 'next/navigation';
import type { PlatformRole } from '@jamiya/types';
import { isAdminRole, isComplianceRole } from '@jamiya/auth';
import { createClient } from '@/lib/supabase/server';

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
): Promise<AdminAccess> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?next=/admin');
  }

  const { data } = await supabase
    .from('profiles')
    .select('platform_role, full_name, email')
    .eq('id', user.id)
    .maybeSingle();

  const profile = data as unknown as {
    platform_role: PlatformRole;
    full_name: string | null;
    email: string | null;
  } | null;

  const role = profile?.platform_role ?? 'member';
  const allowed = mode === 'compliance' ? isComplianceRole(role) : isAdminRole(role);

  if (!allowed) {
    redirect('/dashboard');
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    role,
    profile,
  };
}
