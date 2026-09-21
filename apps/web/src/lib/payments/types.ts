/** Shared payment domain types — app talks to these, not to a PSP SDK. */

export type PaymentProviderId =
  | 'simulated'
  | 'mpesa'
  | 'bank'
  | 'paystack'
  | 'intasend'
  | 'tendepay';

export type PaymentDirection = 'collect' | 'disburse';

export type CollectMethod = 'stk' | 'checkout' | 'bank' | 'simulated';

export type DisburseMethod = 'mpesa_b2c' | 'mpesa_b2b' | 'bank' | 'simulated';

export type CollectPaymentInput = {
  intentId: string;
  amount: number;
  currency?: string;
  phone?: string | null;
  email?: string | null;
  userId?: string | null;
  description?: string;
  /** Prefer STK when the adapter supports it. */
  method?: CollectMethod;
  metadata?: Record<string, unknown>;
};

export type CollectPaymentResult =
  | {
      ok: true;
      provider: PaymentProviderId;
      status: 'completed' | 'processing' | 'redirect';
      checkoutRequestId?: string | null;
      providerReference?: string | null;
      customerMessage?: string | null;
      /** Browser redirect (e.g. Paystack Checkout). */
      redirectUrl?: string;
      fallback?: 'simulated';
    }
  | { ok: false; provider: PaymentProviderId; error: string };

export type DisbursePaymentInput = {
  /** Internal disbursement / withdrawal / treasury payout id (ledger truth). */
  disbursementId: string;
  amount: number;
  currency?: string;
  /** E.164 or 254… phone for B2C. Optional when method is mpesa_b2b / bank. */
  phone?: string;
  /** Paybill / Till shortcode when method is mpesa_b2b. */
  accountNumber?: string;
  beneficiaryName?: string;
  narrative?: string;
  method?: DisburseMethod;
  /** Paybill / Till when method is mpesa_b2b. */
  accountType?: 'Paybill' | 'TillNumber';
  accountReference?: string;
  metadata?: Record<string, unknown>;
};

export type DisbursePaymentResult =
  | {
      ok: true;
      provider: PaymentProviderId;
      status: 'processing' | 'completed';
      providerReference?: string | null;
      trackingId?: string | null;
      fallback?: 'simulated';
    }
  | { ok: false; provider: PaymentProviderId; error: string };

export type PaymentStatusResult = {
  ok: boolean;
  provider: PaymentProviderId;
  status?: 'pending' | 'processing' | 'success' | 'failed' | 'unknown';
  providerReference?: string | null;
  error?: string;
  raw?: unknown;
};
