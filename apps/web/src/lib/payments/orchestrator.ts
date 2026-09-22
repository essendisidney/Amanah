import type { PaymentAdapter } from './adapters/types';
import { simulatedAdapter } from './adapters/simulated';
import { darajaAdapter } from './adapters/daraja';
import { paystackAdapter } from './adapters/paystack';
import { intasendAdapter, isIntasendConfigured } from './adapters/intasend';
import { tendepayAdapter, isTendepayConfigured } from './adapters/tendepay';
import {
  bankAdapter,
  coopBankAdapter,
  kcbBankAdapter,
} from './adapters/bank-rails';
import { isPaystackConfigured } from '@/lib/payments/paystack';
import { paymentProvider } from './provider';
import type {
  CollectPaymentInput,
  CollectPaymentResult,
  DisbursePaymentInput,
  DisbursePaymentResult,
  PaymentProviderId,
  PaymentStatusResult,
} from './types';

/**
 * Payment orchestrator — features call these helpers, never a PSP SDK.
 *
 * Routing:
 * - PAYMENT_PROVIDER = simulated | mpesa | bank | coop | kcb | paystack | intasend | tendepay
 * - PAYMENT_COLLECT_PROVIDER / PAYMENT_DISBURSE_PROVIDER optional overrides
 */

export { paymentProvider };

const COLLECT_IDS = new Set<PaymentProviderId>([
  'mpesa',
  'paystack',
  'intasend',
  'tendepay',
  'bank',
  'coop',
  'kcb',
  'simulated',
]);

const DISBURSE_IDS = new Set<PaymentProviderId>([
  'mpesa',
  'intasend',
  'tendepay',
  'bank',
  'coop',
  'kcb',
  'simulated',
]);

export function collectProvider(): PaymentProviderId {
  const override = (process.env.PAYMENT_COLLECT_PROVIDER ?? '').toLowerCase();
  if (COLLECT_IDS.has(override as PaymentProviderId)) {
    return override as PaymentProviderId;
  }
  return paymentProvider();
}

export function disburseProvider(): PaymentProviderId {
  const override = (process.env.PAYMENT_DISBURSE_PROVIDER ?? '').toLowerCase();
  if (DISBURSE_IDS.has(override as PaymentProviderId)) {
    return override as PaymentProviderId;
  }
  // Prefer IntaSend for Kenya B2C when configured, even if collections are Paystack.
  if (isIntasendConfigured() && paymentProvider() === 'paystack') {
    return 'intasend';
  }
  if (isTendepayConfigured() && paymentProvider() === 'paystack') {
    return 'tendepay';
  }
  if (paymentProvider() === 'paystack') return 'mpesa';
  return paymentProvider();
}

function adapterFor(id: PaymentProviderId): PaymentAdapter {
  switch (id) {
    case 'paystack':
      return paystackAdapter;
    case 'mpesa':
      return darajaAdapter;
    case 'intasend':
      return intasendAdapter;
    case 'tendepay':
      return tendepayAdapter;
    case 'bank':
      return bankAdapter;
    case 'coop':
      return coopBankAdapter;
    case 'kcb':
      return kcbBankAdapter;
    default:
      return simulatedAdapter;
  }
}

export function getAdapter(id?: PaymentProviderId): PaymentAdapter {
  return adapterFor(id ?? paymentProvider());
}

export async function collectPayment(
  input: CollectPaymentInput,
  provider?: PaymentProviderId,
): Promise<CollectPaymentResult> {
  const id = provider ?? collectProvider();
  const primary = await collectVia(id, input);
  if (primary.ok) return primary;

  const failover = failoverCollectProvider(id);
  if (!failover || failover === id) return primary;
  // Skip failover on validation / config errors
  if (isNonRetriablePaymentError(primary.error)) return primary;

  const secondary = await collectVia(failover, input);
  if (secondary.ok) return secondary;
  return {
    ok: false,
    provider: id,
    error: `${primary.error} (failover ${failover}: ${secondary.error})`,
  };
}

export async function disbursePayment(
  input: DisbursePaymentInput,
  provider?: PaymentProviderId,
): Promise<DisbursePaymentResult> {
  const id = provider ?? disburseProvider();
  const primary = await disburseVia(id, input);
  if (primary.ok) return primary;

  const failover = failoverDisburseProvider(id);
  if (!failover || failover === id) return primary;
  if (isNonRetriablePaymentError(primary.error)) return primary;

  const secondary = await disburseVia(failover, input);
  if (secondary.ok) return secondary;
  return {
    ok: false,
    provider: id,
    error: `${primary.error} (failover ${failover}: ${secondary.error})`,
  };
}

async function collectVia(
  id: PaymentProviderId,
  input: CollectPaymentInput,
): Promise<CollectPaymentResult> {
  const adapter = adapterFor(id);
  if (!adapter.isConfigured() && id !== 'simulated') {
    return {
      ok: false,
      provider: id,
      error: `${id} adapter is not configured.`,
    };
  }
  return adapter.collect(input);
}

async function disburseVia(
  id: PaymentProviderId,
  input: DisbursePaymentInput,
): Promise<DisbursePaymentResult> {
  const adapter = adapterFor(id);
  if (!adapter.isConfigured() && id !== 'simulated') {
    return {
      ok: false,
      provider: id,
      error: `${id} adapter is not configured.`,
    };
  }
  return adapter.disburse(input);
}

function failoverCollectProvider(
  primary: PaymentProviderId,
): PaymentProviderId | null {
  const raw = (process.env.PAYMENT_FAILOVER_COLLECT ?? '').toLowerCase();
  if (COLLECT_IDS.has(raw as PaymentProviderId)) {
    return raw as PaymentProviderId;
  }
  // Default: IntaSend / TendePay / Paystack → Daraja when Edge is reachable
  if (
    (primary === 'intasend' || primary === 'tendepay' || primary === 'paystack') &&
    darajaAdapter.isConfigured()
  ) {
    return 'mpesa';
  }
  return null;
}

function failoverDisburseProvider(
  primary: PaymentProviderId,
): PaymentProviderId | null {
  const raw = (process.env.PAYMENT_FAILOVER_DISBURSE ?? '').toLowerCase();
  if (DISBURSE_IDS.has(raw as PaymentProviderId)) {
    return raw as PaymentProviderId;
  }
  if (
    (primary === 'intasend' || primary === 'tendepay') &&
    darajaAdapter.isConfigured()
  ) {
    return 'mpesa';
  }
  return null;
}

function isNonRetriablePaymentError(error: string): boolean {
  const e = error.toLowerCase();
  return (
    e.includes('phone') ||
    e.includes('e.164') ||
    e.includes('invalid_amount') ||
    e.includes('not configured') ||
    e.includes('required')
  );
}

export async function getPaymentStatus(
  reference: string,
  provider?: PaymentProviderId,
): Promise<PaymentStatusResult> {
  const id = provider ?? collectProvider();
  return adapterFor(id).getStatus(reference);
}

export function orchestratorHealth(): {
  collect: PaymentProviderId;
  disburse: PaymentProviderId;
  failoverCollect: PaymentProviderId | null;
  failoverDisburse: PaymentProviderId | null;
  adapters: Record<PaymentProviderId, { configured: boolean }>;
  bakeOff?: {
    intasend: boolean;
    tendepay: boolean;
    note: string;
  };
} {
  const collect = collectProvider();
  const disburse = disburseProvider();
  return {
    collect,
    disburse,
    failoverCollect: failoverCollectProvider(collect),
    failoverDisburse: failoverDisburseProvider(disburse),
    adapters: {
      simulated: { configured: true },
      mpesa: { configured: darajaAdapter.isConfigured() },
      bank: { configured: Boolean(process.env.BANK_API_URL && process.env.BANK_API_KEY) },
      paystack: { configured: isPaystackConfigured() },
      intasend: { configured: isIntasendConfigured() },
      tendepay: { configured: isTendepayConfigured() },
    },
    bakeOff: {
      intasend: isIntasendConfigured(),
      tendepay: isTendepayConfigured(),
      note: 'Flip PAYMENT_PROVIDER=intasend|tendepay in staging; compare STK + B2C latency and settlement. Daraja is default failover.',
    },
  };
}

export { appBaseUrl } from './provider';
