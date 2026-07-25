import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Dispatches pending notification_outbox rows via Resend (email) / Twilio (SMS).
 * Without provider credentials, marks rows as sent with metadata.skipped=true (dev).
 */

function env(name: string): string {
  return Deno.env.get(name) ?? "";
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

async function sendSms(to: string, body: string): Promise<void> {
  const sid = env("TWILIO_ACCOUNT_SID");
  const token = env("TWILIO_AUTH_TOKEN");
  const from = env("TWILIO_FROM_NUMBER");
  if (!sid || !token || !from) {
    console.info("sms skipped (Twilio not configured)", { to });
    return;
  }

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
