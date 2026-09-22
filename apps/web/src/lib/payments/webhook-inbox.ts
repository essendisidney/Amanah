import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export type WebhookIngestResult = {
  ok: boolean;
  id?: string;
  duplicate?: boolean;
  error?: string;
};

/**
 * Durable PSP callback inbox. Fingerprint must be stable for retries.
 */
export async function ingestWebhookEvent(
  admin: SupabaseClient,
  input: {
    provider: string;
    fingerprint: string;
    payload: Record<string, unknown>;
    eventType?: string | null;
    externalId?: string | null;
    paymentIntentId?: string | null;
    headers?: Record<string, string>;
  },
): Promise<WebhookIngestResult> {
  const { data, error } = await admin.rpc('ingest_webhook_event', {
    p_provider: input.provider,
    p_fingerprint: input.fingerprint,
    p_payload: input.payload,
    p_event_type: input.eventType ?? null,
    p_external_id: input.externalId ?? null,
    p_payment_intent_id: input.paymentIntentId ?? null,
    p_headers: input.headers ?? {},
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  const row = data as { ok?: boolean; id?: string; duplicate?: boolean } | null;
  return {
    ok: Boolean(row?.ok),
    id: row?.id,
    duplicate: Boolean(row?.duplicate),
  };
}

export async function finalizeWebhookEvent(
  admin: SupabaseClient,
  eventId: string | undefined,
  status: 'processed' | 'ignored' | 'failed',
  opts?: { error?: string; paymentIntentId?: string | null },
): Promise<void> {
  if (!eventId) return;
  await admin.rpc('finalize_webhook_event', {
    p_event_id: eventId,
    p_status: status,
    p_error: opts?.error ?? null,
    p_payment_intent_id: opts?.paymentIntentId ?? null,
  });
}

/** Stable fingerprint from provider + key fields (SHA-256 hex). */
export function webhookFingerprint(
  provider: string,
  parts: Array<string | null | undefined>,
): string {
  const raw = [provider, ...parts.map((p) => (p ?? '').trim())].join('|');
  return createHash('sha256').update(raw).digest('hex');
}
