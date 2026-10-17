'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import { withNoticeQuery } from '@/features/auth/lib/types';

export async function updateRefundDualApprovalAction(formData: FormData) {
  await requireAdminAccess('admin');
  const enabled = String(formData.get('enabled') ?? '') === 'on';
  const thresholdRaw = String(formData.get('threshold') ?? '10000').trim();
  const threshold = Number(thresholdRaw);

  if (!Number.isFinite(threshold) || threshold < 0) {
    redirect(
      withNoticeQuery(
        '/admin/finance/approvals',
        'Invalid refund dual-approval threshold.',
        'error',
      ),
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('set_platform_setting', {
    p_key: 'dual_approval_refunds',
    p_value: { enabled, threshold },
  });

  const ok =
    !error &&
    data &&
    typeof data === 'object' &&
    (data as { ok?: boolean }).ok === true;

  revalidatePath('/admin/finance/approvals');
  revalidatePath('/admin/finance');
  revalidatePath('/admin/architecture');

  redirect(
    withNoticeQuery(
      '/admin/finance/approvals',
      ok
        ? `Refund dual-approval ${enabled ? 'on' : 'off'} · threshold KES ${threshold}.`
        : `Update failed: ${error?.message ?? (data as { error?: string })?.error ?? 'unknown'}`,
      ok ? 'success' : 'error',
    ),
  );
}

/** Jameiyah's Tawarruq profit rate for each term, in percent (stored in basis points). */
export async function updateTawarruqRatesAction(formData: FormData) {
  await requireAdminAccess('admin');
  const rates: Record<string, number> = {};
  for (const term of ['3', '6', '12', '24']) {
    const pct = Number(String(formData.get(`rate_${term}`) ?? '').trim());
    if (!Number.isFinite(pct) || pct <= 0 || pct > 50) {
      redirect(
        withNoticeQuery(
          '/admin/finance/approvals',
          `Tawarruq rate for ${term} months must be above 0% and at most 50%.`,
          'error',
        ),
      );
    }
    rates[term] = Math.round(pct * 100);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('set_tawarruq_rates' as never, { p_rates: rates } as never);
  const ok = !error && (data as { ok?: boolean } | null)?.ok === true;

  revalidatePath('/admin/finance/approvals');
  revalidatePath('/finance/tawarruq');
  redirect(
    withNoticeQuery(
      '/admin/finance/approvals',
      ok
        ? 'Tawarruq rates saved. New requests use them; existing ones keep their rate.'
        : `Update failed: ${error?.message ?? (data as { error?: string } | null)?.error ?? 'unknown'}`,
      ok ? 'success' : 'error',
    ),
  );
}
