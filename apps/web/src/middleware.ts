import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@jamiya/database/middleware';

const AUTH_ROUTES = new Set([
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/phone',
]);

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/profile',
  '/settings',
  '/circles',
  '/jamiyas', // legacy → redirected below, still auth-gated
  '/wallet',
  '/admin',
  '/invitations',
  '/finance',
  '/notifications',
];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Permanent redirects: /jamiyas → /circles (and admin). */
function legacyCircleRedirect(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;
  if (pathname === '/jamiyas' || pathname.startsWith('/jamiyas/')) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/jamiyas/, '/circles');
    return NextResponse.redirect(url, 308);
  }
  if (pathname === '/admin/jamiyas' || pathname.startsWith('/admin/jamiyas/')) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/admin\/jamiyas/, '/admin/circles');
    return NextResponse.redirect(url, 308);
  }
  return null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // PWA assets must bypass auth session work.
  if (
    pathname === '/sw.js' ||
    pathname === '/manifest.webmanifest' ||
    pathname.startsWith('/icons/')
  ) {
    return NextResponse.next();
  }

  const legacy = legacyCircleRedirect(request);
  if (legacy) return legacy;

  const hasSupabaseEnv =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );

  // Allow builds / misconfigured previews to compile; runtime still needs env.
  if (!hasSupabaseEnv) {
    return NextResponse.next();
  }

  const { user, response } = await updateSession(request);

  if (pathname.startsWith('/auth/callback')) {
    return response;
  }

  if (isProtectedPath(pathname) && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/phone';
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && AUTH_ROUTES.has(pathname) && pathname !== '/reset-password') {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = '/dashboard';
    dashboardUrl.search = '';
    return NextResponse.redirect(dashboardUrl);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
