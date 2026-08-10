import type {
  ContributionStatusEnum,
  JamiyaStatusEnum,
  MembershipRoleEnum,
  MembershipStatusEnum,
  NotificationTypeEnum,
  PayoutStatusEnum,
} from '@jamiya/database';

export type DashboardProfile = {
  full_name: string | null;
  email: string | null;
  platform_role: string;
  kyc_status: string;
  profile_completed: boolean;
};

export type DashboardJamiya = {
  membershipId: string;
  role: MembershipRoleEnum;
  status: MembershipStatusEnum;
  payoutPosition: number | null;
  jamiya: {
    id: string;
    name: string;
    slug: string;
    status: JamiyaStatusEnum;
    contributionAmount: number;
    currency: string;
    maxMembers: number;
    memberCount: number;
    cycleCount: number;
    currentCycle: number;
    startDate: string | null;
  };
};

export type DashboardContribution = {
  id: string;
  cycleNumber: number;
  amount: number;
  amountPaid: number;
  currency: string;
  status: ContributionStatusEnum;
  dueDate: string;
  jamiyaName: string;
  jamiyaSlug: string;
  jamiyaId: string;
};

export type DashboardPayout = {
  id: string;
  cycleNumber: number;
  amount: number;
  currency: string;
  status: PayoutStatusEnum;
  scheduledDate: string;
  jamiyaName: string;
  jamiyaSlug: string;
  jamiyaId: string;
};

export type DashboardNotification = {
  id: string;
  type: NotificationTypeEnum;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

export type DashboardWallet = {
  id: string;
  balance: number;
  availableBalance: number;
  currency: string;
};

export type DashboardData = {
  profile: DashboardProfile | null;
  jamiyas: DashboardJamiya[];
  contributions: DashboardContribution[];
  payouts: DashboardPayout[];
  notifications: DashboardNotification[];
  wallet: DashboardWallet | null;
  unreadNotificationCount: number;
  stats: {
    activeCircles: number;
    pendingContributions: number;
    upcomingPayouts: number;
  };
};
