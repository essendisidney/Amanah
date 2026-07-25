/**
 * @jamiya/database
 *
 * Supabase client factories and typed database contracts.
 * Generated schema types are merged once `supabase gen types` runs.
 */

export type {
  Database,
  Json,
  PlatformRoleEnum,
  KycStatusEnum,
  JamiyaStatusEnum,
  MembershipRoleEnum,
  MembershipStatusEnum,
  ContributionStatusEnum,
  PayoutStatusEnum,
  InvitationStatusEnum,
  TransactionTypeEnum,
  TransactionStatusEnum,
  NotificationChannelEnum,
  NotificationTypeEnum,
  AuditActionEnum,
  KycDocumentTypeEnum,
  KycDocumentStatusEnum,
} from './types';
export { getSupabaseEnv, type SupabasePublicEnv } from './env';
