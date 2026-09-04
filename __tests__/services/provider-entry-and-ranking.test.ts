import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
  ensureCollections,
} from "../helpers/mongo-test-server";
import CompetitionParticipant from "../../database/models/trading/competition-participant.model";
import { buildParticipantSeat } from "../../lib/services/contest-entry/participant-seat";
import { providerGameModule } from "../../lib/games/provider";
import { getGameModule, listGameModules } from "../../lib/games/registry";
import { routeToTradingSettlement } from "../../lib/games/settlement";
import { calculateRankings } from "../../lib/services/competition-ranking.service";
import type {
  ParticipantData,
  CompetitionRules,
} from "../../lib/services/competition-ranking.service";

/**
 * X5 - a provider contest can be entered and ranked.
 *
 * Two defects sat between a created contest and a played one, and both were the quiet kind:
 * a provider participant could not be SAVED, because three trading-capital fields were
 * required with no default; and a provider participant that did save was stamped
 * `gameKey: "trading"` by the schema default, filing them under the wrong game forever
 * because `gameKey` is immutable.
 *
 * Neither produced a wrong number anywhere. The first was a validation error naming a
 * concept the player has never heard of; the second was a row that looked perfectly correct.
 */

const TRADING_RULES: CompetitionRules = {
  rankingMethod: "pnl",
  tieBreaker1: "join_time",
  minimumTrades: 0,
  tiePrizeDistribution: "split_equally",
  disqualifyOnLiquidation: false,
};

beforeAll(async () => {
  await startTestMongo();
  // MongoDB cannot create a collection inside a transaction, and Mongoose builds indexes on
  // first use - both are catalog changes. Settle them before any test writes.
  await ensureCollections(["competitionparticipants"]);
}, 120_000);

afterAll(async () => {
  await stopTestMongo();
});

beforeEach(async () => {
  await clearTestMongo();
});

describe("the participant seat a provider entry writes", () => {
  const base = {
    competitionId: new mongoose.Types.ObjectId().toString(),
    userId: new mongoose.Types.ObjectId().toString(),
    username: "player",
    email: "player@example.com",
    enteredAt: new Date(),
  };

  it("copies gameKey from the contest instead of letting the schema default it", () => {
    const seat = buildParticipantSeat({
      ...base,
      gameKey: "provider:acme:chess",
      gameType: "provider",
    });

    // The whole defect in one assertion. The schema default is "trading", so a seat that
    // omits gameKey saves successfully and is wrong. `gameKey` is immutable, so it cannot
    // be corrected later - the row is mis-filed permanently.
    expect(seat.gameKey).toBe("provider:acme:chess");
  });

  it("omits the three virtual-capital fields for a provider contest", () => {
    const seat = buildParticipantSeat({
      ...base,
      gameKey: "provider:acme:chess",
      gameType: "provider",
      startingCapital: undefined,
    });

    expect(seat).not.toHaveProperty("startingCapital");
    expect(seat).not.toHaveProperty("currentCapital");
    expect(seat).not.toHaveProperty("availableCapital");

    // Nor any of the trade-count fields, which would otherwise show a chess player a
    // win rate of 0% over 0 trades on their profile.
    expect(seat).not.toHaveProperty("totalTrades");
    expect(seat).not.toHaveProperty("winRate");
    expect(seat).not.toHaveProperty("pnl");
  });

  it("still writes the full trading seat for a trading contest", () => {
    const seat = buildParticipantSeat({
      ...base,
      gameKey: "trading",
      gameType: "trading",
      startingCapital: 10_000,
    });

    expect(seat.startingCapital).toBe(10_000);
    expect(seat.currentCapital).toBe(10_000);
    expect(seat.availableCapital).toBe(10_000);
    expect(seat.pnl).toBe(0);
    expect(seat.winRate).toBe(0);
    expect(seat.gameKey).toBe("trading");
  });

  it("treats an unlabelled contest as trading, per invariant 5", () => {
    // Reason: a contest written before the label existed carries none, and it IS a trading
    // contest. Reading absent as "not trading" would drop its capital and break it.
    const seat = buildParticipantSeat({
      ...base,
      gameKey: undefined,
      gameType: undefined,
      startingCapital: 5_000,
    });

    expect(seat.gameKey).toBe("trading");
    expect(seat.startingCapital).toBe(5_000);
  });

  it("writes only field names the schema declares", () => {
    // Reason: strict mode discards undeclared fields BEFORE anything can observe them, so
    // no assertion on a saved document can catch a typo'd field name. Comparing the
    // builder's keys against `schema.paths` is the only way. This is how the simulator
    // batch route was found to be silently dropping six participant fields.
    const declared = new Set(Object.keys(CompetitionParticipant.schema.paths));

    for (const gameType of ["trading", "provider"]) {
      const seat = buildParticipantSeat({
        ...base,
        gameKey: gameType,
        gameType,
        startingCapital: 1_000,
      });

      const undeclared = Object.keys(seat).filter((key) => !declared.has(key));
      expect(
        undeclared,
        `buildParticipantSeat writes ${undeclared.join(", ")} for a ${gameType} contest, which the schema does not declare - strict mode will discard it silently`,
      ).toEqual([]);
    }
  });
});

describe("the participant schema, now that capital is conditional", () => {
  const seatFor = (gameKey: string, capital?: number) => ({
    competitionId: new mongoose.Types.ObjectId().toString(),
    userId: new mongoose.Types.ObjectId().toString(),
    username: "p",
    email: "p@example.com",
    gameKey,
    ...(capital === undefined
      ? {}
      : {
          startingCapital: capital,
          currentCapital: capital,
          availableCapital: capital,
        }),
    enteredAt: new Date(),
  });

  it("saves a provider participant that has no capital at all", async () => {
    const saved = await CompetitionParticipant.create(
      seatFor("provider:acme:chess"),
    );

    expect(saved.gameKey).toBe("provider:acme:chess");
    expect(saved.startingCapital).toBeUndefined();
    expect(saved.score).toBe(0);
  });

  it("still refuses a TRADING participant with no capital", async () => {
    // The narrowing must not become a hole. `startingCapital` is what every trading
    // calculation divides by, so a trading participant without it is a NaN generator.
    await expect(CompetitionParticipant.create(seatFor("trading"))).rejects.toThrow(
      /startingCapital/,
    );
  });

  it("refuses a participant whose label is an empty string, with no capital", async () => {
    // This is what makes the `|| "trading"` in the requirement predicate load-bearing, and
    // getting here took a correction worth recording.
    //
    // The obvious version of this test DELETES `gameKey` - and it passes whether or not the
    // `||` is there, because Mongoose applies the schema default before validation runs, so
    // an absent label never reaches the predicate as undefined. It looked like a guard and
    // was proving nothing.
    //
    // An empty string does reach it: defaults fill `undefined` only. And "" is a real shape
    // for a missing value, not a contrivance - the game-label backfill exists precisely
    // because absent, null and "" are three different ways a label goes missing and only
    // the first is obvious. Written `this.gameKey === "trading"`, such a row saves with no
    // capital and every trading calculation downstream divides by undefined.
    const seat = { ...seatFor("trading"), gameKey: "" };

    await expect(CompetitionParticipant.create(seat)).rejects.toThrow(
      /startingCapital/,
    );
  });

  it("reports isAtRisk as false for a capital-less participant rather than NaN", async () => {
    const saved = await CompetitionParticipant.create(
      seatFor("provider:acme:chess"),
    );

    expect(saved.get("isAtRisk")).toBe(false);
  });
});

describe("the provider game module", () => {
  it("is registered, which is what lets a provider contest be ranked at all", () => {
    expect(getGameModule("provider")).toBe(providerGameModule);
    expect(listGameModules().map((m) => m.type)).toContain("provider");
  });

  it("ranks on the raw score when higher is better", () => {
    const value = providerGameModule.getRankingValue(
      { userId: "u", status: "active", enteredAt: new Date(), score: 120 },
      "pnl",
    );
    expect(value).toBe(120);
  });

  it("negates the score when the title declares lower is better", () => {
    // A 92-second run must beat a 105-second run through the engine's single descending
    // sort. Negation is what expresses that without the engine learning about time trials.
    const fast = providerGameModule.getRankingValue(
      {
        userId: "fast",
        status: "active",
        enteredAt: new Date(),
        score: 92,
        scoreDirection: "lower_is_better",
      },
      "pnl",
    );
    const slow = providerGameModule.getRankingValue(
      {
        userId: "slow",
        status: "active",
        enteredAt: new Date(),
        score: 105,
        scoreDirection: "lower_is_better",
      },
      "pnl",
    );

    expect(fast).toBeGreaterThan(slow);
    expect(fast).toBe(-92);
  });

  it("ignores rankingMethod entirely, so no operator setting silently does nothing", () => {
    const participant = {
      userId: "u",
      status: "active",
      enteredAt: new Date(),
      score: 50,
    };
    const methods = ["pnl", "roi", "win_rate", "total_capital", "profit_factor"];
    const values = methods.map((m) =>
      providerGameModule.getRankingValue(participant, m),
    );

    expect(new Set(values).size).toBe(1);
  });

  it("treats an absent score as zero rather than crashing", () => {
    // By ranking time the unresolved-round policy has already decided what a missing
    // result means, so an absent score here is a settled zero, not an error.
    expect(
      providerGameModule.getRankingValue(
        { userId: "u", status: "active", enteredAt: new Date() },
        "pnl",
      ),
    ).toBe(0);
  });

  it("declares no tie-breaks, so identical scores are a genuine tie", () => {
    expect(providerGameModule.getTieBreakerValue()).toBe(0);
  });

  it("does not need market hours, which is why weekends work", () => {
    expect(providerGameModule.capabilities.needsMarketHours).toBe(false);
    expect(providerGameModule.capabilities.needsPriceFeed).toBe(false);
  });
});

describe("ranking a provider field end to end", () => {
  const rank = (
    rows: { userId: string; score: number }[],
    direction?: "lower_is_better",
  ) => {
    const participants = rows.map((row) => ({
      userId: row.userId,
      username: row.userId,
      score: row.score,
      scoreDirection: direction,
      status: "active",
      enteredAt: new Date("2026-01-01"),
      // Trading fields the shared interface still declares. Zero for a provider player,
      // and the point of the test is that none of them influence the outcome.
      currentCapital: 0,
      pnl: 0,
      pnlPercentage: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      startingCapital: 0,
    })) as unknown as ParticipantData[];

    return calculateRankings(participants, TRADING_RULES, {
      gameType: "provider",
    });
  };

  it("orders a higher-is-better game by score", () => {
    const ranked = rank([
      { userId: "low", score: 10 },
      { userId: "high", score: 90 },
      { userId: "mid", score: 50 },
    ]);

    expect(ranked.map((r) => r.userId)).toEqual(["high", "mid", "low"]);
    expect(ranked[0]?.rank).toBe(1);
  });

  it("orders a lower-is-better game by score, ascending", () => {
    const ranked = rank(
      [
        { userId: "slow", score: 105 },
        { userId: "fast", score: 92 },
        { userId: "middling", score: 99 },
      ],
      "lower_is_better",
    );

    expect(ranked.map((r) => r.userId)).toEqual(["fast", "middling", "slow"]);
  });

  it("ties players on equal scores rather than inventing an order", () => {
    const ranked = rank([
      { userId: "a", score: 70 },
      { userId: "b", score: 70 },
    ]);

    expect(ranked[0]?.rank).toBe(1);
    expect(ranked[1]?.rank).toBe(1);
    expect(ranked[0]?.isTied).toBe(true);
  });

  it("does NOT rank a provider field as trading, which would tie everyone at 1", () => {
    // The failure this whole seam exists to prevent. Trading's `pnl` method reads a field
    // every provider participant has as zero, so all three would tie at rank 1 and split
    // the pool equally between a winner and two losers - silently, page rendering fine.
    const asTrading = calculateRankings(
      [
        { userId: "a", score: 90 },
        { userId: "b", score: 10 },
      ].map((r) => ({
        ...r,
        username: r.userId,
        status: "active",
        enteredAt: new Date("2026-01-01"),
        currentCapital: 0,
        pnl: 0,
        pnlPercentage: 0,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        startingCapital: 0,
      })) as unknown as ParticipantData[],
      TRADING_RULES,
      { gameType: "trading" },
    );

    expect(asTrading[0]?.isTied).toBe(true);

    const asProvider = rank([
      { userId: "a", score: 90 },
      { userId: "b", score: 10 },
    ]);
    expect(asProvider[0]?.isTied).toBe(false);
    expect(asProvider[0]?.userId).toBe("a");
  });
});

describe("settlement routing, now that the provider module exists", () => {
  it("refuses a provider contest with no_settle_path, not unknown_game", () => {
    // The flip from unknown_game IS the evidence the module is registered: no_settle_path
    // is only reachable when the registry returns a module whose type is not trading.
    const route = routeToTradingSettlement("provider", "competition x");

    expect(route.ok).toBe(false);
    if (!route.ok) {
      expect(route.reason).toBe("no_settle_path");
      expect(route.error).toContain("Provider game");
    }
  });

  it("still lets a trading contest settle", () => {
    expect(routeToTradingSettlement("trading", "c").ok).toBe(true);
    expect(routeToTradingSettlement(undefined, "c").ok).toBe(true);
  });

  it("still refuses a genuinely unknown game", () => {
    const route = routeToTradingSettlement("roulette", "c");
    expect(route.ok).toBe(false);
    if (!route.ok) expect(route.reason).toBe("unknown_game");
  });
});
