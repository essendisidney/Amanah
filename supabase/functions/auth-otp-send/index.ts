import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Phone OTP send via Taifa — runs on Edge so login works even when
 * Vercel is missing SUPABASE_SERVICE_ROLE_KEY / TAIFA_API_KEY.
 * Public (verify_jwt=false); abuse controls are rate limits + KE phone check.
 */

const RESEND_COOLDOWN_SEC = 60;
const MAX_OTP_PER_HOUR = 5;
const MAX_OTP_PER_DAY = 15;

const PRIORITY = new Set(["254722210711"]);

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

function isPriority(phone254: string): boolean {
  const extra = env("SMS_PRIORITY_PHONES")
    .split(",")
    .map((s) => normalizePhone254(s.trim()))
    .filter(Boolean);
  return PRIORITY.has(phone254) || extra.includes(phone254);
}

/**
 * Taifa Mobile SMS. The old api.taifamobile.co.ke/sms/sendsms endpoint went away in October 2026,
 * so this follows Taifa's client library (github.com/taifaMobile/sms): `{ message, recepients }`
 * is AES-128-CBC encrypted with the API key (first 16 bytes, zero-padded) and the library's fixed
 * IV, hex-encoded, and posted with the key to /clientapi/sms/. Success is status "00".
 * Same code as apps/web/src/lib/sms.ts (tested there against PHP's openssl_encrypt).
 */
const TAIFA_SMS_URL = "https://sms.taifamobile.co.ke/clientapi/sms/";
const TAIFA_IV = "w4^dgd$%^62:)dgs";
const TAIFA_STATUS: Record<string, string> = {
  "01": "message failed",
  "97": "not enough SMS credit",
  "98": "SMS service not found",
  "99": "missing details",
};

async function taifaEncrypt(plaintext: string, apiKey: string): Promise<string> {
  const enc = new TextEncoder();
  const keyBytes = new Uint8Array(16);
  keyBytes.set(enc.encode(apiKey).slice(0, 16));
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-CBC", false, ["encrypt"]);
  const sealed = await crypto.subtle.encrypt(
    { name: "AES-CBC", iv: enc.encode(TAIFA_IV) },
    key,
    enc.encode(plaintext),
  );
  return Array.from(new Uint8Array(sealed), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function postTaifa(mobile: string, message: string, apiKey: string): Promise<void> {
  const serviceName = env("TAIFA_SERVICE_NAME").trim().replace(/^["']|["']$/g, "") || null;
  let res: Response;
  try {
    res = await fetch(TAIFA_SMS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Fail clearly instead of hanging until the platform kills the request.
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({
        message: await taifaEncrypt(JSON.stringify({ message, recepients: mobile }), apiKey),
        key: apiKey,
        service_name: serviceName,
      }),
    });
  } catch (e) {
    const why = e instanceof Error && e.name === "TimeoutError" ? "no answer in 20s" : String(e);
    throw new Error(`Taifa unreachable: ${why}`);
  }

  const text = await res.text();
  let row: { status?: string | number; statusDescription?: string } | undefined;
  try {
    const parsed = JSON.parse(text) as unknown;
    row = (Array.isArray(parsed) ? parsed[0] : parsed) as typeof row;
  } catch {
    throw new Error(`Bad response from Taifa (HTTP ${res.status}): ${text.slice(0, 120)}`);
  }

  const status = String(row?.status ?? "").padStart(2, "0");
  if (status === "00") return;
  throw new Error(
    `Taifa ${status}: ${row?.statusDescription ?? TAIFA_STATUS[status] ?? text.slice(0, 120)}`,
  );
}

async function sendSmsTaifa(mobile: string, message: string): Promise<void> {
  const apiKey = env("TAIFA_API_KEY").replace(/^["']|["']$/g, "");
  if (!apiKey) throw new Error("TAIFA_API_KEY is not configured on Edge");
  await postTaifa(mobile, message, apiKey);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Connection": "keep-alive",
    },
  });
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

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { phone?: string };
    const raw = typeof body.phone === "string" ? body.phone : "";
    if (!raw.trim()) return json({ error: "Phone number required" }, 400);
    if (!isValidKeMobile(raw)) {
      return json(
        { error: "Enter a valid Kenya mobile (e.g. 0712 345 678)." },
        400,
      );
    }

    const normalized = normalizePhone254(raw);
    const priority = isPriority(normalized);

    const supabaseUrl = env("SUPABASE_URL");
    const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      console.error("[auth-otp-send] missing service role env");
      return json({ error: "OTP service misconfigured" }, 503);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (!priority) {
      const { data: recent } = await admin
        .from("otp_codes")
        .select("created_at")
        .eq("phone", normalized)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recent?.created_at) {
        const ageMs = Date.now() - new Date(recent.created_at).getTime();
        const waitSec = Math.ceil((RESEND_COOLDOWN_SEC * 1000 - ageMs) / 1000);
        if (waitSec > 0) {
          return json(
            {
              error: `Wait ${waitSec}s before requesting another code.`,
              retry_after: waitSec,
            },
            429,
          );
        }
      }

      const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const [{ count: hourCount }, { count: dayCount }] = await Promise.all([
        admin
          .from("otp_codes")
          .select("id", { count: "exact", head: true })
          .eq("phone", normalized)
          .gte("created_at", hourAgo),
        admin
          .from("otp_codes")
          .select("id", { count: "exact", head: true })
          .eq("phone", normalized)
          .gte("created_at", dayAgo),
      ]);

      if ((hourCount ?? 0) >= MAX_OTP_PER_HOUR) {
        return json(
          {
            error: "Too many codes requested this hour. Try again later.",
            retry_after: 3600,
          },
          429,
        );
      }
      if ((dayCount ?? 0) >= MAX_OTP_PER_DAY) {
        return json(
          {
            error: "Daily OTP limit reached for this number. Try again tomorrow.",
            retry_after: 86400,
          },
          429,
        );
      }
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const { error: insertError } = await admin.from("otp_codes").insert({
      phone: normalized,
      code,
      purpose: "auth",
      expires_at: expiresAt,
      used: false,
    });

    if (insertError) {
      console.error("[auth-otp-send] otp insert", insertError);
      return json({ error: "Could not send code" }, 500);
    }

    if (env("SMS_BYPASS") === "true") {
      console.log("[SMS BYPASS] OTP for", normalized, "is:", code);
      return json({
        success: true,
        retry_after: priority ? 0 : RESEND_COOLDOWN_SEC,
        hint: "SMS bypassed — check Edge logs for code",
      });
    }

    await sendSmsTaifa(
      normalized,
      `Your Jameiyah code is ${code}. Valid 15 min. Do not share.`,
    );

    return json({
      success: true,
      retry_after: priority ? 0 : RESEND_COOLDOWN_SEC,
    });
  } catch (e) {
    console.error("[auth-otp-send]", e);
    const msg = e instanceof Error ? e.message : "Failed to send code";
    // Do not leak Taifa credentials; surface provider status for ops.
    if (msg.includes("TAIFA_API_KEY")) {
      return json({ error: "SMS service is not configured. Contact support." }, 503);
    }
    if (msg.startsWith("Taifa ")) {
      return json({ error: "SMS provider rejected the message. Try again shortly." }, 502);
    }
    return json({ error: "Failed to send code" }, 500);
  }
});
