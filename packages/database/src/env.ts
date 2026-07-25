export interface SupabasePublicEnv {
  url: string;
  anonKey: string;
}

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. See .env.example for setup.`,
    );
  }
  return value;
}

/**
 * Resolve public Supabase env for browser / server clients.
 * Prefer NEXT_PUBLIC_* in the Next.js app; fall back to SUPABASE_* for tooling.
 *
 * Uses direct `process.env.NEXT_PUBLIC_*` access so Next.js can inline values
 * into client bundles when this package is transpiled.
 */
export function getSupabaseEnv(): SupabasePublicEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_ANON_KEY;

  return {
    url: requireEnv('NEXT_PUBLIC_SUPABASE_URL', url),
    anonKey: requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', anonKey),
  };
}
