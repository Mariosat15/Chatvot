import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  calculateRankings,
  distributePrizesWithTies,
  type CompetitionRules,
  type ParticipantData,
} from "@/lib/services/competition-ranking.service";

/**
 * TASK 30's CASE MATRIX: the seven game cases, the seven trading cases, and the three
 * settlement cases that can be decided without a database. The two retry cases are in
 * `settlement-retry-idempotency.test.ts`, because they need one.
 *
 * WHY THIS EXISTS BESIDE THE GOLDEN REGRESSION, which already replays 18 scenarios through
 * the same two functions. The golden file records what the code DOES; it cannot record what
 * the code SHOULD do. Regenerate it after a mistake and it locks the mistake in, green for
 * ever - which is not hypothetical, because it was regenerated on 9 September 2026 as part
 * of this very change. Every expectation below is written out as a number a person chose,
 * so a wrong redistribution has to argue with an assertion rather than with a snapshot.
 *
 * WHY THE CASES ARE ASSERTED ON WHO IS PAID AND HOW MUCH, never on the ranking alone. The
 * defect these rules exist to close paid two players who had never started a round, and the
 * RANKING was not wrong when it did - they genuinely tied on a fallback zero. Every case
 * therefore asserts the payout, and the "nobody eligible" cases assert that the payout is
 * EMPTY rather than that some particular person missed out: an empty distribution is the
 * signal settlement reads to book the unclaimed pool, so it is the load-bearing observable.
 */

const POOL = 1000;

const DISTRIBUTION_70_20_10 = [
  { rank: 1, percentage: 70 },
  { rank: 2, percentage: 20 },
  { rank: 3, percentage: 10 },
];

/**
 * What provider settlement actually passes. `minimumTrades: 0` and
 * `disqualifyOnLiquidation: false` are correct for a game with no trades and no margin -
 * and they are also the reason nothing disqualified anybody before the module seam existed,
 * so a matrix that quietly used trading's rules here would prove nothing about a game.
 */
const GAME_RULES: CompetitionRules = {
  rankingMethod: "pnl",
  tieBreaker1: "win_rate",
  tieBreaker2: "join_time",
  minimumTrades: 0,
  tiePrizeDistribution: "split_equally",
  disqualifyOnLiquidation: false,
};

const TRADING_RULES: CompetitionRules = {
  rankingMethod: "pnl",
  tieBreaker1: "trades_count",
  tieBreaker2: "join_time",
  minimumTrades: 0,
  tiePrizeDistribution: "split_equally",
  disqualifyOnLiquidation: true,
};

const ENTERED = new Date("2026-09-09T10:00:00.000Z");

/**
 * Reason for the cast: `ParticipantData` declares the trading metrics, and the entire point
 * of a game participant is that it carries none of them. This is the shape provider
 * settlement builds, and `calculateRankings` accepts the wider `RankableParticipant`.
 */
function gamePlayer(
  userId: string,
  score: number | undefined,
  status = "active",
): ParticipantData {
  return {
    userId,
    username: userId,
    score,
    status,
    enteredAt: ENTERED,
  } as unknown as ParticipantData;
}

function trader(
  userId: string,
  pnl: number,
  status = "active",
  totalTrades = 10,
): ParticipantData {
  return {
    userId,
    username: userId,
    status,
    enteredAt: ENTERED,
    startingCapital: 10_000,
    currentCapital: 10_000 + pnl,
    pnl,
    pnlPercentage: (pnl / 10_000) * 100,
    totalTrades,
    winningTrades: 5,
    losingTrades: 5,
    winRate: 50,
  };
}

function settle(
  participants: ParticipantData[],
  rules: CompetitionRules,
  gameType?: string,
  distribution = DISTRIBUTION_70_20_10,
  pool = POOL,
  feeFraction = 0,
) {
  const ranked = calculateRankings(participants, rules, {
    competitionStatus: "completed",
    gameType,
  });

  const paid = distributePrizesWithTies(
    ranked,
    distribution,
    pool,
    rules,
    feeFraction,
  );

  return {
    ranked,
    paid,
    /** Convenience for the assertions that only care about who got what. */
    byUser: new Map(paid.map((p) => [p.userId, p.prizeAmount])),
    total: paid.reduce((sum, p) => sum + p.prizeAmount, 0),
  };
}

const game = (participants: ParticipantData[], ...rest: [] | [typeof DISTRIBUTION_70_20_10, number, number]) =>
  settle(participants, GAME_RULES, "provider", ...(rest as []));

const trading = (participants: ParticipantData[]) =>
  settle(participants, TRADING_RULES, undefined);

/* ------------------------------------------------------------------------------------- */

describe("task 30 - game competition eligibility", () => {
  it("case 1: three valid positive scores are paid 70/20/10 as configured", () => {
    /*
      The control. Nothing is vacated, so normalisation must be an EXACT identity - the
      factor is `configuredTotal / filledTotal`, which is 1 here. A redistribution rule
      that drifts on the ordinary path is far worse than one that is wrong on an edge, and
      this is the only case in the file that can catch it.
    */
    const { byUser, total } = game([
      gamePlayer("first", 900),
      gamePlayer("second", 500),
      gamePlayer("third", 100),
    ]);

    expect(byUser.get("first")).toBe(700);
    expect(byUser.get("second")).toBe(200);
    expect(byUser.get("third")).toBe(100);
    expect(total).toBe(POOL);
  });

  it("case 2: two valid and one zero pays only the two, proportionally", () => {
    /*
      THE OWNER'S WORKED EXAMPLE. 70 and 20 are the surviving shares, so they are scaled by
      100/90 - 77.78 and 22.22, keeping the 3.5:1 curve the operator configured. The
      equal-share bonus this replaced paid 75 and 25, a 3:1 curve, flattening the top prize
      by five points of the pot without anybody choosing to.
    */
    const { byUser, total } = game([
      gamePlayer("first", 900),
      gamePlayer("second", 500),
      gamePlayer("zero", 0),
    ]);

    expect(byUser.has("zero")).toBe(false);
    expect(byUser.get("first")).toBeCloseTo(777.78, 2);
    expect(byUser.get("second")).toBeCloseTo(222.22, 2);
    expect(total).toBe(POOL);

    /*
      The ratio, asserted separately: it is the property the owner asked for, and two
      amounts can both be wrong while still summing to the pot.

      TO THREE PLACES, NOT SIX, and the reason is the rounding rule rather than sloppiness.
      777.78/222.22 is 3.50004, not 3.5, because both amounts are rounded to whole cents
      before anybody can divide them. Demanding an exact ratio would be demanding that the
      allocator NOT round - which is the one thing it exists to do - so the tolerance has
      to be wider than a cent's worth of the smaller amount.
    */
    expect(byUser.get("first")! / byUser.get("second")!).toBeCloseTo(70 / 20, 3);
  });

  it("case 3: one valid and two zeros pays the whole pot to the one scorer", () => {
    const { byUser, paid, total } = game([
      gamePlayer("first", 900),
      gamePlayer("zero-a", 0),
      gamePlayer("zero-b", 0),
    ]);

    expect(paid).toHaveLength(1);
    expect(byUser.get("first")).toBe(POOL);
    expect(total).toBe(POOL);
  });

  it("case 4: all zero pays nobody, so the whole pot is unclaimed", () => {
    /*
      A zero is STORED and is not paid - the distinction that makes this case exist at all.
      The score is a real fact about the round and stays on the row; eligibility is a
      separate question, answered by the module. Asserting the empty distribution is
      asserting the unclaimed pool, because that is the signal settlement acts on.
    */
    const { paid, ranked } = game([
      gamePlayer("zero-a", 0),
      gamePlayer("zero-b", 0),
      gamePlayer("zero-c", 0),
    ]);

    expect(paid).toEqual([]);
    expect(
      ranked.every((p) => p.qualificationStatus === "disqualified"),
    ).toBe(true);
  });

  it("case 5: a valid scorer beside a disqualified player pays only the scorer", () => {
    /*
      `status: "disqualified"` is checked by the ENGINE, not by the game module, because it
      is an operator's verdict about a person rather than a fact about their metrics. That
      is why this case is in both the game and the trading halves of this matrix and reads
      identically in each - a game-specific answer to it would be the bug.
    */
    const { byUser, paid } = game([
      gamePlayer("scored", 900),
      gamePlayer("banned", 950, "disqualified"),
    ]);

    expect(paid).toHaveLength(1);
    expect(byUser.get("scored")).toBe(POOL);
    // Note the disqualified player had the HIGHER score. A rule that merely reordered the
    // board would still pay them; this asserts they are removed from it.
    expect(byUser.has("banned")).toBe(false);
  });

  it("case 6: all disqualified pays nobody", () => {
    const { paid } = game([
      gamePlayer("banned-a", 900, "disqualified"),
      gamePlayer("banned-b", 500, "disqualified"),
    ]);

    expect(paid).toEqual([]);
  });

  it("case 7: no submitted scores at all pays nobody", () => {
    /*
      DISTINCT FROM CASE 4, and the distinction is the one R50 turned on: `undefined` means
      the player never reported, a stored `0` means they played and scored nothing. Both
      are refused a prize, for two different reasons, and a `?? 0` anywhere on the path
      collapses the first into the second - which is exactly the defect that made every
      entrant eligible.
    */
    const { paid, ranked } = game([
      gamePlayer("absent-a", undefined),
      gamePlayer("absent-b", undefined),
    ]);

    expect(paid).toEqual([]);
    expect(ranked[0].disqualificationReason).toMatch(/no score/i);
  });
});

/* ------------------------------------------------------------------------------------- */

describe("task 30 - trading competition eligibility", () => {
  it("case 1: all valid are paid 70/20/10", () => {
    const { byUser, total } = trading([
      trader("win", 5_000),
      trader("mid", 2_000),
      trader("low", 100),
    ]);

    expect(byUser.get("win")).toBe(700);
    expect(byUser.get("mid")).toBe(200);
    expect(byUser.get("low")).toBe(100);
    expect(total).toBe(POOL);
  });

  it("case 2: a liquidated trader is excluded and their share redistributed", () => {
    const { byUser, paid } = trading([
      trader("alive", 5_000),
      trader("wiped", 9_000, "liquidated"),
    ]);

    expect(paid).toHaveLength(1);
    expect(byUser.get("alive")).toBe(POOL);
    expect(byUser.has("wiped")).toBe(false);
  });

  it("case 3: a disqualified trader is excluded", () => {
    const { byUser, paid } = trading([
      trader("clean", 3_000),
      trader("banned", 8_000, "disqualified"),
    ]);

    expect(paid).toHaveLength(1);
    expect(byUser.get("clean")).toBe(POOL);
  });

  it("case 4: valid, liquidated and disqualified together pays only the valid one", () => {
    const { byUser, paid } = trading([
      trader("clean", 1_000),
      trader("wiped", 7_000, "liquidated"),
      trader("banned", 9_000, "disqualified"),
    ]);

    expect(paid).toHaveLength(1);
    expect(byUser.get("clean")).toBe(POOL);
  });

  it("case 5: all liquidated pays nobody", () => {
    const { paid } = trading([
      trader("a", 100, "liquidated"),
      trader("b", 50, "liquidated"),
    ]);

    expect(paid).toEqual([]);
  });

  it("case 6: all disqualified pays nobody", () => {
    const { paid } = trading([
      trader("a", 100, "disqualified"),
      trader("b", 50, "disqualified"),
    ]);

    expect(paid).toEqual([]);
  });

  it("case 7: a mixture of liquidation and disqualification leaves the two valid traders", () => {
    /*
      Two survivors rather than one, so this case exercises the proportional scaling on the
      trading side as well - 70 and 20 scaled by 100/90. The game half's case 2 and this
      one must agree, because the redistribution rule is shared and a divergence would mean
      the same vacated rank paid differently depending on the game.
    */
    const { byUser, total } = trading([
      trader("clean-a", 5_000),
      trader("clean-b", 2_000),
      trader("wiped", 8_000, "liquidated"),
      trader("banned", 9_000, "disqualified"),
    ]);

    expect(byUser.get("clean-a")).toBeCloseTo(777.78, 2);
    expect(byUser.get("clean-b")).toBeCloseTo(222.22, 2);
    expect(byUser.has("wiped")).toBe(false);
    expect(byUser.has("banned")).toBe(false);
    expect(total).toBe(POOL);
  });

  it("keeps disqualifyOnLiquidation meaningful - off, a liquidated trader is paid", () => {
    /*
      NOT ONE OF TASK 30's SEVEN, and it is here because of what it protects. The owner's
      decision of 9 September was to KEEP this switch, on the grounds that its off state is
      a legitimate contest variant. Without this case, someone reading the six cases above
      would reasonably conclude liquidation is always fatal and hard-wire it - which is a
      one-line change that turns an operator's setting into decoration and passes every
      other assertion in this file.
    */
    const rules = { ...TRADING_RULES, disqualifyOnLiquidation: false };
    const { byUser } = settle(
      [trader("wiped", 9_000, "liquidated"), trader("alive", 100)],
      rules,
      undefined,
    );

    /*
      777.78 and 222.22 rather than 700 and 200, because there are TWO players against a
      three-rank table, so rank 3 is vacated and normalisation applies exactly as it does
      in the cases above. Worth spelling out: the first draft of this test expected 700 and
      200, having reasoned about the switch and forgotten the vacancy. Both numbers being
      "wrong" is the redistribution working - the assertion that matters here is which
      player holds rank 1.
    */
    expect(byUser.get("wiped")).toBeCloseTo(777.78, 2);
    expect(byUser.get("alive")).toBeCloseTo(222.22, 2);
  });
});

/* ------------------------------------------------------------------------------------- */

describe("task 30 - settlement arithmetic", () => {
  it("normalises percentages to the CONFIGURED total, never to 100", () => {
    /*
      The trap this catches is the one that reads as obviously correct. An operator who
      allocates 50/30 - 80% of the pot, deliberately, keeping 20% - must still be paying
      80% when both ranks are filled. Normalising to 100 would pay 62.5/37.5 here,
      inflating every prize by a quarter, with no error and no log line.
    */
    const { byUser, total } = settle(
      [gamePlayer("first", 900), gamePlayer("second", 500)],
      GAME_RULES,
      "provider",
      [
        { rank: 1, percentage: 50 },
        { rank: 2, percentage: 30 },
      ],
      POOL,
      0,
    );

    expect(byUser.get("first")).toBe(500);
    expect(byUser.get("second")).toBe(300);
    expect(total).toBe(800);
  });

  it("pays nothing, and nothing NaN, when every held rank is configured at 0%", () => {
    /*
      THE SECOND DIVIDE-BY-ZERO CASE, AND THE ONLY ONE THAT IS REACHABLE. It was added
      because a probe removing the `filledTotal > 0` guard in `normalisePrizeShares` came
      back GREEN against the "nobody is eligible" test below - and the reason is worth
      keeping, because it is the difference between a weak test and a wrong claim.

      When nobody is eligible, every share is `filled: false`, so the code multiplies
      nothing by the factor: `Infinity` is computed and then never used. The guard changes
      no answer on that path. It is only load-bearing when a rank IS held and the
      percentages configured on the held ranks sum to zero - which is legal, since the
      editor accepts a 0% row - and there `0 * Infinity` is `NaN`, an amount that would be
      written to a wallet and would then poison every total computed from it.

      So this is not an exotic fixture chosen to make a probe go red. It is the one shape
      that can distinguish the branches at all, which is what the probe was missing.
    */
    const { paid, total } = settle(
      [gamePlayer("first", 900), gamePlayer("second", 500)],
      GAME_RULES,
      "provider",
      [
        { rank: 1, percentage: 0 },
        { rank: 2, percentage: 0 },
      ],
      POOL,
      0,
    );

    // Nothing is owed, so nothing is paid - and every amount that IS returned must be a
    // real number. `toBe(0)` alone would pass on NaN in neither direction, but a caller
    // summing an empty array gets 0 either way, so the amounts are checked individually.
    for (const p of paid) {
      expect(Number.isFinite(p.prizeAmount), `${p.userId} was paid a non-number`).toBe(
        true,
      );
      expect(p.prizeAmount).toBe(0);
    }
    expect(Number.isFinite(total)).toBe(true);
    expect(total).toBe(0);
  });

  it("pays exactly the distributable pool whenever at least one winner is eligible", () => {
    /*
      Task 30's second settlement case, and it is asserted across a SPREAD of shapes rather
      than one, because the ways of losing money here are all fractional: an odd pot, a
      three-way split that cannot be written in cents, a fee, and a vacated rank all
      produce a different residue. Largest-remainder allocation has to absorb each of them.

      THE TOTAL IS COMPARED IN CENTS, AS INTEGERS, and that is not a way of loosening the
      assertion - it is where the guarantee actually lives. The allocator hands out whole
      cents, so 5002 + 5003 is exactly 10005. Adding the returned amounts back up as
      floats gives 50.02 + 50.03 = 100.05000000000001, which fails an exact `toBe` against
      100.05 while nothing is wrong with the payout. Asserting in cents keeps the assertion
      exact - no tolerance, which would pass the very rounding drift this exists to catch -
      and puts it in the same unit the money is allocated in.
    */
    const shapes: {
      label: string;
      players: ParticipantData[];
      pool: number;
      fee: number;
      distribution: { rank: number; percentage: number }[];
    }[] = [
      {
        label: "three-way even split of an indivisible pot",
        players: [
          gamePlayer("a", 100),
          gamePlayer("b", 100),
          gamePlayer("c", 100),
        ],
        pool: 1000,
        fee: 0,
        distribution: [
          { rank: 1, percentage: 33.34 },
          { rank: 2, percentage: 33.33 },
          { rank: 3, percentage: 33.33 },
        ],
      },
      {
        label: "odd pot with a fee",
        players: [gamePlayer("a", 900), gamePlayer("b", 500)],
        pool: 333.33,
        fee: 0.1,
        distribution: [
          { rank: 1, percentage: 70 },
          { rank: 2, percentage: 30 },
        ],
      },
      {
        label: "a vacated rank on top of a fee",
        players: [gamePlayer("a", 900), gamePlayer("b", 0)],
        pool: 777,
        fee: 0.15,
        distribution: DISTRIBUTION_70_20_10,
      },
      {
        label: "a true tie splitting one rank",
        players: [gamePlayer("a", 500), gamePlayer("b", 500)],
        pool: 100.05,
        fee: 0,
        distribution: [{ rank: 1, percentage: 100 }],
      },
    ];

    for (const shape of shapes) {
      const { paid, total } = settle(
        shape.players,
        GAME_RULES,
        "provider",
        shape.distribution,
        shape.pool,
        shape.fee,
      );

      const configuredTotal = shape.distribution.reduce(
        (sum, d) => sum + d.percentage,
        0,
      );
      const distributable =
        Math.floor(
          ((shape.pool * configuredTotal) / 100) * (1 - shape.fee) * 100,
        ) / 100;

      expect(paid.length, shape.label).toBeGreaterThan(0);
      expect(Math.round(total * 100), shape.label).toBe(
        Math.round(distributable * 100),
      );

      // And nobody is paid a negative or non-finite amount on the way to a correct total,
      // which a naive residue trim can produce while still summing perfectly.
      for (const p of paid) {
        expect(Number.isFinite(p.prizeAmount), shape.label).toBe(true);
        expect(p.prizeAmount, shape.label).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("pays no prize at all when nobody is eligible, whatever the reason", () => {
    /*
      Task 30's third settlement case. Four different roads to "nobody eligible", asserted
      together because settlement's decision to book the unclaimed pool keys on the EMPTY
      DISTRIBUTION and not on the reason - so a rule that handled three of these and left
      the fourth paying one player would put money in a wallet and an unclaimed row on the
      books for the same pot.
    */
    const nobodyEligible: [string, ParticipantData[], CompetitionRules, string?][] = [
      ["no participants at all", [], GAME_RULES, "provider"],
      [
        "every game score is zero",
        [gamePlayer("a", 0), gamePlayer("b", 0)],
        GAME_RULES,
        "provider",
      ],
      [
        "nobody reported a score",
        [gamePlayer("a", undefined), gamePlayer("b", undefined)],
        GAME_RULES,
        "provider",
      ],
      [
        "every trader liquidated",
        [trader("a", 10, "liquidated"), trader("b", 20, "liquidated")],
        TRADING_RULES,
        undefined,
      ],
    ];

    for (const [label, players, rules, gameType] of nobodyEligible) {
      const { paid, total } = settle(players, rules, gameType);
      expect(paid, label).toEqual([]);
      expect(total, label).toBe(0);
    }
  });
});

/* ------------------------------------------------------------------------------------- */

const read = (relative: string) =>
  readFileSync(join(process.cwd(), relative), "utf8");

describe("the redistribution rule is mirrored byte for byte", () => {
  it("the admin copy of prize-shares.ts is identical", () => {
    /*
      `check:mirrors` compares MODELS, so it has no opinion about a util - and a text
      comparison is the only guard there is. It matters here more than for most mirrored
      files, because both apps run the finalize cron every minute: a drifted copy means the
      prize a winner is paid depends on which process claimed the contest first, which is
      exactly the shape of R26 and R42 in this same pair of services.

      IT ALSO COVERS WHAT NO RUNTIME ASSERTION IN THIS FILE CAN. vitest aliases `@` to the
      repository root, so every test above imports the root copy; the admin file is never
      loaded, and no amount of behavioural testing here can see it. That is why the probe
      harness records the admin probes as unreachable rather than shipping them green.
    */
    expect(read("apps/admin/lib/utils/prize-shares.ts")).toBe(
      read("lib/utils/prize-shares.ts"),
    );
  });

  it("both copies of the ranking engine carry the disqualified check", () => {
    /*
      `competition-ranking.service.ts` is a DIVERGENT duplicate - the two copies differ by
      dozens of lines of logging - so it cannot be compared byte for byte and a text search
      for the rule is what is left. Comments are stripped first: this file's own docblocks
      discuss the check at length, so an unstripped search passes a copy whose only mention
      of it is in prose, which is the failure mode a structural test is most prone to.
    */
    const strip = (source: string) =>
      source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    for (const copy of [
      "lib/services/competition-ranking.service.ts",
      "apps/admin/lib/services/competition-ranking.service.ts",
    ]) {
      const code = strip(read(copy));
      expect(code, copy).toContain('participant.status === "disqualified"');
      expect(code, copy).toContain("normalisePrizeShares(");
      expect(code, copy).toContain("allocateWithoutRoundingLoss(");
    }
  });
});
