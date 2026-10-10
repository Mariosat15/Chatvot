/**
 * The admin front page's live-competition figures - `12` s5's overview row.
 *
 * WHAT WAS THERE BEFORE, because it changes what these tests are for. The overview counted no
 * contests at all, of any game: no competition model, no participant model and no game field
 * appeared anywhere in `AdminOverviewDashboard.tsx` or `/api/dashboard/stats`. So this slice is
 * additive, and none of the usual "a trading-shaped aggregate keeps computing and keeps being
 * wrong" hazard applies - there was no wrong number, there was no number. These tests pin the
 * shape of the new one rather than the absence of an old defect.
 *
 * MOSTLY BEHAVIOURAL, deliberately. Every rule worth pinning here is a rule about what the
 * figures are given a particular set of contests and seats, and none of them can be checked by
 * reading the code: which statuses count, that grouping is on the contest's game rather than the
 * seat's, and that the ObjectId/String boundary on `competitionId` is crossed correctly. The two
 * structural tests cover the two properties that are about code rather than data - the section
 * grant on the route, and the absence of money on a screen granted by `overview`.
 *
 * WHICH COPY OF EACH MODEL THIS SEEDS IS NOT A FREE CHOICE. The service lives in `apps/admin`,
 * but vitest maps `@` to the REPO ROOT, so its `@/database/...` imports resolve to the MAIN
 * app's models rather than the admin copies beside it. This file seeds the main copies - the
 * ones the service actually reads. Seeding the admin copies puts fixtures on a Mongoose instance
 * the service never touches, and every assertion then fails on an empty collection, which reads
 * exactly like a logic bug.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  vi,
} from "vitest";
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

const Competition = (
  await import("../../database/models/trading/competition.model")
).default;
const CompetitionParticipant = (
  await import("../../database/models/trading/competition-participant.model")
).default;
const ProviderGame = (
  await import("../../database/models/games/provider-game.model")
).default;
const { WhiteLabel } = await import("../../database/models/whitelabel.model");
const { buildParticipantSeat } = await import(
  "../../lib/services/contest-entry/participant-seat"
);
const { getLiveContestOverview, shouldShowPriceFeed, LIVE_CONTEST_STATUSES } =
  await import("../../apps/admin/lib/services/games/live-contest-overview.service");

const PROVIDER_KEY = "mock-provider";
const GAME_CODE = "mock-trivia";
const GAME_KEY = `provider:${PROVIDER_KEY}:${GAME_CODE}`;

const ROOT = join(__dirname, "..", "..");

/** Comments are stripped first: these files explain the RBAC reasoning in prose, so a test that
 *  reads prose passes a broken file whose only mention of the right thing is a comment. */
function readCode(relativePath: string): string {
  const raw = readFileSync(join(ROOT, relativePath), "utf8");
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const STATS_ROUTE = "apps/admin/app/api/dashboard/stats/route.ts";
const OVERVIEW_SERVICE =
  "apps/admin/lib/services/games/live-contest-overview.service.ts";

beforeAll(async () => {
  await startTestMongo();
  await ensureCollections([
    "competitions",
    "competition_participants",
    "provider_game",
    "whitelabels",
  ]);
}, 120_000);

afterAll(async () => {
  await stopTestMongo();
});

beforeEach(async () => {
  await clearTestMongo();
});

interface ContestOptions {
  status: string;
  provider?: boolean;
  /**
   * Strips the contest's own label after saving, which is the shape the X1 backfill leaves
   * behind in production.
   *
   * Reason it cannot simply be seeded absent: `gameKey` is `required` on `Competition`, so the
   * model refuses it - which is exactly why the field has to be removed with the raw driver
   * afterwards. That is not a fixture taking a liberty: the Game Master route inserts with the
   * raw driver and so has always been able to write a row this way (R7), and the backfill that
   * would repair them has never been applied.
   */
  unlabelled?: boolean;
}

async function seedContest(options: ContestOptions) {
  const now = Date.now();
  const provider = options.provider ?? false;

  const contest = await Competition.create({
    name: provider ? "Puzzle Cup" : "Forex Cup",
    slug: `cup-${now}-${Math.random().toString(16).slice(2)}`,
    description: "A seeded contest",
    gameType: provider ? "provider" : "trading",
    gameKey: provider ? GAME_KEY : "trading",
    ...(provider
      ? {
          gameConfig: {
            providerKey: PROVIDER_KEY,
            gameCode: GAME_CODE,
            settings: {},
          },
          playWindowStart: new Date(now - 60_000),
          playWindowEnd: new Date(now + 3_600_000),
          resultGracePeriodSeconds: 600,
          attemptsPolicy: "single",
          unresolvedRoundPolicy: "score_zero",
        }
      : { startingCapital: 10_000 }),
    status: options.status,
    competitionType: "time_based",
    startTime: new Date(now - 120_000),
    endTime: new Date(now + 7_200_000),
    registrationDeadline: new Date(now - 120_000),
    entryFee: 5,
    minParticipants: 2,
    maxParticipants: 100,
    currentParticipants: 0,
    prizePool: 100,
    platformFeePercentage: 10,
    prizeDistribution: [{ rank: 1, percentage: 100 }],
    createdBy: new mongoose.Types.ObjectId().toString(),
  });

  if (options.unlabelled) {
    await Competition.collection.updateOne(
      { _id: contest._id },
      { $unset: { gameKey: "" } },
    );
  }

  return contest;
}

/**
 * A seat, written the way the entry path writes one, with the participant's OWN game label
 * under our control.
 *
 * Reason it goes through `buildParticipantSeat` rather than a literal: the builder is the
 * production writer, so a fixture built by hand can satisfy assertions no real row would.
 * Reason the label is a parameter: the whole point of the grouping test below is that a seat
 * can disagree with its contest about the game, and a fixture that always agrees cannot tell a
 * correct implementation from the one-query version that groups on the seat.
 */
async function seedSeat(
  competitionId: string,
  seatGameKey: string,
): Promise<void> {
  const userId = new mongoose.Types.ObjectId().toString();

  await CompetitionParticipant.create(
    buildParticipantSeat({
      competitionId,
      userId,
      username: `player-${userId.slice(-6)}`,
      email: `${userId}@example.test`,
      gameKey: seatGameKey,
      // Reason the type is trading whatever the key: the builder omits the virtual-capital
      // fields for a non-trading seat, and the schema requires them when the KEY says trading.
      gameType: "trading",
      startingCapital: 10_000,
      enteredAt: new Date(),
    }),
  );
}

describe("which contests count", () => {
  it("counts active and upcoming, and nothing else", async () => {
    await seedContest({ status: "active" });
    await seedContest({ status: "upcoming" });
    await seedContest({ status: "draft" });
    await seedContest({ status: "completed" });
    await seedContest({ status: "cancelled" });
    await seedContest({ status: "finalizing" });

    const overview = await getLiveContestOverview();

    expect(overview.totals.active).toBe(1);
    expect(overview.totals.upcoming).toBe(1);
  });

  /**
   * `draft` is the status most likely to be "helpfully" admitted later, and the assertion above
   * CANNOT SEE IT. A probe adding `draft` to the status list left this suite green, because a
   * draft contest increments neither counter - the totals stay 1 and 1 while the draft is now
   * being fetched. The observable is the ROW: an unpublished contest appears on the operator's
   * front page as a game with something on, and every figure beside it reads zero.
   *
   * // Reason this is worth a second test rather than a tightened first one: the two failures
   * are different. Above is "the wrong contest was counted"; here it is "a contest nobody can
   * enter was listed at all", which is the same harm the publish control exists to prevent.
   */
  it("does not list a game whose only contest is an unpublished draft", async () => {
    await seedContest({ status: "active" });
    await seedContest({ status: "draft", provider: true });

    const overview = await getLiveContestOverview();

    expect(overview.rows).toHaveLength(1);
    expect(overview.rows[0].isProviderGame).toBe(false);
    // A row that exists while reading zero on both counters is the tell.
    expect(
      overview.rows.filter((row) => row.active + row.upcoming === 0),
    ).toEqual([]);
  });

  it("the status list is the two live states", () => {
    expect([...LIVE_CONTEST_STATUSES]).toEqual(["active", "upcoming"]);
  });

  it("reports empty totals when nothing is running", async () => {
    await seedContest({ status: "completed" });

    const overview = await getLiveContestOverview();

    expect(overview.rows).toEqual([]);
    expect(overview.totals).toEqual({ active: 0, upcoming: 0, participants: 0 });
  });
});

describe("grouping", () => {
  it("splits trading from a provider game and labels each", async () => {
    await ProviderGame.create({
      providerKey: PROVIDER_KEY,
      gameCode: GAME_CODE,
      gameKey: GAME_KEY,
      displayName: "Mock Trivia",
      category: "trivia",
      family: "independent",
      scoreDirection: "higher_is_better",
      scoreType: "integer",
      providerStatus: "active",
      chartvoltEnabled: true,
    });

    await seedContest({ status: "active" });
    await seedContest({ status: "active", provider: true });
    await seedContest({ status: "upcoming", provider: true });

    const overview = await getLiveContestOverview();

    const trading = overview.rows.find((row) => !row.isProviderGame);
    const game = overview.rows.find((row) => row.isProviderGame);

    expect(trading).toMatchObject({ key: "trading", label: "Trading", active: 1 });
    expect(game).toMatchObject({ key: GAME_KEY, label: "Mock Trivia", active: 1, upcoming: 1 });
  });

  /**
   * THE ASSERTION THAT SEPARATES THIS IMPLEMENTATION FROM THE OBVIOUS ONE.
   *
   * `competition_participant.gameKey` is denormalised onto the seat with a schema default of
   * `"trading"`, the Game Master route inserts with the raw driver and bypasses defaults
   * entirely (R7), and the X1 backfill has never been applied to production. So a provider
   * contest's seats can be stored labelled `trading`. Group the seats by their own label - the
   * single-query version, which reads perfectly - and real game entrants are filed under
   * trading while every total still adds up. The contest is the authority on its own game.
   */
  it("attributes a seat to its contest's game, not to the seat's own label", async () => {
    const contest = await seedContest({ status: "active", provider: true });
    await seedSeat(String(contest._id), "trading");
    await seedSeat(String(contest._id), "trading");

    const overview = await getLiveContestOverview();

    expect(overview.rows).toHaveLength(1);
    expect(overview.rows[0].isProviderGame).toBe(true);
    expect(overview.rows[0].participants).toBe(2);
    expect(overview.totals.participants).toBe(2);
  });

  /**
   * `competition_participant.competitionId` is declared `String` while `Competition._id` is an
   * ObjectId, and an aggregation pipeline does no casting - so an unconverted `$in` matches
   * nothing and reports every contest as empty. Third instance after the R42 fixture and the
   * analytics participation funnel. Two contests, so a query matching only one is also caught.
   */
  it("counts seats across the ObjectId/String boundary", async () => {
    const one = await seedContest({ status: "active" });
    const two = await seedContest({ status: "upcoming" });
    await seedSeat(String(one._id), "trading");
    await seedSeat(String(two._id), "trading");
    await seedSeat(String(two._id), "trading");

    const overview = await getLiveContestOverview();

    expect(overview.totals.participants).toBe(3);
  });

  /**
   * An unlabelled provider contest must not collapse into trading, and must not become
   * "Unknown". `gameKey` is immutable precisely so history stays addressable, so the fallback
   * chain ends at the provider and code the contest does carry.
   */
  it("keys an unlabelled provider contest on its provider and code", async () => {
    await seedContest({ status: "active", provider: true, unlabelled: true });

    const overview = await getLiveContestOverview();

    expect(overview.rows).toHaveLength(1);
    expect(overview.rows[0].key).toBe(`provider:${PROVIDER_KEY}:${GAME_CODE}`);
    expect(overview.rows[0].label).toBe(GAME_CODE);
    expect(overview.rows[0].isProviderGame).toBe(true);
  });
});

describe("the price-feed tile", () => {
  /**
   * `12` s5 says to hide the panel when trading is off, and hiding it on that alone is wrong in
   * the one direction that matters: switching trading off does not close the contests already
   * running, and every open position in them is still priced from the same feed. A health
   * indicator that disappears exactly when somebody needs it is worse than one shown needlessly.
   */
  it("stays visible while trading has something live, even with trading switched off", () => {
    expect(
      shouldShowPriceFeed({ tradingEnabled: false, tradingHasLiveContests: true }),
    ).toBe(true);
  });

  it("is withheld only when trading is off and has nothing live", () => {
    expect(
      shouldShowPriceFeed({ tradingEnabled: false, tradingHasLiveContests: false }),
    ).toBe(false);
    expect(
      shouldShowPriceFeed({ tradingEnabled: true, tradingHasLiveContests: false }),
    ).toBe(true);
  });

  it("reports trading as switched off when the settings say so", async () => {
    await WhiteLabel.create({ enabledGameTypes: ["provider"] });
    await seedContest({ status: "active", provider: true });

    const overview = await getLiveContestOverview();

    expect(overview.tradingEnabled).toBe(false);
    expect(overview.tradingHasLiveContests).toBe(false);
    expect(shouldShowPriceFeed(overview)).toBe(false);
  });

  /**
   * The state the deviation exists for: trading disabled, a trading contest still running. The
   * counts must still include it - `getEnabledGameTypes()` is banned from every stats read path
   * (R29, invariant 9), because summing over the enabled set retroactively erases history.
   */
  it("still counts a running trading contest after trading is switched off", async () => {
    await WhiteLabel.create({ enabledGameTypes: ["provider"] });
    await seedContest({ status: "active" });

    const overview = await getLiveContestOverview();

    expect(overview.tradingEnabled).toBe(false);
    expect(overview.tradingHasLiveContests).toBe(true);
    expect(overview.totals.active).toBe(1);
    expect(shouldShowPriceFeed(overview)).toBe(true);
  });
});

describe("what the overview is allowed to know", () => {
  /**
   * `verifyAdminAuth` asks only whether the caller is an admin at all, so an employee granted
   * one unrelated section passes it. `guardSection` is the grant. Eighth instance of this class
   * after Prerequisite A, the internal-secret fallbacks, the suspicion-score route, the provider
   * admin routes, the contest-edit route, the seven lifecycle routes and the analytics route.
   */
  it("the stats route is granted by the overview section", () => {
    const code = readCode(STATS_ROUTE);

    expect(code).toMatch(/guardSection\s*\(\s*["']overview["']\s*\)/);
    expect(code).not.toMatch(/verifyAdminAuth\s*\(/);
  });

  /**
   * THE NEGATIVE ASSERTION IS THE LOAD-BEARING HALF. The overview is granted by `overview`
   * while revenue lives behind `analytics` and `financial`, so a money figure here is a silent
   * widening of who can read the platform's earnings - and it reviews as a helpful addition.
   * Asserted on the fields the service could select, not on the word "revenue".
   */
  it("the service reads no money field off a contest", () => {
    const code = readCode(OVERVIEW_SERVICE);

    for (const field of [
      "prizePool",
      "entryFee",
      "platformFeePercentage",
      "totalRevenue",
      "prizeDistribution",
    ]) {
      expect(code, `${OVERVIEW_SERVICE} reads ${field}`).not.toContain(field);
    }
  });
});
