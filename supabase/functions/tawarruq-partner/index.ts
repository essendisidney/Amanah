/**
 * Simulated Tawarruq partner worker.
 * Marks queued partner_status applications as "partner_ack" after handoff.
 * Invoke with service role or CRON_SECRET. Live bank API replaces this later.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

function env(name: string): string {
  return Deno.env.get(name) ?? "";
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

    const { data: rows, error } = await supabase
      .from("tawarruq_applications")
      .select("id, partner_status, status")
      .eq("status", "submitted_to_partner")
      .eq("partner_status", "queued")
      .limit(25);

    if (error) throw error;

    let updated = 0;
    for (const row of rows ?? []) {
      const { error: upErr } = await supabase
        .from("tawarruq_applications")
        .update({
          partner_status: "partner_ack",
          metadata: {
            worker: "tawarruq-partner",
            ack_at: new Date().toISOString(),
            simulated: true,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (!upErr) updated += 1;
    }

    return Response.json({
      ok: true,
      claimed: rows?.length ?? 0,
      updated,
      note: "Simulated partner ack. Replace with live bank API when ready.",
    });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "UNKNOWN" },
      { status: 500 },
    );
  }
});
