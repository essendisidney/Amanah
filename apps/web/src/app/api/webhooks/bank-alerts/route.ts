import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { parseBankSms } from '@/lib/bank-sms-parse';

export const dynamic = 'force-dynamic';

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseClient(url, key, { auth: { persistSession: false } });
}

function authorized(req: Request): boolean {
  const expected = process.env.BANK_ALERT_WEBHOOK_SECRET;
  if (!expected) return false;
  const header = req.headers.get('x-amanah-webhook-secret')
    ?? req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  return Boolean(header && header === expected);
}

/**
 * Ingest bank / M-Pesa SMS-style alerts for a circle.
 * POST JSON: { jamiyaId, text, provider?, bankAccountId?, amount?, direction?, externalRef? }
 * Auth: header `x-amanah-webhook-secret` (or Bearer) matching BANK_ALERT_WEBHOOK_SECRET.
 */
export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const supabase = serviceClient();
  if (!supabase) {
    return NextResponse.json({ error: 'SERVICE_UNAVAILABLE' }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const jamiyaId = String(body.jamiyaId ?? body.jamiya_id ?? '');
  const text = String(body.text ?? body.alertText ?? body.message ?? '').trim();
  if (!jamiyaId || !text) {
    return NextResponse.json({ error: 'jamiyaId and text required' }, { status: 400 });
  }

  const parsed = parseBankSms(text);
  const provider = String(body.provider ?? parsed.provider);
  const amount =
    body.amount != null && Number.isFinite(Number(body.amount))
      ? Number(body.amount)
      : parsed.amount;
  const direction = (body.direction as string | undefined) ?? parsed.direction;
  const externalRef =
    (body.externalRef as string | undefined)
    ?? (body.external_ref as string | undefined)
    ?? parsed.externalRef;
  const bankAccountId =
    (body.bankAccountId as string | undefined)
    ?? (body.bank_account_id as string | undefined)
    ?? null;

  const { data, error } = await supabase.rpc('ingest_bank_alert', {
    p_jamiya_id: jamiyaId,
    p_provider: provider,
    p_alert_text: text,
    p_amount: amount,
    p_direction: direction,
    p_currency: parsed.currency,
    p_external_ref: externalRef,
    p_bank_account_id: bankAccountId,
    p_occurred_at: new Date().toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const result = data as { ok?: boolean; error?: string; alert_id?: string; duplicate?: boolean };
  if (!result?.ok) {
    return NextResponse.json({ error: result?.error ?? 'INGEST_FAILED' }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    alertId: result.alert_id,
    duplicate: Boolean(result.duplicate),
    parsed: { provider, amount, direction, externalRef },
  });
}
