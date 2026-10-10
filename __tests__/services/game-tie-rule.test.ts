import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  vi,
} from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import mongoose from "mongoose";
import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
  ensureCollections,
} from "../helpers/mongo-test-server";

/**
 * The game tie rule: "If two players have the same score".
 *
 * Owner, 1 October 2026. A game contest offers exactly two answers - the faster player wins
 * (the default, and the behaviour every game contest had before the setting existed), or the
 * tied players share the prize. Trading keeps its own list; `split_weighted` divides by
 * capital, which a game player does not have, and `first_gets_all` decides by sign-up time,
 * so the first person to register wins money. Neither may reach a game contest.
 *
 * WHAT IS GUARDED, because each failure here is silent:
 *   1. The choice is STORED as the rules settlement actually reads, so "share" really ranks
 *      tied players together and "fastest" really orders them by time.
 *   2. An unknown value is REFUSED, not dropped - dropping would create a contest under the
 *      default while the operator believes they chose something else.
 *   3. The shared module is byte-identical in both apps, since the admin wizard and the
 *      Game Master route read the same answer.
 */

vi.mock("@/database/mongoose", () => ({
  connectToDatabase: async () => mongoose.connection,
  default: async () => mongoose.connection,
}));

const ROOT = join(__dirname, "..", "..");

const {
  DEFAULT_GAME_TIE_RULE,
  GAME_TIE_RULES,
  gameTieRuleToRules,
  isGameTieRule,
  resolveGameTieRule,
} = await import("@/lib/services/games/game-tie-rule");
const { calculateRankings } = await import(
  "../../lib/services/competition-ranking.service"
);
const Competition = (
  await import("../../database/models/trading/competition.model")
).default;
const GameProvider = (
  await import("../../database/models/games/game-provider.model")
).default;
const ProviderGame = (
  await import("../../database/models/games/provider-game.model")
).default;
const { WhiteLabel } = await import("../../database/models/whitelabel.model");
const { MOCK_PROVIDER_KEY } = await import(
  "@/lib/services/game-providers/adapters/mock.adapter"
);
const { createProviderContest } = await import(
  "../../apps/admin/lib/services/game-providers/provider-contest.service"
);

type RankInput = Parameters<typeof calculateRankings>[0];
type RulesInput = Parameters<typeof calculateRankings>[1];

describe("the shared tie-rule module", () => {
  it("is byte-identical in both apps", () => {
    const main = readFileSync(
      join(ROOT, "lib/services/games/game-tie-rule.ts"),
      "utf8",
    );
    const admin = readFileSync(
      join(ROOT, "apps/admin/lib/services/games/game-tie-rule.ts"),
      "utf8",
    );
    expect(admin).toBe(main);
  });

  it("offers exactly two rules and defaults to the faster player", () => {
    expect([...GAME_TIE_RULES]).toEqual(["fastest_wins", "share_prize"]);
    expect(DEFAULT_GAME_TIE_RULE).toBe("fastest_wins");
  });

  it("refuses trading's options and prototype keys", () => {
    for (const bad of ["split_weighted", "first_gets_all", "split_equally", "constructor", "", undefined]) {
      expect(isGameTieRule(bad)).toBe(false);
    }
  });

  it("round-trips each rule through the stored rules", () => {
    for (const rule of GAME_TIE_RULES) {
      expect(resolveGameTieRule(gameTieRuleToRules(rule))).toBe(rule);
    }
  });
});

describe("ranking honours the stored rule", () => {
  const field = (): RankInput =>
    [
      { userId: "slow", score: 80, durationMs: 90_000 },
      { userId: "fast", score: 80, durationMs: 40_000 },
      { userId: "low", score: 10, durationMs: 10_000 },
    ].map((row) => ({
      ...row,
      username: row.userId,
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
    })) as unknown as RankInput;

  const rulesFor = (rule: "fastest_wins" | "share_prize"): RulesInput =>
    ({
      rankingMethod: "pnl",
      ...gameTieRuleToRules(rule),
      minimumTrades: 0,
      disqualifyOnLiquidation: false,
    }) as unknown as RulesInput;

  it("puts the faster of two equal scores first under fastest_wins", () => {
    const ranked = calculateRankings(field(), rulesFor("fastest_wins"), {
      gameType: "provider",
    });
    const rankOf = (id: string) => ranked.find((r) => r.userId === id)?.rank;
    expect(rankOf("fast")).toBe(1);
    expect(rankOf("slow")).toBe(2);
    expect(rankOf("low")).toBe(3);
  });

  it("places two equal scores together under share_prize", () => {
    const ranked = calculateRankings(field(), rulesFor("share_prize"), {
      gameType: "provider",
    });
    const rankOf = (id: string) => ranked.find((r) => r.userId === id)?.rank;
    expect(rankOf("fast")).toBe(1);
    expect(rankOf("slow")).toBe(1);
    // The next player skips the shared positions: two people occupy first and second.
    expect(rankOf("low")).toBe(3);
  });
});

// =======================================================================================
// The create service - behavioural, against a real database
// =======================================================================================

const COLLECTIONS = ["competitions", "game_provider", "provider_game", "whitelabels"];
const HOUR = 60 * 60 * 1000;

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
});

async function seedCatalogue() {
  const gameCode = "mock-trivia";
  await GameProvider.create({
    providerKey: MOCK_PROVIDER_KEY,
    displayName: "Mock Provider",
    baseUrl: "https://mock.example.com",
    enabled: true,
  });
  await ProviderGame.create({
    providerKey: MOCK_PROVIDER_KEY,
    gameCode,
    gameKey: `provider:${MOCK_PROVIDER_KEY}:${gameCode}`,
    displayName: "Mock Trivia",
    family: "independent",
    scoreDirection: "higher_is_better",
    scoreType: "integer",
    maxDurationSeconds: 300,
    supportsCompetition: true,
    supportsOneVsOne: true,
    supportsContentSeed: true,
    chartvoltEnabled: true,
    providerStatus: "active",
    configSchema: {
      type: "object",
      properties: {
        rounds: { type: "integer", minimum: 1, maximum: 20, default: 5 },
      },
      required: ["rounds"],
    },
    lastSuccessfulRoundAt: new Date(),
  });
  await WhiteLabel.create({ externalGamesEnabled: true });
  return gameCode;
}

function createInput(gameCode: string, overrides: Record<string, unknown> = {}) {
  const start = new Date(Date.now() + 2 * HOUR);
  const end = new Date(Date.now() + 6 * HOUR);
  return {
    providerKey: MOCK_PROVIDER_KEY,
    gameCode,
    name: "Tie Test",
    description: "A contest used to check the tie rule reaches the database.",
    settings: { rounds: 5 },
    startTime: start,
    endTime: end,
    playWindowStart: start,
    playWindowEnd: end,
    resultGracePeriodSeconds: 900,
    attemptsPolicy: "single" as const,
    roundStartPolicy: "until_window_closes" as const,
    unresolvedRoundPolicy: "score_zero" as const,
    unscoredContestPolicy: "unclaimed_pool" as const,
    entryFee: 10,
    minParticipants: 2,
    maxParticipants: 50,
    platformFeePercentage: 10,
    prizeDistribution: [
      { rank: 1, percentage: 50 },
      { rank: 2, percentage: 30 },
      { rank: 3, percentage: 20 },
    ],
    createdBy: "507f1f77bcf86cd799439011",
    perRoundCostAcknowledged: true,
    ...overrides,
  };
}

async function storedRules() {
  const doc = await Competition.findOne({ name: "Tie Test" }).lean<{
    rules?: { tieBreaker1?: string; tieBreaker2?: string };
  } | null>();
  return doc?.rules;
}

describe("createProviderContest stores the tie rule", () => {
  it("defaults to the faster player when none is chosen", async () => {
    const gameCode = await seedCatalogue();
    const result = await createProviderContest(createInput(gameCode));
    expect(result.success).toBe(true);
    const rules = await storedRules();
    expect(rules?.tieBreaker1).toBe("fastest_time");
    expect(rules?.tieBreaker2).toBe("completed_at");
  });

  it("stores split_prize breakers when the operator chooses to share", async () => {
    const gameCode = await seedCatalogue();
    const result = await createProviderContest(
      createInput(gameCode, { tieRule: "share_prize" }),
    );
    expect(result.success).toBe(true);
    const rules = await storedRules();
    expect(rules?.tieBreaker1).toBe("split_prize");
    expect(rules?.tieBreaker2).toBe("split_prize");
  });

  it("refuses first_gets_all and writes nothing", async () => {
    const gameCode = await seedCatalogue();
    const result = await createProviderContest(
      createInput(gameCode, { tieRule: "first_gets_all" }),
    );
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).toContain("the faster player wins");
    expect(await Competition.countDocuments({})).toBe(0);
  });
});

describe("the Game Master route passes the choice through", () => {
  it("hands body.tieRule to the create service in both copies", () => {
    for (const path of [
      "lib/services/gamemaster/create-provider-competition.ts",
      "apps/admin/lib/services/gamemaster/create-provider-competition.ts",
    ]) {
      const source = readFileSync(join(ROOT, path), "utf8");
      expect(source).toMatch(/tieRule:\s*\(body\.tieRule as GameTieRule/);
    }
  });
});
