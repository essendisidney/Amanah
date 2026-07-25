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
  return path;
}
