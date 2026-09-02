import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Bank PSP Edge Function (Phase 6).
 * - initiate: create/submit transfer via BANK_API_URL when configured
 * - confirm / webhook: settle payment intent or bank_transfer_job
 * Falls back to simulated complete unless REQUIRE_REAL_PROVIDERS=true.
 */

function env(name: string): string {
  return Deno.env.get(name) ?? "";
}

type BankApiResult = {
  ok: boolean;
  reference?: string;
  status?: string;
  raw?: unknown;
  error?: string;
};

async function callBankApi(payload: Record<string, unknown>): Promise<BankApiResult> {
  const base = env("BANK_API_URL").replace(/\/$/, "");
  const key = env("BANK_API_KEY");
  if (!base || !key) {
    return { ok: false, error: "BANK_NOT_CONFIGURED" };
  }

  const res = await fetch(`${base}/transfers`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "X-Amanah-Idempotency-Key": String(payload.idempotency_key ?? crypto.randomUUID()),
    },
    body: JSON.stringify(payload),
  });

  let raw: unknown;
  try {
    raw = await res.json();
  } catch {
    raw = { text: await res.text().catch(() => "") };
  }
  if (!res.ok) {
    return {
      ok: false,
      error: typeof raw === "object" && raw && "message" in raw
        ? String((raw as { message: unknown }).message)
        : `BANK_HTTP_${res.status}`,
      raw,
    };
  }

  const reference =
    typeof raw === "object" && raw && "reference" in raw
      ? String((raw as { reference: unknown }).reference)
      : `bank:${payload.idempotency_key}`;

  const status =
    typeof raw === "object" && raw && "status" in raw
      ? String((raw as { status: unknown }).status)
      : "submitted";

  return { ok: true, reference, status, raw };
}

Deno.serve(async (req) => {
  try {
    const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
    const auth = req.headers.get("Authorization") ?? "";
    if (auth !== `Bearer ${serviceKey}`) {
      return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const supabase = createClient(env("SUPABASE_URL"), serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const action = (body as { action?: string }).action as string | undefined;

    if (action === "health") {
      const hasBank = Boolean(env("BANK_API_KEY") && env("BANK_API_URL"));
      const requireReal = env("REQUIRE_REAL_PROVIDERS") === "true";
      return Response.json({
        ok: true,
        bank_configured: hasBank,
        require_real: requireReal,
        simulated_fallback: !hasBank && !requireReal,
        hint: hasBank
          ? null
          : requireReal
            ? "Set BANK_API_URL and BANK_API_KEY on the Edge function."
            : "Bank API not set; initiate falls back to simulated complete.",
      });
    }

    if (action === "initiate") {
      const intentId = body.intent_id as string | undefined;
      const jobId = body.job_id as string | undefined;
      const requireReal = env("REQUIRE_REAL_PROVIDERS") === "true";
      const hasBank = Boolean(env("BANK_API_KEY") && env("BANK_API_URL"));

      if (jobId) {
        const { data: job } = await supabase
          .from("bank_transfer_jobs")
          .select("*")
          .eq("id", jobId)
          .maybeSingle();

        if (!job) {
          return Response.json({ ok: false, error: "JOB_NOT_FOUND" }, { status: 404 });
        }

        if (!hasBank) {
          if (requireReal) {
            await supabase
              .from("bank_transfer_jobs")
              .update({
                status: "failed",
                error_message: "Bank provider not configured",
              })
              .eq("id", jobId);
            return Response.json({ ok: false, error: "BANK_NOT_CONFIGURED" }, { status: 503 });
          }

          await supabase
            .from("bank_transfer_jobs")
            .update({
              status: "settled",
              provider_reference: `bank-sim:${jobId}`,
              submitted_at: new Date().toISOString(),
              settled_at: new Date().toISOString(),
              response_payload: { source: "bank_fallback_simulated" },
            })
            .eq("id", jobId);

          return Response.json({ ok: true, fallback: "simulated", job_id: jobId });
        }

        const bank = await callBankApi({
          idempotency_key: jobId,
          amount: job.amount,
          currency: job.currency,
          account_name: job.account_name,
          account_number: job.account_number,
          bank_name: job.bank_name,
          metadata: { withdrawal_id: job.withdrawal_id, job_id: jobId },
        });

        if (!bank.ok) {
          await supabase
            .from("bank_transfer_jobs")
            .update({
              status: "failed",
              error_message: bank.error ?? "BANK_FAILED",
              response_payload: bank.raw ?? {},
            })
            .eq("id", jobId);
          return Response.json({ ok: false, error: bank.error }, { status: 502 });
        }

        const settled = bank.status === "settled" || bank.status === "completed";
        await supabase
          .from("bank_transfer_jobs")
          .update({
            status: settled ? "settled" : "submitted",
            provider_reference: bank.reference,
            submitted_at: new Date().toISOString(),
            settled_at: settled ? new Date().toISOString() : null,
            response_payload: bank.raw ?? {},
          })
          .eq("id", jobId);

        return Response.json({
          ok: true,
          job_id: jobId,
          status: settled ? "settled" : "submitted",
          reference: bank.reference,
        });
      }

      if (!intentId) {
        return Response.json({ ok: false, error: "INTENT_OR_JOB_REQUIRED" }, { status: 400 });
      }

      if (!hasBank) {
        if (requireReal) {
          await supabase.rpc("fail_payment_intent", {
            p_intent_id: intentId,
            p_error_message: "Bank provider not configured",
          });
          return Response.json({ ok: false, error: "BANK_NOT_CONFIGURED" }, { status: 503 });
        }

        const { data } = await supabase.rpc("complete_payment_intent", {
          p_intent_id: intentId,
          p_provider_reference: `bank-sim:${intentId}`,
          p_metadata: { source: "bank_fallback_simulated" },
        });
        return Response.json({ ok: true, fallback: "simulated", result: data });
      }

      await supabase.rpc("mark_payment_intent_processing", {
        p_intent_id: intentId,
        p_checkout_request_id: null,
        p_merchant_request_id: null,
        p_provider_reference: `bank-pending:${intentId}`,
      });

      const bank = await callBankApi({
        idempotency_key: intentId,
        amount: body.amount,
        currency: body.currency ?? "KES",
        account_name: body.account_name,
        account_number: body.account_number,
        bank_name: body.bank_name,
        metadata: { payment_intent_id: intentId },
      });

      if (!bank.ok) {
        await supabase.rpc("fail_payment_intent", {
          p_intent_id: intentId,
          p_error_message: bank.error ?? "BANK_FAILED",
        });
        return Response.json({ ok: false, error: bank.error }, { status: 502 });
      }

      if (bank.status === "settled" || bank.status === "completed") {
        const { data } = await supabase.rpc("complete_payment_intent", {
          p_intent_id: intentId,
          p_provider_reference: bank.reference,
          p_metadata: { bank: bank.raw },
        });
        return Response.json({ ok: true, status: "settled", result: data });
      }

      return Response.json({
        ok: true,
        status: "processing",
        reference: bank.reference,
      });
    }

    if (action === "confirm") {
      if (body.job_id) {
        await supabase
          .from("bank_transfer_jobs")
          .update({
            status: "settled",
            provider_reference: body.reference ?? `bank:${body.job_id}`,
            settled_at: new Date().toISOString(),
            response_payload: body,
          })
          .eq("id", body.job_id);
        return Response.json({ ok: true, job_id: body.job_id });
      }

      if (!body.intent_id) {
        return Response.json({ ok: false, error: "INTENT_REQUIRED" }, { status: 400 });
      }

      const { data } = await supabase.rpc("complete_payment_intent", {
        p_intent_id: body.intent_id,
        p_provider_reference: body.reference ?? `bank:${body.intent_id}`,
        p_metadata: { bank: body },
      });
      return Response.json({ ok: true, result: data });
    }

    return Response.json({ ok: false, error: "UNKNOWN_ACTION" }, { status: 400 });
  } catch (error) {
    console.error("payments-bank failed", error);
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "UNKNOWN" },
      { status: 500 },
    );
  }
});
