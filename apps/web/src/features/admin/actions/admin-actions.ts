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
  const { userId: actorId } = await requireAdminAccess('admin');
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const status = String(formData.get('status') ?? '').trim().toLowerCase();
  const allowed = ['draft', 'open', 'active', 'paused', 'completed', 'cancelled'];
  if (!jamiyaId || !allowed.includes(status)) {
    redirect(withNoticeQuery('/admin/circles', 'Pick a valid circle status.', 'error'));
  }

  // Prefer RPC (audited). Fall back to service-role update if the RPC is missing/mismatched.
  const rpc = await callRpc('admin_set_jamiya_status', {
    p_jamiya_id: jamiyaId,
    p_status: status,
  });

  let ok = false;
  let unchanged = false;
  let failCode: string | null = null;

  if (!rpc.error) {
    const result = rpc.data as { ok?: boolean; error?: string; unchanged?: boolean } | null;
    if (result?.ok) {
      ok = true;
      unchanged = Boolean(result.unchanged);
    } else {
      failCode = result?.error ?? 'UPDATE_FAILED';
    }
  }

  if (!ok && (!rpc.error || /function|could not find|p_status/i.test(rpc.error.message))) {
    const { createServiceRoleClient } = await import('@/lib/supabase/service');
    const admin = createServiceRoleClient();
    const { data: current, error: readError } = await admin
      .from('jamiyas')
      .select('id, status')
      .eq('id', jamiyaId)
      .maybeSingle();
    if (readError || !current) {
      failCode = readError?.message ?? 'NOT_FOUND';
    } else if (String((current as { status: string }).status) === status) {
      ok = true;
      unchanged = true;
    } else {
      const { error: updateError } = await admin
        .from('jamiyas')
        .update({ status, updated_at: new Date().toISOString() } as never)
        .eq('id', jamiyaId);
      if (updateError) {
        failCode = updateError.message;
      } else {
        await admin.from('audit_logs').insert({
          actor_id: actorId,
          action: 'jamiya_status_change',
          entity_type: 'jamiya',
          entity_id: jamiyaId,
          jamiya_id: jamiyaId,
          metadata: { from: (current as { status: string }).status, to: status },
        } as never);
        ok = true;
        failCode = null;
      }
    }
  } else if (!ok && rpc.error) {
    failCode = rpc.error.message;
  }

  revalidatePath('/admin/circles');
  revalidatePath('/admin');
  revalidatePath('/circles');
  revalidatePath('/dashboard');

  if (!ok) {
    const code = failCode ?? 'UPDATE_FAILED';
    const messages: Record<string, string> = {
      FORBIDDEN: 'Only platform admins can change circle status.',
      NOT_FOUND: 'Circle not found.',
      INVALID_STATUS: 'That status is not allowed.',
      UNAUTHENTICATED: 'Sign in again, then retry.',
    };
    redirect(
      withNoticeQuery(
        '/admin/circles',
        messages[code] ?? `Could not update status (${code}).`,
        'error',
      ),
    );
  }

  redirect(
    withNoticeQuery(
      '/admin/circles',
      unchanged
        ? `Status already ${status}.`
        : status === 'cancelled'
          ? 'Chama cancelled.'
          : `Circle status set to ${status}.`,
      'success',
    ),
  );
}

export async function deleteJamiyaAction(formData: FormData): Promise<void> {
  const { userId: actorId } = await requireAdminAccess('admin');
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  if (!jamiyaId) {
    redirect(withNoticeQuery('/admin/circles', 'Missing circle id.', 'error'));
  }

  const rpc = await callRpc('admin_delete_jamiya', { p_jamiya_id: jamiyaId });
  let deletedName: string | null = null;
  let failCode: string | null = null;
  let failMessage: string | null = null;

  if (!rpc.error) {
    const result = rpc.data as {
      ok?: boolean;
      error?: string;
      message?: string;
      name?: string;
    } | null;
    if (result?.ok) {
      deletedName = result.name ?? null;
    } else {
      failCode = result?.error ?? 'DELETE_FAILED';
      failMessage = result?.message ?? null;
    }
  }

  const rpcMissing =
    Boolean(rpc.error) && /function|could not find|schema cache/i.test(rpc.error!.message);

  if (!deletedName && (rpcMissing || failCode === 'DELETE_FAILED')) {
    const { createServiceRoleClient } = await import('@/lib/supabase/service');
    const admin = createServiceRoleClient();
    const { data: row, error: readError } = await admin
      .from('jamiyas')
      .select('id, name, slug, status')
      .eq('id', jamiyaId)
      .maybeSingle();

    if (readError || !row) {
      failCode = readError?.message ?? 'NOT_FOUND';
    } else {
      const circle = row as {
        id: string;
        name: string;
        slug: string;
        status: string;
      };
      const [{ count: activeMembers }, { count: paidActivity }] = await Promise.all([
        admin
          .from('members')
          .select('id', { count: 'exact', head: true })
          .eq('jamiya_id', jamiyaId)
          .eq('status', 'active'),
        admin
          .from('contributions')
          .select('id', { count: 'exact', head: true })
          .eq('jamiya_id', jamiyaId)
          .in('status', ['paid', 'partial', 'late']),
      ]);

      if (
        ['active', 'paused', 'open', 'completed'].includes(circle.status) &&
        ((activeMembers ?? 0) > 0 || (paidActivity ?? 0) > 0)
      ) {
        failCode = 'CANCEL_FIRST';
        failMessage =
          'Cancel the chama first, then delete. Live circles with members or payments cannot be deleted directly.';
      } else {
        await admin.from('audit_logs').insert({
          actor_id: actorId,
          action: 'jamiya_delete',
          entity_type: 'jamiya',
          entity_id: jamiyaId,
          jamiya_id: jamiyaId,
          metadata: {
            name: circle.name,
            slug: circle.slug,
            status: circle.status,
            active_members: activeMembers ?? 0,
            paid_activity: paidActivity ?? 0,
          },
        } as never);
        const { error: deleteError } = await admin.from('jamiyas').delete().eq('id', jamiyaId);
        if (deleteError) {
          failCode = deleteError.message;
        } else {
          deletedName = circle.name;
          failCode = null;
          failMessage = null;
        }
      }
    }
  } else if (!deletedName && rpc.error && !rpcMissing) {
    failCode = rpc.error.message;
  }

  revalidatePath('/admin/circles');
  revalidatePath('/admin');
  revalidatePath('/circles');
  revalidatePath('/dashboard');

  if (!deletedName) {
    const code = failCode ?? 'DELETE_FAILED';
    if (code === 'CANCEL_FIRST') {
      redirect(
        withNoticeQuery(
          '/admin/circles',
          failMessage ??
            'Cancel the chama first, then delete. Live circles with members or payments cannot be deleted directly.',
          'error',
        ),
      );
    }
    const messages: Record<string, string> = {
      FORBIDDEN: 'Only platform admins can delete circles.',
      NOT_FOUND: 'Circle not found (maybe already deleted).',
      UNAUTHENTICATED: 'Sign in again, then retry.',
    };
    redirect(
      withNoticeQuery(
        '/admin/circles',
        messages[code] ?? failMessage ?? `Could not delete (${code}).`,
        'error',
      ),
    );
  }

  redirect(
    withNoticeQuery('/admin/circles', `Deleted “${deletedName}”.`, 'success'),
  );
}
