import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  buildPostAuthPath,
  getSafeRedirectPath,
  isProfileComplete,
} from '@/features/auth/lib/types';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = getSafeRedirectPath(searchParams.get('next'));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Password-reset must reach the form even if the profile is incomplete.
      if (next === '/reset-password' || next.startsWith('/reset-password?')) {
        return NextResponse.redirect(`${origin}${next}`);
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      let complete = false;
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('profile_completed, full_name')
          .eq('id', user.id)
          .maybeSingle();
        complete = isProfileComplete(
          profile as { profile_completed?: boolean; full_name?: string | null } | null,
        );
      }

      return NextResponse.redirect(`${origin}${buildPostAuthPath(next, complete)}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent('Authentication failed')}`,
  );
}
