import type { PaymentAdapter } from './types';
import type {
  CollectPaymentInput,
  CollectPaymentResult,
  DisbursePaymentInput,
  DisbursePaymentResult,
  PaymentStatusResult,
} from '../types';
import {
  initializePaystackTransaction,
  settlePaystackReference,
  verifyPaystackTransaction,
  isPaystackConfigured,
} from '@/lib/payments/paystack';

export const paystackAdapter: PaymentAdapter = {
  id: 'paystack',

  isConfigured() {
    return isPaystackConfigured() && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  },

  async collect(input: CollectPaymentInput): Promise<CollectPaymentResult> {
    const init = await initializePaystackTransaction({
      intentId: input.intentId,
      amount: input.amount,
      currency: input.currency,
      email: input.email,
      phone: input.phone,
      userId: input.userId,
      metadata: input.metadata,
    });
    if (!init.ok) {
      return { ok: false, provider: 'paystack', error: init.error };
    }
    return {
      ok: true,
      provider: 'paystack',
      status: 'redirect',
      redirectUrl: init.authorization_url,
      providerReference: init.reference,
      customerMessage: 'Continue to Paystack Checkout to complete payment.',
    };
  },

  async disburse(_input: DisbursePaymentInput): Promise<DisbursePaymentResult> {
    return {
      ok: false,
      provider: 'paystack',
      error:
        'Paystack B2C/disbursement is not the Kenya chama path — use IntaSend or Daraja.',
    };
  },

  async getStatus(reference: string): Promise<PaymentStatusResult> {
    const verified = await verifyPaystackTransaction(reference);
    if (!verified.ok || !verified.data) {
      return {
        ok: false,
        provider: 'paystack',
        error: verified.error ?? 'VERIFY_FAILED',
        providerReference: reference,
      };
    }
    const status = (verified.data.status ?? '').toLowerCase();
    const mapped =
      status === 'success'
        ? 'success'
        : status === 'failed' || status === 'abandoned'
          ? 'failed'
          : status === 'pending'
            ? 'pending'
            : 'unknown';
    return {
      ok: true,
      provider: 'paystack',
      status: mapped,
      providerReference: reference,
      raw: verified.data,
    };
  },
};

/** Settle a Paystack reference into the ledger (webhook / callback). */
export async function settlePaystackViaOrchestrator(reference: string) {
  return settlePaystackReference(reference);
}
