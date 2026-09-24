import { isComplianceRole } from '@jamiya/auth';
import type { PlatformRole } from '@jamiya/types';

/** Canonical Support console path — keep nav + page gate + returnTo in sync. */
export const ADMIN_SUPPORT_PATH = '/admin/support' as const;

/**
 * Who may open /admin/support (nav or direct load).
 * Matches requireAdminAccess('compliance') used by the admin layout + Support page.
 */
export function canAccessAdminSupport(role: PlatformRole | null | undefined): boolean {
  return !!role && isComplianceRole(role);
}
