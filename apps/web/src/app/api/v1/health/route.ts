import { NextResponse } from 'next/server';

/** Liveness + build identity for mobile / uptime monitors. */
export async function GET() {
  const hasServiceRole = Boolean((process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim());
  const hasTaifa = Boolean((process.env.TAIFA_API_KEY ?? '').trim());
  const hasSupabaseUrl = Boolean(
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '').trim(),
  );
  const hasAnon = Boolean((process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim());

  return NextResponse.json({
    ok: true,
    service: 'jameiyah-web',
    phase: 6,
    timestamp: new Date().toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev',
    otp: {
      supabase_url: hasSupabaseUrl,
      anon_key: hasAnon,
      service_role: hasServiceRole,
      taifa_key: hasTaifa,
      edge_proxy: hasSupabaseUrl && hasAnon,
    },
  });
}
