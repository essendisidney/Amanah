import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * M-Pesa STK Push initiator + Daraja callback handler.
 *
 * POST JSON:
 * - { action: "stk_push", intent_id, amount, phone }  (service-role)
 * - Daraja callback body (ResultCode / Body.stkCallback)
 *
 * Without MPESA_* secrets, STK falls back to completing the intent as simulated.
 */

type StkBody = {
  action?: string;
  intent_id?: string;
  amount?: number;
  phone?: string;
};

function env(name: string): string {
  return Deno.env.get(name) ?? "";
}

function toMsisdn(phone: string): string {
  // +2547... → 2547...
  return phone.replace(/^\+/, "");
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
  if (!res.ok) return null;
  const json = await res.json();
  return json.access_token as string;
}

function password(shortcode: string, passkey: string, timestamp: string): string {
  return btoa(`${shortcode}${passkey}${timestamp}`);
}

function timestampNow(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`
  );
}

Deno.serve(async (req) => {
  try {
    const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseUrl = env("SUPABASE_URL");
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

    // ---- STK initiate (service) ----
    if ((json as StkBody).action === "stk_push") {
      if (auth !== `Bearer ${serviceKey}`) {
        return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
      }

      const body = json as StkBody;
      if (!body.intent_id || !body.amount || !body.phone) {
        return Response.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
      }

      const token = await getDarajaToken();
      if (!token) {
        // Dev fallback: complete immediately when Daraja not configured.
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
      const ts = timestampNow();
      const base = env("MPESA_BASE_URL") || "https://sandbox.safaricom.co.ke";

      const stkRes = await fetch(
        `${base}/mpesa/stkpush/v1/processrequest`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            BusinessShortCode: shortcode,
            Password: password(shortcode, passkey, ts),
            Timestamp: ts,
            TransactionType: "CustomerPayBillOnline",
            Amount: Math.round(body.amount),
            PartyA: toMsisdn(body.phone),
            PartyB: shortcode,
            PhoneNumber: toMsisdn(body.phone),
            CallBackURL: callbackUrl,
            AccountReference: body.intent_id.slice(0, 12),
            TransactionDesc: "Amanah wallet top-up",
          }),
        },
      );

      const stkJson = await stkRes.json();
      if (!stkRes.ok || stkJson.ResponseCode !== "0") {
        await supabase.rpc("fail_payment_intent", {
          p_intent_id: body.intent_id,
          p_error_message: stkJson.errorMessage ?? stkJson.ResponseDescription ?? "STK failed",
        });
        return Response.json({ ok: false, error: stkJson }, { status: 502 });
      }

      await supabase.rpc("mark_payment_intent_processing", {
        p_intent_id: body.intent_id,
        p_checkout_request_id: stkJson.CheckoutRequestID,
        p_merchant_request_id: stkJson.MerchantRequestID,
        p_provider_reference: stkJson.CheckoutRequestID,
      });

      return Response.json({ ok: true, checkout_request_id: stkJson.CheckoutRequestID });
    }

    // ---- Daraja callback ----
    const callback = (json as {
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
    }).Body?.stkCallback;

    if (callback?.CheckoutRequestID) {
      const { data: intents } = await supabase
        .from("payment_intents")
        .select("id")
        .eq("checkout_request_id", callback.CheckoutRequestID)
        .limit(1);

      const intentId = intents?.[0]?.id as string | undefined;
      if (!intentId) {
        return Response.json({ ok: false, error: "INTENT_NOT_FOUND" }, { status: 404 });
      }

      if (callback.ResultCode === 0) {
        const receipt = callback.CallbackMetadata?.Item?.find((i) =>
          i.Name === "MpesaReceiptNumber"
        )?.Value;

        await supabase.rpc("complete_payment_intent", {
          p_intent_id: intentId,
          p_provider_reference: String(receipt ?? callback.CheckoutRequestID),
          p_checkout_request_id: callback.CheckoutRequestID,
          p_metadata: { daraja: callback },
        });
      } else {
        await supabase.rpc("fail_payment_intent", {
          p_intent_id: intentId,
          p_error_message: callback.ResultDesc ?? "M-Pesa declined",
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
