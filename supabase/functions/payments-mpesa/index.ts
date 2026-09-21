import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * M-Pesa STK Push + B2C initiator + Daraja callback handler (Phase 9 / Option B).
 *
 * POST JSON:
 * - { action: "stk_push", intent_id, amount?, phone? }  (service-role)
 * - { action: "b2c_payment", disbursement_id, amount?, phone? }  (service-role)
 * - { action: "health" }  (service-role) — config readiness
 * - Daraja STK callback body (Body.stkCallback)
 * - Daraja B2C Result callback (Result.ResultType / ConversationID)
 *
 * Secrets (Edge): MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_SHORTCODE,
 * MPESA_PASSKEY, MPESA_CALLBACK_URL, optional MPESA_BASE_URL,
 * MPESA_TRANSACTION_TYPE (CustomerPayBillOnline | CustomerBuyGoodsOnline),
 * optional B2C: MPESA_B2C_INITIATOR, MPESA_B2C_SECURITY_CREDENTIAL,
 * MPESA_B2C_RESULT_URL, MPESA_B2C_TIMEOUT_URL, MPESA_B2C_COMMAND_ID.
 *
 * Without Daraja secrets: completes as simulated unless REQUIRE_REAL_PROVIDERS=true.
 */

type StkBody = {
  action?: string;
  intent_id?: string;
  disbursement_id?: string;
  /** charity (default) | withdrawal — wallet / circle cashouts */
  kind?: string;
  amount?: number;
  phone?: string;
  description?: string;
  checkout_request_id?: string;
};


function env(name: string): string {
  return Deno.env.get(name) ?? "";
}

function requireReal(): boolean {
  return env("REQUIRE_REAL_PROVIDERS") === "true";
}

/** Accept exact service-role secret match or a JWT whose role is service_role for this project. */
function isServiceRoleRequest(authHeader: string, serviceKey: string): boolean {
  const trimmedHeader = authHeader.trim();
  const trimmedKey = serviceKey.trim();
  if (!trimmedHeader) return false;
  if (trimmedKey && trimmedHeader === `Bearer ${trimmedKey}`) return true;

  const token = trimmedHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token || !token.includes(".")) return false;
  try {
    const payloadPart = token.split(".")[1] ?? "";
    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as {
      role?: string;
      ref?: string;
    };
    const projectRef =
      env("SUPABASE_URL").match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1] ??
      "vzpnixfqkvovbniaoudx";
    return payload.role === "service_role" && payload.ref === projectRef;
  } catch {
    return false;
  }
}

function toMsisdn(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length === 10) {
    return `254${digits.slice(1)}`;
  }
  if (digits.startsWith("254")) return digits;
  return phone.replace(/^\+/, "");
}

/** Daraja timestamps must be East Africa local time (Africa/Nairobi), not UTC. */
function timestampNairobi(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}${get("month")}${get("day")}${get("hour")}${get("minute")}${get("second")}`;
}

function password(shortcode: string, passkey: string, timestamp: string): string {
  return btoa(`${shortcode}${passkey}${timestamp}`);
}

async function getDarajaToken(): Promise<string | null> {
  const key = env("MPESA_CONSUMER_KEY");
  const secret = env("MPESA_CONSUMER_SECRET");
  const base = env("MPESA_BASE_URL") || "https://sandbox.safaricom.co.ke";
  if (!key || !secret) return null;

  const auth = btoa(`${key}:${secret}`);
  const res = await fetch(
    `${base}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${auth}` } },
  );
  if (!res.ok) {
    console.error("daraja oauth failed", res.status, await res.text());
    return null;
  }
  const json = await res.json();
  return (json.access_token as string) ?? null;
}

function darajaConfigured(): boolean {
  return Boolean(
    env("MPESA_CONSUMER_KEY") &&
      env("MPESA_CONSUMER_SECRET") &&
      env("MPESA_SHORTCODE") &&
      env("MPESA_PASSKEY") &&
      env("MPESA_CALLBACK_URL"),
  );
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

function descForKind(kind: string | undefined, fallback?: string): string {
  if (fallback) return fallback.slice(0, 13);
  switch (kind) {
    case "sadaka":
      return "Jameiyah sadaka";
    case "sponsorship":
      return "Jameiyah adopt";
    case "platform_tip":
      return "Jameiyah support";
    default:
      return "Jameiyah top-up";
  }
}

Deno.serve(async (req) => {
  try {
    const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseUrl = env("SUPABASE_URL");
    if (!serviceKey || !supabaseUrl) {
      return Response.json({ ok: false, error: "MISSING_SUPABASE_ENV" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const auth = req.headers.get("Authorization") ?? "";
    const raw = await req.text();
    let json: Record<string, unknown> = {};
    try {
      json = raw ? JSON.parse(raw) : {};
    } catch {
      json = {};
    }

    if ((json as StkBody).action === "health") {
      if (!isServiceRoleRequest(auth, serviceKey)) {
        return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
      }
      return Response.json({
        ok: true,
        daraja_configured: darajaConfigured(),
        b2c_configured: b2cConfigured(),
        require_real: requireReal(),
        base_url: env("MPESA_BASE_URL") || "https://sandbox.safaricom.co.ke",
        transaction_type:
          env("MPESA_TRANSACTION_TYPE") || "CustomerPayBillOnline",
      });
    }

    // ---- B2C initiate (service) — charity OR wallet withdrawal ----
    if ((json as StkBody).action === "b2c_payment") {
      if (!isServiceRoleRequest(auth, serviceKey)) {
        return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
      }

      const body = json as StkBody;
      if (!body.disbursement_id) {
        return Response.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
      }

      const kind = (body.kind ?? "charity").toLowerCase();
      let amount = Number(body.amount ?? 0);
      let phone = String(body.phone ?? "");
      let remarks = body.description?.slice(0, 70) || "Jameiyah payout";

      if (kind === "withdrawal" || kind === "wallet") {
        const { data: wrow, error: wErr } = await supabase
          .from("withdrawal_requests")
          .select("id, amount, destination_phone, status, currency")
          .eq("id", body.disbursement_id)
          .maybeSingle();
        if (wErr || !wrow) {
          return Response.json({ ok: false, error: "WITHDRAWAL_NOT_FOUND" }, { status: 404 });
        }
        if (!["pending", "processing"].includes(wrow.status as string)) {
          return Response.json(
            { ok: false, error: "NOT_PAYABLE", status: wrow.status },
            { status: 409 },
          );
        }
        amount = Number(body.amount ?? wrow.amount);
        phone = String(body.phone ?? wrow.destination_phone ?? "");
        remarks = (body.description ?? "Jameiyah withdrawal").slice(0, 70);
      } else {
        const { data: row, error: rowErr } = await supabase
          .from("charity_disbursements")
          .select("id, net_amount, beneficiary_phone, status, currency")
          .eq("id", body.disbursement_id)
          .maybeSingle();

        if (rowErr || !row) {
          return Response.json({ ok: false, error: "DISBURSEMENT_NOT_FOUND" }, { status: 404 });
        }
        if (!["pending", "processing"].includes(row.status as string)) {
          return Response.json(
            { ok: false, error: "NOT_PAYABLE", status: row.status },
            { status: 409 },
          );
        }
        amount = Number(body.amount ?? row.net_amount);
        phone = String(body.phone ?? row.beneficiary_phone ?? "");
        remarks = "Jameiyah sadaka";
      }

      if (!Number.isFinite(amount) || amount < 1) {
        return Response.json({ ok: false, error: "INVALID_AMOUNT" }, { status: 400 });
      }
      if (!phone) {
        return Response.json({ ok: false, error: "PHONE_REQUIRED" }, { status: 400 });
      }

      const token = await getDarajaToken();
      if (!token || !b2cConfigured()) {
        if (requireReal()) {
          if (kind !== "withdrawal" && kind !== "wallet") {
            await supabase.rpc("complete_sadaka_disbursement", {
              p_disbursement_id: body.disbursement_id,
              p_success: false,
              p_error: "B2C secrets not configured",
            });
          }
          return Response.json({ ok: false, error: "B2C_UNAVAILABLE" }, { status: 502 });
        }

        if (kind === "withdrawal" || kind === "wallet") {
          return Response.json({
            ok: true,
            fallback: "simulated",
            conversation_id: `sim-b2c:${body.disbursement_id}`,
          });
        }

        const { data } = await supabase.rpc("complete_sadaka_disbursement", {
          p_disbursement_id: body.disbursement_id,
          p_success: true,
          p_mpesa_b2c_id: `sim-b2c:${body.disbursement_id}`,
          p_error: null,
        });
        return Response.json({ ok: true, fallback: "simulated", result: data });
      }

      const shortcode = env("MPESA_SHORTCODE");
      const initiator = env("MPESA_B2C_INITIATOR");
      const securityCredential = env("MPESA_B2C_SECURITY_CREDENTIAL");
      const resultUrl =
        env("MPESA_B2C_RESULT_URL") || env("MPESA_CALLBACK_URL");
      const timeoutUrl =
        env("MPESA_B2C_TIMEOUT_URL") || resultUrl;
      const commandId = env("MPESA_B2C_COMMAND_ID") || "BusinessPayment";
      const base = env("MPESA_BASE_URL") || "https://sandbox.safaricom.co.ke";
      const msisdn = toMsisdn(phone);

      const b2cRes = await fetch(`${base}/mpesa/b2c/v1/paymentrequest`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          InitiatorName: initiator,
          SecurityCredential: securityCredential,
          CommandID: commandId,
          Amount: Math.max(1, Math.round(amount)),
          PartyA: shortcode,
          PartyB: msisdn,
          Remarks: remarks,
          QueueTimeOutURL: timeoutUrl,
          ResultURL: resultUrl,
          Occasion: String(body.disbursement_id).replace(/-/g, "").slice(0, 20),
        }),
      });

      const b2cJson = await b2cRes.json();
      if (!b2cRes.ok || String(b2cJson.ResponseCode) !== "0") {
        if (kind !== "withdrawal" && kind !== "wallet") {
          await supabase.rpc("complete_sadaka_disbursement", {
            p_disbursement_id: body.disbursement_id,
            p_success: false,
            p_error:
              b2cJson.errorMessage ??
              b2cJson.ResponseDescription ??
              "B2C initiate failed",
          });
        }
        return Response.json({ ok: false, error: b2cJson }, { status: 502 });
      }

      const conversationId = String(
        b2cJson.ConversationID ?? b2cJson.OriginatorConversationID ?? "",
      );

      if (kind === "withdrawal" || kind === "wallet") {
        const { data: prev } = await supabase
          .from("withdrawal_requests")
          .select("metadata")
          .eq("id", body.disbursement_id)
          .maybeSingle();
        const prevMeta =
          prev && typeof prev.metadata === "object" && prev.metadata
            ? (prev.metadata as Record<string, unknown>)
            : {};
        await supabase
          .from("withdrawal_requests")
          .update({
            status: "processing",
            provider_reference: conversationId || null,
            metadata: {
              ...prevMeta,
              daraja_kind: "withdrawal",
              originator_conversation_id:
                b2cJson.OriginatorConversationID ?? null,
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", body.disbursement_id);
      } else {
        await supabase
          .from("charity_disbursements")
          .update({
            status: "processing",
            mpesa_b2c_id: conversationId,
          })
          .eq("id", body.disbursement_id);
      }

      return Response.json({
        ok: true,
        conversation_id: b2cJson.ConversationID ?? null,
        originator_conversation_id: b2cJson.OriginatorConversationID ?? null,
        response_description: b2cJson.ResponseDescription ?? null,
        kind,
      });
    }

    // ---- STK query (service) — for reconcile / getPaymentStatus ----
    if ((json as StkBody).action === "stk_query") {
      if (!isServiceRoleRequest(auth, serviceKey)) {
        return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
      }
      const checkoutId = String(
        (json as StkBody).checkout_request_id ?? "",
      ).trim();
      if (!checkoutId) {
        return Response.json({ ok: false, error: "CHECKOUT_REQUIRED" }, { status: 400 });
      }
      const token = await getDarajaToken();
      if (!token || !darajaConfigured()) {
        return Response.json({
          ok: true,
          status: "unknown",
          error: "DARAJA_UNAVAILABLE",
        });
      }
      const shortcode = env("MPESA_SHORTCODE");
      const passkey = env("MPESA_PASSKEY");
      const ts = timestampNairobi();
      const base = env("MPESA_BASE_URL") || "https://sandbox.safaricom.co.ke";
      const qRes = await fetch(`${base}/mpesa/stkpushquery/v1/query`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          BusinessShortCode: shortcode,
          Password: password(shortcode, passkey, ts),
          Timestamp: ts,
          CheckoutRequestID: checkoutId,
        }),
      });
      const qJson = await qRes.json().catch(() => ({})) as {
        ResultCode?: string | number;
        ResultDesc?: string;
        errorMessage?: string;
        ResponseCode?: string;
      };
      if (!qRes.ok) {
        return Response.json({
          ok: false,
          error: qJson.errorMessage ?? `Query HTTP ${qRes.status}`,
          status: "unknown",
        });
      }
      const code = String(qJson.ResultCode ?? "");
      // 0 = success; common cancel/fail codes; else still pending
      const status =
        code === "0"
          ? "success"
          : ["1032", "17", "1025", "1019", "1001"].includes(code)
            ? "failed"
            : "processing";
      return Response.json({
        ok: true,
        status,
        result_code: code,
        result_desc: qJson.ResultDesc ?? null,
        checkout_request_id: checkoutId,
      });
    }

    // ---- STK initiate (service) ----
    if ((json as StkBody).action === "stk_push") {
      if (!isServiceRoleRequest(auth, serviceKey)) {
        return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
      }

      const body = json as StkBody;
      if (!body.intent_id) {
        return Response.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
      }

      const { data: intent, error: intentErr } = await supabase
        .from("payment_intents")
        .select("id, amount, phone, status, metadata, provider")
        .eq("id", body.intent_id)
        .maybeSingle();

      if (intentErr || !intent) {
        return Response.json({ ok: false, error: "INTENT_NOT_FOUND" }, { status: 404 });
      }
      if (!["pending", "processing"].includes(intent.status as string)) {
        return Response.json(
          { ok: false, error: "INTENT_NOT_PENDING", status: intent.status },
          { status: 409 },
        );
      }

      const amount = Number(body.amount ?? intent.amount);
      const phone = String(body.phone ?? intent.phone ?? "");
      const kind = (intent.metadata as { kind?: string } | null)?.kind;
      if (!Number.isFinite(amount) || amount < 1) {
        return Response.json({ ok: false, error: "INVALID_AMOUNT" }, { status: 400 });
      }
      if (!/^\+?[1-9]\d{7,14}$/.test(phone) && !/^0\d{9}$/.test(phone)) {
        return Response.json({ ok: false, error: "PHONE_REQUIRED" }, { status: 400 });
      }

      const token = await getDarajaToken();
      if (!token) {
        if (requireReal() || darajaConfigured()) {
          // Configured but oauth failed, or real mode without secrets
          await supabase.rpc("fail_payment_intent", {
            p_intent_id: body.intent_id,
            p_error_message: darajaConfigured()
              ? "Daraja OAuth failed"
              : "M-Pesa secrets not configured",
          });
          return Response.json(
            { ok: false, error: "DARAJA_UNAVAILABLE" },
            { status: 502 },
          );
        }

        const { data } = await supabase.rpc("complete_payment_intent", {
          p_intent_id: body.intent_id,
          p_provider_reference: `mpesa-sim:${body.intent_id}`,
          p_metadata: { source: "mpesa_fallback_simulated" },
        });
        return Response.json({ ok: true, fallback: "simulated", result: data });
      }

      const shortcode = env("MPESA_SHORTCODE");
      const passkey = env("MPESA_PASSKEY");
      const callbackUrl = env("MPESA_CALLBACK_URL");
      const txType = env("MPESA_TRANSACTION_TYPE") || "CustomerPayBillOnline";
      const ts = timestampNairobi();
      const base = env("MPESA_BASE_URL") || "https://sandbox.safaricom.co.ke";
      const msisdn = toMsisdn(phone);

      const stkRes = await fetch(`${base}/mpesa/stkpush/v1/processrequest`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          BusinessShortCode: shortcode,
          Password: password(shortcode, passkey, ts),
          Timestamp: ts,
          TransactionType: txType,
          Amount: Math.max(1, Math.round(amount)),
          PartyA: msisdn,
          PartyB: shortcode,
          PhoneNumber: msisdn,
          CallBackURL: callbackUrl,
          AccountReference: String(body.intent_id).replace(/-/g, "").slice(0, 12),
          TransactionDesc: descForKind(kind, body.description),
        }),
      });

      const stkJson = await stkRes.json();
      if (!stkRes.ok || String(stkJson.ResponseCode) !== "0") {
        await supabase.rpc("fail_payment_intent", {
          p_intent_id: body.intent_id,
          p_error_message:
            stkJson.errorMessage ??
            stkJson.ResponseDescription ??
            stkJson.errorMessage ??
            "STK failed",
        });
        return Response.json({ ok: false, error: stkJson }, { status: 502 });
      }

      await supabase.rpc("mark_payment_intent_processing", {
        p_intent_id: body.intent_id,
        p_checkout_request_id: stkJson.CheckoutRequestID,
        p_merchant_request_id: stkJson.MerchantRequestID,
        p_provider_reference: stkJson.CheckoutRequestID,
      });

      return Response.json({
        ok: true,
        checkout_request_id: stkJson.CheckoutRequestID,
        merchant_request_id: stkJson.MerchantRequestID,
        customer_message: stkJson.CustomerMessage ?? null,
      });
    }

    // ---- Daraja callback ----
    const callback = (
      json as {
        Body?: {
          stkCallback?: {
            ResultCode?: number;
            ResultDesc?: string;
            CheckoutRequestID?: string;
            CallbackMetadata?: {
              Item?: Array<{ Name: string; Value?: string | number }>;
            };
          };
        };
      }
    ).Body?.stkCallback;

    if (callback?.CheckoutRequestID) {
      const { data: intents } = await supabase
        .from("payment_intents")
        .select("id, status")
        .eq("checkout_request_id", callback.CheckoutRequestID)
        .limit(1);

      const intentId = intents?.[0]?.id as string | undefined;
      if (!intentId) {
        // Acknowledge to stop Daraja retries; log for ops
        console.error("INTENT_NOT_FOUND", callback.CheckoutRequestID);
        return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
      }

      if (intents?.[0]?.status === "completed") {
        return Response.json({ ResultCode: 0, ResultDesc: "Already completed" });
      }

      if (Number(callback.ResultCode) === 0) {
        const receipt = callback.CallbackMetadata?.Item?.find(
          (i) => i.Name === "MpesaReceiptNumber",
        )?.Value;

        await supabase.rpc("complete_payment_intent", {
          p_intent_id: intentId,
          p_provider_reference: String(receipt ?? callback.CheckoutRequestID),
          p_checkout_request_id: callback.CheckoutRequestID,
          p_metadata: { daraja: callback, source: "mpesa_callback" },
        });
      } else {
        await supabase.rpc("fail_payment_intent", {
          p_intent_id: intentId,
          p_error_message: callback.ResultDesc ?? "M-Pesa declined",
        });
      }

      return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    // ---- Daraja B2C result callback ----
    const b2cResult = (
      json as {
        Result?: {
          ResultCode?: number;
          ResultDesc?: string;
          ConversationID?: string;
          OriginatorConversationID?: string;
          TransactionID?: string;
          ResultParameters?: {
            ResultParameter?: Array<{ Key: string; Value?: string | number }>;
          };
        };
      }
    ).Result;

    if (b2cResult?.ConversationID || b2cResult?.OriginatorConversationID) {
      const conv =
        b2cResult.ConversationID ?? b2cResult.OriginatorConversationID ?? "";
      const receipt =
        b2cResult.TransactionID ??
        b2cResult.ResultParameters?.ResultParameter?.find(
          (p) => p.Key === "TransactionReceipt",
        )?.Value;
      const success = Number(b2cResult.ResultCode) === 0;

      // Wallet / circle withdrawals first
      const { data: wRows } = await supabase
        .from("withdrawal_requests")
        .select("id, status")
        .eq("provider_reference", conv)
        .in("status", ["pending", "processing"])
        .limit(1);
      let withdrawalId = wRows?.[0]?.id as string | undefined;
      if (!withdrawalId && b2cResult.OriginatorConversationID) {
        const { data: wAlt } = await supabase
          .from("withdrawal_requests")
          .select("id, status")
          .eq("provider_reference", b2cResult.OriginatorConversationID)
          .in("status", ["pending", "processing"])
          .limit(1);
        withdrawalId = wAlt?.[0]?.id as string | undefined;
      }

      if (withdrawalId) {
        if (success) {
          await supabase.rpc("process_withdrawal", {
            p_withdrawal_id: withdrawalId,
            p_approve: true,
            p_provider_reference: String(receipt ?? conv),
            p_error_message: null,
          });
        } else {
          await supabase
            .from("withdrawal_requests")
            .update({
              status: "failed",
              error_message: (b2cResult.ResultDesc ?? "B2C declined").slice(0, 500),
              updated_at: new Date().toISOString(),
            })
            .eq("id", withdrawalId);
        }
        return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
      }

      const { data: rows } = await supabase
        .from("charity_disbursements")
        .select("id, status")
        .eq("mpesa_b2c_id", conv)
        .limit(1);

      let disbursementId = rows?.[0]?.id as string | undefined;
      if (!disbursementId && b2cResult.OriginatorConversationID) {
        const { data: alt } = await supabase
          .from("charity_disbursements")
          .select("id, status")
          .eq("mpesa_b2c_id", b2cResult.OriginatorConversationID)
          .limit(1);
        disbursementId = alt?.[0]?.id as string | undefined;
      }

      if (!disbursementId) {
        console.error("B2C_DISBURSEMENT_NOT_FOUND", conv);
        return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
      }

      if (rows?.[0]?.status === "paid") {
        return Response.json({ ResultCode: 0, ResultDesc: "Already paid" });
      }

      if (success) {
        await supabase.rpc("complete_sadaka_disbursement", {
          p_disbursement_id: disbursementId,
          p_success: true,
          p_mpesa_b2c_id: String(receipt ?? conv),
          p_error: null,
        });
      } else {
        await supabase.rpc("complete_sadaka_disbursement", {
          p_disbursement_id: disbursementId,
          p_success: false,
          p_error: b2cResult.ResultDesc ?? "B2C declined",
        });
      }

      return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    return Response.json({ ok: false, error: "UNKNOWN_PAYLOAD" }, { status: 400 });
  } catch (error) {
    console.error("payments-mpesa failed", error);
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "UNKNOWN" },
      { status: 500 },
    );
  }
});
