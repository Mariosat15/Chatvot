// ─── Shared Types for Game Master Dashboard ──────────────────────────

export interface DashboardStats {
  totalReferredUsers: number;
  activeReferredUsers: number;
  totalCompetitions: number;
  activeCompetitions: number;
  completedCompetitions: number;
  totalEarnings: number;
  paidEarnings: number;
  pendingEarnings: number;
  totalTransactions: number;
}

export interface CompetitionItem {
  id: string;
  name: string;
  status: string;
  participants: number;
  maxParticipants: number;
  prizePool: number;
  entryFee: number;
  startTime: string;
  endTime: string;
  createdAt: string;
}

export interface EarningItem {
  id: string;
  sourceType: string;
  sourceName: string;
  referredUserName: string;
  entryFeeAmount: number;
  netEarning: number;
  status: string;
  createdAt: string;
}

export interface ReferralItem {
  _id: string;
  name: string;
  email: string;
  createdAt: string;
  isActive?: boolean;
}

export interface SubscriptionData {
  _id: string;
  packageName?: string;
  status?: string;
  referralCode?: string;
  startDate?: string;
  endDate?: string;
  autoRenew?: boolean;
  renewalPrice?: number;
  isPaused?: boolean;
  scheduledForDeletion?: boolean;
  canCreateCompetitions: boolean;
  canEarnFromChallenges: boolean;
  currentPeriodCompetitionsCreated?: number;
  totalCompetitionsCreated?: number;
  limits: {
    maxCompetitionsPerDay?: number;
    maxUsersPerCompetition?: number;
    referralFeePercentage?: number;
    challengeReferralFeePercentage?: number;
  };
}
