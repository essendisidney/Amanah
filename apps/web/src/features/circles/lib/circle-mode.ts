import { redirectWithCircleNotice } from './circle-notice';

export function isRotatingKind(kind?: string | null): boolean {
  return kind === 'rotating' || !kind;
}

export function isShareDividendKind(kind?: string | null): boolean {
  return kind === 'share_dividend';
}

export function isSavingsKind(kind?: string | null): boolean {
  return kind === 'savings';
}

/** Admin, chair, treasurer, and secretary run the group. */
export const CIRCLE_LEADER_ROLES = ['circle_admin', 'chair', 'treasurer', 'secretary'] as const;

export function isCircleLeader(role?: string | null): boolean {
  return (CIRCLE_LEADER_ROLES as readonly string[]).includes(role ?? '');
}

/** Send merry-go-round users back to the circle hub instead of table-banking surfaces. */
export function redirectIfRotating(
  slug: string,
  kind: string | null | undefined,
  message: string,
): void {
  if (!isRotatingKind(kind)) return;
  redirectWithCircleNotice(slug, message, 'info');
}
