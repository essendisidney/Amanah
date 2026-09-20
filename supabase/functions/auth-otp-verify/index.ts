import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Phone OTP verify + session minting on Edge (service role available here).
 * Next.js proxies here when Vercel is missing SUPABASE_SERVICE_ROLE_KEY.
 */

function env(name: string): string {
  return (Deno.env.get(name) ?? "").trim();
}

function normalizePhone254(raw: string): string {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (!d) return d;
  if (d.startsWith("2540") && d.length >= 11) d = `254${d.slice(4)}`;
  else if (d.startsWith("0") && d.length >= 10) d = `254${d.slice(1)}`;
  else if (d.length === 9 && (d.startsWith("7") || d.startsWith("1"))) d = `254${d}`;
  else if (!d.startsWith("254")) d = `254${d.replace(/^0+/, "")}`;
  if (d.length > 12) d = d.slice(0, 12);
  return d;
}

function isValidKeMobile(raw: string): boolean {
  return /^254[17]\d{8}$/.test(normalizePhone254(raw));
}

function internalEmail(normalized254: string) {
  return `${normalized254}@amanah.internal`;
}

function errorMessage(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    for (const key of ["error_description", "message", "msg", "error"]) {
      const v = o[key];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  return fallback;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", Connection: "keep-alive" },
  });
}

function isProfileComplete(
  p: { profile_completed?: boolean; full_name?: string | null; phone?: string | null } | null,
): boolean {
  if (!p) return false;
  if (p.profile_completed === true) return true;
  return Boolean(p.full_name?.trim() && p.phone?.trim());
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
    },
  );
  if (!res.ok) return null;
  const body = (await res.json()) as {
    users?: Array<{ id: string; email?: string; phone?: string }>;
    id?: string;
    email?: string;
    phone?: string;
  };
  if (body.id) return { id: body.id, email: body.email, phone: body.phone };
  return body.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
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
    },
  );
  if (!res.ok) return null;
  const body = (await res.json()) as {
    users?: Array<{ id: string; email?: string; phone?: string }>;
    id?: string;
    email?: string;
    phone?: string;
  };
  if (body.id) return { id: body.id, email: body.email, phone: body.phone };
  return body.users?.find((u) => u.phone === phone) ?? null;
}

async function createSessionForEmail(
  admin: ReturnType<typeof createClient>,
  url: string,
  anon: string,
  email: string,
): Promise<{ access_token: string; refresh_token: string; expires_in?: number } | { error: string }> {
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const hashed = linkData?.properties?.hashed_token;
  if (linkError || !hashed) {
    return { error: errorMessage(linkError?.message, "Could not start session") };
  }

  for (const type of ["magiclink", "email"] as const) {
    const verifyRes = await fetch(`${url}/auth/v1/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
    if (type === "email") {
      return {
        error: errorMessage(
          verifyData.error_description ?? verifyData.msg ?? verifyData.message ?? verifyData.error,
          "Could not create session",
        ),
      };
    }
  }
  return { error: "Could not create session" };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = env("SUPABASE_URL");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
  const anon = env("SUPABASE_ANON_KEY") || env("SUPABASE_PUBLISHABLE_KEY");
  if (!url || !serviceKey || !anon) {
    return json({ error: "OTP verify misconfigured on Edge" }, 503);
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let claimedOtpId: string | null = null;
  const releaseOtp = async () => {
    if (!claimedOtpId) return;
    const id = claimedOtpId;
    claimedOtpId = null;
    await admin.from("otp_codes").update({ used: false }).eq("id", id);
  };

  try {
    const body = (await req.json().catch(() => ({}))) as {
      phone?: string;
      otp?: string;
      code?: string;
    };
    const phoneRaw = String(body.phone ?? "").trim();
    const codeRaw = String(body.otp ?? body.code ?? "").trim();

    if (!phoneRaw || !codeRaw) return json({ error: "Phone and code required" }, 400);
    if (!isValidKeMobile(phoneRaw)) return json({ error: "Invalid phone number" }, 400);
    if (!/^\d{6}$/.test(codeRaw)) return json({ error: "Enter the 6-digit code" }, 400);

    const normalized = normalizePhone254(phoneRaw);
    const e164 = `+${normalized}`;
    const email = internalEmail(normalized);
    const now = new Date().toISOString();

    const { data: otpRecord, error: otpLookupError } = await admin
      .from("otp_codes")
      .select("id")
      .eq("phone", normalized)
      .eq("code", codeRaw)
      .eq("purpose", "auth")
      .eq("used", false)
      .gte("expires_at", now)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpLookupError) {
      console.error("[auth-otp-verify] otp lookup", otpLookupError);
      return json({ error: "Could not verify code. Try again." }, 500);
    }
    if (!otpRecord) return json({ error: "Invalid or expired code" }, 400);

    const { data: claimed, error: claimError } = await admin
      .from("otp_codes")
      .update({ used: true })
      .eq("id", otpRecord.id)
      .eq("used", false)
      .select("id")
      .maybeSingle();

    if (claimError) {
      console.error("[auth-otp-verify] otp claim", claimError);
      return json({ error: "Could not verify code. Try again." }, 500);
    }
    if (!claimed) return json({ error: "Code already used. Request a new one." }, 400);
    claimedOtpId = claimed.id;

    let authUserId: string | null = null;
    let loginEmail = email;

    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id, email")
      .eq("phone", e164)
      .maybeSingle();

    if (existingProfile?.id) {
      authUserId = existingProfile.id;
      if (existingProfile.email) loginEmail = existingProfile.email;
    }

    if (!authUserId) {
      const found =
        (await adminFindUserByEmail(url, serviceKey, email)) ??
        (await adminFindUserByPhone(url, serviceKey, e164)) ??
        (await adminFindUserByPhone(url, serviceKey, normalized));
      if (found) {
        authUserId = found.id;
        if (found.email) loginEmail = found.email;
      }
    }

    if (!authUserId) {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { phone: e164, created_via: "taifa_otp" },
      });

      if (createErr || !created.user?.id) {
        const msg = (createErr?.message ?? "").toLowerCase();
        if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
          const found =
            (await adminFindUserByEmail(url, serviceKey, email)) ??
            (await adminFindUserByPhone(url, serviceKey, normalized)) ??
            (await adminFindUserByPhone(url, serviceKey, e164));
          if (!found) {
            await releaseOtp();
            return json({ error: "Could not create account. Contact support." }, 500);
          }
          authUserId = found.id;
          if (found.email) loginEmail = found.email;
        } else {
          console.error("[auth-otp-verify] createUser", createErr);
          await releaseOtp();
          return json(
            {
              error: errorMessage(
                createErr?.message ?? createErr,
                "Account creation failed. Request a new code.",
              ),
            },
            500,
          );
        }
      } else {
        authUserId = created.user.id;
        loginEmail = created.user.email ?? email;
      }
    }

    if (!authUserId) {
      await releaseOtp();
      return json({ error: "Could not resolve account" }, 500);
    }

    const { data: ensuredUser, error: updateErr } = await admin.auth.admin.updateUserById(
      authUserId,
      {
        email: loginEmail.includes("@") ? loginEmail : email,
        email_confirm: true,
        phone: normalized,
        phone_confirm: true,
        user_metadata: { phone: e164, created_via: "taifa_otp" },
      },
    );
    if (updateErr) {
      console.error("[auth-otp-verify] updateUser", updateErr);
    } else if (ensuredUser.user?.email) {
      loginEmail = ensuredUser.user.email;
    } else {
      loginEmail = email;
    }

    const { error: profileErr } = await admin.from("profiles").upsert(
      {
        id: authUserId,
        phone: e164,
        email: loginEmail,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    if (profileErr) console.error("[auth-otp-verify] profile upsert", profileErr);

    const session = await createSessionForEmail(admin, url, anon, loginEmail);
    if ("error" in session) {
      console.error("[auth-otp-verify] session", session.error);
      await releaseOtp();
      return json({ error: session.error }, 500);
    }

    const { data: profileAfter } = await admin
      .from("profiles")
      .select("profile_completed, full_name, phone")
      .eq("id", authUserId)
      .maybeSingle();

    claimedOtpId = null;
    return json({
      success: true,
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
      userId: authUserId,
      profile_completed: isProfileComplete(profileAfter),
    });
  } catch (err) {
    console.error("[auth-otp-verify]", err);
    await releaseOtp();
    const detail = err instanceof Error ? err.message : null;
    return json(
      {
        error: detail && detail.length < 180
          ? detail
          : "Something went wrong. Please try again.",
      },
      500,
    );
  }
});
