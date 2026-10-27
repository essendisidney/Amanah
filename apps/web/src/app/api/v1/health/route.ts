import { NextResponse } from 'next/server';
import { canSeeOpsDetails } from '@/lib/ops-access';

/** Liveness + build identity for mobile / uptime monitors. Key details for operators only. */
export async function GET(request: Request) {
  const hasServiceRole = Boolean((process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim());
  const hasTaifa = Boolean((process.env.TAIFA_API_KEY ?? '').trim());
  const hasSupabaseUrl = Boolean(
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '').trim(),
  );
  const hasAnon = Boolean((process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim());

  const base = {
    ok: true,
    service: 'jameiyah-web',
    timestamp: new Date().toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev',
  };
  if (!(await canSeeOpsDetails(request))) return NextResponse.json(base);

  return NextResponse.json({
    ...base,
    otp: {
      supabase_url: hasSupabaseUrl,
      anon_key: hasAnon,
      service_role: hasServiceRole,
      taifa_key: hasTaifa,
      edge_proxy: hasSupabaseUrl && hasAnon,
    },
  });
}
