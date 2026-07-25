'use server';

import { revalidatePath } from 'next/cache';
import { callRpc } from '@/lib/supabase/rpc';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';

export async function syncCollectionsAction(): Promise<void> {
  await requireAdminAccess('compliance');
  await callRpc('sync_collection_cases', {});
  revalidatePath('/admin/collections');
}

export async function updateCollectionCaseAction(formData: FormData): Promise<void> {
  await requireAdminAccess('compliance');
  const caseId = String(formData.get('caseId') ?? '');
  const status = String(formData.get('status') ?? '');
  const notes = String(formData.get('notes') ?? '');
  if (!caseId || !status) return;

  await callRpc('update_collection_case', {
    p_case_id: caseId,
    p_status: status,
    p_notes: notes || null,
    p_promised_pay_date: null,
  });

  revalidatePath('/admin/collections');
}
