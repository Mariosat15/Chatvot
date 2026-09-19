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
import type { GameModule, ScoreDirection } from "@/lib/games/types";
import {
  allocateWithoutRoundingLoss,
  normalisePrizeShares,
} from "@/lib/utils/prize-shares";

/**
 * A participant being ranked, in any game.
 *
 * THE TRADING FIELDS ARE OPTIONAL AS OF X5, and finding that they were not is the third
 * instance of one defect. X1 added `score` to `RankableParticipant` and removed nothing,
 * which was right - but this is a DIFFERENT interface, and it still demanded eight trading
 * fields, so a provider participant could not be passed to `calculateRankings` at all.
 * `CompetitionParticipant` demanded three capital fields for the same reason. The rule:
 * when you add a field for a new case, check what the old fields still DEMAND. The
 * interesting requirement is always the one nobody touched.
 *
 * Making them optional is safe here because THE RANKING ENGINE READS NONE OF THEM. Every
 * ranking and tie-break value comes from `gameModule.getRankingValue`, so these fields
 * exist for the trading module to read and for three qualification and tie-split rules -
 * each of which now tolerates their absence rather than producing NaN.
 */
export interface ParticipantData {
  userId: string;
  username: string;
  status: string;
  enteredAt: Date;
  /** Trading. Absent for any game that does not run a virtual account. */
  currentCapital?: number;
  pnl?: number;
  pnlPercentage?: number;
  totalTrades?: number;
  winningTrades?: number;
  losingTrades?: number;
  winRate?: number;
  startingCapital?: number;
  /** Score-reporting games, including every provider title. */
  score?: number;
  /**
   * Which way this title's score sorts. Absent means higher is better.
   *
   * Typed as the union rather than `string` so this interface stays assignable to
   * `RankableParticipant`. A plain `string` compiles here and then fails at every call
   * into the game module, which is a confusing place to discover the real problem.
   */
  scoreDirection?: ScoreDirection;
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
 *
 * `hasResult` earns its place here for the same reason the other two are here and nothing
 * else is - it is a question about THIS PARTICIPANT'S metrics, answerable from the row in
 * front of it. Widening the narrowing was the fix rather than typing `checkQualification`
 * against the whole `GameModule`: that compiles just as well and quietly reopens the door
 * this type exists to hold shut.
 */
type ScoringModule = Pick<
  GameModule,
  "getRankingValue" | "getTieBreakerValue" | "hasResult"
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
  gameModule: ScoringModule,
  options?: RankingOptions,
): { qualified: boolean; reason?: string } {
  const isCompleted = options?.competitionStatus === "completed";

  /*
    AN EXPLICITLY DISQUALIFIED PARTICIPANT IS NOT PAID, and this check did not exist until
    9 September 2026 (owner's rule, task document 2 and 3).

    Say the exposure precisely, because it differs between the two contest shapes and a
    summary tends to average them. `"disqualified"` is a declared value on BOTH
    `CompetitionParticipant.status` and `ChallengeParticipant.status`. Nothing writes it on
    a competition participant today, so for competitions this was LATENT - an operator
    reaching for the status by hand, or any future admin control, would have found it
    decorative. `challenge-finalize.actions.ts` DOES write it on challenge participants,
    so there the missing check was live in the sense that the status could be set and this
    function would have ranked and paid the player anyway.

    UNCONDITIONAL, unlike liquidation. `disqualifyOnLiquidation` is an operator switch
    because "liquidated players still compete" is a legitimate contest variant; there is
    no reading of "disqualified" under which the player should still be paid, so offering
    a switch would be offering a way to pay somebody the platform has already excluded.

    Checked before every other rule so the REASON a player sees is the decision an
    operator actually took, rather than a downstream consequence of it - a disqualified
    trader with no trades should read "Disqualified", not "Insufficient trades (0/1)".

    Not gated on `isCompleted`, matching liquidation: unlike the minimum-trades and
    win-rate rules, this is not a target the player might still reach, so hiding it from a
    live leaderboard would show them as competing for a prize they cannot win.
  */
  if (participant.status === "disqualified") {
    return { qualified: false, reason: "Disqualified" };
  }

  // Check liquidation (always applies)
  if (rules.disqualifyOnLiquidation && participant.status === "liquidated") {
    return { qualified: false, reason: "Liquidated" };
  }

  /*
    NO RESULT, NO PRIZE - and until this existed, every check below was trading-shaped and
    provider contests had no qualification rule at all.

    Provider settlement legitimately passes `minimumTrades: 0` and
    `disqualifyOnLiquidation: false`, because a puzzle has neither. So nothing disqualified
    anybody: **a player who never launched a single round ranked on a fallback zero and was
    paid a prize.** With the owner's own 70/20/10 example and one real scorer, two players
    who never started took 30% of the pot between them, and when nobody scored at all the
    three of them tied at rank 1 and split the entire pot.

    Asked of the module rather than branched on here, because `if (gameType === "provider")`
    is the shape that makes the next game silently fail. Trading answers `true` - a flat
    account is a real result, and `minimumTrades` is the existing way to say otherwise.

    Only when the contest is COMPLETED, matching the two checks below: a live leaderboard
    must show a player who has not played yet as unplaced, not as disqualified.
  */
  if (isCompleted && !gameModule.hasResult(participant)) {
    return {
      qualified: false,
      reason: "No score recorded",
    };
  }

  // Check minimum trades - ONLY when competition is COMPLETED
  // During active competitions, users can still meet the requirement
  //
  // Reason for `?? 0`: a game with no trades must read as zero rather than undefined. The
  // comparison happened to be safe already (`undefined < n` is false), but the REASON
  // STRING was not - it would have told a player "Insufficient trades (undefined/0)".
  const tradeCount = participant.totalTrades ?? 0;
  if (isCompleted && tradeCount < rules.minimumTrades) {
    return {
      qualified: false,
      reason: `Insufficient trades (${tradeCount}/${rules.minimumTrades})`,
    };
  }

  // Check minimum win rate - ONLY when competition is COMPLETED
  const winRate = participant.winRate ?? 0;
  if (isCompleted && rules.minimumWinRate && winRate < rules.minimumWinRate) {
    return {
      qualified: false,
      reason: `Win rate too low (${winRate.toFixed(1)}% < ${rules.minimumWinRate}%)`,
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
    const qualification = checkQualification(p, rules, gameModule, options);
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
 *
 * REDISTRIBUTION IS PROPORTIONAL SINCE 9 SEPTEMBER 2026. This docblock used to say
 * "redistributes unclaimed prize positions EQUALLY among actual winners", which was an
 * accurate description of the code and is now the wrong rule - corrected in place rather
 * than reworded, because the next reader needs to know the payout changed rather than
 * that a sentence was tidied. The rule itself is `normalisePrizeShares`.
 *
 * ONE EFFECT WORTH KNOWING BEFORE IT SURPRISES SOMEBODY: a tie also vacates a rank, since
 * `calculateRankings` gives two tied players rank 1 and sends the next player to rank 3.
 * So the change reaches tie payouts as well as ineligible ones - there is no way for the
 * normalisation to tell "nobody eligible holds this rank" from "a tie skipped past it",
 * and inventing one would mean two redistribution rules. What was NOT changed is which
 * ranks a tied group absorbs: two players tied for first still share first place's share
 * alone, with second place's share normalised across everybody. Making a tied group
 * absorb the ranks it occupies is a defensible different rule and a third behaviour
 * change nobody asked for, so it is recorded here rather than smuggled in.
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

  /*
    Step 1: normalise the configured shares over the ranks an ELIGIBLE player holds.

    Owner's rule, 9 September 2026 (task document 5 and 6). This replaced an equal-share
    bonus: 50/30/20 with rank 3 vacated used to pay 60/40 and now pays 62.5/37.5, because
    proportional normalisation preserves the prize curve the operator configured instead
    of flattening it a little every time a position goes unclaimed.

    The rule lives in `prize-shares.ts` rather than here BECAUSE IT HAS A SECOND CONSUMER:
    `prize-projection.ts` renders what the lobby's prize table and the admin contest panel
    promise. Two copies of a redistribution rule means a lobby quoting one figure while
    settlement pays another - and the promise is the one the player read before paying.
  */
  const normalised = normalisePrizeShares(
    prizeDistribution,
    // Reason: `rank` comes from the contest's own prize table, not from a request, and the
    // linter cannot tell the two apart. Disabled inline, which is the convention already
    // used for this false positive in `app/arena/page.tsx` and `api-server/routes/`.
    // eslint-disable-next-line security/detect-object-injection
    (rank) => (rankGroups[rank]?.length ?? 0) > 0,
  );

  // Reason: the fee is taken off each winner's share rather than off the pot, which is
  // how this function has always worked (see the R30 note above). Kept as one helper so
  // the four tie branches below cannot disagree about the order of the arithmetic.
  const netOf = (percentage: number) =>
    ((grossPrizePool * percentage) / 100) * (1 - platformFeeFraction);

  /*
    Step 2: EXACT amounts first, rounding last.

    Collected unrounded and rounded in a single pass at the end, so the total is
    guaranteed rather than hoped for. Flooring each winner as it was computed - which is
    what this function used to do - lost up to a cent per winner, always in the platform's
    favour, which is the direction nobody reports.
  */
  const exact: {
    userId: string;
    amount: number;
    rank: number;
    isTied: boolean;
  }[] = [];

  normalised.shares.forEach((share) => {
    if (!share.filled) return;

    const winnersAtRank = rankGroups[share.rank] ?? [];
    const winnersCount = winnersAtRank.length;
    const groupNet = netOf(share.effectivePercentage);

    if (winnersCount === 1) {
      exact.push({
        userId: winnersAtRank[0].userId,
        amount: groupNet,
        rank: share.rank,
        isTied: false,
      });
      return;
    }

    if (rules.tiePrizeDistribution === "first_gets_all") {
      // First person by join time takes the whole group's share.
      const sorted = [...winnersAtRank].sort(
        (a, b) =>
          new Date(a.enteredAt).getTime() - new Date(b.enteredAt).getTime(),
      );

      exact.push({
        userId: sorted[0].userId,
        amount: groupNet,
        rank: share.rank,
        isTied: true,
      });
      return;
    }

    if (rules.tiePrizeDistribution === "split_weighted") {
      const totalWeight = winnersAtRank.reduce(
        (sum, w) => sum + (w.currentCapital ?? 0),
        0,
      );

      // Reason: weighting by capital divides by the group's total capital, so a game
      // with no capital - or a trading group where everyone is at zero - divides by zero
      // and every prize in the group becomes NaN. A NaN prize is not a behaviour worth
      // preserving, so an unweightable group falls back to an equal share. The
      // alternative silently writes NaN into a wallet transaction.
      const equalFallback = totalWeight <= 0;

      winnersAtRank.forEach((winner) => {
        const weight = equalFallback
          ? 1 / winnersCount
          : (winner.currentCapital ?? 0) / totalWeight;

        exact.push({
          userId: winner.userId,
          amount: groupNet * weight,
          rank: share.rank,
          isTied: true,
        });
      });
      return;
    }

    // "split_equally", and the default for anything unrecognised.
    winnersAtRank.forEach((winner) => {
      exact.push({
        userId: winner.userId,
        amount: groupNet / winnersCount,
        rank: share.rank,
        isTied: true,
      });
    });
  });

  /*
    Step 3: round to whole cents so the winners' total is exactly the distributable pot.

    THE TARGET IS A CAP, NOT A DISCREPANCY DETECTOR, and this comment used to claim the
    latter - that deriving it from `configuredTotal` rather than from summing the amounts
    above existed "to catch a discrepancy between the two". A probe disproved it: the two
    expressions agree to within 1e-13 on every input this function can construct, because
    `netOf` is linear and `normalisePrizeShares` guarantees the filled shares sum to
    `configuredTotal`. There is no discrepancy to catch.

    What the choice does buy is worth keeping. `netOf(configuredTotal)` is bounded by the
    net pot whatever the per-winner arithmetic did, so a share computed wrongly high is
    clamped here; summing the amounts would faithfully pay out whatever they happened to
    be. That cap is pinned by `ranking-regression.test.ts`'s "no scenario pays out more
    than its prize pool", across all 18 scenarios.
  */
  const targetTotal = exact.length > 0 ? netOf(normalised.configuredTotal) : 0;
  const rounded = allocateWithoutRoundingLoss(
    exact.map((e) => e.amount),
    targetTotal,
  );

  exact.forEach((e, index) => {
    distributions.push({
      userId: e.userId,
      // eslint-disable-next-line security/detect-object-injection -- forEach index
      prizeAmount: rounded[index],
      rank: e.rank,
      isTied: e.isTied,
    });
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
