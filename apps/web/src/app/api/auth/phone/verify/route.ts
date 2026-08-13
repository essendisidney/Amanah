import { NextResponse, type NextRequest } from 'next/server';
import { isValidKeMobile, normalizePhone254 } from '@jamiya/shared';
import { createClient as createCookieClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';

function internalEmail(normalized254: string) {
  return `${normalized254}@amanah.internal`;
}

function errorMessage(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    for (const key of ['error_description', 'message', 'msg', 'error']) {
      const v = o[key];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
  }
  return fallback;
}

async function adminFindUserByEmail(
  url: string,
  serviceKey: string,
  email: string,
): Promise<{ id: string; email?: string; phone?: string } | null> {
  const res = await fetch(
    `${url}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      cache: 'no-store',
    },
  );
  if (!res.ok) return null;
  const json = (await res.json()) as {
    users?: Array<{ id: string; email?: string; phone?: string }>;
    id?: string;
    email?: string;
    phone?: string;
  };
  if (json.id) return { id: json.id, email: json.email, phone: json.phone };
  const match = json.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  return match ?? null;
}

async function adminFindUserByPhone(
  url: string,
  serviceKey: string,
  phone: string,
): Promise<{ id: string; email?: string; phone?: string } | null> {
  const res = await fetch(
    `${url}/auth/v1/admin/users?phone=${encodeURIComponent(phone)}`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      cache: 'no-store',
    },
  );
  if (!res.ok) return null;
  const json = (await res.json()) as {
    users?: Array<{ id: string; email?: string; phone?: string }>;
    id?: string;
    email?: string;
    phone?: string;
  };
  if (json.id) return { id: json.id, email: json.email, phone: json.phone };
  const match = json.users?.find((u) => u.phone === phone);
  return match ?? null;
}

async function createSessionForEmail(
  admin: ReturnType<typeof createServiceRoleClient>,
  url: string,
  anon: string,
  email: string,
): Promise<{ access_token: string; refresh_token: string; expires_in?: number } | { error: string }> {
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });

  const hashed = linkData?.properties?.hashed_token;
  if (linkError || !hashed) {
    return { error: errorMessage(linkError?.message, 'Could not start session') };
  }

  for (const type of ['magiclink', 'email'] as const) {
    const verifyRes = await fetch(`${url}/auth/v1/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anon,
        Authorization: `Bearer ${anon}`,
      },
      body: JSON.stringify({ type, token_hash: hashed }),
    });
    const verifyData = (await verifyRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error_description?: string;
      msg?: string;
      error?: unknown;
      message?: string;
    };
    if (verifyData.access_token && verifyData.refresh_token) {
      return {
        access_token: verifyData.access_token,
        refresh_token: verifyData.refresh_token,
        expires_in: verifyData.expires_in,
      };
    }
    if (type === 'email') {
      return {
        error: errorMessage(
          verifyData.error_description ?? verifyData.msg ?? verifyData.message ?? verifyData.error,
          'Could not create session',
        ),
      };
    }
  }

  return { error: 'Could not create session' };
}

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  // Prefer legacy JWT anon for Auth /verify; publishable keys are fine as fallback.
  const anon =
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !serviceKey) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  let claimedOtpId: string | null = null;
  const admin = createServiceRoleClient();

  const releaseOtp = async () => {
    if (!claimedOtpId) return;
    const id = claimedOtpId;
    claimedOtpId = null;
    const { error } = await admin.from('otp_codes').update({ used: false }).eq('id', id);
    if (error) {
      console.error('[auth/phone/verify] otp release', error);
    }
  };

  try {
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

    // Auth stores Kenya MSISDN without '+'; profiles use E.164 with '+'.
    const normalized = normalizePhone254(phoneRaw);
    const e164 = `+${normalized}`;
    const email = internalEmail(normalized);
    const now = new Date().toISOString();

    const { data: otpRecord, error: otpLookupError } = await admin
      .from('otp_codes')
      .select('id')
      .eq('phone', normalized)
      .eq('code', codeRaw)
      .eq('used', false)
      .gte('expires_at', now)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpLookupError) {
      console.error('[auth/phone/verify] otp lookup', otpLookupError);
      return NextResponse.json({ error: 'Could not verify code. Try again.' }, { status: 500 });
    }

    if (!otpRecord) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });
    }

    const { data: claimed, error: claimError } = await admin
      .from('otp_codes')
      .update({ used: true })
      .eq('id', otpRecord.id)
      .eq('used', false)
      .select('id')
      .maybeSingle();

    if (claimError) {
      console.error('[auth/phone/verify] otp claim', claimError);
      return NextResponse.json({ error: 'Could not verify code. Try again.' }, { status: 500 });
    }

    if (!claimed) {
      return NextResponse.json(
        { error: 'Code already used. Request a new one.' },
        { status: 400 },
      );
    }
    claimedOtpId = claimed.id;

    let authUserId: string | null = null;
    let loginEmail = email;

    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id, email')
      .eq('phone', e164)
      .maybeSingle();

    if (existingProfile?.id) {
      authUserId = existingProfile.id;
      if (existingProfile.email) loginEmail = existingProfile.email;
    }

    if (!authUserId) {
      const byEmail = await adminFindUserByEmail(url, serviceKey, email);
      const byPhonePlus = await adminFindUserByPhone(url, serviceKey, e164);
      const byPhonePlain = await adminFindUserByPhone(url, serviceKey, normalized);
      const found = byEmail ?? byPhonePlus ?? byPhonePlain;
      if (found) {
        authUserId = found.id;
        if (found.email) loginEmail = found.email;
      }
    }

    if (!authUserId) {
      // Do not set auth.users.phone here: GoTrue may store MSISDN without '+',
      // and the profile trigger historically copied that into profiles.phone
      // (E.164 required). Metadata carries +254… for the trigger / profile.
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { phone: e164, created_via: 'taifa_otp' },
      });

      if (createErr || !created.user?.id) {
        const msg = (createErr?.message ?? '').toLowerCase();
        if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
          const byEmail = await adminFindUserByEmail(url, serviceKey, email);
          const byPhonePlain = await adminFindUserByPhone(url, serviceKey, normalized);
          const byPhonePlus = await adminFindUserByPhone(url, serviceKey, e164);
          const found = byEmail ?? byPhonePlain ?? byPhonePlus;
          if (!found) {
            await releaseOtp();
            return NextResponse.json(
              { error: 'Could not create account. Contact support.' },
              { status: 500 },
            );
          }
          authUserId = found.id;
          if (found.email) loginEmail = found.email;
        } else {
          console.error('[auth/phone/verify] createUser', createErr);
          await releaseOtp();
          return NextResponse.json(
            {
              error: errorMessage(
                createErr?.message ?? createErr,
                'Account creation failed. Request a new code.',
              ),
            },
            { status: 500 },
          );
        }
      } else {
        authUserId = created.user.id;
        loginEmail = created.user.email ?? email;
      }
    }

    if (!authUserId) {
      await releaseOtp();
      return NextResponse.json({ error: 'Could not resolve account' }, { status: 500 });
    }

    const { data: ensuredUser, error: updateErr } = await admin.auth.admin.updateUserById(
      authUserId,
      {
        email: loginEmail.includes('@') ? loginEmail : email,
        email_confirm: true,
        // Auth stores without '+'; profiles keep E.164 via upsert below.
        phone: normalized,
        phone_confirm: true,
        user_metadata: { phone: e164, created_via: 'taifa_otp' },
      },
    );

    if (updateErr) {
      console.error('[auth/phone/verify] updateUser', updateErr);
    } else if (ensuredUser.user?.email) {
      loginEmail = ensuredUser.user.email;
    } else {
      loginEmail = email;
    }

    const { error: profileErr } = await admin.from('profiles').upsert(
      {
        id: authUserId,
        phone: e164,
        email: loginEmail,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );
    if (profileErr) {
      console.error('[auth/phone/verify] profile upsert', profileErr);
    }

    const session = await createSessionForEmail(admin, url, anon, loginEmail);
    if ('error' in session) {
      console.error('[auth/phone/verify] session', session.error);
      await releaseOtp();
      return NextResponse.json({ error: session.error }, { status: 500 });
    }

    // Persist auth cookies on the response so the browser does not rely on
    // client-only setSession (which can throw in some WebViews / PWA shells).
    let cookiesSet = false;
    try {
      const cookieClient = await createCookieClient();
      const { error: cookieErr } = await cookieClient.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      if (cookieErr) {
        console.error('[auth/phone/verify] cookie session', cookieErr);
      } else {
        cookiesSet = true;
      }
    } catch (cookieSetErr) {
      console.error('[auth/phone/verify] cookie session threw', cookieSetErr);
    }

    claimedOtpId = null;
    return NextResponse.json({
      success: true,
      cookies_set: cookiesSet,
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
      userId: authUserId,
    });
  } catch (err) {
    console.error('[auth/phone/verify]', err);
    await releaseOtp();
    const detail = err instanceof Error ? err.message : null;
    return NextResponse.json(
      {
        error: detail && detail.length < 180
          ? detail
          : 'Something went wrong. Please try again.',
      },
      { status: 500 },
    );
  }
}
