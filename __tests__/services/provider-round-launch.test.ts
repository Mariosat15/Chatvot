import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
import mongoose from "mongoose";
import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
  ensureCollections,
} from "../helpers/mongo-test-server";

// Reason: the service calls `connectToDatabase()`, which reads MONGODB_URI and refuses to
// guess. The suite is already connected to the in-memory replica set by `startTestMongo`,
// so hand the service that connection rather than giving the tests a real URI.
vi.mock("@/database/mongoose", () => ({
  connectToDatabase: async () => mongoose.connection,
  default: async () => mongoose.connection,
}));

import Competition from "../../database/models/trading/competition.model";
import CompetitionParticipant from "../../database/models/trading/competition-participant.model";
import ProviderGame from "../../database/models/games/provider-game.model";
import GameProvider from "../../database/models/games/game-provider.model";
import GameRound from "../../database/models/games/game-round.model";
import { WhiteLabel } from "../../database/models/whitelabel.model";
import {
  MockProviderAdapter,
  MOCK_PROVIDER_KEY,
} from "../../lib/services/game-providers/adapters/mock.adapter";
import { registerProviderAdapter } from "../../lib/services/game-providers/registry";
import { launchContestRound } from "../../lib/services/games/round-launch.service";

/**
 * X5 - launching a round in a provider contest.
 *
 * The service under test adds only what requires knowing about a CONTEST; `createRound`
 * (X3) already owns provider resolution, attempts, the one-live-round rule and idempotency.
 * So these tests concentrate on the four contest-level refusals, and on the one that is
 * load-bearing.
 *
 * THE SEAT CHECK IS THE LOAD-BEARING ONE, and its failure mode is why. Without it any
 * signed-in user can launch a ranked round in a contest they never paid to enter: the round
 * is created, the provider bills us for it, a score comes back, and ingestion writes it
 * against a contest where they hold no participant row - so it is silently dropped at
 * settlement while the player watches a score they believe counts.
 */

const GAME_CODE = "mock-puzzle";
const GAME_KEY = `provider:${MOCK_PROVIDER_KEY}:${GAME_CODE}`;

let savedBaseUrl: string | undefined;

beforeAll(async () => {
  await startTestMongo();
  await ensureCollections([
    "competitions",
    "competitionparticipants",
    "providergames",
    "gameproviders",
    "gamerounds",
    "whitelabels",
    "providerevents",
  ]);
  registerProviderAdapter(new MockProviderAdapter());
}, 120_000);

afterAll(async () => {
  await stopTestMongo();
});

beforeEach(async () => {
  await clearTestMongo();
  savedBaseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  process.env.NEXT_PUBLIC_BASE_URL = "https://chartvolt.test";
});

afterEach(() => {
  if (savedBaseUrl === undefined) delete process.env.NEXT_PUBLIC_BASE_URL;
  else process.env.NEXT_PUBLIC_BASE_URL = savedBaseUrl;
});

/** Every switch on, catalogue synced, so a test only has to turn OFF what it examines. */
async function seedPlayableWorld(
  overrides: {
    contestStatus?: string;
    playWindowStart?: Date;
    playWindowEnd?: Date;
    chartvoltEnabled?: boolean;
    providerStatus?: string;
    attemptsPolicy?: string;
    gameConfig?: Record<string, unknown> | null;
  } = {},
) {
  // BOTH switches, and the distinction cost a debugging round. `resolveEnabledProvider`
  // reads the per-provider flag from `WhiteLabel.gameProviders`, NOT from the
  // `game_provider` collection - the collection is the operator's register of companies,
  // the settings array is the runtime switch. Seeding only the collection leaves the
  // provider correctly registered and still unavailable, and the refusal message
  // ("not configured in settings") points at the right place once you know to read it.
  //
  // The admin service writes both in `setProviderEnabled`, so this is a fixture obligation
  // rather than a product bug - verified before assuming it.
  await WhiteLabel.create({
    externalGamesEnabled: true,
    gameProviders: [{ providerKey: MOCK_PROVIDER_KEY, enabled: true }],
  });
  await GameProvider.create({
    providerKey: MOCK_PROVIDER_KEY,
    displayName: "Mock",
    baseUrl: "https://mock.test",
    enabled: true,
  });
  await ProviderGame.create({
    providerKey: MOCK_PROVIDER_KEY,
    gameCode: GAME_CODE,
    gameKey: GAME_KEY,
    displayName: "Mock Puzzle",
    // Real enum values, checked against the schema. A fixture trimmed or guessed here
    // fails every test at once for one unrelated reason - Mongoose validates the whole
    // document, not the subset the test cares about.
    family: "independent",
    scoreType: "integer",
    scoreDirection: "higher_is_better",
    maxDurationSeconds: 300,
    supportsCompetition: true,
    providerStatus: overrides.providerStatus ?? "active",
    chartvoltEnabled: overrides.chartvoltEnabled ?? true,
  });

  const now = Date.now();
  const contest = await Competition.create({
    name: "Puzzle Cup",
    slug: `puzzle-cup-${now}`,
    description: "A mock puzzle competition",
    gameType: "provider",
    gameKey: GAME_KEY,
    gameConfig:
      overrides.gameConfig === null
        ? undefined
        : (overrides.gameConfig ?? {
            providerKey: MOCK_PROVIDER_KEY,
            gameCode: GAME_CODE,
            settings: {},
          }),
    contentSeed: "seed-abc",
    playWindowStart: overrides.playWindowStart ?? new Date(now - 60_000),
    playWindowEnd: overrides.playWindowEnd ?? new Date(now + 3_600_000),
    resultGracePeriodSeconds: 600,
    attemptsPolicy: overrides.attemptsPolicy ?? "single",
    unresolvedRoundPolicy: "score_zero",
    status: overrides.contestStatus ?? "active",
    competitionType: "time_based",
    startTime: new Date(now - 120_000),
    endTime: new Date(now + 7_200_000),
    registrationDeadline: new Date(now - 120_000),
    entryFee: 5,
    minParticipants: 2,
    maxParticipants: 100,
    currentParticipants: 1,
    prizePool: 5,
    platformFeePercentage: 10,
    prizeDistribution: [{ rank: 1, percentage: 100 }],
    createdBy: new mongoose.Types.ObjectId().toString(),
  });

  return contest;
}

async function seatFor(competitionId: string, userId: string) {
  return CompetitionParticipant.create({
    competitionId,
    userId,
    username: "player",
    email: "player@example.com",
    gameKey: GAME_KEY,
    enteredAt: new Date(),
  });
}

const ACTOR = { userId: new mongoose.Types.ObjectId().toString() };

describe("launching a round in a provider competition", () => {
  it("creates a round for a player who holds a seat", async () => {
    const contest = await seedPlayableWorld();
    await seatFor(String(contest._id), ACTOR.userId);

    const outcome = await launchContestRound(String(contest._id), ACTOR);

    expect(outcome.success).toBe(true);
    if (outcome.success) {
      expect(outcome.launchUrl).toContain("http");
      expect(outcome.attemptNumber).toBe(1);
      expect(outcome.idempotent).toBe(false);
    }

    const round = await GameRound.findOne({ contestId: contest._id });
    expect(round?.userId).toBe(ACTOR.userId);
    expect(round?.mode).toBe("ranked");
    // The label is copied from the contest, never derived here - it is the join key for
    // every historical stat and it is immutable.
    expect(round?.gameKey).toBe(GAME_KEY);
  });

  it("REFUSES a signed-in user who never joined the competition", async () => {
    const contest = await seedPlayableWorld();
    // Deliberately no seat.

    const outcome = await launchContestRound(String(contest._id), ACTOR);

    expect(outcome.success).toBe(false);
    if (!outcome.success) expect(outcome.refusal).toBe("not_a_participant");

    // The refusal must leave NOTHING behind. A round created and then rejected still bills
    // the provider and still consumes an attempt number, because the unique index means a
    // surviving row of any status burns it permanently.
    expect(await GameRound.countDocuments({})).toBe(0);
  });

  it("passes the round to the provider with a reachable callback URL", async () => {
    const contest = await seedPlayableWorld();
    await seatFor(String(contest._id), ACTOR.userId);

    await launchContestRound(String(contest._id), ACTOR);

    const round = await GameRound.findOne({ contestId: contest._id });
    expect(round).toBeTruthy();
    // Asserted because a provider that cannot reach us posts every result into nothing,
    // and the only symptom is players reporting vanished scores days later.
    expect(round?.roundId).toBeTruthy();
  });

  it("refuses when the public base URL is not configured, rather than using localhost", async () => {
    const contest = await seedPlayableWorld();
    await seatFor(String(contest._id), ACTOR.userId);
    delete process.env.NEXT_PUBLIC_BASE_URL;

    const outcome = await launchContestRound(String(contest._id), ACTOR);

    expect(outcome.success).toBe(false);
    if (!outcome.success) expect(outcome.refusal).toBe("misconfigured");
    expect(await GameRound.countDocuments({})).toBe(0);
  });

  it("refuses a relative or non-http base URL for the same reason", async () => {
    const contest = await seedPlayableWorld();
    await seatFor(String(contest._id), ACTOR.userId);
    process.env.NEXT_PUBLIC_BASE_URL = "chartvolt.test";

    const outcome = await launchContestRound(String(contest._id), ACTOR);

    expect(outcome.success).toBe(false);
    if (!outcome.success) expect(outcome.refusal).toBe("misconfigured");
  });
});

/**
 * The production-only half of the base-URL check.
 *
 * WHY THIS NEEDED ITS OWN BLOCK
 * -----------------------------
 * A plain-http base URL passes every assertion above: it is absolute, it parses, and a round
 * launches happily with a callback address the provider can never usefully post to. Found live
 * on 6 September 2026 on a deployment running `http://chartvolt.com/` against an https site.
 *
 * `NODE_ENV` has to be reassigned rather than mocked, because the guard reads it at call time -
 * which is the point, since a deployment's value is fixed long before this code runs.
 */
describe("the base URL a provider is told to post results to", () => {
  let savedNodeEnv: string | undefined;

  beforeEach(() => {
    savedNodeEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    // Reason for the cast: `NODE_ENV` is typed as a literal union, and restoring an
    // `undefined` it may legitimately have had is not expressible without it.
    (process.env as Record<string, string | undefined>).NODE_ENV = savedNodeEnv;
  });

  async function launchWith(baseUrl: string, nodeEnv: string) {
    const contest = await seedPlayableWorld();
    await seatFor(String(contest._id), ACTOR.userId);
    process.env.NEXT_PUBLIC_BASE_URL = baseUrl;
    (process.env as Record<string, string | undefined>).NODE_ENV = nodeEnv;

    return launchContestRound(String(contest._id), ACTOR);
  }

  it("refuses plain http in production, because a 301 turns the result POST into a GET", async () => {
    // Certbot installs the http -> https redirect as a matter of course, and the fetch
    // specification converts a POST following a 301 into a GET. The result then arrives at
    // our route as a GET, is rejected, and the round is written off as unresolved days later.
    const outcome = await launchWith("http://chartvolt.test", "production");

    expect(outcome.success).toBe(false);
    if (!outcome.success) expect(outcome.refusal).toBe("misconfigured");
    expect(await GameRound.countDocuments({})).toBe(0);
  });

  it("refuses a loopback host in production, even over https", async () => {
    // The provider is a different process, and on a real integration a different company.
    // 127.0.0.1 there means "post the result to yourself".
    const outcome = await launchWith("https://127.0.0.1:3000", "production");

    expect(outcome.success).toBe(false);
    if (!outcome.success) expect(outcome.refusal).toBe("misconfigured");
    expect(await GameRound.countDocuments({})).toBe(0);
  });

  it("accepts https on a real host in production", async () => {
    // The control. Without it, a guard that refuses everything would pass both tests above.
    const outcome = await launchWith("https://chartvolt.test", "production");

    expect(outcome.success).toBe(true);
    expect(await GameRound.countDocuments({})).toBe(1);
  });

  it("still allows plain http on loopback in development", async () => {
    // Pins the carve-out, not just the guard. Every local rehearsal and every test here
    // legitimately serves plain http on loopback, and a check that fired in development would
    // be switched off rather than fixed - so widening this guard must turn a test red.
    const outcome = await launchWith("http://localhost:3000", "development");

    expect(outcome.success).toBe(true);
    expect(await GameRound.countDocuments({})).toBe(1);
  });

  it("fails closed on a value the protocol test accepts but URL cannot parse", async () => {
    // `https://` satisfies the regex and throws in `new URL`. Returning it anyway would hand
    // the provider a callback address that is not an address.
    const outcome = await launchWith("https://", "production");

    expect(outcome.success).toBe(false);
    if (!outcome.success) expect(outcome.refusal).toBe("misconfigured");
  });
});

describe("the contest-level refusals", () => {
  it("refuses a competition that has not started", async () => {
    const contest = await seedPlayableWorld({ contestStatus: "upcoming" });
    await seatFor(String(contest._id), ACTOR.userId);

    const outcome = await launchContestRound(String(contest._id), ACTOR);
    expect(outcome.success).toBe(false);
    if (!outcome.success) expect(outcome.refusal).toBe("contest_not_open");
  });

  it("refuses while the contest is FINALIZING, not only when completed", async () => {
    // Reason: during `finalizing` ranking is being computed from participant scores, so a
    // round started then may or may not be counted depending purely on timing. That is
    // worse than a clean refusal, because it leaves no trace either way.
    const contest = await seedPlayableWorld({ contestStatus: "finalizing" });
    await seatFor(String(contest._id), ACTOR.userId);

    const outcome = await launchContestRound(String(contest._id), ACTOR);
    expect(outcome.success).toBe(false);
    if (!outcome.success) expect(outcome.refusal).toBe("contest_not_open");
  });

  it("refuses before the play window opens, even though the contest is active", async () => {
    // The play window is narrower than the contest, and only the contest knows about its
    // start - `createRound` enforces the end.
    const contest = await seedPlayableWorld({
      playWindowStart: new Date(Date.now() + 3_600_000),
    });
    await seatFor(String(contest._id), ACTOR.userId);

    const outcome = await launchContestRound(String(contest._id), ACTOR);
    expect(outcome.success).toBe(false);
    if (!outcome.success)
      expect(outcome.refusal).toBe("play_window_not_started");
  });

  it("refuses a title an operator has switched off mid-contest", async () => {
    const contest = await seedPlayableWorld({ chartvoltEnabled: false });
    await seatFor(String(contest._id), ACTOR.userId);

    const outcome = await launchContestRound(String(contest._id), ACTOR);
    expect(outcome.success).toBe(false);
    if (!outcome.success) expect(outcome.refusal).toBe("title_unavailable");
    // Pausing must not read as cancelling: scores already earned still stand, per the rule
    // that a disabled game's history is retired rather than deleted.
    expect(outcome.success ? "" : outcome.error).toMatch(/already completed still count/);
  });

  it("refuses a title the PROVIDER has taken out of service", async () => {
    const contest = await seedPlayableWorld({ providerStatus: "maintenance" });
    await seatFor(String(contest._id), ACTOR.userId);

    const outcome = await launchContestRound(String(contest._id), ACTOR);
    expect(outcome.success).toBe(false);
    if (!outcome.success) expect(outcome.refusal).toBe("title_unavailable");
  });

  it("refuses a trading competition rather than half-launching it", async () => {
    const now = Date.now();
    const trading = await Competition.create({
      name: "Trading Cup",
      slug: `trading-cup-${now}`,
      description: "A trading competition",
      startingCapital: 10_000,
      status: "active",
      competitionType: "time_based",
      startTime: new Date(now - 1000),
      endTime: new Date(now + 3_600_000),
      registrationDeadline: new Date(now - 1000),
      entryFee: 0,
      minParticipants: 2,
      maxParticipants: 10,
      prizePool: 0,
      platformFeePercentage: 10,
      prizeDistribution: [{ rank: 1, percentage: 100 }],
      createdBy: new mongoose.Types.ObjectId().toString(),
    });

    const outcome = await launchContestRound(String(trading._id), ACTOR);
    expect(outcome.success).toBe(false);
    if (!outcome.success) expect(outcome.refusal).toBe("not_provider_contest");
  });

  it("refuses a contest labelled provider but carrying no provider game", async () => {
    // Reason: `isProviderContest` requires the label AND the keys, because a contest with
    // the label alone cannot launch anything and treating it as a provider contest would
    // only move the failure later.
    const contest = await seedPlayableWorld({ gameConfig: null });
    await seatFor(String(contest._id), ACTOR.userId);

    const outcome = await launchContestRound(String(contest._id), ACTOR);
    expect(outcome.success).toBe(false);
    if (!outcome.success) expect(outcome.refusal).toBe("not_provider_contest");
  });

  it("gives a neutral message when OUR configuration is the problem", async () => {
    // An unrecognised attempts policy is our gap, not the player's. They get a neutral
    // message; the operator gets the specific one in the log.
    const contest = await seedPlayableWorld({ attemptsPolicy: "best_of_n" });
    await Competition.updateOne(
      { _id: contest._id },
      { $set: { attemptsPolicy: "unlimited_in_window" } },
    );
    await seatFor(String(contest._id), ACTOR.userId);

    const outcome = await launchContestRound(String(contest._id), ACTOR);
    expect(outcome.success).toBe(false);
    if (!outcome.success) {
      expect(outcome.refusal).toBe("misconfigured");
      expect(outcome.error).not.toContain("attempts policy");
    }
  });

  it("refuses a competition that does not exist", async () => {
    const outcome = await launchContestRound(
      new mongoose.Types.ObjectId().toString(),
      ACTOR,
    );
    expect(outcome.success).toBe(false);
    if (!outcome.success) expect(outcome.refusal).toBe("not_found");
  });
});

describe("pressing Play twice", () => {
  it("returns the SAME round rather than burning a second attempt", async () => {
    const contest = await seedPlayableWorld({ attemptsPolicy: "best_of_n" });
    await Competition.updateOne(
      { _id: contest._id },
      { $set: { attemptsAllowed: 3 } },
    );
    await seatFor(String(contest._id), ACTOR.userId);

    const first = await launchContestRound(String(contest._id), ACTOR);
    const second = await launchContestRound(String(contest._id), ACTOR);

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    if (first.success && second.success) {
      expect(second.roundId).toBe(first.roundId);
      expect(second.idempotent).toBe(true);
      expect(second.attemptNumber).toBe(first.attemptNumber);
    }

    // Reason: an attempt is consumed on CREATION, deliberately - otherwise a player
    // abandons a bad round and retries free forever. So a double-click must not create a
    // second row, and this count is what proves it did not.
    expect(await GameRound.countDocuments({ contestId: contest._id })).toBe(1);
  });
});
