import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  projectPrizeDistribution,
  type PrizeProjectionInput,
} from "../../lib/utils/prize-projection";
import {
  resolveSettledPrizeRows,
  resolveSettledResultRows,
  resolvePrizeBasisNote,
  PRIZE_REDISTRIBUTION_NOTE,
  PRIZE_SETTLED_NOTE,
} from "../../apps/admin/lib/admin/contest-result-presentation";

/**
 * The admin prize sidebar: a projection while the outcome is unknown, the recorded amounts once
 * settlement has run - and `finalLeaderboard` rendered at all, which it never was.
 *
 * WHAT WAS WRONG. The sidebar mapped `competition.prizeDistribution` and printed each rank's
 * bare configured percentage of the pool. The player-facing table has always redistributed an
 * unclaimed position's share, so **the two screens quoted different amounts for the same rank**,
 * and the operator's was the one that then disagreed with the wallet ledger. On a settled
 * contest both were wrong, because settlement divides by how many players *placed* and both
 * screens divide by how many *entered* - a different number since R45.
 *
 * WHY A TEST FILE RATHER THAN TRUSTING THE JSX. A structural assertion over a page rendering
 * both branches can prove it mentions a paid amount and cannot prove which branch produced it.
 * The two resolvers below can be called with a settled contest and an unsettled one, so the
 * branch is provable.
 */

const ROOT = join(__dirname, "..", "..");

function readCode(relative: string): string {
  return readFileSync(join(ROOT, relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const PANEL = "apps/admin/components/admin/competitions/ContestPrizePanel.tsx";
const SETTLED_PANEL =
  "apps/admin/components/admin/competitions/SettledResultPanel.tsx";
const VIEW_PAGE = "apps/admin/app/competitions/view/[id]/page.tsx";

const THREE_WAY: PrizeProjectionInput = {
  prizeDistribution: [
    { rank: 1, percentage: 70 },
    { rank: 2, percentage: 20 },
    { rank: 3, percentage: 10 },
  ],
  prizePool: 100,
  platformFeePercentage: 10,
};

describe("the projection is one calculation shared with the player table", () => {
  it("redistributes an unclaimed rank's share among the ranks somebody holds", () => {
    // The owner's own worked example: three paid ranks at 70/20/10 with two entrants. Rank 3
    // is unclaimed, so its 10% is split between the two who did place.
    const projection = projectPrizeDistribution({
      ...THREE_WAY,
      currentParticipants: 2,
    });

    expect(projection.unclaimedPercentage).toBe(10);
    expect(projection.filledPositions).toBe(2);
    expect(projection.allFilled).toBe(false);

    expect(projection.rows[0].bonusPercentage).toBe(5);
    expect(projection.rows[1].bonusPercentage).toBe(5);
    expect(projection.rows[2].bonusPercentage).toBe(0);

    // 75% of 100, less the 10% platform fee.
    expect(projection.rows[0].netAmount).toBeCloseTo(67.5, 6);
    expect(projection.rows[1].netAmount).toBeCloseTo(22.5, 6);
  });

  it("keeps the configured share visible beside the redistributed one", () => {
    // An operator has to be able to see that 70 became 75, or the screen looks like it is
    // ignoring what they typed.
    const projection = projectPrizeDistribution({
      ...THREE_WAY,
      currentParticipants: 2,
    });

    expect(projection.rows[0].configuredPercentage).toBe(70);
    expect(projection.rows[0].bonusPercentage).toBe(5);
  });

  it("adds no bonus once every paid rank is held", () => {
    const projection = projectPrizeDistribution({
      ...THREE_WAY,
      currentParticipants: 9,
    });

    expect(projection.unclaimedPercentage).toBe(0);
    expect(projection.allFilled).toBe(true);
    expect(projection.rows.every((row) => row.bonusPercentage === 0)).toBe(true);
    expect(projection.rows[0].netAmount).toBeCloseTo(63, 6);
  });

  it("marks an unheld rank rather than reporting an amount for it", () => {
    // `filled` is what makes the row render `-`. An amount on a rank nobody holds is the read
    // -side form of R45: it states that somebody was paid, which is a different fact from a
    // rank standing empty.
    const projection = projectPrizeDistribution({
      ...THREE_WAY,
      currentParticipants: 1,
    });

    expect(projection.rows[0].filled).toBe(true);
    expect(projection.rows[1].filled).toBe(false);
    expect(projection.rows[2].filled).toBe(false);
  });

  it("survives an empty contest without dividing by zero", () => {
    /*
      Boundary that reaches production on every draft: no entrants at all.

      THE `filledPositions > 0` TERNARY THAT LOOKS LIKE WHAT SAVES THIS CHANGES NO ANSWER, and
      the probe proving that is recorded in `tools/probe-contest-prize-basis.ps1` rather than
      shipped green. `filledPositions` is zero only when nobody has entered or no rank pays, and
      in both cases every row is unfilled - so `bonusPerWinner` becomes `Infinity` or `NaN` and
      is then read by nothing, because `isFilled && bonusPerWinner > 0` short-circuits first.
      The ternary is kept, both because it is one of the four expressions pinned character for
      character and because the accident holds only for `>`: an "is there a bonus" check written
      the other way round would propagate the `Infinity`. Same shape as the `isAtRisk` NaN guard
      in X5 - clarity, not a bug fix, and saying so is the honest claim.
    */
    const projection = projectPrizeDistribution({
      ...THREE_WAY,
      currentParticipants: 0,
    });

    expect(projection.filledPositions).toBe(0);
    expect(projection.unclaimedPercentage).toBe(100);
    expect(projection.rows.every((row) => row.bonusPercentage === 0)).toBe(true);
    expect(projection.rows.every((row) => Number.isFinite(row.netAmount))).toBe(
      true,
    );
  });

  it("falls back from prizePool to prizePoolCredits", () => {
    // Both fields are live: trading contests carry one, provider contests the other. Reading
    // only the first is how the whole panel renders zeroes on a provider contest.
    const projection = projectPrizeDistribution({
      prizeDistribution: [{ rank: 1, percentage: 100 }],
      currentParticipants: 1,
      prizePoolCredits: 250,
      platformFeePercentage: 0,
    });

    expect(projection.prizePool).toBe(250);
    expect(projection.rows[0].netAmount).toBeCloseTo(250, 6);
  });

  it("numbers a rank by position when the configured slice omits one", () => {
    const projection = projectPrizeDistribution({
      prizeDistribution: [{ percentage: 60 }, { percentage: 40 }],
      currentParticipants: 2,
      prizePool: 100,
    });

    expect(projection.rows.map((row) => row.rank)).toEqual([1, 2]);
  });

  it("returns nothing to render on a contest with no configured shares", () => {
    const projection = projectPrizeDistribution({ currentParticipants: 5 });
    expect(projection.rows).toEqual([]);
    expect(projection.prizePositions).toBe(0);
  });
});

describe("a settled contest reports what was paid, not what was projected", () => {
  const distribution = [
    { rank: 1, percentage: 70 },
    { rank: 2, percentage: 20 },
    { rank: 3, percentage: 10 },
  ];

  it("reads each rank's real prizeAmount out of finalLeaderboard", () => {
    const rows = resolveSettledPrizeRows({
      distribution,
      finalLeaderboard: [
        { rank: 1, username: "ada", prizeAmount: 67.5 },
        { rank: 2, username: "grace", prizeAmount: 22.5 },
      ],
    });

    expect(rows).not.toBeNull();
    expect(rows?.[0].paidAmount).toBe(67.5);
    expect(rows?.[0].names).toEqual(["ada"]);
    expect(rows?.[1].paidAmount).toBe(22.5);
  });

  it("reports a rank nobody placed in as null, never as zero", () => {
    // The distinction R45 is built on. `0` says somebody was paid nothing; `null` says the
    // rank stood empty, and only the second is true here.
    const rows = resolveSettledPrizeRows({
      distribution,
      finalLeaderboard: [{ rank: 1, username: "ada", prizeAmount: 90 }],
    });

    expect(rows?.[1].paidAmount).toBeNull();
    expect(rows?.[2].paidAmount).toBeNull();
  });

  it("sums a tied rank rather than reporting one of its winners", () => {
    /*
      `distributePrizesWithTies` splits the combined share of the tied positions between the
      tied players, so both hold their own `prizeAmount`. Reporting one understates the rank by
      half; averaging produces a figure that appears in no ledger row at all.
    */
    const rows = resolveSettledPrizeRows({
      distribution,
      finalLeaderboard: [
        { rank: 1, username: "ada", prizeAmount: 40.5, isTied: true },
        { rank: 1, username: "grace", prizeAmount: 40.5, isTied: true },
      ],
    });

    expect(rows?.[0].paidAmount).toBe(81);
    expect(rows?.[0].names).toEqual(["ada", "grace"]);
    expect(rows?.[0].isTied).toBe(true);
  });

  it("infers a tie from two rows sharing a rank even without the flag", () => {
    // `isTied` is add-only and was silently discarded before X5, so historical contests can
    // hold tied rows with the flag unset. Two rows at one rank IS the tie.
    const rows = resolveSettledPrizeRows({
      distribution,
      finalLeaderboard: [
        { rank: 1, username: "ada", prizeAmount: 40.5 },
        { rank: 1, username: "grace", prizeAmount: 40.5 },
      ],
    });

    expect(rows?.[0].isTied).toBe(true);
  });

  it("names a player by id when the username was never stored", () => {
    const rows = resolveSettledPrizeRows({
      distribution,
      finalLeaderboard: [{ rank: 1, userId: "6a44fbe8", prizeAmount: 90 }],
    });

    expect(rows?.[0].names).toEqual(["6a44fbe8"]);
  });

  it("falls back to the projection when no settled record exists", () => {
    /*
      THE BASIS IS KEYED ON THE RECORD, NOT ON THE STATUS, and this is the case that forces it:
      a contest can be completed with no stored leaderboard - predating the field, cancelled, or
      settlement never ran. Reading the basis off `status === "completed"` would caption a
      column of blanks as the amounts paid, which is worse than the projection it replaced.
    */
    expect(
      resolveSettledPrizeRows({ distribution, finalLeaderboard: [] }),
    ).toBeNull();
    expect(
      resolveSettledPrizeRows({ distribution, finalLeaderboard: null }),
    ).toBeNull();
    expect(resolveSettledPrizeRows({ distribution })).toBeNull();
  });

  it("does not tell an operator a recorded payment might be higher", () => {
    /*
      The "figures are a floor" caution is right about a projection and FALSE beside real
      payments. Same class as the play screen's play-window note and the wizard's publishing
      note: a warning that has quietly become untrue reads as though somebody checked it.
    */
    expect(resolvePrizeBasisNote("projected")).toBe(PRIZE_REDISTRIBUTION_NOTE);
    expect(resolvePrizeBasisNote("settled")).toBe(PRIZE_SETTLED_NOTE);

    expect(PRIZE_REDISTRIBUTION_NOTE).toMatch(/higher/i);
    expect(PRIZE_SETTLED_NOTE).not.toMatch(/higher/i);
    expect(PRIZE_SETTLED_NOTE).toMatch(/actually paid/i);
  });
});

describe("finalLeaderboard is rendered somewhere at last", () => {
  it("orders the settled rows by the rank that was recorded", () => {
    const rows = resolveSettledResultRows([
      { rank: 3, username: "c" },
      { rank: 1, username: "a" },
      { rank: 2, username: "b" },
    ]);

    expect(rows?.map((row) => row.username)).toEqual(["a", "b", "c"]);
  });

  it("does not reorder the caller's array in place", () => {
    // The page hands it `competition.finalLeaderboard` directly, and a sort that mutates would
    // silently reorder whatever else on the page reads the same array.
    const stored = [{ rank: 3 }, { rank: 1 }];
    resolveSettledResultRows(stored);
    expect(stored.map((row) => row.rank)).toEqual([3, 1]);
  });

  it("renders nothing at all when there is no settled record", () => {
    // An empty table headed "Settled Result" is indistinguishable from data that failed to
    // load - the same reason the player lobby hides its prize panel with no configured shares.
    expect(resolveSettledResultRows([])).toBeNull();
    expect(resolveSettledResultRows(null)).toBeNull();
    expect(resolveSettledResultRows(undefined)).toBeNull();

    const code = readCode(SETTLED_PANEL);
    expect(code).toMatch(/if \(!rows\) return null;/);
  });

  it("shows the stored qualification verdict and its reason", () => {
    /*
      Recomputing a disqualification later cannot recover the reason an operator has to give
      the player, which is the whole argument for reading the snapshot.

      ASSERT THE CONDITION WITH ITS OPERATOR, NOT THE BARE IDENTIFIER. Written
      `toContain("row.disqualificationReason")` this test was GREEN against a panel whose guard
      had been replaced with `{false && (`, because the field is named a second time inside the
      element it guards. Fifth instance of the class, after the fixed-character Edit guard,
      `canTransitionRound`, `MIN_REASON_LENGTH` and `expectedOrigin` - so the count is asserted
      too, or a second unguarded mention hides behind the first.
    */
    const code = readCode(SETTLED_PANEL);
    expect(code).toContain('row.qualificationStatus === "disqualified"');
    expect(code).toMatch(/\{row\.disqualificationReason && \(/);
    expect(code.match(/row\.disqualificationReason/g)).toHaveLength(2);
    expect(code).toMatch(/\{row\.isTied && \(/);
    expect(code).toMatch(/typeof row\.prizeAmount === "number" &&/);
  });

  it("reads the game's own metric rather than hard-coding either one", () => {
    // The settled snapshot carries `score` AND the four trading figures, so a panel picking
    // one would repeat R46 - the defect where a provider contest showed 0 trades and +0.00%
    // while the number it ranked on sat unrendered on the same row.
    const code = readCode(SETTLED_PANEL);
    expect(code).toMatch(/resolveResultMetric\(row,\s*isProviderGame\)/);
    expect(code).not.toContain("row.pnl");
    expect(code).not.toContain("row.totalTrades");
  });
});

describe("the panel structure holds the properties the resolvers cannot", () => {
  it("picks its heading from the basis", () => {
    // "Prize Distribution" above real payments reads as configuration, so an operator assumes
    // the figures are meant to match the ledger and reports a defect when they do not.
    const code = readCode(PANEL);
    const heading = code.indexOf('basis === "settled"');
    const paid = code.indexOf('"Prizes Paid"');

    expect(heading).toBeGreaterThan(-1);
    expect(paid).toBeGreaterThan(heading);
  });

  it("shares the projection module with the player-facing table", () => {
    /*
      THE NEGATIVE ASSERTION IS THE LOAD-BEARING HALF. Importing the module is trivially
      satisfied by a panel that then does its own arithmetic beside it, which is precisely what
      this screen used to do - and a second copy of a payout calculation is the "one rule, two
      copies" shape behind `referenceId`, `failedReason`, `challengeId` and the Game Master `||`.
    */
    const code = readCode(PANEL);
    expect(code).toContain('from "@/lib/utils/prize-projection"');
    expect(code).toContain("projectPrizeDistribution(competition)");

    for (const forbidden of [
      "unclaimedPercentage +=",
      "/ filledPositions",
      "prize.percentage +",
    ]) {
      expect(code).not.toContain(forbidden);
    }
  });

  it("keeps the redistribution badge the player already sees", () => {
    const code = readCode(PANEL);
    expect(code).toMatch(/row\.bonusPercentage > 0/);
  });

  it("no longer maps the raw distribution on the page", () => {
    // The page mapped `competition.prizeDistribution` and multiplied percentages inline. If
    // that returns, the panel is decoration and the two screens can disagree again.
    const code = readCode(VIEW_PAGE);
    expect(code).not.toContain("competition.prizeDistribution?.map");
    expect(code).not.toContain("platformFeePercentage)");
    expect(code).toContain("<ContestPrizePanel");
    expect(code).toContain("<SettledResultPanel");
  });

  it("takes no Mongoose model into either shared module", () => {
    /*
      MODEL-FREE BY REQUIREMENT, not preference. `prize-projection.ts` is imported by the
      player lobby's table and by an admin component, so a model import here surfaces as a
      broken client bundle rather than as a type error - the shape behind R39, where a lucide
      icon crossing the server/client boundary took the trading lobby down in production.
    */
    for (const copy of [
      "lib/utils/prize-projection.ts",
      "apps/admin/lib/utils/prize-projection.ts",
    ]) {
      const code = readCode(copy);
      expect(code).not.toMatch(/from "[^"]*database\/models/);
      expect(code).not.toMatch(/from "mongoose"/);
    }
  });

  it("keeps the two copies of the projection byte-identical", () => {
    /*
      `check:mirrors` compares MODELS, so it has no opinion about this file - the same silence
      that let `provider-finalize.ts` sit mirrored and uncalled for three days (R42). A text
      comparison is the only guard available, because vitest aliases `@` to the repository root
      and no runtime assertion here can see the admin copy.
    */
    const main = readFileSync(
      join(ROOT, "lib/utils/prize-projection.ts"),
      "utf8",
    );
    const admin = readFileSync(
      join(ROOT, "apps/admin/lib/utils/prize-projection.ts"),
      "utf8",
    );

    expect(admin).toBe(main);
  });
});
