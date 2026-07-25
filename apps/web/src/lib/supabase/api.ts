import { createClient as createSupabaseJsClient, type SupabaseClient } from '@supabase/supabase-js';
import { createClient as createCookieClient } from '@/lib/supabase/server';
import { getSupabaseEnv } from '@jamiya/database';

// Untyped until gen:types covers Phase 3–5 tables.
export type ApiSupabase = SupabaseClient;

/**
 * Prefers `Authorization: Bearer <access_token>` (mobile), else cookie session (web).
 */
export async function createApiClient(request: Request): Promise<ApiSupabase> {
  const header = request.headers.get('Authorization');
  if (header?.startsWith('Bearer ')) {
    const token = header.slice('Bearer '.length).trim();
    const { url, anonKey } = getSupabaseEnv();
    return createSupabaseJsClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return (await createCookieClient()) as unknown as ApiSupabase;
}
