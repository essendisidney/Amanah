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

const JAMIYA_STATUSES = [
  'draft',
  'open',
  'active',
  'paused',
  'suspended',
  'completed',
  'cancelled',
] as const;

function isNextRedirectError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    typeof (error as { digest?: unknown }).digest === 'string' &&
    String((error as { digest: string }).digest).startsWith('NEXT_REDIRECT')
  );
}

function safeNotice(message: string, max = 180): string {
  return message.replace(/\s+/g, ' ').trim().slice(0, max);
}

function circlesNotice(message: string, type: 'success' | 'error' | 'info' = 'success') {
  return withNoticeQuery('/admin/circles', safeNotice(message), type);
}

async function setJamiyaStatusViaServiceRole(
  actorId: string,
  jamiyaId: string,
  status: string,
): Promise<{ ok: boolean; unchanged: boolean; failCode: string | null }> {
  try {
    const { createServiceRoleClient } = await import('@/lib/supabase/service');
    const admin = createServiceRoleClient();
    const { data: current, error: readError } = await admin
      .from('jamiyas')
      .select('id, status')
      .eq('id', jamiyaId)
      .maybeSingle();
    if (readError || !current) {
      return { ok: false, unchanged: false, failCode: readError?.message ?? 'NOT_FOUND' };
    }
    const previous = String((current as { status: string }).status);
    if (previous === status) {
      return { ok: true, unchanged: true, failCode: null };
    }
    const { error: updateError } = await admin
      .from('jamiyas')
      .update({ status, updated_at: new Date().toISOString() } as never)
      .eq('id', jamiyaId);
    if (updateError) {
      return { ok: false, unchanged: false, failCode: updateError.message };
    }
    await admin.from('audit_logs').insert({
      actor_id: actorId,
      action: 'jamiya_status_change',
      entity_type: 'jamiya',
      entity_id: jamiyaId,
      jamiya_id: jamiyaId,
      metadata: { from: previous, to: status },
    } as never);
    return { ok: true, unchanged: false, failCode: null };
  } catch (error) {
    return {
      ok: false,
      unchanged: false,
      failCode: error instanceof Error ? error.message : 'UPDATE_FAILED',
    };
  }
}

export async function setJamiyaStatusAction(formData: FormData): Promise<void> {
  try {
    const { userId: actorId } = await requireAdminAccess('admin');
    const jamiyaId = String(formData.get('jamiyaId') ?? '');
    let status = String(formData.get('status') ?? '').trim().toLowerCase();
    const intent = String(formData.get('intent') ?? '').trim().toLowerCase();

    // DB enum may not include suspended yet — store as paused.
    if (status === 'suspended' || intent === 'suspend') {
      status = 'paused';
    }

    if (!jamiyaId || !JAMIYA_STATUSES.includes(status as (typeof JAMIYA_STATUSES)[number])) {
      redirect(circlesNotice('Pick a valid circle status.', 'error'));
    }

    let { ok, unchanged, failCode } = await setJamiyaStatusViaServiceRole(
      actorId,
      jamiyaId,
      status,
    );

    if (!ok) {
      const rpc = await callRpc('admin_set_jamiya_status', {
        p_jamiya_id: jamiyaId,
        p_status: status,
      });
      if (!rpc.error) {
        const result = rpc.data as { ok?: boolean; error?: string; unchanged?: boolean } | null;
        if (result?.ok) {
          ok = true;
          unchanged = Boolean(result.unchanged);
          failCode = null;
        } else {
          failCode = result?.error ?? failCode ?? 'UPDATE_FAILED';
        }
      } else if (!failCode) {
        failCode = rpc.error.message;
      }
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
      redirect(circlesNotice(messages[code] ?? `Could not update status (${code}).`, 'error'));
    }

    if (intent === 'suspend') {
      redirect(circlesNotice(unchanged ? 'Chama already suspended.' : 'Chama suspended.', 'success'));
    }
    if (status === 'cancelled') {
      redirect(circlesNotice(unchanged ? 'Chama already cancelled.' : 'Chama cancelled.', 'success'));
    }

    redirect(
      circlesNotice(
        unchanged ? `Status already ${status}.` : `Circle status set to ${status}.`,
        'success',
      ),
    );
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(
      circlesNotice(
        error instanceof Error ? error.message : 'Could not update circle status.',
        'error',
      ),
    );
  }
}

export async function deleteJamiyaAction(formData: FormData): Promise<void> {
  try {
    const { userId: actorId } = await requireAdminAccess('admin');
    const jamiyaId = String(formData.get('jamiyaId') ?? '');
    if (!jamiyaId) {
      redirect(circlesNotice('Missing circle id.', 'error'));
    }

    let deletedName: string | null = null;
    let failCode: string | null = null;
    let failMessage: string | null = null;

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
          'Cancel or suspend the chama first, then delete. Live circles with members or payments cannot be deleted directly.';
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

        const childTables = [
          'invitations',
          'members',
          'contributions',
          'payouts',
          'penalties',
          'qard_loans',
          'circle_subscriptions',
        ] as const;
        for (const table of childTables) {
          await admin.from(table).delete().eq('jamiya_id', jamiyaId);
        }

        const { error: deleteError } = await admin.from('jamiyas').delete().eq('id', jamiyaId);
        if (deleteError) {
          failCode = 'HAS_DEPENDENCIES';
          failMessage = deleteError.message;
        } else {
          deletedName = circle.name;
          failCode = null;
          failMessage = null;
        }
      }
    }

    if (!deletedName && failCode !== 'CANCEL_FIRST') {
      const rpc = await callRpc('admin_delete_jamiya', { p_jamiya_id: jamiyaId });
      if (!rpc.error) {
        const result = rpc.data as {
          ok?: boolean;
          error?: string;
          message?: string;
          name?: string;
        } | null;
        if (result?.ok) {
          deletedName = result.name ?? deletedName ?? 'circle';
          failCode = null;
          failMessage = null;
        } else if (!failCode) {
          failCode = result?.error ?? 'DELETE_FAILED';
          failMessage = result?.message ?? null;
        }
      }
    }

    revalidatePath('/admin/circles');
    revalidatePath('/admin');
    revalidatePath('/circles');
    revalidatePath('/dashboard');

    if (!deletedName) {
      const code = failCode ?? 'DELETE_FAILED';
      if (code === 'CANCEL_FIRST') {
        redirect(
          circlesNotice(
            failMessage ?? 'Cancel or suspend the chama first, then delete.',
            'error',
          ),
        );
      }
      const messages: Record<string, string> = {
        FORBIDDEN: 'Only platform admins can delete circles.',
        NOT_FOUND: 'Circle not found (maybe already deleted).',
        UNAUTHENTICATED: 'Sign in again, then retry.',
        HAS_DEPENDENCIES:
          'This chama still has linked records that block delete. Cancel or suspend it, then try again.',
      };
      redirect(
        circlesNotice(messages[code] ?? failMessage ?? `Could not delete (${code}).`, 'error'),
      );
    }

    redirect(circlesNotice(`Deleted "${deletedName}".`, 'success'));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(
      circlesNotice(
        error instanceof Error ? error.message : 'Could not delete circle.',
        'error',
      ),
    );
  }
}
