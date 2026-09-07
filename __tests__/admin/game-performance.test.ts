/**
 * Game Performance - `12` s5's per-game operational screen.
 *
 * BEHAVIOURAL tests, because every rule worth pinning is a rule about what the figures are
 * given a particular history of rounds, and none of them can be checked by reading the code.
 *
 * WHICH COPY OF EACH MODEL THIS FILE SEEDS IS NOT A FREE CHOICE. The service lives in
 * `apps/admin`, but vitest maps `@` to the REPO ROOT, so its `@/database/...` imports resolve
 * to the MAIN app's models rather than the admin copies beside it. This file therefore seeds
 * the main copies - the ones the service actually reads. Seeding the admin copies puts
 * fixtures on a Mongoose instance the service never touches, and every assertion then fails
 * on an empty collection, which reads exactly like a logic bug.
 *
 * Only ONE copy of each model is imported, because both register under the same name via
 * `models.X || model(...)` and importing both silently returns whichever registered first.
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
import mongoose, { Types } from "mongoose";
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

const GameProvider = (
  await import("../../database/models/games/game-provider.model")
).default;
const ProviderGame = (
  await import("../../database/models/games/provider-game.model")
).default;
const GameRound = (await import("../../database/models/games/game-round.model"))
  .default;
const CompetitionParticipant = (
  await import("../../database/models/trading/competition-participant.model")
).default;
const { getGamePerformance, resolveWindow, PERFORMANCE_WINDOWS } = await import(
  "../../apps/admin/lib/services/games/game-performance.service"
);
const { MOCK_PROVIDER_KEY } = await import(
  "../../lib/services/game-providers/adapters/mock.adapter"
);

const GAME_CODE = "mock-trivia";
const GAME_KEY = `provider:${MOCK_PROVIDER_KEY}:${GAME_CODE}`;

const COLLECTIONS = [
  "game_provider",
  "provider_game",
  "game_round",
  "competitionparticipants",
];

beforeAll(async () => {
  const uri = await startTestMongo();
  await mongoose.connect(uri);
  await ensureCollections(COLLECTIONS);
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect();
  await stopTestMongo();
});

beforeEach(async () => {
  await clearTestMongo();
  await ensureCollections(COLLECTIONS);
  roundCounter = 0;
});

async function seedCatalogue() {
  await GameProvider.create({
    providerKey: MOCK_PROVIDER_KEY,
    displayName: "Mock Provider",
    baseUrl: "https://mock.example.com",
    enabled: true,
  });
  await ProviderGame.create({
    providerKey: MOCK_PROVIDER_KEY,
    gameCode: GAME_CODE,
    gameKey: GAME_KEY,
    displayName: "Mock Trivia",
    family: "independent",
    supportsCompetition: true,
    scoreDirection: "higher_is_better",
    scoreType: "integer",
    providerStatus: "active",
    chartvoltEnabled: true,
  });
}

let roundCounter = 0;
async function seedRound(
  status: string,
  overrides: Record<string, unknown> = {},
) {
  roundCounter += 1;
  return GameRound.create({
    roundId: `cv_rnd_perf_${roundCounter}`,
    providerKey: MOCK_PROVIDER_KEY,
    gameCode: GAME_CODE,
    gameKey: GAME_KEY,
    userId: new Types.ObjectId().toString(),
    contestType: "competition",
    contestId: new Types.ObjectId(),
    attemptNumber: roundCounter,
    mode: "ranked",
    status,
    expiresAt: new Date(Date.now() + 60_000),
    ...overrides,
  });
}

/**
 * A seat, satisfying the WHOLE schema rather than the fields the service reads.
 *
 * `email` and `username` are required and play no part in any figure on this screen, but
 * Mongoose validates the document rather than the subset a test cares about - a trimmed
 * fixture fails every assertion at once for one unrelated reason, which is the recurring trap
 * recorded against the `Competition` fixture. The virtual-capital fields are conditional on
 * `gameKey === "trading"` and are correctly absent here.
 */
async function seedSeat(competitionId: string, userId: string) {
  return CompetitionParticipant.create({
    competitionId,
    userId,
    username: `player-${userId.slice(-6)}`,
    email: `player-${userId.slice(-6)}@example.com`,
    gameKey: GAME_KEY,
    score: 0,
  });
}

describe("the window is an allow-list, never a number from the caller", () => {
  /**
   * The deciding value of a database scan must not come from caller input. An arbitrary
   * `days` is a full-collection scan anybody holding the grant can trigger by editing a URL,
   * and it would look exactly like a legitimate request in the logs.
   */
  it("falls back to the default rather than honouring an arbitrary day count", () => {
    expect(resolveWindow("100000")).toBe(30);
    expect(resolveWindow("0")).toBe(30);
    expect(resolveWindow("-1")).toBe(30);
    expect(resolveWindow(null)).toBe(30);
    expect(resolveWindow("not a number")).toBe(30);
  });

  it("honours a window that is on the list", () => {
    expect(resolveWindow("7")).toBe(7);
    expect(resolveWindow("90")).toBe(90);
    // Asserted rather than assumed: a window added to the list without being offered by the
    // UI would silently be unreachable, and one removed would silently fall back.
    expect([...PERFORMANCE_WINDOWS]).toEqual([7, 30, 90]);
  });
});

describe("practice rounds are excluded", () => {
  /**
   * Nothing is at stake in a practice round, so a player abandoning one is not a signal about
   * the game. Counting them makes every title's abandonment rate a measure of how much free
   * play it gets, which is a number that looks precise and answers nothing.
   */
  it("does not count a practice round as traffic", async () => {
    await seedCatalogue();
    await seedRound("abandoned", {
      mode: "practice",
      contestType: "practice",
      contestId: null,
    });

    const rows = await getGamePerformance(30);
    expect(rows).toHaveLength(0);
  });
});

describe("no traffic is its own verdict, not a guess", () => {
  /**
   * Same reasoning as provider health's own `no_traffic`: a title with no play is neither
   * healthy nor broken, and a green badge there is a guess presented as a measurement.
   */
  it("says so rather than reporting healthy when every round is still live", async () => {
    await seedCatalogue();
    await seedRound("launched");
    await seedRound("pending");

    const [row] = await getGamePerformance(30);
    expect(row.verdict).toBe("no_traffic");
    expect(row.rounds.live).toBe(2);
    expect(row.summary).toMatch(/nothing to judge/i);
  });

  it("omits a title whose only rounds are older than the window", async () => {
    await seedCatalogue();
    const old = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    await seedRound("completed", { createdAt: old, rawScore: 10 });

    // Reason 7 and not 30: the fixture is 60 days old, so a 30-day window would exclude it
    // too and the test would pass with the window filter removed entirely.
    expect(await getGamePerformance(7)).toHaveLength(0);
    expect(await getGamePerformance(90)).toHaveLength(1);
  });
});

describe("a round nobody reported is a fault; a round a player walked away from is not", () => {
  /**
   * The two are counted separately because they need different actions. An abandoned round is
   * the player's doing and the answer is to read the settings; an unresolved round is the
   * provider never reporting, and it either holds settlement or scores a player zero for a
   * game they actually played.
   */
  it("calls a title with unreported rounds a problem and one with abandonment a watch", async () => {
    await seedCatalogue();
    for (let i = 0; i < 8; i += 1) {
      await seedRound("completed", { rawScore: 10, durationMs: 30_000 });
    }
    await seedRound("unresolved");

    const [problem] = await getGamePerformance(30);
    expect(problem.verdict).toBe("problem");
    expect(problem.rounds.neverReported).toBe(1);
    expect(problem.summary).toMatch(/never reported/i);

    await clearTestMongo();
    await ensureCollections(COLLECTIONS);
    roundCounter = 0;
    await seedCatalogue();
    for (let i = 0; i < 5; i += 1) {
      await seedRound("completed", { rawScore: 10, durationMs: 30_000 });
    }
    for (let i = 0; i < 5; i += 1) {
      await seedRound("abandoned");
    }

    const [watch] = await getGamePerformance(30);
    expect(watch.verdict).toBe("watch");
    expect(watch.rounds.gaveUp).toBe(5);
    expect(watch.abandonmentRate).toBeCloseTo(0.5, 5);
  });

  it("reports abandonment as a share of finished rounds, not a bare count", async () => {
    await seedCatalogue();
    // Two abandoned out of four is a game people cannot get on with. Two out of four hundred
    // is nothing. A count calls both the same, which is why the rate is what the verdict reads.
    await seedRound("abandoned");
    await seedRound("abandoned");
    await seedRound("completed", { rawScore: 1, durationMs: 1_000 });
    await seedRound("completed", { rawScore: 1, durationMs: 1_000 });

    const [row] = await getGamePerformance(30);
    expect(row.abandonmentRate).toBeCloseTo(0.5, 5);
    expect(row.verdict).toBe("watch");
  });

  it("does not count live rounds in the abandonment denominator", async () => {
    await seedCatalogue();
    await seedRound("abandoned");
    await seedRound("completed", { rawScore: 1, durationMs: 1_000 });
    await seedRound("launched");
    await seedRound("launched");

    const [row] = await getGamePerformance(30);
    // Reason: a round still in play has not been abandoned OR completed, so including it
    // dilutes the rate and the number improves every time somebody starts playing.
    expect(row.abandonmentRate).toBeCloseTo(0.5, 5);
  });
});

describe("result latency is measured, because nothing else measures it", () => {
  /**
   * THIS IS THE NUMBER R44's GRACE WINDOW EXISTS FOR. A latency approaching the window means
   * results are about to start being refused as late, and a player who finished inside the
   * contest is then ranked on nothing. It is the earliest available warning and nothing was
   * measuring it.
   */
  it("averages the delay between the provider finishing and us receiving", async () => {
    await seedCatalogue();
    const completedAt = new Date(Date.now() - 10_000);
    await seedRound("completed", {
      rawScore: 5,
      durationMs: 20_000,
      completedAt,
      resultReceivedAt: new Date(completedAt.getTime() + 2_000),
    });
    await seedRound("completed", {
      rawScore: 5,
      durationMs: 20_000,
      completedAt,
      resultReceivedAt: new Date(completedAt.getTime() + 4_000),
    });

    const [row] = await getGamePerformance(30);
    expect(row.averageResultLatencySeconds).toBeCloseTo(3, 3);
    expect(row.averagePlaySeconds).toBeCloseTo(20, 3);
  });

  /**
   * `completedAt` is the PROVIDER's clock and `resultReceivedAt` is OURS, so this is the only
   * cross-clock figure on the screen. A negative delay means the two disagree, which is a
   * different problem from a slow provider - and averaging a negative into the mean hides
   * both, reporting a healthy latency on a provider whose clock is minutes ahead.
   */
  it("counts a negative delay as clock skew instead of averaging it in", async () => {
    await seedCatalogue();
    const receivedAt = new Date();
    await seedRound("completed", {
      rawScore: 5,
      durationMs: 1_000,
      completedAt: new Date(receivedAt.getTime() - 2_000),
      resultReceivedAt: receivedAt,
    });
    await seedRound("completed", {
      rawScore: 5,
      durationMs: 1_000,
      // The provider claims to have finished AFTER we received the result.
      completedAt: new Date(receivedAt.getTime() + 30_000),
      resultReceivedAt: receivedAt,
    });

    const [row] = await getGamePerformance(30);
    expect(row.clockSkewedResults).toBe(1);
    // 2s, not the mean of 2 and -30 (which would read as a suspiciously fast provider).
    expect(row.averageResultLatencySeconds).toBeCloseTo(2, 3);
  });

  it("reports no latency at all rather than zero when nothing carries both timestamps", async () => {
    await seedCatalogue();
    await seedRound("completed", { rawScore: 5, durationMs: 1_000 });

    const [row] = await getGamePerformance(30);
    // Reason `null` and not `0`: an instant result and an unmeasurable one are different
    // facts, and `0` reads as the first. Same distinction as the score column's `-`.
    expect(row.averageResultLatencySeconds).toBeNull();
  });
});

describe("the participation funnel counts the right two sets", () => {
  /**
   * An entrant who never started a round is invisible on every other screen - they simply
   * rank last. It is either a player who could not find the button or a launch that refused.
   */
  it("counts entrants who never started a round in a competition they paid for", async () => {
    await seedCatalogue();
    const contestId = new Types.ObjectId();
    const played = new Types.ObjectId().toString();
    const didNotPlay = new Types.ObjectId().toString();

    await seedRound("completed", {
      contestId,
      userId: played,
      rawScore: 10,
      durationMs: 5_000,
    });
    await seedSeat(contestId.toString(), played);
    await seedSeat(contestId.toString(), didNotPlay);

    const [row] = await getGamePerformance(30);
    expect(row.entrantsWhoNeverPlayed).toBe(1);
    expect(row.contests).toBe(1);
  });

  /**
   * `game_round.contestId` is an ObjectId while `competition_participant.competitionId` is
   * declared `String`, and the raw driver does no casting. An unconverted `$in` matches
   * nothing, logs nothing, and reports every entrant as having played - a number that is
   * always reassuring and always wrong. Same trap as the R42 fixture.
   */
  it("matches seats across the ObjectId/String boundary", async () => {
    await seedCatalogue();
    const contestId = new Types.ObjectId();
    await seedRound("completed", {
      contestId,
      rawScore: 1,
      durationMs: 1_000,
    });
    for (let i = 0; i < 3; i += 1) {
      await seedSeat(contestId.toString(), new Types.ObjectId().toString());
    }

    const [row] = await getGamePerformance(30);
    // Three seats, none of which is the user who played, so all three never played. A broken
    // `$in` would return 0 here.
    expect(row.entrantsWhoNeverPlayed).toBe(3);
  });

  /**
   * The denominator is COMPETITION seats, so the played set must be competition rounds only.
   * A challenge player counted against competition entrants produces a shortfall that is
   * wrong on any game and negative on a busy one, while still rendering a plausible number.
   */
  it("does not let a challenge round count as having played a competition", async () => {
    await seedCatalogue();
    const contestId = new Types.ObjectId();
    const challenger = new Types.ObjectId().toString();

    // A seat in the competition, and a round played in a CHALLENGE by the same person.
    await seedRound("completed", {
      contestId,
      rawScore: 1,
      durationMs: 1_000,
    });
    await seedRound("completed", {
      contestType: "challenge",
      contestId: new Types.ObjectId(),
      userId: challenger,
      rawScore: 1,
      durationMs: 1_000,
    });
    await seedSeat(contestId.toString(), challenger);

    const [row] = await getGamePerformance(30);
    expect(row.entrantsWhoNeverPlayed).toBe(1);
  });

  it("reports no funnel at all rather than zero when there are no seats", async () => {
    await seedCatalogue();
    await seedRound("completed", { rawScore: 1, durationMs: 1_000 });

    const [row] = await getGamePerformance(30);
    // Nobody having entered and everybody having played are different facts, and `0` reads as
    // the second.
    expect(row.entrantsWhoNeverPlayed).toBeNull();
  });
});

describe("a title that has left the catalogue still has history", () => {
  /**
   * A disabled game's rows are RETIRED, never deleted (R29), and `gameKey` is immutable, so
   * its history stays addressable for ever. A screen that dropped the row would make the
   * abandonment its rounds recorded disappear the moment an operator switched the game off -
   * the read-side form of the retroactive-subtraction failure R29 exists to prevent.
   */
  it("still reports the game, labelled, when its catalogue row is gone", async () => {
    await seedCatalogue();
    await seedRound("completed", { rawScore: 1, durationMs: 1_000 });
    await ProviderGame.deleteMany({});

    const [row] = await getGamePerformance(30);
    expect(row.gameKey).toBe(GAME_KEY);
    expect(row.inCatalogue).toBe(false);
    // Falls back through the key rather than reading "Unknown", which would make two retired
    // titles indistinguishable.
    expect(row.title).toBe(GAME_CODE);
    expect(row.providerKey).toBe(MOCK_PROVIDER_KEY);
  });
});

describe("the verdict and the sentence cannot disagree", () => {
  /**
   * They are computed together in the service rather than assembled in the component, so a
   * badge reading "problem" beside a sentence describing healthy traffic is not reachable.
   * That combination is worse than either being wrong alone, because it destroys an
   * operator's confidence in the whole screen.
   */
  it("never returns a bare status word as the summary", async () => {
    await seedCatalogue();
    await seedRound("completed", { rawScore: 1, durationMs: 1_000 });

    const [row] = await getGamePerformance(30);
    expect(row.verdict).toBe("healthy");
    expect(row.summary.length).toBeGreaterThan(30);
    // The sentence must name what it is based on, not restate the badge.
    expect(row.summary).toMatch(/\d/);
  });
});

describe("the screen carries no money, and that is an RBAC rule", () => {
  const root = join(process.cwd(), "apps", "admin");
  const service = readFileSync(
    join(root, "lib", "services", "games", "game-performance.service.ts"),
    "utf8",
  );
  const component = readFileSync(
    join(root, "components", "admin", "games", "GamePerformanceSection.tsx"),
    "utf8",
  );
  const route = readFileSync(
    join(root, "app", "api", "games", "performance", "route.ts"),
    "utf8",
  );

  /** Comments discuss the money this screen deliberately omits, so prose must not be matched. */
  function stripComments(source: string): string {
    return source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
  }

  /**
   * This screen is granted by a games section; entry-fee volume and platform revenue are
   * granted by `analytics` and `financial`. Adding a revenue figure here would widen who can
   * read it while reviewing as a helpful addition - the same shape as the section merge `12`
   * s1.1 warns about.
   */
  it("reads no money field and imports no money model", () => {
    const code = stripComments(service);
    for (const forbidden of [
      "entryFee",
      "prizePool",
      "platformFee",
      "WalletTransaction",
      "PlatformTransaction",
      "wallet",
    ]) {
      expect(code).not.toContain(forbidden);
    }
  });

  it("renders no currency and reads no money field", () => {
    const code = stripComments(component);
    for (const forbidden of ["creditSymbol", "entryFee", "prizePool", "platformFee"]) {
      expect(code).not.toContain(forbidden);
    }
    // A currency SYMBOL, not a bare `$` - the file is full of `${...}` template literals and a
    // literal match on `$` flags every one of them, which is a guard that fails on correct
    // code and therefore gets deleted.
    expect(code).not.toMatch(/€/);
    expect(code).not.toMatch(/\$(?!\{)\s*\{?\s*[\d(]/);
    // The claim is about the DATA, not about the prose: the description deliberately mentions
    // fee revenue in order to send an operator to the screen that carries it, and a check on
    // the word alone would forbid the signpost that makes the omission navigable. Every field
    // this component reads off a row is asserted instead.
    const readFields = [...code.matchAll(/row\.([A-Za-z.]+)/g)].map((m) => m[1]);
    expect(readFields.length).toBeGreaterThan(8);
    for (const field of readFields) {
      expect(field).not.toMatch(/fee|prize|revenue|credit|amount|pool|payout/i);
    }
  });

  /**
   * The positive half, and it is not decoration: a screen that omits money without saying
   * where money lives teaches an operator that the platform has no per-game revenue figures
   * at all. Naming the other screen is what makes the omission a boundary rather than a gap.
   */
  it("says where the money figures are instead", () => {
    expect(component).toMatch(/Competition Analytics/);
  });

  /**
   * `guardSection`, never `requireAdminAuth` - the latter asks only whether the caller is an
   * admin at all, so an employee granted one unrelated section passes it. Sixth instance of
   * that class in this codebase, which is why it is asserted rather than reviewed.
   */
  it("guards on the section grant and not merely on being an admin", () => {
    const code = stripComments(route);
    expect(code).toContain('guardSection("game-performance")');
    expect(code).not.toContain("requireAdminAuth");
    expect(code).not.toContain("verifyAdminToken");
    // Counted, not merely found: a file whose GET is guarded and whose second handler is not
    // passes any mention-based check while leaving the other one open.
    const handlers = code.match(/export async function (GET|POST|PATCH|PUT|DELETE)/g) ?? [];
    const guards = code.match(/guardSection\(/g) ?? [];
    expect(handlers.length).toBe(1);
    expect(guards.length).toBe(handlers.length);
  });

  /**
   * The section id is a Mongoose enum value on `allowedSections`, so it is ADD-ONLY: removing
   * it orphans every employee document storing it. Pinned so a later tidy-up cannot drop it.
   */
  it("registers the section id so the grant can be given", () => {
    const model = readFileSync(
      join(root, "database", "models", "admin-employee.model.ts"),
      "utf8",
    );
    expect(stripComments(model)).toContain('"game-performance"');
  });
});
