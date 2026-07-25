import type { PlatformRole } from '@jamiya/types';
import { PLATFORM_ROLE_HIERARCHY } from '@jamiya/shared';

export const PLATFORM_ADMIN_ROLES: readonly PlatformRole[] = [
  'platform_admin',
  'super_admin',
];

export function hasPlatformPrivilege(
  userRole: PlatformRole,
  requiredRole: PlatformRole,
): boolean {
  const userIndex = PLATFORM_ROLE_HIERARCHY.indexOf(userRole);
  const requiredIndex = PLATFORM_ROLE_HIERARCHY.indexOf(requiredRole);
  if (userIndex === -1 || requiredIndex === -1) return false;
  return userIndex >= requiredIndex;
}

export function isAdminRole(role: PlatformRole): boolean {
  return PLATFORM_ADMIN_ROLES.includes(role);
}

export function isComplianceRole(role: PlatformRole): boolean {
  return role === 'compliance_officer' || isAdminRole(role);
}
