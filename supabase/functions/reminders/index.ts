import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Contribution reminders — mark late dues and notify members with upcoming payments.
 * Invoke via cron / schedule with Authorization: Bearer <service_role_or_cron_secret>.
 */
Deno.serve(async (req) => {
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const cronSecret = Deno.env.get("CRON_SECRET");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (cronSecret && auth !== `Bearer ${cronSecret}` && auth !== `Bearer ${serviceKey}`) {
      return new Response(JSON.stringify({ ok: false, error: "UNAUTHORIZED" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: lateResult, error: lateError } = await supabase.rpc(
      "mark_late_contributions",
    );
    if (lateError) {
      throw lateError;
    }

    const today = new Date();
    const inThreeDays = new Date(today);
    inThreeDays.setUTCDate(today.getUTCDate() + 3);
    const dueBefore = inThreeDays.toISOString().slice(0, 10);

    const { data: upcoming, error: upcomingError } = await supabase
      .from("contributions")
      .select(
        "id, due_date, amount, currency, cycle_number, member_id, jamiya_id, members!inner(user_id), jamiyas!inner(name, slug)",
      )
      .in("status", ["pending", "late"])
      .lte("due_date", dueBefore)
      .limit(200);

    if (upcomingError) {
      throw upcomingError;
    }

    let notified = 0;
    for (const row of upcoming ?? []) {
      const member = row.members as { user_id: string } | { user_id: string }[] | null;
      const jamiya = row.jamiyas as
        | { name: string; slug: string }
        | { name: string; slug: string }[]
        | null;
      const userId = Array.isArray(member) ? member[0]?.user_id : member?.user_id;
      const circle = Array.isArray(jamiya) ? jamiya[0] : jamiya;
      if (!userId || !circle) continue;

      const { error: insertError } = await supabase.from("notifications").insert({
        user_id: userId,
        type: "contribution_due",
        channel: "in_app",
        title: "Contribution reminder",
        body: `${circle.name}: cycle ${row.cycle_number} is due ${row.due_date}.`,
        data: {
          contribution_id: row.id,
          jamiya_id: row.jamiya_id,
          slug: circle.slug,
        },
      });

      if (!insertError) notified += 1;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        late: lateResult,
        reminders_sent: notified,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("reminders failed", error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : "UNKNOWN",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
