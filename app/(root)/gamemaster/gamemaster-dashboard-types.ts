// ─── Shared Types for Game Master Dashboard ──────────────────────────

import type { GmReferralView } from "@/lib/services/gamemaster/gm-referral-view";
import type { GmContestKind } from "@/lib/utils/gm-contest-kind";

export interface DashboardStats {
  totalReferredUsers: number;
  activeReferredUsers: number;
  ownReferrals?: number;
  externalReferrals?: number;
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
  /** Normal / Private / Funded, resolved server-side by `gmContestKind`. */
  kind?: GmContestKind;
}

export interface EarningItem {
  id: string;
  /** Kind of the source competition; `null` for a challenge earning or a deleted contest. */
  kind?: GmContestKind | null;
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

// Reason: the dashboard route maps every row through `toGameMasterReferralView`, so the screen
// types the same shape rather than a second hand-written copy that could re-admit the email.
export type ReferralItem = GmReferralView;

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
