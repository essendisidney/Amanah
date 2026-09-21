import type { PaymentAdapter } from './types';
import type {
  CollectPaymentInput,
  CollectPaymentResult,
  DisbursePaymentInput,
  DisbursePaymentResult,
  PaymentStatusResult,
} from '../types';
import { invokeMpesaStk } from '@/lib/payments/mpesa';

function edgeBase(): { baseUrl: string; serviceKey: string } | null {
  const baseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  if (!baseUrl || !serviceKey) return null;
  return { baseUrl, serviceKey };
}

/** Safaricom Daraja via existing Edge Function `payments-mpesa`. */
export const darajaAdapter: PaymentAdapter = {
  id: 'mpesa',

  isConfigured() {
    // Edge holds Daraja secrets; app needs service-role reachability.
    // Set DARAJA_READY=false to force-disable even when Supabase is linked.
    if ((process.env.DARAJA_READY ?? 'true').toLowerCase() === 'false') {
      return false;
    }
    return Boolean(edgeBase());
  },

  async collect(input: CollectPaymentInput): Promise<CollectPaymentResult> {
    const phone = (input.phone ?? '').trim();
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
      return {
        ok: false,
        provider: 'mpesa',
        error: 'M-Pesa STK requires an E.164 phone, e.g. +254712345678.',
      };
    }

    const stk = await invokeMpesaStk({
      intentId: input.intentId,
      amount: input.amount,
      phone,
      description: input.description ?? 'Jameiyah payment',
    });

    if (!stk.ok) {
      return { ok: false, provider: 'mpesa', error: stk.error ?? 'STK_FAILED' };
    }

    if (stk.fallback === 'simulated') {
      return {
        ok: true,
        provider: 'mpesa',
        status: 'completed',
        checkoutRequestId: stk.checkout_request_id ?? null,
        customerMessage:
          'M-Pesa sandbox not configured — simulated completion via Daraja adapter.',
        fallback: 'simulated',
      };
    }

    return {
      ok: true,
      provider: 'mpesa',
      status: 'processing',
      checkoutRequestId: stk.checkout_request_id ?? null,
      customerMessage:
        stk.customer_message ??
        'M-Pesa prompt sent. Approve on your phone to complete payment.',
    };
  },

  async disburse(input: DisbursePaymentInput): Promise<DisbursePaymentResult> {
    const edge = edgeBase();
    if (!edge) {
      return {
        ok: false,
        provider: 'mpesa',
        error: 'Supabase URL or service role key missing for B2C.',
      };
    }

    const phone = (input.phone ?? '').trim();
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
      return {
        ok: false,
        provider: 'mpesa',
        error: 'B2C requires an E.164 phone, e.g. +254712345678.',
      };
    }

    const metaKind =
      typeof input.metadata?.kind === 'string' ? input.metadata.kind : '';
    const kind =
      metaKind === 'withdrawal' || metaKind === 'wallet' || metaKind === 'payout'
        ? 'withdrawal'
        : 'charity';

    try {
      const res = await fetch(`${edge.baseUrl}/functions/v1/payments-mpesa`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${edge.serviceKey}`,
          apikey: edge.serviceKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'b2c_payment',
          kind,
          disbursement_id: input.disbursementId,
          amount: input.amount,
          phone,
          description: input.narrative,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        fallback?: 'simulated';
        conversation_id?: string;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        return {
          ok: false,
          provider: 'mpesa',
          error:
            typeof json.error === 'string'
              ? json.error
              : json.error
                ? JSON.stringify(json.error)
                : `B2C HTTP ${res.status}`,
        };
      }
      return {
        ok: true,
        provider: 'mpesa',
        status: json.fallback === 'simulated' ? 'completed' : 'processing',
        providerReference: json.conversation_id ?? null,
        trackingId: json.conversation_id ?? null,
        fallback: json.fallback,
      };
    } catch (err) {
      return {
        ok: false,
        provider: 'mpesa',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },

  async getStatus(reference: string): Promise<PaymentStatusResult> {
    const edge = edgeBase();
    if (!edge) {
      return {
        ok: false,
        provider: 'mpesa',
        error: 'Supabase env missing.',
        providerReference: reference,
      };
    }
    try {
      const res = await fetch(`${edge.baseUrl}/functions/v1/payments-mpesa`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${edge.serviceKey}`,
          apikey: edge.serviceKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'stk_query',
          checkout_request_id: reference,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        status?: 'success' | 'failed' | 'processing' | 'unknown';
        error?: string;
        result_desc?: string;
      };
      if (!res.ok || !json.ok) {
        return {
          ok: false,
          provider: 'mpesa',
          status: 'unknown',
          providerReference: reference,
          error: json.error ?? `Query HTTP ${res.status}`,
        };
      }
      return {
        ok: true,
        provider: 'mpesa',
        status: json.status ?? 'unknown',
        providerReference: reference,
        error: json.result_desc,
      };
    } catch (err) {
      return {
        ok: false,
        provider: 'mpesa',
        status: 'unknown',
        providerReference: reference,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
