/**
 * Competition Ranking Service
 * Handles all ranking calculations, tie-breaking, and qualification logic
 *
 * X1 seam 1: this file owns qualification, sorting, tie detection, rank assignment and
 * prize distribution - the parts that are the same whatever the game. What a score MEANS
 * is the game's business, so the two metric switches that used to live here now live in
 * the game modules and are reached through the registry.
 *
 * Invariant 1: this file must never import a specific game folder. It imports the
 * registry, which is what makes a game replaceable.
 */

import { getGameModuleOrTrading } from "@/lib/games/registry";
import type { GameModule } from "@/lib/games/types";

export interface ParticipantData {
  userId: string;
  username: string;
  currentCapital: number;
  pnl: number;
  pnlPercentage: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  status: string;
  enteredAt: Date;
  startingCapital: number;
}

export interface RankedParticipant extends ParticipantData {
  rank: number;
  isTied: boolean;
  tiedWith?: string[]; // User IDs of tied participants
  qualificationStatus: "qualified" | "disqualified";
  disqualificationReason?: string;
}

export interface CompetitionRules {
  rankingMethod:
    | "pnl"
    | "roi"
    | "total_capital"
    | "win_rate"
    | "total_wins"
    | "profit_factor";
  tieBreaker1:
    | "trades_count"
    | "win_rate"
    | "total_capital"
    | "roi"
    | "join_time"
    | "split_prize";
  tieBreaker2?:
    | "trades_count"
    | "win_rate"
    | "total_capital"
    | "roi"
    | "join_time"
    | "split_prize";
  minimumTrades: number;
  minimumWinRate?: number;
  tiePrizeDistribution: "split_equally" | "split_weighted" | "first_gets_all";
  disqualifyOnLiquidation: boolean;
}

export interface RankingOptions {
  competitionStatus?: "upcoming" | "active" | "completed" | "cancelled";
  /**
   * Which game module interprets the ranking metrics.
   *
   * Optional and absent means trading, so every pre-X1 caller keeps its exact behaviour
   * without being touched. Invariant 5: an absent label reads as trading.
   */
  gameType?: string;
}

/**
 * The scoring half of a game module - the only part ranking needs.
 *
 * Reason for narrowing it rather than passing the whole module: it documents that ranking
 * reads no capabilities and consults no flags, so nobody later adds an
 * "is this game enabled" check into a sort comparator.
 */
type ScoringModule = Pick<
  GameModule,
  "getRankingValue" | "getTieBreakerValue"
>;

/**
 * Resolve which module interprets this contest's metrics.
 *
 * THROWS on an unknown game type, and that is deliberate in a function which otherwise
 * has no error channel. The alternative is to fall back to trading, which would read
 * every provider score as zero, tie the whole field at rank 1 and split the pool between
 * players who did not win it - silently, with the page still rendering. Aborting
 * finalization is recoverable; paying the wrong people is not. Callers are server actions
 * that already catch and return `{ success: false }`.
 */
function resolveScoringModule(gameType?: string): ScoringModule {
  const gameModule = getGameModuleOrTrading(gameType);

  if (!gameModule) {
    throw new Error(
      `Cannot rank a contest for unknown game type "${gameType}". No module is registered for it, and ranking it as trading would pay the wrong players.`,
    );
  }

  return gameModule;
}

/**
 * Check if two participants are truly tied (same stats across ALL relevant criteria)
 * This ensures players with identical performance get the same rank/badge
 */
function areParticipantsTied(
  a: ParticipantData,
  b: ParticipantData,
  rules: CompetitionRules,
  gameModule: ScoringModule,
): boolean {
  const epsilon = 0.0001;

  // Compare primary ranking value
  const aValue = gameModule.getRankingValue(a, rules.rankingMethod);
  const bValue = gameModule.getRankingValue(b, rules.rankingMethod);
  if (Math.abs(aValue - bValue) >= epsilon) return false;

  // Compare tiebreaker 1 (if not split_prize)
  if (rules.tieBreaker1 && rules.tieBreaker1 !== "split_prize") {
    const aTie1 = gameModule.getTieBreakerValue(a, rules.tieBreaker1);
    const bTie1 = gameModule.getTieBreakerValue(b, rules.tieBreaker1);
    if (Math.abs(aTie1 - bTie1) >= epsilon) return false;
  }

  // Compare tiebreaker 2 (if exists and not split_prize)
  if (rules.tieBreaker2 && rules.tieBreaker2 !== "split_prize") {
    const aTie2 = gameModule.getTieBreakerValue(a, rules.tieBreaker2);
    const bTie2 = gameModule.getTieBreakerValue(b, rules.tieBreaker2);
    if (Math.abs(aTie2 - bTie2) >= epsilon) return false;
  }

  // All criteria match - truly tied!
  return true;
}

/**
 * Check if participant qualifies for prizes
 * NOTE: Minimum trades are only checked when competition is COMPLETED
 * During active competitions, we show warnings but don't disqualify yet
 */
function checkQualification(
  participant: ParticipantData,
  rules: CompetitionRules,
  options?: RankingOptions,
): { qualified: boolean; reason?: string } {
  const isCompleted = options?.competitionStatus === "completed";

  // Check liquidation (always applies)
  if (rules.disqualifyOnLiquidation && participant.status === "liquidated") {
    return { qualified: false, reason: "Liquidated" };
  }

  // Check minimum trades - ONLY when competition is COMPLETED
  // During active competitions, users can still meet the requirement
  if (isCompleted && participant.totalTrades < rules.minimumTrades) {
    return {
      qualified: false,
      reason: `Insufficient trades (${participant.totalTrades}/${rules.minimumTrades})`,
    };
  }

  // Check minimum win rate - ONLY when competition is COMPLETED
  if (
    isCompleted &&
    rules.minimumWinRate &&
    participant.winRate < rules.minimumWinRate
  ) {
    return {
      qualified: false,
      reason: `Win rate too low (${participant.winRate.toFixed(1)}% < ${rules.minimumWinRate}%)`,
    };
  }

  return { qualified: true };
}

/**
 * Main ranking function with tie-breaking logic
 * @param options.competitionStatus - Only checks min trades/win rate when 'completed'
 */
export function calculateRankings(
  participants: ParticipantData[],
  rules: CompetitionRules,
  options?: RankingOptions,
): RankedParticipant[] {
  // Resolved once, not per comparison: the sort comparator runs O(n log n) times.
  const gameModule = resolveScoringModule(options?.gameType);

  // Step 1: Check qualifications (min trades only checked when competition is completed)
  const qualifiedParticipants = participants.map((p) => {
    const qualification = checkQualification(p, rules, options);
    return {
      ...p,
      rank: 0, // Will be assigned later
      isTied: false,
      tiedWith: [] as string[], // Track tied participants
      qualificationStatus: qualification.qualified
        ? ("qualified" as const)
        : ("disqualified" as const),
      disqualificationReason: qualification.reason,
    };
  });

  // Separate qualified and disqualified
  const qualified = qualifiedParticipants.filter(
    (p) => p.qualificationStatus === "qualified",
  );
  const disqualified = qualifiedParticipants.filter(
    (p) => p.qualificationStatus === "disqualified",
  );

  // Step 2: Sort qualified participants
  // Use epsilon for floating point comparisons to handle precision issues
  const sortEpsilon = 0.01; // $0.01 difference is negligible for ranking purposes

  qualified.sort((a, b) => {
    // Primary ranking method
    const aValue = gameModule.getRankingValue(a, rules.rankingMethod);
    const bValue = gameModule.getRankingValue(b, rules.rankingMethod);

    // Use epsilon comparison for floating point values
    if (Math.abs(aValue - bValue) >= sortEpsilon) {
      return bValue - aValue; // Higher is better (descending)
    }

    // Tie on primary! Apply tiebreaker 1
    if (rules.tieBreaker1 !== "split_prize") {
      const aTie1 = gameModule.getTieBreakerValue(a, rules.tieBreaker1);
      const bTie1 = gameModule.getTieBreakerValue(b, rules.tieBreaker1);

      // Use epsilon for floating-point tiebreakers (win_rate, roi)
      // Use 0.5 threshold for integer-like values (trades_count, join_time)
      const tie1Epsilon = ["win_rate", "roi", "total_capital"].includes(
        rules.tieBreaker1,
      )
        ? 0.01
        : 0.5;
      if (Math.abs(aTie1 - bTie1) >= tie1Epsilon) {
        return bTie1 - aTie1; // Higher is better (for trades_count, value is negative so fewer trades wins)
      }
    }

    // Still tied! Apply tiebreaker 2
    if (rules.tieBreaker2 && rules.tieBreaker2 !== "split_prize") {
      const aTie2 = gameModule.getTieBreakerValue(a, rules.tieBreaker2);
      const bTie2 = gameModule.getTieBreakerValue(b, rules.tieBreaker2);

      const tie2Epsilon = ["win_rate", "roi", "total_capital"].includes(
        rules.tieBreaker2,
      )
        ? 0.01
        : 0.5;
      if (Math.abs(aTie2 - bTie2) >= tie2Epsilon) {
        return bTie2 - aTie2;
      }
    }

    // Ultimate tiebreaker: join time (earlier is better)
    return new Date(a.enteredAt).getTime() - new Date(b.enteredAt).getTime();
  });

  // Step 3: Assign ranks and detect TRUE ties (same across ALL criteria)
  let currentRank = 1;
  let skipCount = 0; // Track how many positions to skip after ties

  // Reason: every index in this loop is a counter bounded by `qualified.length` on a
  // local array, so no caller-supplied key can reach these lookups. Suppressed as a
  // block rather than refactored to `.at()` because the walk-back below relies on its
  // `break` to stop at a differing rank, and rank decides the prize split.
  /* eslint-disable security/detect-object-injection */
  for (let i = 0; i < qualified.length; i++) {
    const current = qualified[i];

    // Check if tied with previous (using comprehensive comparison)
    if (i > 0) {
      const previous = qualified[i - 1];

      // Use the comprehensive tie detection that checks ALL criteria
      const isTied = areParticipantsTied(current, previous, rules, gameModule);

      if (isTied) {
        // Truly tied! Use same rank as previous
        current.rank = previous.rank;
        current.isTied = true;
        previous.isTied = true;
        skipCount++; // Skip this position for next non-tied participant

        // Track who they're tied with (collect all tied participants)
        // Add all previous tied participants to current's list
        current.tiedWith.push(previous.userId);
        if (previous.tiedWith.length > 0) {
          previous.tiedWith.forEach((id: string) => {
            if (!current.tiedWith.includes(id)) {
              current.tiedWith.push(id);
            }
          });
        }

        // Add current to previous's list
        previous.tiedWith.push(current.userId);

        // Update all previously tied participants to include current
        for (let j = i - 2; j >= 0; j--) {
          if (qualified[j].rank === current.rank && qualified[j].isTied) {
            if (!qualified[j].tiedWith.includes(current.userId)) {
              qualified[j].tiedWith.push(current.userId);
            }
            if (!current.tiedWith.includes(qualified[j].userId)) {
              current.tiedWith.push(qualified[j].userId);
            }
          } else {
            break; // Stop when we hit a different rank
          }
        }
      } else {
        // Not tied - assign next available rank (accounting for skipped positions)
        currentRank = previous.rank + skipCount + 1;
        current.rank = currentRank;
        current.isTied = false;
        skipCount = 0;
      }
    } else {
      // First participant
      current.rank = 1;
      current.isTied = false;
      currentRank = 1;
    }
  }
  /* eslint-enable security/detect-object-injection */

  // Step 4: Assign disqualified ranks (after all qualified)
  disqualified.forEach((p, index) => {
    p.rank = qualified.length + index + 1;
  });

  // Combine and return
  return [...qualified, ...disqualified];
}

/**
 * Calculate prize distribution with tie handling
 * FIXED: Now calculates from GROSS prize pool and deducts platform fee from each winner
 * FIXED: Redistributes unclaimed prize positions equally among actual winners
 *
 * @param platformFeeFraction A FRACTION, not a percentage: pass 0.1 for a 10% fee.
 *   Renamed from `platformFeePercentage` on 4 Sep 2026 (risk R30). The old name was
 *   wrong and dangerous: the maths below is `grossPrize * (1 - fee)`, so a caller who
 *   trusted the name and passed 10 for "10%" got a multiplier of -9 and paid every
 *   winner a NEGATIVE prize. Both callers were already correct; the name was not.
 */
export function distributePrizesWithTies(
  rankedParticipants: RankedParticipant[],
  prizeDistribution: { rank: number; percentage: number }[],
  grossPrizePool: number, // CHANGED: Now receives GROSS prize pool
  rules: CompetitionRules,
  platformFeeFraction: number = 0, // A fraction: 0.1 means 10%. See R30 above.
): { userId: string; prizeAmount: number; rank: number; isTied: boolean }[] {
  // Reason: a percentage passed here silently inverts every payout, so the unit is
  // checked rather than trusted. This can never reject valid data - both competition and
  // challenge schemas cap platformFeePercentage at `max: 50`, so a correctly converted
  // fraction is at most 0.5. Anything above 1 is a unit error by construction.
  // Throwing aborts finalization, which is retryable; paying negative prizes is not.
  if (
    !Number.isFinite(platformFeeFraction) ||
    platformFeeFraction < 0 ||
    platformFeeFraction > 1
  ) {
    throw new Error(
      `Platform fee must be a fraction between 0 and 1, received ${platformFeeFraction}. Pass 0.1 for a 10% fee, not 10 - a percentage here would pay negative prizes.`,
    );
  }

  const distributions: {
    userId: string;
    prizeAmount: number;
    rank: number;
    isTied: boolean;
  }[] = [];

  // Group qualified participants by rank to handle ties
  const rankGroups: { [rank: number]: RankedParticipant[] } = {};
  const qualifiedParticipants = rankedParticipants.filter(
    (p) => p.qualificationStatus === "qualified",
  );

  qualifiedParticipants.forEach((p) => {
    if (!rankGroups[p.rank]) rankGroups[p.rank] = [];
    rankGroups[p.rank].push(p);
  });

  // Step 1: Calculate which prize positions are filled and which are unclaimed
  let unclaimedPercentage = 0;
  const filledPrizePositions: {
    rank: number;
    percentage: number;
    winners: RankedParticipant[];
  }[] = [];

  prizeDistribution.forEach((dist) => {
    const winnersAtRank = rankGroups[dist.rank] || [];

    if (winnersAtRank.length === 0) {
      // No one at this rank - add percentage to unclaimed pool
      unclaimedPercentage += dist.percentage;
    } else {
      // Winners exist at this rank
      filledPrizePositions.push({
        rank: dist.rank,
        percentage: dist.percentage,
        winners: winnersAtRank,
      });
    }
  });

  // Step 2: Calculate bonus percentage per filled winner from unclaimed pool
  // Distribute unclaimed percentage equally among ALL actual winners
  const totalActualWinners = filledPrizePositions.reduce(
    (sum, pos) => sum + pos.winners.length,
    0,
  );
  const bonusPercentagePerWinner =
    totalActualWinners > 0 ? unclaimedPercentage / totalActualWinners : 0;

  // Step 3: Distribute prizes with bonus
  filledPrizePositions.forEach((pos) => {
    const winnersAtRank = pos.winners;

    // Calculate base percentage + bonus for each winner at this rank
    const basePercentage = pos.percentage;
    const winnersCount = winnersAtRank.length;

    // For ties at the same rank, they already split the base percentage
    // Plus each winner gets bonus from unclaimed pool
    const perWinnerBasePercentage = basePercentage / winnersCount;
    const totalPercentagePerWinner =
      perWinnerBasePercentage + bonusPercentagePerWinner;

    if (winnersCount === 1) {
      // Single winner at this rank
      const grossPrize =
        (grossPrizePool * (basePercentage + bonusPercentagePerWinner)) / 100;
      const netPrize = grossPrize * (1 - platformFeeFraction);
      const prizeAmount = Math.floor(netPrize * 100) / 100;

      distributions.push({
        userId: winnersAtRank[0].userId,
        prizeAmount,
        rank: pos.rank,
        isTied: false,
      });
    } else {
      // Multiple winners tied at this rank
      if (rules.tiePrizeDistribution === "split_equally") {
        // Split base percentage equally, plus each gets bonus
        winnersAtRank.forEach((winner) => {
          const grossPrize = (grossPrizePool * totalPercentagePerWinner) / 100;
          const netPrize = grossPrize * (1 - platformFeeFraction);
          const prizeAmount = Math.floor(netPrize * 100) / 100;

          distributions.push({
            userId: winner.userId,
            prizeAmount,
            rank: pos.rank,
            isTied: true,
          });
        });
      } else if (rules.tiePrizeDistribution === "first_gets_all") {
        // First person (by join time) gets all (base + all bonuses for this rank)
        const sorted = winnersAtRank.sort(
          (a, b) =>
            new Date(a.enteredAt).getTime() - new Date(b.enteredAt).getTime(),
        );
        const totalGroupPercentage =
          basePercentage + bonusPercentagePerWinner * winnersCount;
        const grossPrize = (grossPrizePool * totalGroupPercentage) / 100;
        const netPrize = grossPrize * (1 - platformFeeFraction);
        const prizeAmount = Math.floor(netPrize * 100) / 100;

        distributions.push({
          userId: sorted[0].userId,
          prizeAmount,
          rank: pos.rank,
          isTied: true,
        });
      } else if (rules.tiePrizeDistribution === "split_weighted") {
        // Split based on secondary metrics (e.g., capital)
        const totalWeight = winnersAtRank.reduce(
          (sum, w) => sum + w.currentCapital,
          0,
        );
        // Total pool for this group: base + all bonuses
        const totalGroupPercentage =
          basePercentage + bonusPercentagePerWinner * winnersCount;

        winnersAtRank.forEach((winner) => {
          const weight = winner.currentCapital / totalWeight;
          const grossPrize =
            (grossPrizePool * totalGroupPercentage * weight) / 100;
          const netPrize = grossPrize * (1 - platformFeeFraction);
          const prizeAmount = Math.floor(netPrize * 100) / 100;

          distributions.push({
            userId: winner.userId,
            prizeAmount,
            rank: pos.rank,
            isTied: true,
          });
        });
      }
    }
  });

  return distributions;
}

/**
 * Get ranking method description
 */
export function getRankingMethodDescription(method: string): string {
  const descriptions = {
    pnl: "Highest Profit/Loss (P&L)",
    roi: "Highest Return on Investment (ROI %)",
    total_capital: "Highest Total Capital",
    win_rate: "Highest Win Rate %",
    total_wins: "Most Winning Trades",
    profit_factor: "Best Profit Factor",
  };
  return descriptions[method as keyof typeof descriptions] || method;
}

/**
 * Get tiebreaker description
 */
export function getTieBreakerDescription(tieBreaker: string): string {
  const descriptions = {
    trades_count: "Fewer trades (more efficient)",
    win_rate: "Higher win rate",
    total_capital: "Higher total capital",
    roi: "Higher ROI %",
    join_time: "Who joined first",
    split_prize: "Split prize equally",
  };
  return descriptions[tieBreaker as keyof typeof descriptions] || tieBreaker;
}
