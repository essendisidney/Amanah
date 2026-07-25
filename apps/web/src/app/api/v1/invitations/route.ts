import { NextResponse } from 'next/server';
import { createApiClient } from '@/lib/supabase/api';

/** Pending invitations for the signed-in user (email/phone match or invitee_user_id). */
export async function GET(request: Request) {
  const supabase = await createApiClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: 'UNAUTHENTICATED' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('email, phone')
    .eq('id', user.id)
    .maybeSingle();

  const { data, error } = await supabase
    .from('invitations')
    .select(
      'id, email, phone, status, expires_at, created_at, jamiya_id, jamiya:jamiyas(id, name, slug)',
    )
    .eq('status', 'pending')
    .or(
      [
        `invitee_user_id.eq.${user.id}`,
        profile?.email ? `email.eq.${profile.email}` : null,
        profile?.phone ? `phone.eq.${profile.phone}` : null,
      ]
        .filter(Boolean)
        .join(','),
    )
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, invitations: data ?? [] });
}
