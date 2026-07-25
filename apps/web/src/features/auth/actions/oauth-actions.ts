'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSafeRedirectPath } from '../lib/types';

function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}

export async function signInWithGoogleAction(formData: FormData): Promise<void> {
  const next = getSafeRedirectPath(String(formData.get('next') ?? '/dashboard'));
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${getSiteUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error || !data.url) {
    redirect(`/login?error=${encodeURIComponent(error?.message ?? 'Google sign-in failed')}`);
  }

  redirect(data.url);
}
