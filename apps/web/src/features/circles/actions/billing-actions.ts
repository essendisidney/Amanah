'use server';

import { revalidatePath } from 'next/cache';
import { callRpc } from '@/lib/supabase/rpc';
import { mapMoneyError, redirectWithCircleNotice } from '@/features/circles/lib/circle-notice';

export async function setCirclePlanAction(formData: FormData): Promise<void> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const planId = String(formData.get('planId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  if (!jamiyaId || !planId) return;

  const { data, error } = await callRpc('set_circle_plan', {
    p_jamiya_id: jamiyaId,
    p_plan_id: planId,
  });

  if (slug) {
    revalidatePath(`/circles/${slug}`);
    revalidatePath(`/circles/${slug}/officer`);
  }
  revalidatePath('/pricing');

  if (!slug) return;

  if (error) {
    redirectWithCircleNotice(slug, mapMoneyError(error.message), 'error', '/officer');
  }
  const result = data as {
    ok?: boolean;
    error?: string;
    already_active?: boolean;
    price_kes?: number;
  } | null;
  if (!result?.ok) {
    const code = result?.error ?? 'Could not update plan.';
    if (code === 'MEMBER_LIMIT') {
      redirectWithCircleNotice(
        slug,
        'This circle has more members than the plan allows. Reduce seats or pick Pro.',
        'error',
        '/officer',
      );
    }
    redirectWithCircleNotice(slug, mapMoneyError(code), 'error', '/officer');
  }
  const charged = Number(result?.price_kes ?? 0) > 0;
  redirectWithCircleNotice(
    slug,
    result?.already_active
      ? 'That plan is already active.'
      : charged
        ? 'Plan paid from your wallet and activated for 30 days.'
        : 'Plan updated.',
    'success',
    '/officer',
  );
}

export async function setCircleDualApprovalAction(formData: FormData): Promise<void> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const enabledFlags = formData.getAll('enabled').map(String);
  const enabled = enabledFlags.includes('true');
  const threshold = Number(formData.get('threshold') ?? 10000);
  if (!jamiyaId) return;

  await callRpc('set_circle_dual_approval', {
    p_jamiya_id: jamiyaId,
    p_enabled: enabled,
    p_threshold: Number.isFinite(threshold) ? threshold : 10000,
  });

  if (slug) {
    revalidatePath(`/circles/${slug}`);
    revalidatePath(`/circles/${slug}/officer`);
  }
}

export async function confirmCircleDualApprovalAction(formData: FormData): Promise<void> {
  const requestId = String(formData.get('requestId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const approve = String(formData.get('approve') ?? 'true') === 'true';
  if (!requestId || !slug) return;

  const { data, error } = await callRpc('confirm_dual_approval', {
    p_request_id: requestId,
    p_approve: approve,
  });

  revalidatePath(`/circles/${slug}`);
  revalidatePath(`/circles/${slug}/officer`);
  revalidatePath(`/circles/${slug}/audit`);

  if (error) {
    redirectWithCircleNotice(slug, mapMoneyError(error.message), 'error', '/officer');
  }
  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    const code = result?.error ?? 'Could not complete second approval.';
    const message =
      code === 'SECOND_APPROVER_MUST_DIFFER'
        ? 'A different officer must second-approve. You already gave the first approval.'
        : mapMoneyError(code);
    redirectWithCircleNotice(slug, message, 'error', '/officer');
  }
  redirectWithCircleNotice(
    slug,
    approve ? 'Second approval recorded.' : 'Request rejected.',
    'success',
    '/officer',
  );
}

export async function setCircleAutoFineAction(formData: FormData): Promise<void> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const enabledFlags = formData.getAll('enabled').map(String);
  const enabled = enabledFlags.includes('true');
  const graceDays = Number(formData.get('graceDays') ?? 3);
  if (!jamiyaId) return;

  await callRpc('set_circle_auto_fine', {
    p_jamiya_id: jamiyaId,
    p_enabled: enabled,
    p_grace_days: Number.isFinite(graceDays) ? graceDays : 3,
  });

  if (slug) {
    revalidatePath(`/circles/${slug}/arrears`);
    revalidatePath(`/circles/${slug}/officer`);
  }
}

export async function runAutoFinesAction(formData: FormData): Promise<void> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  if (!jamiyaId) return;

  await callRpc('run_auto_fines', { p_jamiya_id: jamiyaId });

  if (slug) {
    revalidatePath(`/circles/${slug}/arrears`);
    revalidatePath(`/circles/${slug}/officer`);
    revalidatePath(`/circles/${slug}`);
  }
}
