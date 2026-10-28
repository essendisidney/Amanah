import { normalizePhone254 } from '@jamiya/shared';

/**
 * Taifa Mobile SMS. The old `api.taifamobile.co.ke/sms/sendsms` endpoint went away in October
 * 2026 (404 / sign-in page), so this follows Taifa's client library (github.com/taifaMobile/sms):
 * the JSON `{ message, recepients }` is AES-128-CBC encrypted with the API key and the library's
 * fixed IV, hex-encoded, and posted with the key to /clientapi/sms/. Success is status "00".
 * The same code runs in the auth-otp-send and notify-dispatch Edge functions; keep them in step.
 */
export const TAIFA_SMS_URL = 'https://sms.taifamobile.co.ke/clientapi/sms/';
const TAIFA_IV = 'w4^dgd$%^62:)dgs';

const TAIFA_STATUS: Record<string, string> = {
  '01': 'message failed',
  '97': 'not enough SMS credit',
  '98': 'SMS service not found',
  '99': 'missing details',
};

/** Same bytes as PHP openssl_encrypt(…, 'aes-128-cbc', $apiKey, OPENSSL_RAW_DATA, $iv): the key is
 *  its first 16 bytes, zero-padded when shorter; PKCS#7 padding; lowercase hex out. */
export async function taifaEncrypt(plaintext: string, apiKey: string): Promise<string> {
  const enc = new TextEncoder();
  const keyBytes = new Uint8Array(16);
  keyBytes.set(enc.encode(apiKey).slice(0, 16));
  const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-CBC', false, ['encrypt']);
  const sealed = await crypto.subtle.encrypt(
    { name: 'AES-CBC', iv: enc.encode(TAIFA_IV) },
    key,
    enc.encode(plaintext),
  );
  return Array.from(new Uint8Array(sealed), (b) => b.toString(16).padStart(2, '0')).join('');
}

function clean(value: string | undefined): string {
  return (value ?? '').trim().replace(/^["']|["']$/g, '');
}

/** Send an SMS. Mobile is 2547XXXXXXXX (no +). Throws `Taifa <status>: …` when Taifa refuses. */
export async function sendSMS(phone: string, message: string): Promise<void> {
  const apiKey = clean(process.env.TAIFA_API_KEY);
  if (!apiKey) {
    throw new Error('TAIFA_API_KEY is not configured');
  }

  const mobile = normalizePhone254(phone);
  if (!/^254[17]\d{8}$/.test(mobile)) {
    throw new Error(`Invalid Kenya mobile: ${phone}`);
  }

  const serviceName = clean(process.env.TAIFA_SERVICE_NAME) || null;
  let res: Response;
  try {
    res = await fetch(TAIFA_SMS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Fail clearly instead of hanging until the platform kills the request.
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({
        message: await taifaEncrypt(JSON.stringify({ message, recepients: mobile }), apiKey),
        key: apiKey,
        service_name: serviceName,
      }),
    });
  } catch (e) {
    const why = e instanceof Error && e.name === 'TimeoutError' ? 'no answer in 20s' : String(e);
    throw new Error(`Taifa unreachable: ${why}`);
  }

  const text = await res.text();
  let row: { status?: string | number; statusDescription?: string } | undefined;
  try {
    const parsed = JSON.parse(text) as unknown;
    row = (Array.isArray(parsed) ? parsed[0] : parsed) as typeof row;
  } catch {
    throw new Error(`Bad response from Taifa (HTTP ${res.status}): ${text.slice(0, 120)}`);
  }

  const status = String(row?.status ?? '').padStart(2, '0');
  if (status === '00') return;
  throw new Error(
    `Taifa ${status}: ${row?.statusDescription ?? TAIFA_STATUS[status] ?? text.slice(0, 120)}`,
  );
}
