import { unstable_cache } from 'next/cache';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export type PlatformPlan = {
  id: string;
  name: string;
  description: string;
  price_kes: number | string;
  max_members: number;
  sms_credits_month: number;
  whatsapp_enabled: boolean;
  dual_approval_included: boolean;
  exports_included: boolean;
};

/** Cookie-free anon client — safe for ISR/public pages (no cookies()). */
function createPublicAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const getActivePlatformPlans = unstable_cache(
  async (): Promise<PlatformPlan[]> => {
    const supabase = createPublicAnonClient();
    const { data } = await supabase
      .from('platform_plans')
      .select(
        'id, name, description, price_kes, max_members, sms_credits_month, whatsapp_enabled, dual_approval_included, exports_included',
      )
      .eq('active', true)
      .order('sort_order', { ascending: true });
    return (data ?? []) as PlatformPlan[];
  },
  ['platform-plans-active'],
  { revalidate: 3600 },
);
