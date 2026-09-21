import { createServiceRoleClient } from '@/lib/supabase/service';
import { appBaseUrl } from '@/lib/payments/provider';
import { logger } from '@/lib/observability';
import type { PaymentAdapter } from './types';
import type {
  CollectPaymentInput,
  CollectPaymentResult,
  DisbursePaymentInput,
  DisbursePaymentResult,
  PaymentStatusResult,
} from '../types';

/**
 * TendePay adapter (Kenya bake-off vs IntaSend / Daraja).
 *
 * Public developer docs are limited — paths are configurable so staging can
 * point at the real TendePay API once credentials are issued.
 *
 * Env:
 *   TENDEPAY_API_KEY          required
 *   TENDEPAY_API_BASE         default https://api.tendepay.com (or sandbox)
 *   TENDEPAY_TEST=true        use sandbox base if TENDEPAY_API_BASE unset
 *   TENDEPAY_STK_PATH         default /v1/payments/stk-push
 *   TENDEPAY_DISBURSE_PATH    default /v1/payments/b2c
 *   TENDEPAY_STATUS_PATH      default /v1/payments/status
 *
 * Product: https://www.tendepay.com
 */

function apiKey(): string {
  return (process.env.TENDEPAY_API_KEY ?? '').trim();
}

function isTest(): boolean {
  return (process.env.TENDEPAY_TEST ?? 'true').toLowerCase() !== 'false';
}

function apiBase(): string {
  const explicit = (process.env.TENDEPAY_API_BASE ?? '').trim().replace(/\/$/, '');
  if (explicit) return explicit;
  return isTest()
    ? 'https://sandbox.tendepay.com/api'
    : 'https://api.tendepay.com';
}

function stkPath(): string {
  return (process.env.TENDEPAY_STK_PATH ?? '/v1/payments/stk-push').trim();
}

function disbursePath(): string {
  return (process.env.TENDEPAY_DISBURSE_PATH ?? '/v1/payments/b2c').trim();
}

function statusPath(): string {
  return (process.env.TENDEPAY_STATUS_PATH ?? '/v1/payments/status').trim();
}

function toMsisdn(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 10) return `254${digits.slice(1)}`;
  if (digits.startsWith('254')) return digits;
  if (digits.startsWith('7') && digits.length === 9) return `254${digits}`;
  return digits;
}

export function isTendepayConfigured(): boolean {
  return Boolean(apiKey());
}

async function tendepayFetch(
  path: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const res = await fetch(`${apiBase()}${path.startsWith('/') ? path : `/${path}`}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Api-Key': apiKey(),
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, json };
}

function pickRef(json: Record<string, unknown>): string | null {
  const candidates = [
    json.reference,
    json.transaction_id,
    json.tracking_id,
    json.checkout_request_id,
    json.id,
    json.request_id,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return null;
}

export const tendepayAdapter: PaymentAdapter = {
  id: 'tendepay',

  isConfigured() {
    return isTendepayConfigured();
  },

  async collect(input: CollectPaymentInput): Promise<CollectPaymentResult> {
    if (!isTendepayConfigured()) {
      return {
        ok: false,
        provider: 'tendepay',
        error: 'TendePay is not configured. Set TENDEPAY_API_KEY (and optional TENDEPAY_API_BASE).',
      };
    }

    const phone = (input.phone ?? '').trim();
    if (!phone) {
      return { ok: false, provider: 'tendepay', error: 'Phone required for TendePay STK.' };
    }

    const msisdn = toMsisdn(phone);
    const { ok, status, json } = await tendepayFetch(stkPath(), {
      amount: Math.round(Number(input.amount)),
      phone: msisdn,
      phone_number: msisdn,
      currency: (input.currency ?? 'KES').toUpperCase(),
      reference: input.intentId,
      external_reference: input.intentId,
      callback_url: `${appBaseUrl()}/api/webhooks/tendepay`,
      narrative: input.description ?? 'Jameiyah payment',
      description: input.description ?? 'Jameiyah payment',
    });

    if (!ok) {
      const err =
        (typeof json.detail === 'string' && json.detail) ||
        (typeof json.message === 'string' && json.message) ||
        (typeof json.error === 'string' && json.error) ||
        `TendePay STK HTTP ${status}`;
      logger.warn('tendepay stk failed', { error: err, intentId: input.intentId, status });
      return { ok: false, provider: 'tendepay', error: err };
    }

    const ref = pickRef(json) ?? input.intentId;
    const admin = createServiceRoleClient();
    await admin.rpc('mark_payment_intent_processing', {
      p_intent_id: input.intentId,
      p_checkout_request_id: ref,
      p_merchant_request_id: null,
      p_provider_reference: ref,
    });

    return {
      ok: true,
      provider: 'tendepay',
      status: 'processing',
      checkoutRequestId: ref,
      providerReference: ref,
      customerMessage: 'M-Pesa prompt sent via TendePay. Enter your PIN to complete payment.',
    };
  },

  async disburse(input: DisbursePaymentInput): Promise<DisbursePaymentResult> {
    if (!isTendepayConfigured()) {
      return {
        ok: false,
        provider: 'tendepay',
        error: 'TendePay is not configured. Set TENDEPAY_API_KEY.',
      };
    }

    const msisdn = toMsisdn(input.phone);
    const { ok, status, json } = await tendepayFetch(disbursePath(), {
      amount: Math.round(Number(input.amount)),
      phone: msisdn,
      phone_number: msisdn,
      currency: (input.currency ?? 'KES').toUpperCase(),
      reference: input.disbursementId,
      external_reference: input.disbursementId,
      callback_url: `${appBaseUrl()}/api/webhooks/tendepay`,
      narrative: input.narrative ?? `disbursement:${input.disbursementId}`,
      beneficiary_name: input.beneficiaryName ?? 'Jameiyah member',
    });

    if (!ok) {
      const err =
        (typeof json.detail === 'string' && json.detail) ||
        (typeof json.message === 'string' && json.message) ||
        (typeof json.error === 'string' && json.error) ||
        `TendePay B2C HTTP ${status}`;
      logger.warn('tendepay disburse failed', {
        error: err,
        disbursementId: input.disbursementId,
        status,
      });
      return { ok: false, provider: 'tendepay', error: err };
    }

    const ref = pickRef(json) ?? `tendepay:${input.disbursementId}`;
    return {
      ok: true,
      provider: 'tendepay',
      status: 'processing',
      providerReference: ref,
      trackingId: ref,
    };
  },

  async getStatus(reference: string): Promise<PaymentStatusResult> {
    if (!isTendepayConfigured()) {
      return {
        ok: false,
        provider: 'tendepay',
        error: 'TendePay not configured.',
        providerReference: reference,
      };
    }
    try {
      const { ok, status, json } = await tendepayFetch(statusPath(), {
        reference,
        transaction_id: reference,
      });
      if (!ok) {
        return {
          ok: false,
          provider: 'tendepay',
          error:
            (typeof json.message === 'string' && json.message) ||
            `Status HTTP ${status}`,
          providerReference: reference,
        };
      }
      const state = String(
        json.state ?? json.status ?? json.transaction_status ?? '',
      ).toUpperCase();
      const mapped =
        state === 'COMPLETE' ||
        state === 'COMPLETED' ||
        state === 'SUCCESS' ||
        state === 'PAID'
          ? 'success'
          : state === 'FAILED' || state === 'CANCELLED' || state === 'CANCELED'
            ? 'failed'
            : state === 'PENDING' || state === 'PROCESSING'
              ? 'processing'
              : 'unknown';
      return {
        ok: true,
        provider: 'tendepay',
        status: mapped,
        providerReference: reference,
        raw: json,
      };
    } catch (err) {
      return {
        ok: false,
        provider: 'tendepay',
        error: err instanceof Error ? err.message : String(err),
        providerReference: reference,
      };
    }
  },
};
