import type { PaymentAdapter } from './types';
import type {
  CollectPaymentInput,
  CollectPaymentResult,
  DisbursePaymentInput,
  DisbursePaymentResult,
  PaymentStatusResult,
} from '../types';
import { createServiceRoleClient } from '@/lib/supabase/service';

export const simulatedAdapter: PaymentAdapter = {
  id: 'simulated',

  isConfigured() {
    return true;
  },

  async collect(input: CollectPaymentInput): Promise<CollectPaymentResult> {
    const admin = createServiceRoleClient();
    const { data, error } = await admin.rpc('complete_payment_intent', {
      p_intent_id: input.intentId,
      p_provider_reference: `sim:${input.intentId}`,
      p_metadata: { source: 'simulated_adapter', ...(input.metadata ?? {}) },
    });
    if (error) {
      return { ok: false, provider: 'simulated', error: error.message };
    }
    const result = data as { ok?: boolean; error?: string } | null;
    if (!result?.ok) {
      return {
        ok: false,
        provider: 'simulated',
        error: result?.error ?? 'SIMULATED_COMPLETE_FAILED',
      };
    }
    return {
      ok: true,
      provider: 'simulated',
      status: 'completed',
      providerReference: `sim:${input.intentId}`,
      customerMessage: 'Simulated payment completed.',
      fallback: 'simulated',
    };
  },

  async disburse(input: DisbursePaymentInput): Promise<DisbursePaymentResult> {
    return {
      ok: true,
      provider: 'simulated',
      status: 'completed',
      providerReference: `sim-b2c:${input.disbursementId}`,
      fallback: 'simulated',
    };
  },

  async getStatus(reference: string): Promise<PaymentStatusResult> {
    return {
      ok: true,
      provider: 'simulated',
      status: reference.startsWith('sim') ? 'success' : 'unknown',
      providerReference: reference,
    };
  },
};
