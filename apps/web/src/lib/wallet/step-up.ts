import { isValidKeMobile, normalizePhone254 } from '@jamiya/shared';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service';
import { sendSMS } from '@/lib/sms';
import { isSmsPriorityPhone } from '@/lib/sms-priority';

export type WalletStepUpPurpose = 'wallet_top_up' | 'wallet_withdraw';

const RESEND_COOLDOWN_SEC = 60;
const MAX_OTP_PER_HOUR = 5;

function maskPhone(normalized254: string): string {
  if (normalized254.length < 8) return 'your phone';
  return `+${normalized254.slice(0, 5)}***${normalized254.slice(-3)}`;
}

function digitsOnlyCode(raw: string): string {
  return String(raw ?? '').replace(/\D/g, '').slice(0, 6);
}

export function normalizeStepUpPhone(
  raw: string,
): { ok: true; phone: string } | { ok: false; error: string } {
  if (!raw.trim() || !isValidKeMobile(raw)) {
    return {
      ok: false,
      error: 'Add a Kenya mobile on your profile before loading or withdrawing.',
    };
  }
  return { ok: true, phone: normalizePhone254(raw) };
}

async function resolveUserPhone(): Promise<
  { ok: true; phone: string } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sign in again, then retry.' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('phone')
    .eq('id', user.id)
    .maybeSingle();

  const raw = String(
    (profile as { phone?: string | null } | null)?.phone ??
      user.phone ??
      (user.user_metadata as { phone?: string } | undefined)?.phone ??
      '',
  ).trim();

  if (!raw || !isValidKeMobile(raw)) {
    return normalizeStepUpPhone(raw);
  }

  return { ok: true, phone: normalizePhone254(raw) };
}

/** Retire unused codes so only the latest SMS can confirm money movement. */
async function invalidatePriorOtps(
  admin: ReturnType<typeof createServiceRoleClient>,
  phone: string,
  purpose: WalletStepUpPurpose,
) {
  await admin
    .from('otp_codes')
    .update({ used: true })
    .eq('phone', phone)
    .eq('purpose', purpose)
    .eq('used', false);
}

export async function sendWalletStepUpOtpToPhone(
  phoneRaw: string,
  purpose: WalletStepUpPurpose,
): Promise<{ success: false; needsOtp?: boolean; message: string; maskedPhone?: string }> {
  const resolved = normalizeStepUpPhone(phoneRaw);
  if (!resolved.ok) return { success: false, message: resolved.error };

  const admin = createServiceRoleClient();
  const priority = isSmsPriorityPhone(resolved.phone);

  if (!priority) {
    const { data: recent } = await admin
      .from('otp_codes')
      .select('created_at')
      .eq('phone', resolved.phone)
      .eq('purpose', purpose)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recent?.created_at) {
      const ageMs = Date.now() - new Date(recent.created_at).getTime();
      const waitSec = Math.ceil((RESEND_COOLDOWN_SEC * 1000 - ageMs) / 1000);
      if (waitSec > 0) {
        return {
          success: false,
          needsOtp: true,
          maskedPhone: maskPhone(resolved.phone),
          message: `Wait ${waitSec}s before requesting another code.`,
        };
      }
    }

    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await admin
      .from('otp_codes')
      .select('id', { count: 'exact', head: true })
      .eq('phone', resolved.phone)
      .eq('purpose', purpose)
      .gte('created_at', hourAgo);

    if ((count ?? 0) >= MAX_OTP_PER_HOUR) {
      return {
        success: false,
        message: 'Too many verification codes this hour. Try again later.',
      };
    }
  }

  await invalidatePriorOtps(admin, resolved.phone, purpose);

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const { error: insertError } = await admin.from('otp_codes').insert({
    phone: resolved.phone,
    code,
    purpose,
    expires_at: expiresAt,
    used: false,
  });

  if (insertError) {
    console.error('[wallet/step-up] insert', insertError);
    return { success: false, message: 'Could not start verification. Try again.' };
  }

  const action = purpose === 'wallet_withdraw' ? 'withdraw' : 'top up';
  const isProd =
    process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';

  if (process.env.SMS_BYPASS === 'true' && !isProd) {
    console.log('[SMS BYPASS] wallet step-up', purpose, resolved.phone, code);
    return {
      success: false,
      needsOtp: true,
      maskedPhone: maskPhone(resolved.phone),
      message: `Enter the 6-digit code sent to ${maskPhone(resolved.phone)} to ${action} (dev bypass — check server logs).`,
    };
  }

  try {
    await sendSMS(
      resolved.phone,
      `Amanah: ${code} confirms your wallet ${action}. Valid 10 min. Do not share.`,
    );
  } catch (err) {
    console.error('[wallet/step-up] sms', err);
    return {
      success: false,
      message: 'Could not send the verification SMS. Try again or contact support.',
    };
  }

  return {
    success: false,
    needsOtp: true,
    maskedPhone: maskPhone(resolved.phone),
    message: `Enter the 6-digit code sent to ${maskPhone(resolved.phone)} to ${action}.`,
  };
}

export async function sendWalletStepUpOtp(
  purpose: WalletStepUpPurpose,
): Promise<{ success: false; needsOtp?: boolean; message: string; maskedPhone?: string }> {
  const resolved = await resolveUserPhone();
  if (!resolved.ok) return { success: false, message: resolved.error };
  return sendWalletStepUpOtpToPhone(resolved.phone, purpose);
}

export async function consumeWalletStepUpOtpForPhone(
  phoneRaw: string,
  purpose: WalletStepUpPurpose,
  codeRaw: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const code = digitsOnlyCode(codeRaw);
  if (!/^\d{6}$/.test(code)) {
    return { ok: false, error: 'Enter the 6-digit code from SMS.' };
  }

  const resolved = normalizeStepUpPhone(phoneRaw);
  if (!resolved.ok) return { ok: false, error: resolved.error };

  const admin = createServiceRoleClient();
  const now = new Date().toISOString();

  const { data: rows, error: lookupError } = await admin
    .from('otp_codes')
    .select('id')
    .eq('phone', resolved.phone)
    .eq('code', code)
    .eq('purpose', purpose)
    .eq('used', false)
    .gte('expires_at', now)
    .order('created_at', { ascending: false })
    .limit(1);

  if (lookupError) {
    console.error('[wallet/step-up] lookup', lookupError);
    return { ok: false, error: 'Could not verify the code. Try again.' };
  }

  const otpRecord = rows?.[0];
  if (!otpRecord) {
    return {
      ok: false,
      error: 'That code is wrong or no longer valid. Use the latest SMS, or request a new code.',
    };
  }

  const { data: claimed, error: claimError } = await admin
    .from('otp_codes')
    .update({ used: true })
    .eq('id', otpRecord.id)
    .eq('used', false)
    .select('id')
    .maybeSingle();

  if (claimError || !claimed) {
    return { ok: false, error: 'Code already used. Request a new one.' };
  }

  return { ok: true };
}

export async function consumeWalletStepUpOtp(
  purpose: WalletStepUpPurpose,
  codeRaw: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const resolved = await resolveUserPhone();
  if (!resolved.ok) return { ok: false, error: resolved.error };
  return consumeWalletStepUpOtpForPhone(resolved.phone, purpose, codeRaw);
}

export async function requireApiWalletStepUp(input: {
  phoneRaw: string;
  purpose: WalletStepUpPurpose;
  otp?: string | null;
}): Promise<
  | { ok: true }
  | { ok: false; status: number; body: Record<string, unknown> }
> {
  const otp = digitsOnlyCode(String(input.otp ?? ''));
  if (!otp) {
    const sent = await sendWalletStepUpOtpToPhone(input.phoneRaw, input.purpose);
    return {
      ok: false,
      status: sent.needsOtp ? 403 : 400,
      body: {
        ok: false,
        error: sent.needsOtp ? 'STEP_UP_REQUIRED' : 'STEP_UP_FAILED',
        message: sent.message,
        needs_otp: Boolean(sent.needsOtp),
      },
    };
  }
  const check = await consumeWalletStepUpOtpForPhone(input.phoneRaw, input.purpose, otp);
  if (!check.ok) {
    return {
      ok: false,
      status: 403,
      body: { ok: false, error: 'STEP_UP_INVALID', message: check.error, needs_otp: true },
    };
  }
  return { ok: true };
}
