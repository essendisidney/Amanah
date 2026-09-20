import { NextResponse, type NextRequest } from 'next/server';
import { isValidKeMobile, normalizePhone254 } from '@jamiya/shared';
import { sendSMS } from '@/lib/sms';
import { isSmsPriorityPhone } from '@/lib/sms-priority';
import { createServiceRoleClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';

const RESEND_COOLDOWN_SEC = 60;
const MAX_OTP_PER_HOUR = 5;
const MAX_OTP_PER_DAY = 15;

type OtpSendResult = {
  success?: boolean;
  error?: string;
  retry_after?: number;
  hint?: string;
  via?: 'edge' | 'vercel';
};

function supabasePublicConfig(): { url: string; anon: string } | null {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '')
    .trim()
    .replace(/\/$/, '');
  const anon = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();
  if (!url || !anon) return null;
  return { url, anon };
}

/** Prefer Edge (service role + Taifa secrets live there) when Vercel env is incomplete. */
async function sendViaEdge(phone: string): Promise<OtpSendResult | null> {
  const cfg = supabasePublicConfig();
  if (!cfg) return null;

  const res = await fetch(`${cfg.url}/functions/v1/auth-otp-send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: cfg.anon,
      Authorization: `Bearer ${cfg.anon}`,
    },
    body: JSON.stringify({ phone }),
  });

  const json = (await res.json().catch(() => ({}))) as OtpSendResult;
  if (!res.ok) {
    return {
      success: false,
      error: typeof json.error === 'string' ? json.error : 'Failed to send code',
      retry_after: json.retry_after,
    };
  }
  return { ...json, success: true, via: 'edge' };
}

async function sendViaVercel(normalized: string, priority: boolean): Promise<OtpSendResult> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return {
      success: false,
      error: 'Login SMS is misconfigured (missing service role). Contact support.',
    };
  }

  const admin = createServiceRoleClient();

  if (!priority) {
    const { data: recent } = await admin
      .from('otp_codes')
      .select('created_at')
      .eq('phone', normalized)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recent?.created_at) {
      const ageMs = Date.now() - new Date(recent.created_at).getTime();
      const waitSec = Math.ceil((RESEND_COOLDOWN_SEC * 1000 - ageMs) / 1000);
      if (waitSec > 0) {
        return {
          success: false,
          error: `Wait ${waitSec}s before requesting another code.`,
          retry_after: waitSec,
        };
      }
    }

    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [{ count: hourCount }, { count: dayCount }] = await Promise.all([
      admin
        .from('otp_codes')
        .select('id', { count: 'exact', head: true })
        .eq('phone', normalized)
        .gte('created_at', hourAgo),
      admin
        .from('otp_codes')
        .select('id', { count: 'exact', head: true })
        .eq('phone', normalized)
        .gte('created_at', dayAgo),
    ]);

    if ((hourCount ?? 0) >= MAX_OTP_PER_HOUR) {
      return {
        success: false,
        error: 'Too many codes requested this hour. Try again later.',
        retry_after: 3600,
      };
    }
    if ((dayCount ?? 0) >= MAX_OTP_PER_DAY) {
      return {
        success: false,
        error: 'Daily OTP limit reached for this number. Try again tomorrow.',
        retry_after: 86400,
      };
    }
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const { error: insertError } = await admin.from('otp_codes').insert({
    phone: normalized,
    code,
    purpose: 'auth',
    expires_at: expiresAt,
    used: false,
  });

  if (insertError) {
    console.error('[auth/phone/send] otp insert', insertError);
    return { success: false, error: 'Could not send code' };
  }

  if (!(process.env.TAIFA_API_KEY ?? '').trim() && process.env.SMS_BYPASS !== 'true') {
    return {
      success: false,
      error: 'SMS service is not configured. Contact support.',
    };
  }

  const isProd =
    process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
  if (process.env.SMS_BYPASS === 'true') {
    if (isProd) {
      console.error('[auth/phone/send] SMS_BYPASS blocked in production');
      return {
        success: false,
        error: 'SMS bypass is disabled in production. Configure TAIFA_API_KEY.',
      };
    }
    console.log('[SMS BYPASS] OTP for', normalized, 'is:', code);
    return {
      success: true,
      via: 'vercel',
      retry_after: RESEND_COOLDOWN_SEC,
      hint: 'SMS bypassed — check server logs for code',
    };
  }

  await sendSMS(normalized, `Your Jameiyah code is ${code}. Valid 15 min. Do not share.`);
  return {
    success: true,
    via: 'vercel',
    retry_after: priority ? 0 : RESEND_COOLDOWN_SEC,
  };
}

/** Taifa Mobile SMS + otp_codes (Edge first, Vercel fallback). */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { phone?: string };
    const raw = typeof body.phone === 'string' ? body.phone : '';

    if (!raw.trim()) {
      return NextResponse.json({ error: 'Phone number required' }, { status: 400 });
    }
    if (!isValidKeMobile(raw)) {
      return NextResponse.json(
        { error: 'Enter a valid Kenya mobile (e.g. 0712 345 678).' },
        { status: 400 },
      );
    }

    const normalized = normalizePhone254(raw);
    const priority = isSmsPriorityPhone(normalized);

    // Edge has SUPABASE_SERVICE_ROLE_KEY + TAIFA by default — prefer it.
    const edge = await sendViaEdge(raw).catch((e) => {
      console.error('[auth/phone/send] edge proxy', e);
      return null;
    });

    if (edge?.success) {
      return NextResponse.json({
        success: true,
        retry_after: edge.retry_after ?? (priority ? 0 : RESEND_COOLDOWN_SEC),
        ...(edge.hint ? { hint: edge.hint } : {}),
        ...(process.env.NODE_ENV === 'development' ? { via: edge.via } : {}),
      });
    }

    // If Edge returned a client/rate-limit error, surface it (do not double-send).
    if (edge && edge.success === false && edge.error) {
      const status =
        edge.retry_after && edge.retry_after > 0
          ? 429
          : edge.error.includes('misconfigured') || edge.error.includes('not configured')
            ? 503
            : edge.error.includes('provider')
              ? 502
              : 500;
      // Fall through to Vercel only when Edge is unavailable / misconfigured.
      const edgeDown =
        edge.error === 'Failed to send code' ||
        edge.error.includes('misconfigured') ||
        edge.error.includes('not configured');
      if (!edgeDown) {
        return NextResponse.json(
          { error: edge.error, ...(edge.retry_after ? { retry_after: edge.retry_after } : {}) },
          { status },
        );
      }
    }

    const local = await sendViaVercel(normalized, priority);
    if (!local.success) {
      const status =
        local.retry_after && local.retry_after > 0
          ? 429
          : local.error?.includes('misconfigured') || local.error?.includes('not configured')
            ? 503
            : 500;
      return NextResponse.json(
        {
          error: local.error ?? edge?.error ?? 'Failed to send code',
          ...(local.retry_after ? { retry_after: local.retry_after } : {}),
        },
        { status },
      );
    }

    return NextResponse.json({
      success: true,
      retry_after: local.retry_after ?? RESEND_COOLDOWN_SEC,
      ...(local.hint ? { hint: local.hint } : {}),
      ...(process.env.NODE_ENV === 'development' ? { via: local.via } : {}),
    });
  } catch (e) {
    console.error('[auth/phone/send]', e);
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      return NextResponse.json(
        { error: 'Login SMS is misconfigured (missing service role). Contact support.' },
        { status: 503 },
      );
    }
    if (msg.startsWith('Taifa ')) {
      return NextResponse.json(
        { error: 'SMS provider rejected the message. Try again shortly.' },
        { status: 502 },
      );
    }
    return NextResponse.json({ error: 'Failed to send code' }, { status: 500 });
  }
}
