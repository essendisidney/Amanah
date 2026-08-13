import { NextResponse } from 'next/server';
import { dispatchSmsOutboxViaTaifa } from '@/lib/notifications/dispatch-sms-taifa';

export const dynamic = 'force-dynamic';

/**
 * Vercel Cron → local Taifa SMS + Supabase Edge fan-out.
 * Auth: Bearer CRON_SECRET, or Vercel cron header + CRON_SECRET query.
 */
async function invokeEdge(fn: string, cronSecret: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  if (!base) throw new Error('SUPABASE_URL missing');
  const res = await fetch(`${base}/functions/v1/${fn}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cronSecret}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  const text = await res.text();
  let json: unknown = text;
  try {
    json = JSON.parse(text);
  } catch {
    /* keep text */
  }
  return { status: res.status, body: json };
}

function authorized(request: Request): string | null {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return null;
  const auth = request.headers.get('Authorization') ?? '';
  if (auth === `Bearer ${secret}`) return secret;
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';
  const q = new URL(request.url).searchParams.get('secret');
  if (isVercelCron && (q === secret || !q)) return secret;
  return null;
}

export async function GET(request: Request) {
  const secret = authorized(request);
  if (!secret) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const job = new URL(request.url).searchParams.get('job') ?? 'all';
  const results: Record<string, unknown> = {};
  try {
    if (job === 'all' || job === 'reminders') {
      results.reminders = await invokeEdge('reminders', secret);
    }
    if (job === 'all' || job === 'auto-fines') {
      const { createServiceRoleClient } = await import('@/lib/supabase/service');
      const admin = createServiceRoleClient();
      const { data, error } = await admin.rpc('run_auto_fines', { p_jamiya_id: null });
      results.auto_fines = error ? { ok: false, error: error.message } : data;
    }
    if (job === 'all' || job === 'notify') {
      // SMS uses the same Taifa keys as phone OTP (Vercel env).
      results.notify_sms_taifa = await dispatchSmsOutboxViaTaifa(50);
      // Edge still handles email / WhatsApp / push (and SMS fallback if any remain).
      results.notify = await invokeEdge('notify-dispatch', secret);
    }
    if (job === 'all' || job === 'collections') {
      results.collections = await invokeEdge('collections', secret);
    }
    if (job === 'all' || job === 'tawarruq') {
      results.tawarruq = await invokeEdge('tawarruq-partner', secret);
    }
    if (job === 'all' || job === 'sadaka') {
      results.sadaka = await invokeEdge('sadaka-ops', secret);
    }
    return NextResponse.json({ ok: true, results });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'UNKNOWN' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
