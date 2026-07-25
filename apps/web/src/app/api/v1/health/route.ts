import { NextResponse } from 'next/server';

/** Liveness + build identity for mobile / uptime monitors. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'amanah-web',
    phase: 6,
    timestamp: new Date().toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev',
  });
}
