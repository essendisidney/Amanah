import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@jamiya/database/middleware';

const AUTH_ROUTES = new Set([
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/phone',
  '/welcome',
]);

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/profile',
  '/settings',
  '/circles',
  '/jamiyas', // legacy → redirected below, still auth-gated
  '/wallet',
  '/pay',
  '/admin',
  '/invitations',
  '/finance',
  '/notifications',
  '/services',
];

/** Last time this browser used the app while signed in (epoch ms). */
const SEEN_COOKIE = 'jm_seen';
const IDLE_LIMIT_MS = 7 * 24 * 60 * 60 * 1000;
/** Only rewrite the cookie this often, not on every request. */
const SEEN_REFRESH_MS = 60 * 60 * 1000;
const SEEN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 400 * 24 * 60 * 60,
};

/** Drop the session cookies and send the member to sign in again. */
function idleSignOut(request: NextRequest, pathname: string): NextResponse {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.search = '';
  loginUrl.searchParams.set('reason', 'idle');
  if (pathname !== '/' && !AUTH_ROUTES.has(pathname)) {
    loginUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
  }
  const redirect = NextResponse.redirect(loginUrl);
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith('sb-')) redirect.cookies.delete(cookie.name);
  }
  redirect.cookies.delete(SEEN_COOKIE);
  return redirect;
}

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function hasSupabaseAuthCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith('sb-') && cookie.name.includes('auth-token'));
}

function safeNextPath(raw: string | null): string | null {
  if (
    !raw ||
    !raw.startsWith('/') ||
    raw.startsWith('//') ||
    raw.includes('\\') ||
    raw.includes('://')
  ) {
    return null;
  }
  return raw;
}

/**
 * Refresh when we may have (or need) an auth session.
 * Global practice: installed app + marketing home always resolve “am I signed in?”
 * so returning users land in the product, not a fake Sign-in wall.
 */
function needsSessionRefresh(request: NextRequest, pathname: string): boolean {
  return (
    pathname === '/' ||
    isProtectedPath(pathname) ||
    AUTH_ROUTES.has(pathname) ||
    pathname.startsWith('/auth/') ||
    hasSupabaseAuthCookie(request)
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

  if (!needsSessionRefresh(request, pathname)) {
    return NextResponse.next();
  }

  const { user, response } = await updateSession(request);

  if (pathname.startsWith('/auth/callback')) {
    // Fresh sign-in (Google / magic link): start the idle clock now.
    response.cookies.set(SEEN_COOKIE, String(Date.now()), SEEN_COOKIE_OPTIONS);
    return response;
  }

  // Idle sign-out: 7 days without opening the app means signing in again.
  const seenRaw = request.cookies.get(SEEN_COOKIE)?.value;
  const seen = seenRaw ? Number(seenRaw) : NaN;
  if (user) {
    const now = Date.now();
    if (Number.isFinite(seen) && now - seen > IDLE_LIMIT_MS) {
      return idleSignOut(request, pathname);
    }
    // Missing (first visit after this shipped, or just signed in) → start the clock.
    if (!Number.isFinite(seen) || now - seen > SEEN_REFRESH_MS) {
      response.cookies.set(SEEN_COOKIE, String(now), SEEN_COOKIE_OPTIONS);
    }
  } else if (seenRaw) {
    // Signed out: clear the clock so the next sign-in starts fresh.
    response.cookies.delete(SEEN_COOKIE);
  }

  // Signed-in users never sit on marketing home (PWA reopen / bookmark / /).
  if (user && pathname === '/') {
    const dest = new URL('/dashboard', request.url);
    const redirect = NextResponse.redirect(dest);
    response.cookies.getAll().forEach((cookie) => {
      redirect.cookies.set(cookie);
    });
    return redirect;
  }

  if (isProtectedPath(pathname) && !user) {
    const loginUrl = request.nextUrl.clone();
    // Hub for phone OTP, email/password, and Google — not phone-only.
    loginUrl.pathname = '/login';
    // Keep full path (e.g. /invitations/CODE) so invite deep links survive auth.
    loginUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
    const redirect = NextResponse.redirect(loginUrl);
    response.cookies.getAll().forEach((cookie) => {
      redirect.cookies.set(cookie);
    });
    return redirect;
  }

  if (user && AUTH_ROUTES.has(pathname) && pathname !== '/reset-password') {
    // Never drop ?next= — invitees often land on /phone with cookies already set
    // (OTP race) and must continue to /invitations/… instead of dashboard.
    const dest = safeNextPath(request.nextUrl.searchParams.get('next')) ?? '/dashboard';
    const redirect = NextResponse.redirect(new URL(dest, request.url));
    response.cookies.getAll().forEach((cookie) => {
      redirect.cookies.set(cookie);
    });
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
