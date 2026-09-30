/**
 * Enum aliases used across the app. The Database type is generated from the
 * live schema: run `pnpm gen:types` after adding a migration.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type PlatformRoleEnum =
  | 'member'
  | 'compliance_officer'
  | 'platform_admin'
  | 'super_admin';

export type KycStatusEnum =
  | 'not_started'
  | 'pending'
  | 'under_review'
  | 'approved'
  | 'rejected';

export type JamiyaStatusEnum =
  | 'draft'
  | 'open'
  | 'active'
  | 'paused'
  | 'suspended'
  | 'completed'
  | 'cancelled';

export type MembershipRoleEnum = 'member' | 'circle_admin';

export type MembershipStatusEnum =
  | 'invited'
  | 'active'
  | 'suspended'
  | 'left'
  | 'removed';

export type ContributionStatusEnum =
  | 'pending'
  | 'paid'
  | 'late'
  | 'waived'
  | 'failed'
  | 'partial';

export type PayoutStatusEnum = 'scheduled' | 'processing' | 'paid' | 'failed' | 'cancelled';

export type InvitationStatusEnum = 'pending' | 'accepted' | 'declined' | 'expired' | 'revoked';

export type TransactionTypeEnum =
  | 'contribution'
  | 'payout'
  | 'wallet_top_up'
  | 'wallet_withdrawal'
  | 'fee'
  | 'adjustment';

export type TransactionStatusEnum =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'reversed';

export type NotificationChannelEnum = 'in_app' | 'email' | 'sms' | 'push';

export type NotificationTypeEnum =
  | 'invitation'
  | 'contribution_due'
  | 'contribution_received'
  | 'payout_scheduled'
  | 'payout_paid'
  | 'kyc_update'
  | 'system'
  | 'admin';

export type AuditActionEnum =
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'invite'
  | 'join'
  | 'leave'
  | 'approve'
  | 'reject'
  | 'export'
  | 'role_change';

export type KycDocumentTypeEnum =
  | 'national_id'
  | 'passport'
  | 'driving_license'
  | 'proof_of_address'
  | 'selfie'
  | 'other';

export type KycDocumentStatusEnum = 'uploaded' | 'under_review' | 'approved' | 'rejected';

type Timestamps = {
  created_at: string;
  updated_at: string;
};

export type { Database } from './generated';
