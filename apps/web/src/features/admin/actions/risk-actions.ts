'use server';

import { revalidatePath } from 'next/cache';
import { callRpc } from '@/lib/supabase/rpc';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';

export async function recomputeAllRiskAction(): Promise<void> {
  await requireAdminAccess('compliance');
  await callRpc('recompute_all_member_risk', {});
  revalidatePath('/admin/risk');
}
