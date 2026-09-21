import { createServiceRoleClient } from '@/lib/supabase/service';
import { getPaymentStatus } from '@/lib/payments/orchestrator';
import { logger } from '@/lib/observability';

const STALE_MS = 6 * 60 * 60 * 1000;
/** Never block Money page render waiting on provider status. */
const BUDGET_MS = 2500;
const MAX_ROWS = 3;

/**
 * On Money page load: settle paid IntaSend/TendePay intents, and clear
 * long-stuck processing rows so the UI does not look unpaid.
 * Hard time budget — page must not hang if the rail is slow.
 */
export async function reconcileUserPaymentIntents(userId: string): Promise<void> {
  await Promise.race([
    reconcileInner(userId),
    new Promise<void>((resolve) => {
      setTimeout(resolve, BUDGET_MS);
    }),
  ]);
}

async function reconcileInner(userId: string): Promise<void> {
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from('payment_intents')
    .select('id, provider, status, provider_reference, checkout_request_id, created_at')
    .eq('user_id', userId)
    .in('status', ['pending', 'processing'])
    .in('provider', ['intasend', 'tendepay', 'paystack'])
    .order('created_at', { ascending: false })
    .limit(MAX_ROWS);

  const rows = (data ?? []) as Array<{
    id: string;
    provider: string;
    status: string;
    provider_reference: string | null;
    checkout_request_id: string | null;
    created_at: string;
  }>;

  await Promise.allSettled(
    rows.map(async (row) => {
      const age = Date.now() - new Date(row.created_at).getTime();
      const ref = row.provider_reference?.trim() || row.checkout_request_id?.trim() || '';

      if ((row.provider === 'intasend' || row.provider === 'tendepay') && ref) {
        try {
          const status = await getPaymentStatus(
            ref,
            row.provider as 'intasend' | 'tendepay',
          );
          if (status.ok && status.status === 'success') {
            await admin.rpc('complete_payment_intent', {
              p_intent_id: row.id,
              p_provider_reference: status.providerReference ?? ref,
              p_checkout_request_id: row.checkout_request_id,
              p_metadata: { source: 'wallet_page_reconcile', provider: row.provider },
            });
            return;
          }
          if (status.ok && status.status === 'failed') {
            await admin.rpc('fail_payment_intent', {
              p_intent_id: row.id,
              p_error_message: `${row.provider} ${status.status}`,
            });
            return;
          }
        } catch (err) {
          logger.warn('wallet reconcile status failed', {
            intentId: row.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      if (age > STALE_MS) {
        await admin.rpc('fail_payment_intent', {
          p_intent_id: row.id,
          p_error_message: 'Expired — no confirmation. Retry if you still need to top up.',
        });
      }
    }),
  );
}
