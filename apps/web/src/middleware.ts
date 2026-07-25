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
  '/jamiyas',
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

export async function middleware(request: NextRequest) {
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
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/auth/callback')) {
    return response;
  }

  if (isProtectedPath(pathname) && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
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
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
