/** Platform-wide RBAC roles (stored in profiles / app_metadata — never user_metadata). */
export type PlatformRole =
  | 'member'
  | 'compliance_officer'
  | 'platform_admin'
  | 'super_admin';

/** Role within a specific savings circle. */
export type MembershipRole = 'member' | 'circle_admin' | 'treasurer' | 'secretary' | 'chair';

export type MembershipStatus = 'invited' | 'active' | 'suspended' | 'left' | 'removed';

export type JamiyaStatus =
  | 'draft'
  | 'open'
  | 'active'
  | 'paused'
  | 'completed'
  | 'cancelled';

export type ContributionStatus = 'pending' | 'paid' | 'late' | 'waived' | 'failed' | 'partial';

export type PayoutStatus = 'scheduled' | 'processing' | 'paid' | 'failed' | 'cancelled';

export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'revoked';

export type KycStatus = 'not_started' | 'pending' | 'under_review' | 'approved' | 'rejected';

export type KycDocumentType =
  | 'national_id'
  | 'passport'
  | 'driving_license'
  | 'proof_of_address'
  | 'selfie'
  | 'other';

export type KycDocumentStatus = 'uploaded' | 'under_review' | 'approved' | 'rejected';

export type TransactionType =
  | 'contribution'
  | 'payout'
  | 'wallet_top_up'
  | 'wallet_withdrawal'
  | 'fee'
  | 'adjustment';

export type TransactionStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'reversed';

export type NotificationChannel = 'in_app' | 'email' | 'sms' | 'push';

export type NotificationType =
  | 'invitation'
  | 'contribution_due'
  | 'contribution_received'
  | 'payout_scheduled'
  | 'payout_paid'
  | 'kyc_update'
  | 'system'
  | 'admin';

export type AuditAction =
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
