// ─── Shared Types for Game Master Dashboard ──────────────────────────

export interface DashboardStats {
  totalReferredUsers: number;
  activeReferredUsers: number;
  totalCompetitions: number;
  activeCompetitions: number;
  /** Package concurrent cap — denominator for Active / Slots Left KPIs. */
  maxActiveCompetitions?: number;
  /** maxActiveCompetitions − activeCompetitions, floored at 0. */
  remainingActiveSlots?: number;
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
  minParticipants?: number;
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

/** Per-game earnings rollup from the dashboard API (X7 step 5). */
export interface EarningsByGameRow {
  gameKey: string;
  label: string;
  netEarning: number;
  count: number;
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
    maxActiveCompetitions?: number;
    maxUsersPerCompetition?: number;
    referralFeePercentage?: number;
    challengeReferralFeePercentage?: number;
  };
}
