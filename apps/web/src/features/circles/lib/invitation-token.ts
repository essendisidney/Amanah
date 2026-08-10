import { createHash, randomBytes } from 'node:crypto';

/** Ambiguity-safe alphabet (no 0/O/1/I/L). */
const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateInvitationToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Short human-friendly invite code (default 8 chars). */
export function generateInviteCode(length = 8): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += INVITE_CODE_ALPHABET[bytes[i]! % INVITE_CODE_ALPHABET.length];
  }
  return out;
}

export function isShortInviteCode(value: string): boolean {
  return /^[A-HJ-NP-Z2-9]{6,8}$/i.test(value.trim());
}

/** Build RPC args for preview/accept/decline from a URL token or short code. */
export function invitationRpcArgs(credential: string): {
  p_token_hash?: string;
  p_invite_code?: string;
} {
  const trimmed = credential.trim();
  if (isShortInviteCode(trimmed)) {
    return { p_invite_code: trimmed.toUpperCase() };
  }
  return { p_token_hash: hashInvitationToken(trimmed) };
}

export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function getInvitationExpiry(days = 14): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}
