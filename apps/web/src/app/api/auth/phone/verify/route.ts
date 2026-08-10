import { NextResponse, type NextRequest } from 'next/server';
import { isValidKeMobile, normalizePhone254 } from '@jamiya/shared';
import { createServiceRoleClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';

function oneTimePassword() {
  const a = crypto.randomUUID().replace(/-/g, '');
  const b = crypto.randomUUID().replace(/-/g, '');
  return `amanah_${a}${b}`;
}

function internalEmail(normalized254: string) {
  return `${normalized254}@amanah.internal`;
}

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anon) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  try {
    const admin = createServiceRoleClient();
    const body = (await req.json()) as { phone?: string; otp?: string; code?: string };
    const phoneRaw = String(body.phone ?? '').trim();
    const codeRaw = String(body.otp ?? body.code ?? '').trim();

    if (!phoneRaw || !codeRaw) {
      return NextResponse.json({ error: 'Phone and code required' }, { status: 400 });
    }
    if (!isValidKeMobile(phoneRaw)) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
    }
    if (!/^\d{6}$/.test(codeRaw)) {
      return NextResponse.json({ error: 'Enter the 6-digit code' }, { status: 400 });
    }

    const normalized = normalizePhone254(phoneRaw);
    const e164 = `+${normalized}`;
    const now = new Date().toISOString();

    const { data: otpRecord } = await admin
      .from('otp_codes')
      .select('id')
      .eq('phone', normalized)
      .eq('code', codeRaw)
      .eq('used', false)
      .gte('expires_at', now)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!otpRecord) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });
    }

    await admin.from('otp_codes').update({ used: true }).eq('id', otpRecord.id);

    const email = internalEmail(normalized);
    const password = oneTimePassword();

    let authUserId: string | null = null;

    // Amanah profiles store E.164 (+254…)
    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id')
      .eq('phone', e164)
      .maybeSingle();

    if (existingProfile?.id) {
      authUserId = existingProfile.id;
    }

    if (!authUserId) {
      const { data: listed } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const found = listed.users?.find(
        (u) => u.email === email || u.phone === e164 || u.phone === normalized,
      );
      if (found) authUserId = found.id;
    }

    if (!authUserId) {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        phone: e164,
        phone_confirm: true,
        user_metadata: { phone: e164, created_via: 'taifa_otp' },
      });

      if (createErr || !created.user?.id) {
        if (createErr?.message?.toLowerCase().includes('already')) {
          const { data: listed } = await admin.auth.admin.listUsers({ perPage: 1000 });
          const found = listed.users?.find((u) => u.email === email || u.phone === e164);
          if (!found) {
            return NextResponse.json(
              { error: 'Could not create account. Contact support.' },
              { status: 500 },
            );
          }
          authUserId = found.id;
        } else {
          return NextResponse.json(
            { error: createErr?.message ?? 'Account creation failed' },
            { status: 500 },
          );
        }
      } else {
        authUserId = created.user.id;
      }
    }

    if (!authUserId) {
      return NextResponse.json({ error: 'Could not resolve account' }, { status: 500 });
    }

    await admin.auth.admin.updateUserById(authUserId, {
      password,
      email,
      email_confirm: true,
      phone: e164,
      phone_confirm: true,
    });

    await admin.from('profiles').upsert(
      {
        id: authUserId,
        phone: e164,
        email,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );

    const signInRes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anon,
        Authorization: `Bearer ${anon}`,
      },
      body: JSON.stringify({ email, password }),
    });

    const signInData = (await signInRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error_description?: string;
      msg?: string;
      error?: string;
    };

    if (!signInData.access_token || !signInData.refresh_token) {
      return NextResponse.json(
        {
          error:
            signInData.error_description ??
            signInData.msg ??
            signInData.error ??
            'Could not create session',
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      access_token: signInData.access_token,
      refresh_token: signInData.refresh_token,
      expires_in: signInData.expires_in,
      userId: authUserId,
    });
  } catch (err) {
    console.error('[auth/phone/verify]', err);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 },
    );
  }
}
