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
 * IntaSend adapter — collections (STK) + B2C disbursements.
 * Env: INTASEND_SECRET_KEY, INTASEND_PUBLISHABLE_KEY,
 * optional INTASEND_TEST=true (sandbox), INTASEND_WALLET_ID for send-money.
 * Docs: https://developers.intasend.com/docs/m-pesa-stk-push
 */

function secretKey(): string {
  return (process.env.INTASEND_SECRET_KEY ?? '').trim();
}

function publishableKey(): string {
  return (process.env.INTASEND_PUBLISHABLE_KEY ?? '').trim();
}

function isTest(): boolean {
  return (process.env.INTASEND_TEST ?? 'true').toLowerCase() !== 'false';
}

function apiBase(): string {
  return isTest()
    ? 'https://sandbox.intasend.com/api/v1'
    : 'https://payment.intasend.com/api/v1';
}

function toMsisdn(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 10) return `254${digits.slice(1)}`;
  if (digits.startsWith('254')) return digits;
  if (digits.startsWith('7') && digits.length === 9) return `254${digits}`;
  return digits;
}

/** M-Pesa / IntaSend narrative display is short — keep it brand-first. */
function truncateNarrative(raw: string, max = 22): string {
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= max) return cleaned || 'Jameiyah';
  return `${cleaned.slice(0, max - 1)}…`;
}

export function isIntasendConfigured(): boolean {
  return Boolean(secretKey() && publishableKey());
}

async function intasendFetch(
  path: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const res = await fetch(`${apiBase()}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, json };
}

export const intasendAdapter: PaymentAdapter = {
  id: 'intasend',

  isConfigured() {
    return isIntasendConfigured();
  },

  async collect(input: CollectPaymentInput): Promise<CollectPaymentResult> {
    if (!isIntasendConfigured()) {
      return {
        ok: false,
        provider: 'intasend',
        error:
          'IntaSend is not configured. Set INTASEND_SECRET_KEY and INTASEND_PUBLISHABLE_KEY.',
      };
    }

    const phone = (input.phone ?? '').trim();
    if (!phone) {
      return { ok: false, provider: 'intasend', error: 'Phone required for IntaSend STK.' };
    }

    const msisdn = toMsisdn(phone);
    // Keep api_ref = intent UUID for webhook settle. Narrative is what members may see
    // alongside the partner STK label (e.g. co-op-bank-stk-push).
    const narrative = truncateNarrative(
      input.description?.trim() || 'Jameiyah top-up',
    );
    const { ok, status, json } = await intasendFetch('/payment/mpesa-stk-push/', {
      amount: Math.round(Number(input.amount)),
      phone_number: msisdn,
      currency: (input.currency ?? 'KES').toUpperCase(),
      api_ref: input.intentId,
      email: input.email ?? undefined,
      narrative,
    });

    if (!ok) {
      const err =
        (typeof json.detail === 'string' && json.detail) ||
        (typeof json.message === 'string' && json.message) ||
        (typeof json.error === 'string' && json.error) ||
        `IntaSend STK HTTP ${status}`;
      logger.warn('intasend stk failed', { error: err, intentId: input.intentId });
      return { ok: false, provider: 'intasend', error: err };
    }

    const invoiceObj =
      json.invoice && typeof json.invoice === 'object'
        ? (json.invoice as Record<string, unknown>)
        : null;
    const invoiceId =
      (typeof invoiceObj?.id === 'string' && invoiceObj.id) ||
      (typeof json.id === 'string' && json.id) ||
      (typeof json.invoice_id === 'string' && json.invoice_id) ||
      null;
    const tracking =
      (typeof json.tracking_id === 'string' && json.tracking_id) ||
      (typeof json.checkout_id === 'string' && json.checkout_id) ||
      invoiceId;

    const admin = createServiceRoleClient();
    await admin.rpc('mark_payment_intent_processing', {
      p_intent_id: input.intentId,
      p_checkout_request_id: tracking,
      p_merchant_request_id: null,
      p_provider_reference: invoiceId ?? tracking,
    });

    return {
      ok: true,
      provider: 'intasend',
      status: 'processing',
      checkoutRequestId: tracking,
      providerReference: invoiceId ?? tracking,
      customerMessage:
        "M-Pesa prompt sent. The name may show a bank partner (e.g. Co-op) — that is Jameiyah's payment rail. Enter your PIN to credit your wallet.",
    };
  },

  async disburse(input: DisbursePaymentInput): Promise<DisbursePaymentResult> {
    if (!isIntasendConfigured()) {
      return {
        ok: false,
        provider: 'intasend',
        error:
          'IntaSend is not configured. Set INTASEND_SECRET_KEY and INTASEND_PUBLISHABLE_KEY.',
      };
    }

    const walletId = (process.env.INTASEND_WALLET_ID ?? '').trim();
    const deviceId = (process.env.INTASEND_DEVICE_ID ?? '').trim();
    const requiresApproval =
      (process.env.INTASEND_REQUIRES_APPROVAL ?? 'NO').toUpperCase() === 'YES'
        ? 'YES'
        : 'NO';

    const accountRaw =
      input.method === 'mpesa_b2b'
        ? String(input.accountNumber ?? input.phone ?? '').replace(/\D/g, '')
        : toMsisdn(input.phone ?? '');
    if (!accountRaw) {
      return {
        ok: false,
        provider: 'intasend',
        error:
          input.method === 'mpesa_b2b'
            ? 'Paybill / Till shortcode required for B2B.'
            : 'Phone required for B2C.',
      };
    }

    const body: Record<string, unknown> = {
      currency: (input.currency ?? 'KES').toUpperCase(),
      provider: input.method === 'mpesa_b2b' ? 'MPESA-B2B' : 'MPESA-B2C',
      requires_approval: requiresApproval,
      callback_url: `${appBaseUrl()}/api/webhooks/intasend`,
      transactions: [
        {
          name: input.beneficiaryName ?? 'Jameiyah member',
          account: Number(accountRaw),
          amount: Math.round(Number(input.amount)),
          narrative: truncateNarrative(
            input.narrative ?? `Jameiyah withdraw`,
          ),
          ...(input.method === 'mpesa_b2b'
            ? {
                account_type: input.accountType ?? 'Paybill',
                account_reference: input.accountReference,
              }
            : {}),
        },
      ],
    };
    if (walletId) body.wallet_id = walletId;
    if (deviceId) body.device_id = deviceId;

    const { ok, status, json } = await intasendFetch('/send-money/initiate/', body);
    if (!ok) {
      const err =
        (typeof json.detail === 'string' && json.detail) ||
        (typeof json.message === 'string' && json.message) ||
        `IntaSend B2C HTTP ${status}`;
      logger.warn('intasend disburse failed', {
        error: err,
        disbursementId: input.disbursementId,
      });
      return { ok: false, provider: 'intasend', error: err };
    }

    const trackingId =
      (typeof json.tracking_id === 'string' && json.tracking_id) ||
      (typeof json.batch_reference === 'string' && json.batch_reference) ||
      null;

    if (requiresApproval === 'YES') {
      return {
        ok: false,
        provider: 'intasend',
        error:
          'IntaSend requires_approval=YES — wire device signing before live B2C, or set INTASEND_REQUIRES_APPROVAL=NO for STP.',
      };
    }

    return {
      ok: true,
      provider: 'intasend',
      status: 'processing',
      providerReference: trackingId,
      trackingId,
    };
  },

  async getStatus(reference: string): Promise<PaymentStatusResult> {
    if (!isIntasendConfigured()) {
      return {
        ok: false,
        provider: 'intasend',
        error: 'IntaSend not configured.',
        providerReference: reference,
      };
    }
    try {
      const res = await fetch(
        `${apiBase()}/payment/status/`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${secretKey()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ invoice_id: reference }),
        },
      );
      const json = (await res.json().catch(() => ({}))) as {
        invoice?: { state?: string };
        state?: string;
        detail?: string;
      };
      if (!res.ok) {
        return {
          ok: false,
          provider: 'intasend',
          error: json.detail ?? `Status HTTP ${res.status}`,
          providerReference: reference,
        };
      }
      const state = (json.invoice?.state ?? json.state ?? '').toUpperCase();
      const mapped =
        state === 'COMPLETE' || state === 'COMPLETED' || state === 'SUCCESS'
          ? 'success'
          : state === 'FAILED' || state === 'CANCELLED'
            ? 'failed'
            : state === 'PENDING' || state === 'PROCESSING'
              ? 'processing'
              : 'unknown';
      return {
        ok: true,
        provider: 'intasend',
        status: mapped,
        providerReference: reference,
        raw: json,
      };
    } catch (err) {
      return {
        ok: false,
        provider: 'intasend',
        error: err instanceof Error ? err.message : String(err),
        providerReference: reference,
      };
    }
  },
};
