/**
 * What the practice area shows about one of the player's own practice rounds.
 *
 * Model-free so the client host can import it (R58); `practice-round.service.ts` builds it.
 */
export interface PracticeRoundView {
  roundId: string;
  status: string;
  isLive: boolean;
  /** Absent until scored. Absent is NOT zero. */
  score?: number;
  scoreBreakdown?: Record<string, unknown>;
  completedAt?: string;
}
