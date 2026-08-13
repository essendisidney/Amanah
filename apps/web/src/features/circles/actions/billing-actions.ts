'use server';

import { revalidatePath } from 'next/cache';
import { callRpc } from '@/lib/supabase/rpc';

export async function setCirclePlanAction(formData: FormData): Promise<void> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const planId = String(formData.get('planId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  if (!jamiyaId || !planId) return;

  await callRpc('set_circle_plan', {
    p_jamiya_id: jamiyaId,
    p_plan_id: planId,
  });

  if (slug) {
    revalidatePath(`/circles/${slug}`);
    revalidatePath(`/circles/${slug}/officer`);
  }
  revalidatePath('/pricing');
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
  if (!requestId) return;

  await callRpc('confirm_dual_approval', {
    p_request_id: requestId,
    p_approve: approve,
  });

  if (slug) {
    revalidatePath(`/circles/${slug}`);
    revalidatePath(`/circles/${slug}/officer`);
    revalidatePath(`/circles/${slug}/audit`);
  }
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
