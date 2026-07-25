import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseEnv } from './env';
import type { Database } from './types';

/** Browser Supabase client (anon key + cookie session via SSR package). */
export function createClient() {
  const { url, anonKey } = getSupabaseEnv();
  return createBrowserClient<Database>(url, anonKey);
}
