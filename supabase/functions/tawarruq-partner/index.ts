/**
 * Tawarruq partner worker (Phase 13).
 * Claims queued applications and POSTs to TAWARRUQ_PARTNER_API_URL when configured.
 * Falls back to simulated ack unless REQUIRE_REAL_PROVIDERS=true.
 *
 * Auth: Bearer SUPABASE_SERVICE_ROLE_KEY or CRON_SECRET.
 * Webhook: POST ?action=webhook with TAWARRUQ_WEBHOOK_SECRET.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

function env(name: string): string {
  return Deno.env.get(name) ?? "";
}

type PartnerResult = {
  ok: boolean;
  reference?: string;
  status?: string;
  raw?: unknown;
  error?: string;
  simulated?: boolean;
};

async function callPartnerApi(payload: Record<string, unknown>): Promise<PartnerResult> {
  const base = env("TAWARRUQ_PARTNER_API_URL").replace(/\/$/, "");
  const key = env("TAWARRUQ_PARTNER_API_KEY");
  if (!base || !key) {
    return { ok: false, error: "TAWARRUQ_NOT_CONFIGURED" };
  }

  const res = await fetch(`${base}/applications`, {
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
        : `PARTNER_HTTP_${res.status}`,
      raw,
    };
  }

  const reference =
    typeof raw === "object" && raw && "reference" in raw
      ? String((raw as { reference: unknown }).reference)
      : String(payload.partner_reference ?? payload.idempotency_key);

  const status =
    typeof raw === "object" && raw && "status" in raw
      ? String((raw as { status: unknown }).status)
      : "partner_ack";

  return { ok: true, reference, status, raw };
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "drain";
    const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
    const cronSecret = env("CRON_SECRET");
    const webhookSecret = env("TAWARRUQ_WEBHOOK_SECRET");
    const auth = req.headers.get("Authorization") ?? "";

    const supabase = createClient(env("SUPABASE_URL"), serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (action === "webhook") {
      const headerSecret =
        req.headers.get("X-Tawarruq-Webhook-Secret") ??
        req.headers.get("X-Webhook-Secret") ??
        "";
      if (!webhookSecret || headerSecret !== webhookSecret) {
        return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
      }

      const body = await req.json();
      const applicationId = body.application_id as string | undefined;
      const partnerReference = body.partner_reference as string | undefined;
      const partnerStatus = (body.partner_status as string | undefined) ?? "updated";
      const appStatus = body.status as string | undefined;

      let query = supabase.from("tawarruq_applications").select("id, metadata").limit(1);
      if (applicationId) query = query.eq("id", applicationId);
      else if (partnerReference) query = query.eq("partner_reference", partnerReference);
      else {
        return Response.json({ ok: false, error: "MISSING_ID" }, { status: 400 });
      }

      const { data: row, error } = await query.maybeSingle();
      if (error) throw error;
      if (!row) {
        return Response.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
      }

      const prevMeta =
        typeof row.metadata === "object" && row.metadata ? row.metadata as Record<string, unknown> : {};
      const patch: Record<string, unknown> = {
        partner_status: partnerStatus,
        metadata: {
          ...prevMeta,
          webhook_at: new Date().toISOString(),
          webhook_payload: body,
        },
        updated_at: new Date().toISOString(),
      };
      if (appStatus) patch.status = appStatus;
      if (partnerReference) patch.partner_reference = partnerReference;

      const { error: upErr } = await supabase
        .from("tawarruq_applications")
        .update(patch)
        .eq("id", row.id);
      if (upErr) throw upErr;

      return Response.json({ ok: true, application_id: row.id });
    }

    if (
      auth !== `Bearer ${serviceKey}` &&
      !(cronSecret && auth === `Bearer ${cronSecret}`)
    ) {
      return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { data: rows, error } = await supabase
      .from("tawarruq_applications")
      .select("id, amount, currency, purpose, partner_reference, user_id, jamiya_id, metadata")
      .eq("status", "submitted_to_partner")
      .eq("partner_status", "queued")
      .limit(25);

    if (error) throw error;

    const requireReal = env("REQUIRE_REAL_PROVIDERS") === "true";
    const hasPartner = Boolean(env("TAWARRUQ_PARTNER_API_URL") && env("TAWARRUQ_PARTNER_API_KEY"));
    let updated = 0;
    const results: Array<Record<string, unknown>> = [];

    for (const row of rows ?? []) {
      const payload = {
        idempotency_key: `tawarruq:${row.id}`,
        application_id: row.id,
        partner_reference: row.partner_reference,
        user_id: row.user_id,
        jamiya_id: row.jamiya_id,
        amount: row.amount,
        currency: row.currency,
        purpose: row.purpose,
      };

      let partner: PartnerResult;
      if (hasPartner) {
        partner = await callPartnerApi(payload);
      } else if (requireReal) {
        partner = { ok: false, error: "TAWARRUQ_REQUIRED" };
      } else {
        partner = {
          ok: true,
          reference: String(row.partner_reference ?? row.id),
          status: "partner_ack",
          simulated: true,
        };
      }

      const prevMeta =
        typeof row.metadata === "object" && row.metadata
          ? (row.metadata as Record<string, unknown>)
          : {};

      if (!partner.ok) {
        await supabase
          .from("tawarruq_applications")
          .update({
            partner_status: "submit_failed",
            metadata: {
              ...prevMeta,
              last_error: partner.error,
              last_error_at: new Date().toISOString(),
              partner_raw: partner.raw ?? null,
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        results.push({ id: row.id, ok: false, error: partner.error });
        continue;
      }

      const { error: upErr } = await supabase
        .from("tawarruq_applications")
        .update({
          partner_status: partner.status ?? "partner_ack",
          partner_reference: partner.reference ?? row.partner_reference,
          metadata: {
            ...prevMeta,
            worker: "tawarruq-partner",
            ack_at: new Date().toISOString(),
            simulated: Boolean(partner.simulated),
            partner_raw: partner.raw ?? null,
            handoff: partner.simulated ? "simulated_partner_api" : "live_partner_api",
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      if (!upErr) {
        updated += 1;
        results.push({
          id: row.id,
          ok: true,
          simulated: Boolean(partner.simulated),
          reference: partner.reference,
        });
      }
    }

    return Response.json({
      ok: true,
      claimed: rows?.length ?? 0,
      updated,
      live: hasPartner,
      results,
    });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "UNKNOWN" },
      { status: 500 },
    );
  }
});
