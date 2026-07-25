import { createHash, randomBytes } from 'node:crypto';

export function generateInvitationToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function getInvitationExpiry(days = 14): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}
