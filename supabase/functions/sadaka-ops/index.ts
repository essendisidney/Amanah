import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Sadaka Option B ops cron:
 * 1) Claim pending disbursements → Daraja B2C (or simulate)
 * 2) Queue due sponsorship charges → STK (or simulate)
 *
 * Auth: Bearer SUPABASE_SERVICE_ROLE_KEY or CRON_SECRET
 */

function env(name: string): string {
  return Deno.env.get(name) ?? "";
}

function b2cConfigured(): boolean {
  return Boolean(
    env("MPESA_CONSUMER_KEY") &&
      env("MPESA_CONSUMER_SECRET") &&
      env("MPESA_SHORTCODE") &&
      env("MPESA_B2C_INITIATOR") &&
      env("MPESA_B2C_SECURITY_CREDENTIAL") &&
      (env("MPESA_B2C_RESULT_URL") || env("MPESA_CALLBACK_URL")),
  );
}

async function invokePaymentsMpesa(
  serviceKey: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const base = env("SUPABASE_URL");
  const res = await fetch(`${base}/functions/v1/payments-mpesa`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { http_status: res.status, ...(json as Record<string, unknown>) };
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

    // ---- 1) Disbursements ----
    const { data: claim, error: claimErr } = await supabase.rpc(
      "claim_pending_sadaka_disbursements",
      { p_limit: 20 },
    );
    if (claimErr) throw claimErr;

    const disbursements = (claim as { disbursements?: Array<Record<string, unknown>> })
      ?.disbursements ?? [];
    const disburseResults: unknown[] = [];
    const useLiveB2c = b2cConfigured();

    for (const row of disbursements) {
      const id = String(row.id);
      if (useLiveB2c) {
        const b2c = await invokePaymentsMpesa(serviceKey, {
          action: "b2c_payment",
          disbursement_id: id,
          amount: Number(row.net_amount),
          phone: String(row.beneficiary_phone),
        });
        disburseResults.push({ id, mode: "live_b2c", result: b2c });
      } else {
        const { data } = await supabase.rpc("complete_sadaka_disbursement", {
          p_disbursement_id: id,
          p_success: true,
          p_mpesa_b2c_id: `sim-b2c:${id}`,
          p_error: null,
        });
        disburseResults.push({ id, mode: "simulated", result: data });
      }
    }

    // ---- 2) Sponsorship charges ----
    const { data: queued, error: queueErr } = await supabase.rpc(
      "queue_due_sponsorship_charges",
      { p_limit: 50 },
    );
    if (queueErr) throw queueErr;

    const items =
      (queued as { items?: Array<Record<string, unknown>> })?.items ?? [];
    const chargeResults: unknown[] = [];

    for (const item of items) {
      const intentId = String(item.intent_id);
      const phone = item.phone ? String(item.phone) : "";
      const amount = Number(item.amount);
      const provider = String(item.provider ?? "simulated");

      if (provider === "mpesa" && phone) {
        const stk = await invokePaymentsMpesa(serviceKey, {
          action: "stk_push",
          intent_id: intentId,
          amount,
          phone,
          description: "Amanah adopt",
        });
        chargeResults.push({ intent_id: intentId, mode: "stk", result: stk });
      } else {
        const { data } = await supabase.rpc("complete_payment_intent", {
          p_intent_id: intentId,
          p_provider_reference: `sponsor-sim:${intentId}`,
          p_metadata: { source: "sadaka_ops_simulated" },
        });
        chargeResults.push({
          intent_id: intentId,
          mode: "simulated",
          result: data,
        });
      }
    }

    return Response.json({
      ok: true,
      b2c_configured: useLiveB2c,
      disbursements_processed: disburseResults.length,
      disbursements: disburseResults,
      sponsorships_queued: items.length,
      sponsorships: chargeResults,
    });
  } catch (error) {
    console.error("sadaka-ops failed", error);
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "UNKNOWN" },
      { status: 500 },
    );
  }
});
