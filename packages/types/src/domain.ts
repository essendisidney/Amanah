import type {
  ContributionStatus,
  JamiyaStatus,
  KycStatus,
  MembershipRole,
  MembershipStatus,
  NotificationType,
  PayoutStatus,
  PlatformRole,
} from './enums';

export interface UserProfileSummary {
  id: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  platformRole: PlatformRole;
  kycStatus: KycStatus;
  profileCompleted: boolean;
}

export interface JamiyaSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: JamiyaStatus;
  contributionAmount: number;
  currency: string;
  cycleCount: number;
  memberCount: number;
  maxMembers: number;
  createdAt: string;
}

export interface MembershipSummary {
  id: string;
  jamiyaId: string;
  userId: string;
  role: MembershipRole;
  status: MembershipStatus;
  payoutPosition: number | null;
  joinedAt: string | null;
}

export interface ContributionSummary {
  id: string;
  jamiyaId: string;
  memberId: string;
  cycleNumber: number;
  amount: number;
  currency: string;
  status: ContributionStatus;
  dueDate: string;
  paidAt: string | null;
}

export interface PayoutSummary {
  id: string;
  jamiyaId: string;
  memberId: string;
  cycleNumber: number;
  amount: number;
  currency: string;
  status: PayoutStatus;
  scheduledDate: string;
  paidAt: string | null;
}

export interface WalletSummary {
  id: string;
  userId: string;
  balance: number;
  currency: string;
  updatedAt: string;
}

export interface NotificationSummary {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}
