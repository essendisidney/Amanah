'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { PlatformRole } from '@jamiya/types';
import { createClient } from '@/lib/supabase/server';
import { callRpc } from '@/lib/supabase/rpc';
import { withNoticeQuery } from '@/features/auth/lib/types';
import { requireAdminAccess } from '../lib/require-admin';

export async function updateUserRoleAction(formData: FormData): Promise<void> {
  const { userId: actorId } = await requireAdminAccess('admin');
  const userId = String(formData.get('userId') ?? '');
  const role = String(formData.get('role') ?? '') as PlatformRole;
  const allowed: PlatformRole[] = [
    'member',
    'compliance_officer',
    'platform_admin',
    'super_admin',
  ];
  if (!userId || !allowed.includes(role)) return;

  const supabase = await createClient();

  await supabase
    .from('profiles')
    .update({ platform_role: role } as never)
    .eq('id', userId);

  await supabase.from('audit_logs').insert({
    actor_id: actorId,
    action: 'role_change',
    entity_type: 'profile',
    entity_id: userId,
    metadata: { platform_role: role },
  } as never);

  revalidatePath('/admin/users');
}

export async function reviewKycDocumentAction(formData: FormData): Promise<void> {
  await requireAdminAccess('compliance');
  const documentId = String(formData.get('documentId') ?? '');
  const decision = String(formData.get('decision') ?? '');
  const reason = String(formData.get('reason') ?? '');

  if (!documentId || !['approved', 'rejected'].includes(decision)) {
    redirect(withNoticeQuery('/admin/kyc', 'Missing document or decision.', 'error'));
  }

  const { data, error } = await callRpc('review_kyc_document', {
    p_document_id: documentId,
    p_decision: decision,
    p_reason: reason || null,
  });

  revalidatePath('/admin/kyc');
  revalidatePath('/admin');
  revalidatePath('/profile');
  revalidatePath('/notifications');

  if (error) {
    redirect(withNoticeQuery('/admin/kyc', error.message, 'error'));
  }
  const result = data as { ok?: boolean; error?: string } | null;
  if (result && result.ok === false) {
    redirect(
      withNoticeQuery(
        '/admin/kyc',
        result.error ?? 'Could not update KYC document.',
        'error',
      ),
    );
  }
  redirect(
    withNoticeQuery(
      '/admin/kyc',
      decision === 'approved' ? 'Document approved.' : 'Document rejected.',
      'success',
    ),
  );
}

export async function setJamiyaStatusAction(formData: FormData): Promise<void> {
  await requireAdminAccess('admin');
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const status = String(formData.get('status') ?? '');
  const allowed = ['draft', 'open', 'active', 'paused', 'completed', 'cancelled'];
  if (!jamiyaId || !allowed.includes(status)) return;

  await callRpc('admin_set_jamiya_status', {
    p_jamiya_id: jamiyaId,
    p_status: status,
  });

  revalidatePath('/admin/circles');
  revalidatePath('/admin');
  revalidatePath('/circles');
}
