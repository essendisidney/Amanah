import { timingSafeEqual } from 'node:crypto';

function timingSafeStringEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, 'utf8');
    const bb = Buffer.from(b, 'utf8');
    return ba.length === bb.length && timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/**
 * IntaSend webhook auth:
 * 1. If INTASEND_WEBHOOK_CHALLENGE is set, body/invoice challenge MUST match.
 * 2. Optional INTASEND_WEBHOOK_SECRET compared to `x-intasend-signature` or `challenge` header.
 */
export function verifyIntasendWebhook(input: {
  body: Record<string, unknown>;
  headers: Headers;
}): { ok: true } | { ok: false; error: string } {
  const expectedChallenge = (process.env.INTASEND_WEBHOOK_CHALLENGE ?? '').trim();
  const invoice =
    (input.body.invoice as Record<string, unknown> | undefined) ??
    (input.body.data as Record<string, unknown> | undefined) ??
    input.body;

  if (expectedChallenge) {
    const challenge = String(
      input.body.challenge ??
        invoice.challenge ??
        input.headers.get('x-intasend-challenge') ??
        '',
    ).trim();
    if (!challenge) {
      return { ok: false, error: 'MISSING_CHALLENGE' };
    }
    if (!timingSafeStringEqual(challenge, expectedChallenge)) {
      return { ok: false, error: 'INVALID_CHALLENGE' };
    }
  }

  const secret = (process.env.INTASEND_WEBHOOK_SECRET ?? '').trim();
  if (secret) {
    const sig = (
      input.headers.get('x-intasend-signature') ??
      input.headers.get('x-webhook-signature') ??
      ''
    ).trim();
    if (!sig || !timingSafeStringEqual(sig, secret)) {
      return { ok: false, error: 'INVALID_SIGNATURE' };
    }
  }

  return { ok: true };
}
