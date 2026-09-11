/* eslint-disable security/detect-object-injection -- the keys here are the test's own
   `const` user ids, not request input. The rule is scoped rather than blanket: a whole-file
   disable would also cover any dynamic lookup a later assertion introduces. */
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import mongoose from "mongoose";
import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
  ensureCollections,
} from "../helpers/mongo-test-server";

vi.mock("@/database/mongoose", () => ({
  connectToDatabase: async () => mongoose.connection,
  default: async () => mongoose.connection,
}));

import GameRound, {
  ROUND_STATUSES,
} from "../../database/models/games/game-round.model";
import { getContestActivity } from "../../lib/services/games/contest-activity.service";
import {
  describeRoundActivity,
  roundActivityToneClass,
} from "../../lib/utils/round-activity";

/**
 * What each player has actually been doing in a contest.
 *
 * The owner asked for the standings to "show what each player solved or progress according to
 * game". The two claims worth guarding are that the answer comes from the GAME rather than from
 * us, and that a round which produced no earned score never contributes one.
 */

const ROOT = join(__dirname, "..", "..");

/**
 * Comments are stripped before any structural match.
 *
 * Reason: these files discuss the anti-patterns they avoid - the metric names that must not be
 * hardcoded are named in prose explaining why they must not be hardcoded. A test that reads
 * prose fails on a correct file for discussing the mistake and passes a broken one whose only
 * mention of the right thing is a comment.
 */
function readCode(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const PLAYER = "68b5c1a2d4e5f60718293a4b";
const RIVAL = "68b5c1a2d4e5f60718293a4c";

function seedRound(
  contestId: mongoose.Types.ObjectId,
  userId: string,
  attemptNumber: number,
  status: string,
  extra: Record<string, unknown> = {},
) {
  // A complete document rather than one trimmed to the fields under test: Mongoose validates
  // the whole thing, so an omitted required field fails every test in the file at once for one
  // unrelated reason.
  return GameRound.create({
    roundId: `cv_rnd_${userId.slice(-4)}_${attemptNumber}_${Math.random().toString(16).slice(2)}`,
    providerKey: "acme",
    gameCode: "puzzle-blitz",
    gameKey: "acme:puzzle-blitz",
    userId,
    contestType: "competition",
    contestId,
    attemptNumber,
    mode: "ranked",
    status,
    expiresAt: new Date(Date.now() + 600_000),
    ...extra,
  });
}

describe("what each player has been doing in a contest", () => {
  let contestId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    const uri = await startTestMongo();
    await mongoose.connect(uri);
    await ensureCollections(["game_round"]);
  }, 120_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await stopTestMongo();
  });

  beforeEach(async () => {
    await clearTestMongo();
    contestId = new mongoose.Types.ObjectId();
  });

  it("reports the game's own breakdown, whatever the game called its metrics", async () => {
    await seedRound(contestId, PLAYER, 1, "completed", {
      rawScore: 820,
      scoreBreakdown: { boardsCompleted: 3, speedBonus: 120 },
    });

    const activity = await getContestActivity(contestId, [PLAYER]);

    expect(activity.latestByUser[PLAYER]?.breakdown).toEqual({
      boardsCompleted: 3,
      speedBonus: 120,
    });
  });

  /**
   * THE LOAD-BEARING TEST OF THE PAIR.
   *
   * A `voided` round stores `rawScore: 0` deliberately - it is the residue of a support action,
   * not something a player earned. Handing that nought to a screen counts an operator's
   * intervention as a result, and on a lower-is-better title a zero sorts FIRST and becomes the
   * player's best. "Has a number" is the wrong test, which is why the service asks
   * `roundContributesScore` instead.
   */
  it("withholds the score from a round that did not earn one", async () => {
    await seedRound(contestId, PLAYER, 1, "voided", { rawScore: 0 });

    const activity = await getContestActivity(contestId, [PLAYER]);

    expect(activity.latestByUser[PLAYER]?.status).toBe("voided");
    expect(activity.latestByUser[PLAYER]?.score).toBeUndefined();
  });

  /**
   * `expired` is the ORDINARY ending for anyone still playing at the final whistle, because
   * `createRound` clamps a round's expiry to the contest's play window. R48 made those runs
   * count, so the score must survive - the opposite answer to the voided case above, and the
   * reason the two are separate tests rather than one parameterised one.
   */
  it("keeps the score from a run the clock cut short", async () => {
    await seedRound(contestId, PLAYER, 1, "expired", { rawScore: 410 });

    const activity = await getContestActivity(contestId, [PLAYER]);

    expect(activity.latestByUser[PLAYER]?.score).toBe(410);
  });

  it("reports the latest attempt per player, not the first", async () => {
    await seedRound(contestId, PLAYER, 1, "completed", { rawScore: 100 });
    await seedRound(contestId, PLAYER, 2, "completed", { rawScore: 900 });

    const activity = await getContestActivity(contestId, [PLAYER]);

    expect(activity.latestByUser[PLAYER]?.attemptNumber).toBe(2);
    expect(activity.latestByUser[PLAYER]?.score).toBe(900);
  });

  /**
   * Scoped to the players asked about. The board is what supplies that list, so an unscoped
   * read would grow with the contest for ever and would also report somebody the standings
   * beside it never mention.
   */
  it("returns nobody who was not asked about", async () => {
    await seedRound(contestId, RIVAL, 1, "completed", { rawScore: 777 });

    const activity = await getContestActivity(contestId, [PLAYER]);

    expect(activity.latestByUser[RIVAL]).toBeUndefined();
    expect(activity.recent).toHaveLength(0);
  });

  /**
   * A practice round is free, unranked and prize-less. Counting one as contest activity would
   * put a rehearsal on a money leaderboard.
   */
  it("ignores practice rounds", async () => {
    await seedRound(contestId, PLAYER, 1, "completed", {
      rawScore: 500,
      mode: "practice",
    });

    const activity = await getContestActivity(contestId, [PLAYER]);

    expect(activity.latestByUser[PLAYER]).toBeUndefined();
  });

  it("orders the feed newest first", async () => {
    await seedRound(contestId, PLAYER, 1, "completed", {
      rawScore: 100,
      completedAt: new Date(Date.now() - 600_000),
    });
    await seedRound(contestId, RIVAL, 1, "completed", {
      rawScore: 200,
      completedAt: new Date(Date.now() - 60_000),
    });

    const activity = await getContestActivity(contestId, [PLAYER, RIVAL]);

    expect(activity.recent.map((entry) => entry.userId)).toEqual([
      RIVAL,
      PLAYER,
    ]);
  });

  it("asks nothing of the database when the board is empty", async () => {
    await seedRound(contestId, PLAYER, 1, "completed", { rawScore: 100 });

    const activity = await getContestActivity(contestId, []);

    expect(activity.recent).toHaveLength(0);
    expect(Object.keys(activity.latestByUser)).toHaveLength(0);
  });
});

describe("putting a round into words", () => {
  /**
   * `ROUND_STATUSES` is a Mongoose enum and therefore add-only: a value can be introduced and
   * never removed. Reading the list rather than naming seven strings is what makes this fail on
   * the day an eighth arrives, instead of silently describing it as something else.
   */
  it.each(ROUND_STATUSES)("says something specific about %s", (status) => {
    const phrase = describeRoundActivity({ status, attemptNumber: 1 });

    expect(phrase.headline.length).toBeGreaterThan(0);
    expect(phrase.headline).not.toBe("In progress");
  });

  it("falls back rather than guessing at a status it does not know", () => {
    const phrase = describeRoundActivity({
      status: "some_future_status",
      attemptNumber: 1,
    });

    expect(phrase.headline).toBe("In progress");
    expect(phrase.tone).toBe("idle");
  });

  /**
   * THE WORDING OF `expired` IS A CORRECTNESS CLAIM, NOT A STYLE ONE. Under the universal
   * cut-off it is what happens to a player who was still going when the contest ended, so
   * blaming the player for it is a false statement about the most common way a round ends.
   */
  it("describes the clock rather than the player when time runs out", () => {
    const phrase = describeRoundActivity({ status: "expired", attemptNumber: 1 });

    expect(phrase.headline.toLowerCase()).toContain("time");
    expect(phrase.headline.toLowerCase()).not.toMatch(/gave up|quit|failed/);
  });

  it("names the attempt a player finished", () => {
    const phrase = describeRoundActivity({
      status: "completed",
      attemptNumber: 3,
    });

    expect(phrase.headline).toContain("3");
    expect(phrase.headline).not.toContain("%d");
  });

  /**
   * THE METRIC ORDER IS THE GAME'S. The platform must not rank a game's own metrics by
   * importance - that is a judgement about one title, and the moment it is made in code the
   * "a new game needs no additional coding" claim is false for the next one. Both BSON and
   * JavaScript preserve insertion order, so taking the leading entries defers to the provider.
   */
  it("keeps the metrics in the order the game declared them", () => {
    const phrase = describeRoundActivity({
      status: "completed",
      attemptNumber: 1,
      breakdown: { lapsFinished: 4, topSpeedKph: 180, fuelUsed: 9 },
    });

    expect(phrase.metrics.map((metric) => metric.label)).toEqual([
      "Laps finished",
      "Top speed kph",
    ]);
  });

  it("drops values a screen cannot render, and keeps a genuine zero", () => {
    const phrase = describeRoundActivity(
      {
        status: "completed",
        attemptNumber: 1,
        breakdown: {
          detail: { nested: true },
          broken: Number.NaN,
          blank: "   ",
          missing: null,
          boardsCompleted: 0,
        },
      },
      { maxMetrics: 5 },
    );

    expect(phrase.metrics).toEqual([{ label: "Boards completed", value: "0" }]);
  });

  it("says a player has not played rather than inventing a round", () => {
    const phrase = describeRoundActivity(undefined);

    expect(phrase.headline).toBe("Not played yet");
    expect(phrase.metrics).toHaveLength(0);
  });

  it("gives every tone a colour", () => {
    const tones = ["live", "scored", "lapsed", "idle"] as const;

    for (const tone of tones) {
      expect(roundActivityToneClass(tone)).toMatch(/^text-/);
    }
  });
});

describe("the activity layer names no game", () => {
  /**
   * THE ONE FAILURE MODE OF THE "NO ADDITIONAL CODING" CLAIM is something that enumerates
   * games or their metrics. A lookup table mapping `boardsCompleted` to a nicer phrase would
   * read as an improvement, pass every test above, and leave the next title's metrics
   * unlabelled while the screen still rendered.
   *
   * The `Ms` suffix in `humanize-metric.ts` is a UNIT convention, not a game's field, which is
   * why that file is not scanned here.
   */
  const GAME_SPECIFIC = [
    "boardsCompleted",
    "speedBonus",
    "fastestBoardMs",
    "circuit-sprint",
    "circuit-perfect",
    "puzzle",
  ];

  it.each([
    "lib/utils/round-activity.ts",
    "lib/services/games/contest-activity.service.ts",
    "components/games/ProviderLeaderboard.tsx",
    "components/games/arena/ArenaActivityFeed.tsx",
  ])("%s mentions no game and no game metric", (path) => {
    const code = readCode(path);

    for (const term of GAME_SPECIFIC) {
      expect(code).not.toContain(term);
    }
  });

  /**
   * The status rule lives in the SERVICE, so a component never re-decides which rounds earned a
   * score. Two copies of that rule is how one screen credits a voided round while the next does
   * not - and the screens are rendered side by side.
   */
  it("decides which rounds earned a score once, in the service", () => {
    expect(
      readCode("lib/services/games/contest-activity.service.ts"),
    ).toContain("roundContributesScore(");

    for (const path of [
      "components/games/ProviderLeaderboard.tsx",
      "components/games/arena/ArenaActivityFeed.tsx",
      "lib/utils/round-activity.ts",
    ]) {
      expect(readCode(path)).not.toContain("roundContributesScore");
    }
  });

  /**
   * Not mirrored, deliberately. `apps/admin` has no player board, and a file copied into the
   * admin app before anything imports it is two copies agreeing while only one of them runs -
   * which is exactly how R42 hid for three days.
   */
  it("is not copied into the admin app", () => {
    expect(() =>
      readCode("apps/admin/lib/services/games/contest-activity.service.ts"),
    ).toThrow();
  });
});
