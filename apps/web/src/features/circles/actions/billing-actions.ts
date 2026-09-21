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

  const { data, error } = await callRpc('set_circle_dual_approval', {
    p_jamiya_id: jamiyaId,
    p_enabled: enabled,
    p_threshold: Number.isFinite(threshold) ? threshold : 10000,
  });

  if (slug) {
    revalidatePath(`/circles/${slug}`);
    revalidatePath(`/circles/${slug}/officer`);
  }

  if (!slug) return;

  if (error) {
    redirectWithCircleNotice(slug, mapMoneyError(error.message), 'error', '/officer');
  }
  const result = data as { ok?: boolean; error?: string } | null;
  if (result && result.ok === false) {
    redirectWithCircleNotice(
      slug,
      mapMoneyError(result.error ?? 'Could not save dual-approval settings.'),
      'error',
      '/officer',
    );
  }
  redirectWithCircleNotice(
    slug,
    enabled
      ? `Dual approval on for amounts at/above ${Number.isFinite(threshold) ? threshold : 10000}.`
      : 'Dual approval turned off.',
    'success',
    '/officer',
  );
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

  const dualResult = result as {
    ok?: boolean;
    ready_to_disburse?: boolean;
    payout_id?: string;
  } | null;

  if (approve && dualResult?.ready_to_disburse && dualResult.payout_id) {
    await maybeDisburseTreasuryAfterDual(dualResult, slug);
  }

  redirectWithCircleNotice(
    slug,
    approve ? 'Second approval recorded.' : 'Request rejected.',
    'success',
    '/officer',
  );
}

async function maybeDisburseTreasuryAfterDual(
  result: { ready_to_disburse?: boolean; payout_id?: string } | null,
  slug: string,
): Promise<void> {
  if (!result?.ready_to_disburse || !result.payout_id) return;
  const { createClient } = await import('@/lib/supabase/server');
  const { runTreasuryB2bDisbursement } = await import('@/lib/payments/disburse-treasury');
  const supabase = await createClient();
  const { data: payout } = await supabase
    .from('treasury_payout_requests')
    .select('id, jamiya_id, amount, currency, status, narrative, provider_reference, metadata, destination_id')
    .eq('id', result.payout_id)
    .maybeSingle();
  if (!payout) return;
  const row = payout as {
    id: string;
    jamiya_id: string;
    amount: number;
    currency: string;
    status: string;
    narrative: string | null;
    provider_reference: string | null;
    metadata: Record<string, unknown> | null;
    destination_id: string;
  };
  const { data: dest } = await supabase
    .from('circle_payout_destinations')
    .select(
      'id, kind, label, shortcode, account_reference, bank_name, bank_account_number, bank_account_name',
    )
    .eq('id', row.destination_id)
    .maybeSingle();
  if (!dest) return;
  const sent = await runTreasuryB2bDisbursement(row, dest as never);
  revalidatePath(`/circles/${slug}/treasury`);
  if (!sent.ok) {
    redirectWithCircleNotice(
      slug,
      mapMoneyError(sent.error),
      'error',
      '/officer',
    );
  }
  redirectWithCircleNotice(slug, sent.message, 'success', '/officer');
}

export async function setCircleAutoFineAction(formData: FormData): Promise<void> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const enabledFlags = formData.getAll('enabled').map(String);
  const enabled = enabledFlags.includes('true');
  const graceDays = Number(formData.get('graceDays') ?? 3);
  if (!jamiyaId) return;

  const { data, error } = await callRpc('set_circle_auto_fine', {
    p_jamiya_id: jamiyaId,
    p_enabled: enabled,
    p_grace_days: Number.isFinite(graceDays) ? graceDays : 3,
  });

  if (slug) {
    revalidatePath(`/circles/${slug}/arrears`);
    revalidatePath(`/circles/${slug}/officer`);
  }

  if (!slug) return;

  if (error) {
    redirectWithCircleNotice(slug, mapMoneyError(error.message), 'error', '/arrears');
  }
  const result = data as { ok?: boolean; error?: string } | null;
  if (result && result.ok === false) {
    redirectWithCircleNotice(
      slug,
      mapMoneyError(result.error ?? 'Could not save auto-fine settings.'),
      'error',
      '/arrears',
    );
  }
  redirectWithCircleNotice(
    slug,
    enabled
      ? `Auto-fines on after ${Number.isFinite(graceDays) ? graceDays : 3} grace day(s).`
      : 'Auto-fines turned off.',
    'success',
    '/arrears',
  );
}

export async function runAutoFinesAction(formData: FormData): Promise<void> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  if (!jamiyaId) return;

  const { data, error } = await callRpc('run_auto_fines', { p_jamiya_id: jamiyaId });

  if (slug) {
    revalidatePath(`/circles/${slug}/arrears`);
    revalidatePath(`/circles/${slug}/officer`);
    revalidatePath(`/circles/${slug}`);
  }

  if (!slug) return;

  if (error) {
    redirectWithCircleNotice(slug, mapMoneyError(error.message), 'error', '/arrears');
  }
  const result = data as { ok?: boolean; error?: string; assessed?: number } | null;
  if (result && result.ok === false) {
    redirectWithCircleNotice(
      slug,
      mapMoneyError(result.error ?? 'Could not run auto-fines.'),
      'error',
      '/arrears',
    );
  }
  const assessed = Number(result?.assessed ?? 0);
  redirectWithCircleNotice(
    slug,
    assessed > 0
      ? `Auto-fines run complete — ${assessed} penalty${assessed === 1 ? '' : 'ies'} assessed.`
      : 'Auto-fines run complete — nothing new to levy.',
    'success',
    '/arrears',
  );
}
