import { normalizePhone254 } from '@jamiya/shared';

/**
 * Taifa Mobile SMS, API v2 (vas.taifamobile.co.ke → API & developers). The v1 path
 * api.taifamobile.co.ke/sms/sendsms with an `api-key` header started answering 404 in October
 * 2026. v2: POST /v2/sms/sendsms, key in the `h_api_key` header, JSON body
 * { mobile, sender_name, message, response_type }. Always HTTP 200; the body is
 * [{ status_code, status_desc, message_id, … }] and "1000" means accepted.
 * The same request is made by the auth-otp-send and notify-dispatch Edge functions.
 */
export const TAIFA_SMS_URL = 'https://api.taifamobile.co.ke/v2/sms/sendsms';

function clean(value: string | undefined): string {
  return (value ?? '').trim().replace(/^["']|["']$/g, '');
}

/** Reads Taifa's reply; returns null when accepted, else the reason. */
export function taifaRejection(text: string): string | null {
  let row: { status_code?: string | number; status_desc?: string } | undefined;
  try {
    const parsed = JSON.parse(text) as unknown;
    row = (Array.isArray(parsed) ? parsed[0] : parsed) as typeof row;
  } catch {
    return `Bad response from Taifa: ${text.slice(0, 120)}`;
  }
  const code = String(row?.status_code ?? '');
  if (code === '1000') return null;
  return `Taifa ${code || '?'}: ${row?.status_desc ?? text.slice(0, 120)}`;
}

/** Send an SMS. Mobile is 2547XXXXXXXX. Throws `Taifa <code>: …` when Taifa refuses. */
export async function sendSMS(phone: string, message: string): Promise<void> {
  const apiKey = clean(process.env.TAIFA_API_KEY);
  if (!apiKey) {
    throw new Error('TAIFA_API_KEY is not configured');
  }

  const mobile = normalizePhone254(phone);
  if (!/^254[17]\d{8}$/.test(mobile)) {
    throw new Error(`Invalid Kenya mobile: ${phone}`);
  }

  let res: Response;
  try {
    res = await fetch(TAIFA_SMS_URL, {
      method: 'POST',
      headers: { h_api_key: apiKey, 'Content-Type': 'application/json' },
      // Fail clearly instead of hanging until the platform kills the request.
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({
        mobile,
        sender_name: clean(process.env.TAIFA_SENDER_ID) || 'SIDNET',
        message,
        response_type: 'json',
      }),
    });
  } catch (e) {
    const why = e instanceof Error && e.name === 'TimeoutError' ? 'no answer in 20s' : String(e);
    throw new Error(`Taifa unreachable: ${why}`);
  }

  const rejection = taifaRejection(await res.text());
  if (rejection) throw new Error(rejection);
}
