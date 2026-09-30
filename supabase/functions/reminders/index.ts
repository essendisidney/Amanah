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

    // Always require a service-role key or the cron secret (it used to be open when CRON_SECRET was unset).
    // The caller's key may be a different service-role key format than this runtime's,
    // so an unknown bearer is checked against the Auth admin API, which only service-role keys can read.
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    const isServiceRole = async (t: string) => {
      if (!t) return false;
      if (t === serviceKey || (cronSecret && t === cronSecret)) return true;
      try {
        const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/admin/users?per_page=1`, {
          headers: { apikey: t, Authorization: `Bearer ${t}` },
        });
        return r.ok;
      } catch {
        return false;
      }
    };
    if (!(await isServiceRole(token))) {
      return new Response(JSON.stringify({ ok: false, error: "UNAUTHORIZED" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    // Auth check only, no work: lets deploys confirm the cron can reach this function.
    if (new URL(req.url).searchParams.get("probe") === "1") {
      return Response.json({ ok: true, probe: true });
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
      .gte("due_date", new Date(Date.now() - 8 * 86_400_000).toISOString().slice(0, 10))
      .limit(200);
    if (upcomingError) throw upcomingError;

    let contributionReminders = 0;
    let contributionSkipped = 0;

    // Remind on key days only (SMS costs money and daily nagging gets ignored):
    // the day before, the due day, then 1, 3 and 7 days late.
    const REMIND_DAYS = new Set([1, 0, -1, -3, -7]);
    const siteUrl = (Deno.env.get("SITE_URL") ?? "https://jameiyah.com").replace(/\/$/, "");
    const dayMs = 86_400_000;
    const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    const daysUntil = (isoDate: string) =>
      Math.round((Date.parse(`${isoDate}T00:00:00Z`) - todayUtc) / dayMs);
    const money = (amount: number | string, currency: string) =>
      `${currency === "KES" ? "KES" : currency} ${Number(amount).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;

    for (const row of upcoming ?? []) {
      const d = daysUntil(row.due_date as string);
      if (!REMIND_DAYS.has(d)) continue;
      const member = row.members as { user_id: string } | { user_id: string }[] | null;
      const jamiya = row.jamiyas as
        | { name: string; slug: string }
        | { name: string; slug: string }[]
        | null;
      const userId = Array.isArray(member) ? member[0]?.user_id : member?.user_id;
      const circle = Array.isArray(jamiya) ? jamiya[0] : jamiya;
      if (!userId || !circle) continue;

      const when = d === 1
        ? "is due tomorrow"
        : d === 0
        ? "is due today"
        : `was due ${-d} day${d === -1 ? "" : "s"} ago`;
      const title = d < 0 ? "Contribution overdue" : "Contribution reminder";
      const body =
        `${circle.name}: ${money(row.amount, row.currency)} (cycle ${row.cycle_number}) ${when}. Pay: ${siteUrl}/pay`;
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
      // One heads-up, the day before the payout.
      if (daysUntil(row.scheduled_date as string) !== 1) continue;
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
        `${circle.name}: your payout of ${money(row.amount, row.currency)} (cycle ${row.cycle_number}) is scheduled for tomorrow.`;
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
