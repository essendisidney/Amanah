import { unstable_cache } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

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

export const getActivePlatformPlans = unstable_cache(
  async (): Promise<PlatformPlan[]> => {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
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
