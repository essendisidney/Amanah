import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Collections cron — sync late contributions into collection_cases,
 * recompute risk, and queue SMS/email for severe+ cases.
 */
Deno.serve(async (req) => {
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const cronSecret = Deno.env.get("CRON_SECRET");

    if (
      auth !== `Bearer ${serviceKey}` &&
      !(cronSecret && auth === `Bearer ${cronSecret}`)
    ) {
      return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceKey,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: syncResult, error: syncError } = await supabase.rpc(
      "sync_collection_cases",
    );
    if (syncError) throw syncError;

    await supabase.rpc("recompute_all_member_risk");

    const { data: severe } = await supabase
      .from("collection_cases")
      .select("id, user_id, amount_due, currency, days_overdue, severity, jamiya_id")
      .in("status", ["open", "contacted"])
      .in("severity", ["severe", "critical"])
      .limit(100);

    let queued = 0;
    for (const row of severe ?? []) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, phone, full_name")
        .eq("id", row.user_id)
        .maybeSingle();

      const body =
        `Amanah collections: you have an overdue contribution ` +
        `(${row.days_overdue} days, ${row.amount_due} ${row.currency}). ` +
        `Please top up and pay from the app.`;

      if (profile?.email) {
        await supabase.from("notification_outbox").insert({
          user_id: row.user_id,
          channel: "email",
          recipient: profile.email,
          subject: "Overdue Amanah contribution",
          body,
          metadata: { collection_case_id: row.id, kind: "collections" },
        });
        queued += 1;
      } else if (profile?.phone) {
        await supabase.from("notification_outbox").insert({
          user_id: row.user_id,
          channel: "sms",
          recipient: profile.phone,
          body,
          metadata: { collection_case_id: row.id, kind: "collections" },
        });
        queued += 1;
      }
    }

    // Outbox inserts from service role bypass RLS by default with service key.
    return Response.json({
      ok: true,
      sync: syncResult,
      outreach_queued: queued,
    });
  } catch (error) {
    console.error("collections failed", error);
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "UNKNOWN" },
      { status: 500 },
    );
  }
});
