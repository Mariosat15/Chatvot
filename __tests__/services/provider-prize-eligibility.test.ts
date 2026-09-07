import { describe, it, expect } from "vitest";
import {
  calculateRankings,
  distributePrizesWithTies,
  type CompetitionRules,
  type ParticipantData,
} from "@/lib/services/competition-ranking.service";

/**
 * WHO IS ELIGIBLE FOR A PRIZE IN A PROVIDER CONTEST, which is the owner's question:
 * "if no winner meaning no score for anyone all loose", and "the 10% split among the 2".
 *
 * THE DEFECT THIS FILE WAS WRITTEN TO PROVE. `checkQualification` is entirely
 * trading-shaped - liquidation, `minimumTrades`, `minimumWinRate` - and provider settlement
 * passes `minimumTrades: 0` with `disqualifyOnLiquidation: false`, because a puzzle has no
 * trades and no liquidation. So **nothing disqualified anybody**, and a player who never
 * launched a single round was ranked as a genuine zero and **paid a prize.** With 70/20/10
 * and one real scorer, the two players who never played tied at rank 2 and took 30% of the
 * pot between them. Nothing errored: the sort ran, the payout ran, the ledger balanced.
 *
 * WHY THE FIX IS A MODULE METHOD AND NOT A BRANCH. `if (gameType === "provider")` inside the
 * qualification check is exactly the shape that makes the next game silently fail - the same
 * failure as the trading-shaped services in `matchmaking.service.ts`. The engine asks the
 * module `hasResult(participant)` and the module answers for its own game.
 *
 * WHY TRADING'S ANSWER IS AN UNCONDITIONAL `true`, and it is a decision rather than a
 * placeholder. A trader who placed no trades still has a result - their account is flat, PnL
 * is zero, and `minimumTrades` is the existing, operator-configurable way to say that is not
 * good enough. Returning `totalTrades > 0` here would silently impose a minimum of one trade
 * on every trading contest ever created, which is a change to the trading contract smuggled
 * in under a provider fix.
 */

const RULES: CompetitionRules = {
  rankingMethod: "pnl",
  tieBreaker1: "win_rate",
  tieBreaker2: "join_time",
  minimumTrades: 0,
  tiePrizeDistribution: "split_equally",
  disqualifyOnLiquidation: false,
};

const DISTRIBUTION = [
  { rank: 1, percentage: 70 },
  { rank: 2, percentage: 20 },
  { rank: 3, percentage: 10 },
];

const POOL = 1000;

/**
 * Reason for the cast: `ParticipantData` requires the trading metrics, and the whole point
 * of a provider participant is that it has none of them. `calculateRankings` accepts the
 * wider `RankableParticipant` at runtime - this is the same shape provider settlement builds.
 */
function player(userId: string, score?: number): ParticipantData {
  return {
    userId,
    username: userId,
    score,
    status: "active",
    enteredAt: new Date("2026-09-07T10:00:00.000Z"),
  } as unknown as ParticipantData;
}

function rank(participants: ParticipantData[]) {
  return calculateRankings(participants, RULES, {
    competitionStatus: "completed",
    gameType: "provider",
  });
}

function pay(participants: ParticipantData[]) {
  return distributePrizesWithTies(rank(participants), DISTRIBUTION, POOL, RULES, 0);
}

describe("a player with no score is not a winner", () => {
  it("disqualifies a player who never scored, with a reason a screen can show", () => {
    const ranked = rank([player("scored", 900), player("never-played")]);

    const absent = ranked.find((p) => p.userId === "never-played");
    expect(absent?.qualificationStatus).toBe("disqualified");
    /*
      The reason is asserted because it is the only thing that reaches the player. A
      disqualification with no explanation on a contest they paid to enter is what generates
      the support ticket the field exists to answer.
    */
    expect(absent?.disqualificationReason).toMatch(/no score/i);

    expect(
      ranked.find((p) => p.userId === "scored")?.qualificationStatus,
    ).toBe("qualified");
  });

  it("pays nothing to a player who never scored, and redistributes their rank", () => {
    /*
      THE OWNER'S EXAMPLE, EXACTLY. Three prize positions at 70/20/10, one player who
      actually played. Ranks 2 and 3 are unclaimed, so the whole 100% goes to the one
      scorer - not 70% with 30% kept by the platform, and not 20% and 10% handed to two
      players who never started a round, which is what this did before.
    */
    const paid = pay([
      player("scored", 900),
      player("never-played-a"),
      player("never-played-b"),
    ]);

    expect(paid).toHaveLength(1);
    expect(paid[0].userId).toBe("scored");
    expect(paid[0].prizeAmount).toBe(POOL);
  });

  it("treats a genuine zero as a result, because it is one", () => {
    /*
      THE DISTINCTION THE WHOLE FIX TURNS ON, and conflating the two is how this would be
      wrong in the opposite direction. A player who attempted the game and scored nothing
      HAS a result: `score` is 0. A player who never launched a round has no `score` field
      at all. **A stored value and an absent one are different facts** - the same rule that
      made `canEnterChallenges` a live defect.

      So the zero-scorer stays eligible and takes rank 2's share. Written as a truthiness
      check (`if (!score)`) the fix would refuse them, which is a player who played being
      told they did not.
    */
    const paid = pay([player("scored", 900), player("tried-and-failed", 0)]);

    expect(paid.map((d) => d.userId).sort()).toEqual([
      "scored",
      "tried-and-failed",
    ]);

    // Rank 3 is unclaimed, so its 10% is split equally between the two who placed.
    expect(paid.find((d) => d.userId === "scored")?.prizeAmount).toBe(750);
    expect(paid.find((d) => d.userId === "tried-and-failed")?.prizeAmount).toBe(
      250,
    );
  });

  it("refuses a score that is not a finite number", () => {
    /*
      WHY `Number.isFinite` AND NOT `!= null`, which is the obvious spelling and admits this.

      `NaN` fails every comparison, so it does not sort to last place - it lands wherever the
      comparator happens to leave it, and would then be PAID from a position nobody chose.
      That is worse than a wrong order, because the order is not explainable afterwards. The
      same reasoning made `Number.isFinite` the right guard for the Game Master rate in R31,
      where `??` would have passed a `NaN` from a form straight onto a money path.
    */
    const ranked = rank([player("scored", 900), player("broken", Number.NaN)]);

    expect(ranked.find((p) => p.userId === "broken")?.qualificationStatus).toBe(
      "disqualified",
    );
  });

  it("pays nobody when nobody scored", () => {
    /*
      "If no winner meaning no score for anyone all loose." Every entrant is disqualified,
      so there is no filled prize position and no bonus to spread - and critically, the
      earlier behaviour was the opposite of nobody winning: all three tied at rank 1 on a
      fallback zero and **split the entire pot between them**, having played nothing.

      What happens to the money is then the fee stage's existing `all_disqualified` branch:
      it is booked as an UNCLAIMED POOL net of the platform fee, not as platform income.
      That is the same treatment a trading contest gets, and whether it should instead be
      refunded is an owner decision this change deliberately does not take.
    */
    const paid = pay([player("a"), player("b"), player("c")]);

    expect(paid).toHaveLength(0);
  });

  it("does not disqualify anybody while the contest is still running", () => {
    /*
      THE GATE IS SCOPED TO A COMPLETED CONTEST, matching the two checks beside it, and
      dropping the scope is the mistake that reads as a tightening.

      `getCompetitionLeaderboard` ranks with the contest's LIVE status, so the same function
      draws the board a player watches during play. Unscoped, every player who has not
      finished their round yet is stamped **disqualified** on a contest they are in the
      middle of - which is not a cosmetic problem: `13` s4.1b renders the reason, so a
      player mid-round would read "No score recorded" as a verdict.
    */
    const live = calculateRankings(
      [player("scored", 900), player("still-playing")],
      RULES,
      { competitionStatus: "active", gameType: "provider" },
    );

    expect(
      live.find((p) => p.userId === "still-playing")?.qualificationStatus,
    ).toBe("qualified");
  });

  it("splits a tie between two real scorers, and hands the unclaimed rank to both", () => {
    /*
      Ties were already handled; this pins them against the new filter, because the obvious
      implementation of "no score, no prize" is a filter on the participant list, and
      filtering before ranking would renumber everybody's rank. The disqualified player must
      keep their place in the ordering and simply not be paid, or a two-player tie for first
      becomes a first and a second.
    */
    const paid = pay([
      player("tie-a", 500),
      player("tie-b", 500),
      player("never-played"),
    ]);

    expect(paid).toHaveLength(2);
    expect(paid.every((d) => d.isTied)).toBe(true);
    // Rank 1 is 70%, rank 2 and 3 are unclaimed at 30%: 100% between the two of them.
    expect(paid[0].prizeAmount).toBe(500);
    expect(paid[1].prizeAmount).toBe(500);
  });
});

describe("trading is unchanged, which is the load-bearing half", () => {
  /**
   * `hasResult` is asked of every game, so getting trading's answer wrong changes every
   * trading contest ever created. These two tests exist to fail loudly if somebody
   * "improves" trading's implementation into `totalTrades > 0`.
   */
  function trader(userId: string, pnl: number, totalTrades: number): ParticipantData {
    return {
      userId,
      username: userId,
      currentCapital: 10_000 + pnl,
      pnl,
      pnlPercentage: pnl / 100,
      totalTrades,
      winningTrades: totalTrades,
      losingTrades: 0,
      winRate: totalTrades > 0 ? 100 : 0,
      status: "active",
      enteredAt: new Date("2026-09-07T10:00:00.000Z"),
    } as unknown as ParticipantData;
  }

  it("keeps a trader who placed no trades qualified when the minimum is zero", () => {
    const ranked = calculateRankings(
      [trader("active-trader", 500, 3), trader("no-trades", 0, 0)],
      RULES,
      { competitionStatus: "completed", gameType: "trading" },
    );

    /*
      A flat account IS a result. `minimumTrades` is the operator's control for saying it is
      not good enough, and it defaults to 0 - so imposing a one-trade minimum here would
      change the meaning of every existing trading contest without anyone choosing it.
    */
    expect(
      ranked.find((p) => p.userId === "no-trades")?.qualificationStatus,
    ).toBe("qualified");
  });

  it("still enforces minimumTrades when an operator has set one", () => {
    const ranked = calculateRankings(
      [trader("active-trader", 500, 3), trader("no-trades", 0, 0)],
      { ...RULES, minimumTrades: 1 },
      { competitionStatus: "completed", gameType: "trading" },
    );

    const absent = ranked.find((p) => p.userId === "no-trades");
    expect(absent?.qualificationStatus).toBe("disqualified");
    // Asserted as the TRADES reason, not merely as disqualified: if `hasResult` started
    // refusing flat accounts, this test would pass on the wrong reason and the test above
    // would be the only thing standing between trading and a silent rule change.
    expect(absent?.disqualificationReason).toMatch(/trades/i);
  });
});
