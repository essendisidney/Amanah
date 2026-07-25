import type { PlatformRole } from '@jamiya/types';
import { hasPlatformPrivilege } from './roles';
import type { AuthUser } from './types';

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: 'UNAUTHENTICATED' | 'FORBIDDEN',
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export function assertAuthenticated(user: AuthUser | null | undefined): asserts user is AuthUser {
  if (!user) {
    throw new AuthError('Authentication required', 'UNAUTHENTICATED');
  }
}

export function assertPlatformRole(user: AuthUser, required: PlatformRole): void {
  assertAuthenticated(user);
  if (!hasPlatformPrivilege(user.platformRole, required)) {
    throw new AuthError('Insufficient permissions', 'FORBIDDEN');
  }
}
