export type AuthActionState = {
  success: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export const initialAuthActionState: AuthActionState = {
  success: false,
};

export function mapZodErrors(
  error: { flatten: () => { fieldErrors: Record<string, string[] | undefined> } },
): Record<string, string[]> {
  const flattened = error.flatten().fieldErrors;
  const result: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(flattened)) {
    if (value && value.length > 0) {
      result[key] = value;
    }
  }
  return result;
}

export function getSafeRedirectPath(path: string | null | undefined, fallback = '/dashboard'): string {
  if (!path || !path.startsWith('/') || path.startsWith('//')) {
    return fallback;
  }
  if (path.includes('\\') || path.includes('://')) {
    return fallback;
  }
  return path || fallback;
}

export function isProfileComplete(
  row: { profile_completed?: boolean | null; full_name?: string | null } | null | undefined,
): boolean {
  return Boolean(row?.profile_completed && row?.full_name?.trim());
}

/** Incomplete profiles land on onboarding; password-reset destinations are left alone. */
export function buildPostAuthPath(next: string | null | undefined, profileComplete: boolean): string {
  const dest = getSafeRedirectPath(next);
  if (dest === '/reset-password' || dest.startsWith('/reset-password?')) {
    return dest;
  }
  if (profileComplete) return dest;
  return `/profile?onboarding=1&next=${encodeURIComponent(dest)}`;
}
