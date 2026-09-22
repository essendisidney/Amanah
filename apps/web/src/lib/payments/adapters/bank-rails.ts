/**
 * Direct bank rails (Co-operative Bank / KCB) behind the orchestrator.
 *
 * Live money moves through Edge `payments-bank` with BANK_RAIL metadata.
 * Until BANK_API_URL + BANK_API_KEY are set, collect/disburse return
 * NOT_CONFIGURED (or simulated only when REQUIRE_REAL_PROVIDERS is false
 * and BANK_ALLOW_SIMULATED=true).
 *
 * Env:
 *   BANK_API_URL / BANK_API_KEY     Edge + app share the generic bank API
 *   BANK_RAIL=coop|kcb|generic      default rail when provider is `bank`
 *   COOP_BANK_API_URL / COOP_BANK_API_KEY   optional Co-op overrides
 *   KCB_BANK_API_URL / KCB_BANK_API_KEY     optional KCB overrides
 *   BANK_ALLOW_SIMULATED=true       allow simulated complete when unconfigured
 */

import { createServiceRoleClient } from '@/lib/supabase/service';
import { logger } from '@/lib/observability';
import type { PaymentAdapter } from './types';
import type {
  CollectPaymentInput,
  CollectPaymentResult,
  DisbursePaymentInput,
  DisbursePaymentResult,
  PaymentProviderId,
  PaymentStatusResult,
} from '../types';

export type BankRail = 'coop' | 'kcb' | 'generic';

export function resolveBankRail(
  provider?: PaymentProviderId | string | null,
): BankRail {
  const id = (provider ?? '').toLowerCase();
  if (id === 'coop' || id === 'coop_bank') return 'coop';
  if (id === 'kcb' || id === 'kcb_bank') return 'kcb';
  const envRail = (process.env.BANK_RAIL ?? 'generic').toLowerCase();
  if (envRail === 'coop' || envRail === 'kcb') return envRail;
  return 'generic';
}

function railEnv(rail: BankRail): { url: string; key: string } {
  if (rail === 'coop') {
    return {
      url: (process.env.COOP_BANK_API_URL ?? process.env.BANK_API_URL ?? '').trim(),
      key: (process.env.COOP_BANK_API_KEY ?? process.env.BANK_API_KEY ?? '').trim(),
    };
  }
  if (rail === 'kcb') {
    return {
      url: (process.env.KCB_BANK_API_URL ?? process.env.BANK_API_URL ?? '').trim(),
      key: (process.env.KCB_BANK_API_KEY ?? process.env.BANK_API_KEY ?? '').trim(),
    };
  }
  return {
    url: (process.env.BANK_API_URL ?? '').trim(),
    key: (process.env.BANK_API_KEY ?? '').trim(),
  };
}

export function isBankRailConfigured(rail: BankRail = resolveBankRail()): boolean {
  const { url, key } = railEnv(rail);
  return Boolean(url && key);
}

function allowSimulated(): boolean {
  if ((process.env.REQUIRE_REAL_PROVIDERS ?? '').toLowerCase() === 'true') {
    return false;
  }
  return (process.env.BANK_ALLOW_SIMULATED ?? 'false').toLowerCase() === 'true';
}

async function invokeBankEdge(body: Record<string, unknown>): Promise<{
  ok: boolean;
  reference?: string;
  status?: string;
  error?: string;
  raw?: unknown;
}> {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceKey) {
    return { ok: false, error: 'SUPABASE_ENV_MISSING' };
  }

  try {
    const res = await fetch(`${baseUrl}/functions/v1/payments-bank`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return {
        ok: false,
        error: String(json.error ?? `BANK_HTTP_${res.status}`),
        raw: json,
      };
    }
    return {
      ok: Boolean(json.ok ?? true),
      reference: json.reference ? String(json.reference) : undefined,
      status: json.status ? String(json.status) : undefined,
      error: json.error ? String(json.error) : undefined,
      raw: json,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'BANK_EDGE_FAILED',
    };
  }
}

function makeBankAdapter(
  id: PaymentProviderId,
  rail: BankRail,
): PaymentAdapter {
  return {
    id,
    isConfigured() {
      return isBankRailConfigured(rail) || allowSimulated();
    },
    async collect(input: CollectPaymentInput): Promise<CollectPaymentResult> {
      if (!isBankRailConfigured(rail)) {
        if (!allowSimulated()) {
          return {
            ok: false,
            provider: id,
            error: `${rail.toUpperCase()}_BANK_NOT_CONFIGURED`,
          };
        }
        const admin = createServiceRoleClient();
        const { error } = await admin.rpc('complete_payment_intent', {
          p_intent_id: input.intentId,
          p_provider_reference: `sim-bank:${rail}:${input.intentId}`,
          p_checkout_request_id: null,
          p_metadata: { source: 'bank_adapter_simulated', rail },
        });
        if (error) {
          return { ok: false, provider: id, error: error.message };
        }
        return {
          ok: true,
          provider: id,
          status: 'completed',
          providerReference: `sim-bank:${rail}:${input.intentId}`,
          fallback: 'simulated',
        };
      }

      const result = await invokeBankEdge({
        action: 'initiate',
        rail,
        intent_id: input.intentId,
        amount: input.amount,
        currency: input.currency ?? 'KES',
        phone: input.phone,
        narrative: input.description,
        idempotency_key: input.intentId,
        metadata: input.metadata ?? {},
      });

      if (!result.ok) {
        logger.warn('bank collect failed', { rail, error: result.error });
        return { ok: false, provider: id, error: result.error ?? 'BANK_COLLECT_FAILED' };
      }

      return {
        ok: true,
        provider: id,
        status: 'processing',
        providerReference: result.reference ?? null,
        customerMessage: `${rail} transfer submitted`,
      };
    },
    async disburse(input: DisbursePaymentInput): Promise<DisbursePaymentResult> {
      if (!isBankRailConfigured(rail)) {
        return {
          ok: false,
          provider: id,
          error: `${rail.toUpperCase()}_BANK_NOT_CONFIGURED`,
        };
      }

      const result = await invokeBankEdge({
        action: 'disburse',
        rail,
        disbursement_id: input.disbursementId,
        amount: input.amount,
        currency: input.currency ?? 'KES',
        account_number: input.accountNumber,
        beneficiary_name: input.beneficiaryName,
        narrative: input.narrative,
        idempotency_key: input.disbursementId,
        metadata: input.metadata ?? {},
      });

      if (!result.ok) {
        return { ok: false, provider: id, error: result.error ?? 'BANK_DISBURSE_FAILED' };
      }

      return {
        ok: true,
        provider: id,
        status: 'processing',
        providerReference: result.reference ?? null,
        trackingId: result.reference ?? null,
      };
    },
    async getStatus(reference: string): Promise<PaymentStatusResult> {
      if (!isBankRailConfigured(rail)) {
        return { ok: false, provider: id, status: 'unknown', error: 'NOT_CONFIGURED' };
      }
      const result = await invokeBankEdge({
        action: 'status',
        rail,
        reference,
      });
      if (!result.ok) {
        return {
          ok: false,
          provider: id,
          status: 'unknown',
          error: result.error,
          raw: result.raw,
        };
      }
      const rawStatus = (result.status ?? 'unknown').toLowerCase();
      const status: PaymentStatusResult['status'] =
        rawStatus === 'success' || rawStatus === 'completed' || rawStatus === 'paid'
          ? 'success'
          : rawStatus === 'failed' || rawStatus === 'rejected'
            ? 'failed'
            : rawStatus === 'pending' || rawStatus === 'submitted' || rawStatus === 'processing'
              ? 'processing'
              : 'unknown';
      return {
        ok: true,
        provider: id,
        status,
        providerReference: result.reference ?? reference,
        raw: result.raw,
      };
    },
  };
}

export const bankAdapter = makeBankAdapter('bank', resolveBankRail('bank'));
export const coopBankAdapter = makeBankAdapter('coop', 'coop');
export const kcbBankAdapter = makeBankAdapter('kcb', 'kcb');
