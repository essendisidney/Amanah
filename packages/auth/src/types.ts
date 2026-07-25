import type { PlatformRole } from '@jamiya/types';

export interface AuthUser {
  id: string;
  email: string | null;
  platformRole: PlatformRole;
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
  expiresAt: number | null;
}
