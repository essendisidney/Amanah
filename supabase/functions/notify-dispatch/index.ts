import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Dispatches pending notification_outbox rows via Resend (email) /
 * Taifa (default SMS) with Africa's Talking / Twilio fallbacks /
 * Twilio WhatsApp / Expo (push).
 * Without provider credentials, marks rows sent after a skip log (dev).
 */

function env(name: string): string {
  return Deno.env.get(name) ?? "";
}

function normalizeMsisdn(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("254") && digits.length >= 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 10) return `+254${digits.slice(1)}`;
  if (digits.length === 9) return `+254${digits}`;
  if (raw.startsWith("+")) return raw;
  return raw.startsWith("+") ? raw : `+${digits}`;
}

/** Taifa Mobile expects 2547XXXXXXXX (no +). Same as apps/web phone OTP. */
function normalizePhone254(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("254") && digits.length >= 12) return digits.slice(0, 12);
  if (digits.startsWith("0") && digits.length === 10) return `254${digits.slice(1)}`;
  if (digits.length === 9 && (digits.startsWith("7") || digits.startsWith("1"))) {
    return `254${digits}`;
  }
  return digits;
}

async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  const apiKey = env("RESEND_API_KEY");
  const from = env("EMAIL_FROM") || "Amanah <noreply@amanah.app>";
  if (!apiKey) {
    console.info("email skipped (no RESEND_API_KEY)", { to, subject });
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject: subject || "Amanah", text: body }),
  });
  if (!res.ok) {
    throw new Error(`Resend ${res.status}: ${await res.text()}`);
  }
}

async function sendSmsTaifa(to: string, body: string): Promise<boolean> {
  const apiKey = env("TAIFA_API_KEY").trim().replace(/^["']|["']$/g, "");
  const senderName = (env("TAIFA_SENDER_ID") || "SIDNET").trim().replace(/^["']|["']$/g, "");
  if (!apiKey) return false;

  const mobile = normalizePhone254(to);
  if (!/^254[17]\d{8}$/.test(mobile)) {
    throw new Error(`Invalid Kenya mobile for Taifa: ${to}`);
  }

  const res = await fetch("https://api.taifamobile.co.ke/sms/sendsms", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mobile,
      response_type: "json",
      sender_name: senderName,
      service_id: 0,
      message: body,
    }),
  });

  const text = await res.text();
  let row: unknown;
  try {
    const parsed = JSON.parse(text) as unknown;
    row = Array.isArray(parsed) ? parsed[0] : parsed;
  } catch {
    throw new Error(`Bad response from Taifa: ${text.slice(0, 200)}`);
  }

  const r = row as { status_code?: string | number; status_desc?: string };
  if (String(r?.status_code ?? "") === "1000") return true;
  throw new Error(
    `Taifa ${r?.status_code ?? "?"}: ${r?.status_desc ?? text.slice(0, 200)}`,
  );
}

async function sendSmsAfricaTalking(to: string, body: string): Promise<boolean> {
  const username = env("AT_USERNAME");
  const apiKey = env("AT_API_KEY");
  const from = env("AT_SMS_SHORTCODE") || env("AT_SENDER_ID") || "";
  if (!username || !apiKey) return false;

  const params = new URLSearchParams({
    username,
    to: normalizeMsisdn(to),
    message: body,
  });
  if (from) params.set("from", from);

  const res = await fetch("https://api.africastalking.com/version1/messaging", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      apiKey,
    },
    body: params,
  });
  if (!res.ok) {
    throw new Error(`AfricaTalking SMS ${res.status}: ${await res.text()}`);
  }
  return true;
}

async function sendSmsTwilio(to: string, body: string): Promise<boolean> {
  const sid = env("TWILIO_ACCOUNT_SID");
  const token = env("TWILIO_AUTH_TOKEN");
  const from = env("TWILIO_FROM_NUMBER");
  if (!sid || !token || !from) return false;

  const auth = btoa(`${sid}:${token}`);
  const params = new URLSearchParams({ To: to, From: from, Body: body });
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    },
  );
  if (!res.ok) {
    throw new Error(`Twilio ${res.status}: ${await res.text()}`);
  }
  return true;
}

async function sendSms(to: string, body: string): Promise<void> {
  // Default Taifa (same as phone OTP). Override with SMS_PROVIDER.
  const prefer = (env("SMS_PROVIDER") || "taifa").toLowerCase();
  const requireReal = env("REQUIRE_REAL_PROVIDERS") === "true";

  if (prefer === "taifa") {
    const ok = await sendSmsTaifa(to, body);
    if (!ok) {
      if (requireReal) throw new Error("TAIFA_SMS_NOT_CONFIGURED");
      console.info("sms skipped (Taifa not configured)", { to });
    }
    return;
  }

  if (prefer === "africastalking" || prefer === "at") {
    const ok = await sendSmsAfricaTalking(to, body);
    if (!ok) {
      if (requireReal) throw new Error("AT_SMS_NOT_CONFIGURED");
      console.info("sms skipped (Africa's Talking not configured)", { to });
    }
    return;
  }

  if (prefer === "twilio") {
    const ok = await sendSmsTwilio(to, body);
    if (!ok) {
      if (requireReal) throw new Error("TWILIO_NOT_CONFIGURED");
      console.info("sms skipped (Twilio not configured)", { to });
    }
    return;
  }

  // auto: Taifa → Africa's Talking → Twilio
  if (await sendSmsTaifa(to, body)) return;
  if (await sendSmsAfricaTalking(to, body)) return;
  if (await sendSmsTwilio(to, body)) return;
  if (requireReal) throw new Error("SMS_NOT_CONFIGURED");
  console.info("sms skipped (no Taifa / AT / Twilio credentials)", { to });
}

/** Twilio WhatsApp (sandbox or live). From must be whatsapp:+… */
async function sendWhatsApp(to: string, body: string): Promise<void> {
  const sid = env("TWILIO_ACCOUNT_SID");
  const token = env("TWILIO_AUTH_TOKEN");
  const fromRaw = env("TWILIO_WHATSAPP_FROM") || env("TWILIO_FROM_NUMBER");
  const requireReal = env("REQUIRE_REAL_PROVIDERS") === "true";

  if (!sid || !token || !fromRaw) {
    if (requireReal) throw new Error("WHATSAPP_NOT_CONFIGURED");
    console.info("whatsapp skipped (Twilio WhatsApp not configured)", { to });
    return;
  }

  const from = fromRaw.startsWith("whatsapp:") ? fromRaw : `whatsapp:${normalizeMsisdn(fromRaw)}`;
  const dest = to.startsWith("whatsapp:") ? to : `whatsapp:${normalizeMsisdn(to)}`;
  const auth = btoa(`${sid}:${token}`);
  const params = new URLSearchParams({ To: dest, From: from, Body: body });
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    },
  );
  if (!res.ok) {
    throw new Error(`Twilio WhatsApp ${res.status}: ${await res.text()}`);
  }
}

async function sendExpoPush(
  to: string,
  title: string | null,
  body: string,
  data: Record<string, unknown> | null,
): Promise<void> {
  if (!to.startsWith("ExponentPushToken") && !to.startsWith("ExpoPushToken")) {
    console.info("push skipped (not an Expo token)", { to: to.slice(0, 24) });
    return;
  }

  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to,
      title: title || "Amanah",
      body,
      data: data ?? {},
      sound: "default",
    }),
  });
  if (!res.ok) {
    throw new Error(`Expo push ${res.status}: ${await res.text()}`);
  }
  const json = await res.json() as { data?: { status?: string; message?: string } };
  if (json?.data?.status === "error") {
    throw new Error(json.data.message ?? "Expo push error");
  }
}

Deno.serve(async (req) => {
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
    const cronSecret = env("CRON_SECRET");

    if (
      auth !== `Bearer ${serviceKey}` &&
      !(cronSecret && auth === `Bearer ${cronSecret}`)
    ) {
      return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const supabase = createClient(env("SUPABASE_URL"), serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: rows, error } = await supabase.rpc("claim_notification_outbox", {
      p_limit: 50,
    });
    if (error) throw error;

    let sent = 0;
    let failed = 0;

    for (const row of rows ?? []) {
      try {
        if (row.channel === "email") {
          await sendEmail(row.recipient, row.subject ?? "Amanah", row.body);
        } else if (row.channel === "sms") {
          await sendSms(row.recipient, row.body);
        } else if (row.channel === "whatsapp") {
          await sendWhatsApp(row.recipient, row.body);
        } else if (row.channel === "push") {
          await sendExpoPush(
            row.recipient,
            row.subject,
            row.body,
            (row.metadata as Record<string, unknown> | null) ?? null,
          );
        } else {
          console.info("unknown channel skipped", { channel: row.channel, id: row.id });
        }
        await supabase.rpc("mark_outbox_sent", { p_id: row.id });
        sent += 1;
      } catch (err) {
        await supabase.rpc("mark_outbox_failed", {
          p_id: row.id,
          p_error: err instanceof Error ? err.message : String(err),
        });
        failed += 1;
      }
    }

    return Response.json({ ok: true, claimed: rows?.length ?? 0, sent, failed });
  } catch (error) {
    console.error("notify-dispatch failed", error);
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "UNKNOWN" },
      { status: 500 },
    );
  }
});
