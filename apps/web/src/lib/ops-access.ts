import { timingSafeEqual } from 'node:crypto';
import { isAdminRole } from '@jamiya/auth';
import { getAuthUser, getUserProfile } from '@/lib/supabase/auth';

/**
 * Health probes say publicly whether a service is up. Which keys and providers are configured
 * is only for operators: a platform admin's session, or `Authorization: Bearer CRON_SECRET`
 * for scripts and uptime tools.
 */
export async function canSeeOpsDetails(request: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get('Authorization') ?? '';
  if (secret && auth.startsWith('Bearer ')) {
    const given = Buffer.from(auth.slice('Bearer '.length));
    const expected = Buffer.from(secret);
    if (given.length === expected.length && timingSafeEqual(given, expected)) return true;
  }
  try {
    const { user } = await getAuthUser();
    if (!user) return false;
    const profile = await getUserProfile(user.id);
    return isAdminRole(profile?.platform_role ?? 'member');
  } catch {
    return false;
  }
}
