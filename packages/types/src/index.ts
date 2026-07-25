/**
 * @jamiya/types
 *
 * Shared domain types and enums for the Amanah platform.
 * Database-generated types live in @jamiya/database; this package
 * holds application-level contracts shared across apps and packages.
 */

export type {
  PlatformRole,
  MembershipRole,
  MembershipStatus,
  JamiyaStatus,
  ContributionStatus,
  PayoutStatus,
  InvitationStatus,
  KycStatus,
  KycDocumentType,
  KycDocumentStatus,
  TransactionType,
  TransactionStatus,
  NotificationChannel,
  NotificationType,
  AuditAction,
} from './enums';

export type {
  ApiError,
  ApiResult,
  PaginatedResult,
  PaginationParams,
  SortParams,
} from './api';

export type {
  UserProfileSummary,
  JamiyaSummary,
  MembershipSummary,
  ContributionSummary,
  PayoutSummary,
  WalletSummary,
  NotificationSummary,
} from './domain';
