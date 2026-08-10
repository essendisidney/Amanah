import { normalizePhone254 } from '@jamiya/shared';

/**
 * Send SMS via Taifa Mobile (same provider as Creda / Savr).
 * API expects mobile as 2547XXXXXXXX (no +).
 */
export async function sendSMS(phone: string, message: string): Promise<void> {
  const apiKey = (process.env.TAIFA_API_KEY ?? '')
    .trim()
    .replace(/^["']|["']$/g, '');
  const senderName = (process.env.TAIFA_SENDER_ID ?? 'SIDNET')
    .trim()
    .replace(/^["']|["']$/g, '');

  if (!apiKey) {
    throw new Error('TAIFA_API_KEY is not configured');
  }

  const mobile = normalizePhone254(phone);
  if (!/^254[17]\d{8}$/.test(mobile)) {
    throw new Error(`Invalid Kenya mobile: ${phone}`);
  }

  const res = await fetch('https://api.taifamobile.co.ke/sms/sendsms', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      mobile,
      response_type: 'json',
      sender_name: senderName,
      service_id: 0,
      message,
    }),
  });

  const text = await res.text();
  let row: unknown;
  try {
    const parsed = JSON.parse(text) as unknown;
    row = Array.isArray(parsed) ? parsed[0] : parsed;
  } catch {
    throw new Error('Bad response from Taifa');
  }

  const r = row as { status_code?: string | number; status_desc?: string };
  if (String(r?.status_code ?? '') === '1000') return;

  throw new Error(
    `Taifa ${r?.status_code ?? '?'}: ${r?.status_desc ?? text.slice(0, 200)}`,
  );
}
