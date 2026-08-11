import { NextResponse, type NextRequest } from 'next/server';
import { isValidKeMobile, normalizePhone254 } from '@jamiya/shared';
import { sendSMS } from '@/lib/sms';
import { createServiceRoleClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';

const RESEND_COOLDOWN_SEC = 60;

/** Taifa Mobile SMS + otp_codes. */
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
    const admin = createServiceRoleClient();

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
        return NextResponse.json(
          {
            error: `Wait ${waitSec}s before requesting another code.`,
            retry_after: waitSec,
          },
          { status: 429 },
        );
      }
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const { error: insertError } = await admin.from('otp_codes').insert({
      phone: normalized,
      code,
      expires_at: expiresAt,
      used: false,
    });

    if (insertError) {
      console.error('[auth/phone/send] otp insert', insertError);
      return NextResponse.json({ error: 'Could not send code' }, { status: 500 });
    }

    if (!(process.env.TAIFA_API_KEY ?? '').trim() && process.env.SMS_BYPASS !== 'true') {
      return NextResponse.json(
        { error: 'SMS service is not configured. Contact support.' },
        { status: 503 },
      );
    }

    const isProd =
      process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
    if (process.env.SMS_BYPASS === 'true') {
      if (isProd) {
        console.error('[auth/phone/send] SMS_BYPASS blocked in production');
        return NextResponse.json(
          { error: 'SMS bypass is disabled in production. Configure TAIFA_API_KEY.' },
          { status: 503 },
        );
      }
      console.log('[SMS BYPASS] OTP for', normalized, 'is:', code);
      return NextResponse.json({
        success: true,
        retry_after: RESEND_COOLDOWN_SEC,
        hint: 'SMS bypassed — check server logs for code',
        ...(process.env.NODE_ENV === 'development' ? { dev_otp: code } : {}),
      });
    }

    await sendSMS(normalized, `Your Amanah code is ${code}. Valid 15 min. Do not share.`);

    return NextResponse.json({
      success: true,
      retry_after: RESEND_COOLDOWN_SEC,
      ...(process.env.NODE_ENV === 'development' ? { dev_otp: code } : {}),
    });
  } catch (e) {
    console.error('[auth/phone/send]', e);
    return NextResponse.json({ error: 'Failed to send code' }, { status: 500 });
  }
}
