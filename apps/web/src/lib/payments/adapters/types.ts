import type {
  CollectPaymentInput,
  CollectPaymentResult,
  DisbursePaymentInput,
  DisbursePaymentResult,
  PaymentProviderId,
  PaymentStatusResult,
} from '../types';

/** One PSP behind the orchestrator. UI/features never import these directly. */
export type PaymentAdapter = {
  id: PaymentProviderId;
  isConfigured(): boolean;
  collect(input: CollectPaymentInput): Promise<CollectPaymentResult>;
  disburse(input: DisbursePaymentInput): Promise<DisbursePaymentResult>;
  getStatus(reference: string): Promise<PaymentStatusResult>;
};
