import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Settlement worker — settles scheduled payouts whose cycle contributions are complete.
 * Prefer circle-admin settle from the UI; this covers overnight batch settlement.
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

    // Service-role path: mark late first, then attempt settle for due payouts.
    await supabase.rpc("mark_late_contributions");

    const { data: payouts, error } = await supabase
      .from("payouts")
      .select("id, cycle_number, jamiya_id, scheduled_date, status")
      .in("status", ["scheduled", "processing"])
      .lte("scheduled_date", new Date().toISOString().slice(0, 10))
      .order("scheduled_date", { ascending: true })
      .limit(50);

    if (error) throw error;

    const settled: string[] = [];
    const skipped: Array<{ id: string; reason: string }> = [];

    for (const payout of payouts ?? []) {
      // Direct ledger settle requires auth.uid(); use SQL via service by calling a
      // privileged settle that checks unpaid count, then credit via private ledger.
      const { count: unpaidCount, error: unpaidError } = await supabase
      .from("contributions")
      .select("id", { count: "exact", head: true })
      .eq("jamiya_id", payout.jamiya_id)
      .eq("cycle_number", payout.cycle_number)
      .not("status", "in", "(paid,waived)");

      if (unpaidError) {
        skipped.push({ id: payout.id, reason: unpaidError.message });
        continue;
      }

      if ((unpaidCount ?? 0) > 0) {
        skipped.push({ id: payout.id, reason: "CYCLE_INCOMPLETE" });
        continue;
      }

      // Fetch payout row + recipient for ledger credit using SQL function via RPC
      // settle_payout needs auth.uid() — use dedicated service settle below.
      const { data: settleResult, error: settleError } = await supabase.rpc(
        "service_settle_payout",
        { p_payout_id: payout.id },
      );

      if (settleError) {
        skipped.push({ id: payout.id, reason: settleError.message });
        continue;
      }

      const result = settleResult as { ok?: boolean; error?: string } | null;
      if (!result?.ok) {
        skipped.push({ id: payout.id, reason: result?.error ?? "FAILED" });
        continue;
      }

      settled.push(payout.id);
    }

    return new Response(
      JSON.stringify({ ok: true, settled, skipped }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("settlement failed", error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : "UNKNOWN",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
