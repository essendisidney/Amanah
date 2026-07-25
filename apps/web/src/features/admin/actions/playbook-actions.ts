'use server';

import { revalidatePath } from 'next/cache';
import { callRpc } from '@/lib/supabase/rpc';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';

export async function runPlaybookAction(formData: FormData): Promise<void> {
  await requireAdminAccess('compliance');
  const caseId = String(formData.get('caseId') ?? '');
  const playbookId = String(formData.get('playbookId') ?? '') || null;
  if (!caseId) return;

  await callRpc('run_collection_playbook', {
    p_case_id: caseId,
    p_playbook_id: playbookId,
  });

  revalidatePath('/admin/collections');
  revalidatePath('/admin/playbooks');
}
