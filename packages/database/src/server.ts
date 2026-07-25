import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseEnv } from './env';
import type { Database } from './types';

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

/**
 * Server Components / Server Actions / Route Handlers client.
 * Requires Next.js `cookies()` — keep this import path Next-only.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseEnv();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component — middleware will refresh sessions.
        }
      },
    },
  });
}
