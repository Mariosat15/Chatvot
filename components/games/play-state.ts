/**
 * The play state as the browser sees it.
 *
 * A SEPARATE, MODEL-FREE COPY OF THE SERVICE'S SHAPE, and the reason is a hard constraint
 * rather than a preference: `lib/services/games/round-status.service.ts` imports Mongoose
 * models, so a client component importing its types would pull the entire database layer into
 * the browser bundle. Re-declaring the shape is the standard answer to that.
 *
 * The risk it introduces is real and is the "one rule, two copies" trap, so it is pinned:
 * `__tests__/games/provider-play-ui.test.ts` compares the field names here against the service's
 * `PlayState` and fails if either side gains or loses one. Without that test the browser would
 * silently read `undefined` from a field the server had renamed.
 *
 * Dates are strings here because they crossed JSON. The service serialises them, so nothing on
 * this side should call `.toISOString()` on them.
 */

export interface PlayerRoundView {
  roundId: string;
  attemptNumber: number;
  status: string;
  /** Absent until the round is scored. Absent is NOT zero - zero is a real score. */
  score?: number;
  /** Display only. Never an input to ranking, on either side of the wire. */
  scoreBreakdown?: Record<string, unknown>;
  startedAt?: string;
  completedAt?: string;
  expiresAt: string;
  launchUrlExpiresAt?: string;
  replayUrl?: string;
  isLive: boolean;
}

export interface PlayState {
  contestStatus: string;
  gameKey?: string;
  attemptsPolicy: string;
  attemptsPermitted: number;
  attemptsUsed: number;
  attemptsRemaining: number;
  liveRound: PlayerRoundView | null;
  rounds: PlayerRoundView[];
  playWindowStart?: string;
  playWindowEnd?: string;
  participantScore: number;
}
