import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Contribution + payout reminders.
 * Marks late dues, then enqueues in-app + email/sms/push with daily dedupe.
 * Invoke via cron with Authorization: Bearer <service_role_or_cron_secret>.
 */
Deno.serve(async (req) => {
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const cronSecret = Deno.env.get("CRON_SECRET");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (
      cronSecret &&
      auth !== `Bearer ${cronSecret}` &&
      auth !== `Bearer ${serviceKey}`
    ) {
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
    if (lateError) throw lateError;

    const today = new Date();
    const dayKey = today.toISOString().slice(0, 10);
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
    if (upcomingError) throw upcomingError;

    let contributionReminders = 0;
    let contributionSkipped = 0;

    for (const row of upcoming ?? []) {
      const member = row.members as { user_id: string } | { user_id: string }[] | null;
      const jamiya = row.jamiyas as
        | { name: string; slug: string }
        | { name: string; slug: string }[]
        | null;
      const userId = Array.isArray(member) ? member[0]?.user_id : member?.user_id;
      const circle = Array.isArray(jamiya) ? jamiya[0] : jamiya;
      if (!userId || !circle) continue;

      const title = "Contribution reminder";
      const body =
        `${circle.name}: cycle ${row.cycle_number} is due ${row.due_date}.`;
      const dedupe = `contrib:${row.id}:${dayKey}`;

      const { data, error } = await supabase.rpc("enqueue_user_reminder", {
        p_user_id: userId,
        p_type: "contribution_due",
        p_title: title,
        p_body: body,
        p_dedupe_key: dedupe,
        p_data: {
          contribution_id: row.id,
          jamiya_id: row.jamiya_id,
          slug: circle.slug,
        },
      });
      if (error) continue;
      const result = data as { skipped?: boolean; ok?: boolean } | null;
      if (result?.skipped) contributionSkipped += 1;
      else if (result?.ok) contributionReminders += 1;
    }

    const payoutBefore = inThreeDays.toISOString().slice(0, 10);
    const { data: payouts, error: payoutError } = await supabase
      .from("payouts")
      .select(
        "id, scheduled_date, amount, currency, cycle_number, member_id, jamiya_id, members!inner(user_id), jamiyas!inner(name, slug)",
      )
      .in("status", ["scheduled", "processing"])
      .lte("scheduled_date", payoutBefore)
      .limit(200);
    if (payoutError) throw payoutError;

    let payoutReminders = 0;
    let payoutSkipped = 0;

    for (const row of payouts ?? []) {
      const member = row.members as { user_id: string } | { user_id: string }[] | null;
      const jamiya = row.jamiyas as
        | { name: string; slug: string }
        | { name: string; slug: string }[]
        | null;
      const userId = Array.isArray(member) ? member[0]?.user_id : member?.user_id;
      const circle = Array.isArray(jamiya) ? jamiya[0] : jamiya;
      if (!userId || !circle) continue;

      const title = "Payout coming up";
      const body =
        `${circle.name}: your payout for cycle ${row.cycle_number} is scheduled ${row.scheduled_date}.`;
      const dedupe = `payout:${row.id}:${dayKey}`;

      const { data, error } = await supabase.rpc("enqueue_user_reminder", {
        p_user_id: userId,
        p_type: "payout_scheduled",
        p_title: title,
        p_body: body,
        p_dedupe_key: dedupe,
        p_data: {
          payout_id: row.id,
          jamiya_id: row.jamiya_id,
          slug: circle.slug,
        },
      });
      if (error) continue;
      const result = data as { skipped?: boolean; ok?: boolean } | null;
      if (result?.skipped) payoutSkipped += 1;
      else if (result?.ok) payoutReminders += 1;
    }

    // Auto-credit qualified referral rewards (wallet credit; no Daraja needed)
    let referralRewards = null;
    try {
      const { data: rewardData } = await supabase.rpc("reward_qualified_referrals", {
        p_limit: 50,
      });
      referralRewards = rewardData;
    } catch {
      referralRewards = { ok: false, error: "RPC_UNAVAILABLE" };
    }

    return new Response(
      JSON.stringify({
        ok: true,
        late: lateResult,
        contribution_reminders: contributionReminders,
        contribution_skipped: contributionSkipped,
        payout_reminders: payoutReminders,
        payout_skipped: payoutSkipped,
        referral_rewards: referralRewards,
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
