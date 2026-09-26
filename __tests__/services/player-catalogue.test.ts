import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

/**
 * X11 Slice 1 — `player-catalogue.service.ts`.
 *
 * Pins: trading first when enabled; provider hard-gated on externalGamesEnabled; same three
 * title switches as challengeable list; no game-code switch in the service; missing slug →
 * null; contests keyed by stored gameKey (trading includes absent labels).
 */

const GameProvider = (
  await import("@/database/models/games/game-provider.model")
).default;
const ProviderGame = (
  await import("@/database/models/games/provider-game.model")
).default;
const Competition = (
  await import("@/database/models/trading/competition.model")
).default;
const { WhiteLabel } = await import("@/database/models/whitelabel.model");
const { MOCK_PROVIDER_KEY } = await import(
  "@/lib/services/game-providers/adapters/mock.adapter"
);
const {
  listBrowsableGames,
  getBrowsableGameBySlug,
  listContestsForGame,
} = await import("@/lib/services/games/player-catalogue.service");
const { TRADING_GAME_TYPE } = await import("@/lib/games");

const COLLECTIONS = [
  "game_provider",
  "provider_game",
  "game_catalogue_entry",
  "whitelabels",
  "competitions",
];

const GAME_CODE = "mock-puzzle";
const GAME_KEY = `provider:${MOCK_PROVIDER_KEY}:${GAME_CODE}`;

async function seedSettings(opts: {
  externalGamesEnabled?: boolean | "absent";
  enabledGameTypes?: string[] | "absent";
} = {}): Promise<void> {
  if (
    opts.externalGamesEnabled === "absent" &&
    opts.enabledGameTypes === "absent"
  ) {
    return;
  }
  const doc: Record<string, unknown> = {};
  if (opts.externalGamesEnabled !== "absent") {
    doc.externalGamesEnabled = opts.externalGamesEnabled ?? true;
  }
  if (opts.enabledGameTypes !== "absent") {
    doc.enabledGameTypes = opts.enabledGameTypes ?? ["trading", "provider"];
  }
  if (Object.keys(doc).length > 0) {
    await WhiteLabel.create(doc);
  }
}

async function seedProviderTitle(
  overrides: {
    providerEnabled?: boolean;
    title?: Record<string, unknown>;
  } = {},
): Promise<void> {
  await GameProvider.create({
    providerKey: MOCK_PROVIDER_KEY,
    displayName: "Mock Provider",
    baseUrl: "https://mock.example.com",
    enabled: overrides.providerEnabled ?? true,
  });

  await ProviderGame.create({
    providerKey: MOCK_PROVIDER_KEY,
    gameCode: GAME_CODE,
    gameKey: GAME_KEY,
    displayName: "Mock Puzzle",
    tagline: "Solve boards fast",
    family: "independent",
    scoreDirection: "higher_is_better",
    scoreType: "integer",
    maxDurationSeconds: 300,
    supportsCompetition: true,
    supportsOneVsOne: true,
    supportsContentSeed: true,
    chartvoltEnabled: true,
    providerStatus: "active",
    configSchema: { type: "object", properties: {} },
    lastSuccessfulRoundAt: new Date(),
    ...overrides.title,
  });
}

function baseCompetition(overrides: Record<string, unknown> = {}) {
  const start = new Date(Date.now() + 60_000);
  const end = new Date(Date.now() + 3_600_000);
  const isProvider = overrides.gameType === "provider";
  return {
    name: "Test Contest",
    slug: `test-${Math.random().toString(36).slice(2, 10)}`,
    description: "fixture",
    createdBy: new mongoose.Types.ObjectId().toString(),
    status: "upcoming",
    competitionType: "time_based",
    entryFee: 50,
    prizePool: 100,
    platformFeePercentage: 10,
    currentParticipants: 0,
    maxParticipants: 20,
    minParticipants: 2,
    startTime: start,
    endTime: end,
    registrationDeadline: start,
    prizeDistribution: [{ rank: 1, percentage: 100 }],
    ...(isProvider
      ? {
          playWindowStart: start,
          playWindowEnd: end,
          resultGracePeriodSeconds: 600,
          attemptsPolicy: "single",
          unresolvedRoundPolicy: "score_zero",
          gameConfig: {
            providerKey: MOCK_PROVIDER_KEY,
            gameCode: GAME_CODE,
            settings: {},
          },
        }
      : { startingCapital: 10_000 }),
    ...overrides,
  };
}

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

describe("listBrowsableGames", () => {
  it("puts trading first when trading is enabled, then provider titles", async () => {
    await seedSettings();
    await seedProviderTitle();

    const games = await listBrowsableGames();
    expect(games.map((g) => g.slug)).toEqual([TRADING_GAME_TYPE, GAME_CODE]);
    expect(games[0].kind).toBe("trading");
    expect(games[0].gameKey).toBe(TRADING_GAME_TYPE);
    expect(games[1].kind).toBe("provider");
    expect(games[1].gameKey).toBe(GAME_KEY);
    expect(games[1].displayName).toBe("Mock Puzzle");
  });

  /**
   * Task 9 leftover: discovery filter chips key on categorySlug. Trading must carry both
   * the label and the slug on the happy path — the fallback already did, and a missing slug
   * silently drops trading from every genre filter while category still reads "Trading".
   */
  it("exposes categorySlug on trading and resolved provider genres", async () => {
    await seedSettings();
    await seedProviderTitle({ title: { category: "puzzle" } });

    const games = await listBrowsableGames();
    const trading = games.find((g) => g.kind === "trading");
    const provider = games.find((g) => g.kind === "provider");
    expect(trading?.category).toBe("Trading");
    expect(trading?.categorySlug).toBe("trading");
    expect(provider?.category).toBe("Puzzle");
    expect(provider?.categorySlug).toBe("puzzle");
  });

  it("omits trading when it is not in enabledGameTypes", async () => {
    await seedSettings({ enabledGameTypes: ["provider"] });
    await seedProviderTitle();

    const games = await listBrowsableGames();
    expect(games.every((g) => g.kind !== "trading")).toBe(true);
    expect(games).toHaveLength(1);
    expect(games[0].slug).toBe(GAME_CODE);
  });

  it("hides provider cards when externalGamesEnabled is off — trading remains", async () => {
    await seedSettings({ externalGamesEnabled: false });
    await seedProviderTitle();

    const games = await listBrowsableGames();
    expect(games).toHaveLength(1);
    expect(games[0].kind).toBe("trading");
  });

  it("hides provider cards when there is no WhiteLabel at all — fails closed", async () => {
    // No WhiteLabel: getEnabledGameTypes falls back to trading; provider list hard-gates off.
    await seedProviderTitle();

    const games = await listBrowsableGames();
    expect(games).toHaveLength(1);
    expect(games[0].kind).toBe("trading");
  });

  it("excludes a title whose provider is disabled", async () => {
    await seedSettings();
    await seedProviderTitle({ providerEnabled: false });

    const games = await listBrowsableGames();
    expect(games.filter((g) => g.kind === "provider")).toEqual([]);
  });

  it("excludes chartvoltEnabled: false and non-active providerStatus", async () => {
    await seedSettings();
    await seedProviderTitle({ title: { chartvoltEnabled: false } });
    expect(
      (await listBrowsableGames()).filter((g) => g.kind === "provider"),
    ).toEqual([]);

    await clearTestMongo();
    await ensureCollections(COLLECTIONS);
    await seedSettings();
    await seedProviderTitle({ title: { providerStatus: "deprecated" } });
    expect(
      (await listBrowsableGames()).filter((g) => g.kind === "provider"),
    ).toEqual([]);
  });
});

describe("getBrowsableGameBySlug", () => {
  it("returns the trading card for slug trading when enabled", async () => {
    await seedSettings();
    const game = await getBrowsableGameBySlug("trading");
    expect(game?.kind).toBe("trading");
    expect(game?.slug).toBe("trading");
  });

  it("returns null for trading when trading is disabled", async () => {
    await seedSettings({ enabledGameTypes: ["provider"] });
    expect(await getBrowsableGameBySlug("trading")).toBeNull();
  });

  it("resolves a provider title by catalogue slug (seeded as gameCode)", async () => {
    await seedSettings();
    await seedProviderTitle();
    const game = await getBrowsableGameBySlug(GAME_CODE);
    expect(game?.gameKey).toBe(GAME_KEY);
    expect(game?.slug).toBe(GAME_CODE);
  });

  it("returns null for a hidden catalogue entry even when the title is playable", async () => {
    await seedSettings();
    await seedProviderTitle();
    const GameCatalogueEntry = (
      await import("@/database/models/games/game-catalogue-entry.model")
    ).default;
    await listBrowsableGames();
    await GameCatalogueEntry.updateOne(
      { gameKey: GAME_KEY },
      { $set: { isVisible: false } },
    );
    expect(await getBrowsableGameBySlug(GAME_CODE)).toBeNull();
    expect(
      (await listBrowsableGames()).filter((g) => g.gameKey === GAME_KEY),
    ).toEqual([]);
  });

  it("honours sortOrder and comingSoon / isFeatured on the hub list", async () => {
    await seedSettings();
    await seedProviderTitle();
    const GameCatalogueEntry = (
      await import("@/database/models/games/game-catalogue-entry.model")
    ).default;
    await listBrowsableGames();
    await GameCatalogueEntry.updateOne(
      { gameKey: GAME_KEY },
      { $set: { sortOrder: -10, isFeatured: true, comingSoon: true } },
    );
    await GameCatalogueEntry.updateOne(
      { gameKey: TRADING_GAME_TYPE },
      { $set: { sortOrder: 50 } },
    );

    const games = await listBrowsableGames();
    expect(games.map((g) => g.slug)).toEqual([GAME_CODE, TRADING_GAME_TYPE]);
    expect(games[0].isFeatured).toBe(true);
    expect(games[0].comingSoon).toBe(true);
  });

  it("returns null for an unknown slug — never throws", async () => {
    await seedSettings();
    await seedProviderTitle();
    await expect(getBrowsableGameBySlug("no-such-game")).resolves.toBeNull();
    await expect(getBrowsableGameBySlug("")).resolves.toBeNull();
    await expect(getBrowsableGameBySlug(null)).resolves.toBeNull();
  });

  it("returns null for a provider slug when external games are off", async () => {
    await seedSettings({ externalGamesEnabled: false });
    await seedProviderTitle();
    expect(await getBrowsableGameBySlug(GAME_CODE)).toBeNull();
  });
});

describe("listContestsForGame", () => {
  it("lists upcoming and active contests for a provider gameKey", async () => {
    await seedSettings();
    await seedProviderTitle();
    await Competition.create(
      baseCompetition({
        name: "Puzzle Cup",
        gameType: "provider",
        gameKey: GAME_KEY,
        status: "upcoming",
      }),
    );
    // completed must not appear
    await Competition.create(
      baseCompetition({
        name: "Old Puzzle",
        gameType: "provider",
        gameKey: GAME_KEY,
        status: "completed",
      }),
    );

    const contests = await listContestsForGame(GAME_KEY);
    expect(contests).toHaveLength(1);
    expect(contests[0].name).toBe("Puzzle Cup");
    expect(contests[0].status).toBe("upcoming");
    expect(contests[0].entryFee).toBe(50);
  });

  it("includes unlabelled trading contests under the trading gameKey (invariant 5)", async () => {
    await seedSettings();
    await Competition.create(
      baseCompetition({
        name: "Legacy Trading",
        // no gameKey / gameType — pre-X1 shape
        status: "active",
      }),
    );
    await Competition.create(
      baseCompetition({
        name: "Labelled Trading",
        gameType: "trading",
        gameKey: TRADING_GAME_TYPE,
        status: "upcoming",
      }),
    );
    await Competition.create(
      baseCompetition({
        name: "Someone Else's Puzzle",
        gameType: "provider",
        gameKey: GAME_KEY,
        status: "upcoming",
      }),
    );

    const contests = await listContestsForGame(TRADING_GAME_TYPE);
    const names = contests.map((c) => c.name).sort();
    expect(names).toEqual(["Labelled Trading", "Legacy Trading"]);
  });

  it("returns an empty array for a game with no contests — never invents rows", async () => {
    await seedSettings();
    expect(await listContestsForGame(GAME_KEY)).toEqual([]);
  });
});

describe("player-catalogue.service structural guards", () => {
  const source = readFileSync(
    join(
      process.cwd(),
      "lib/services/games/player-catalogue.service.ts",
    ),
    "utf8",
  ).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  it("does not hard-code a provider title name or game code", () => {
    // Reason: enumerating titles is the one failure mode of "no additional coding".
    expect(source).not.toMatch(/circuit-sprint/i);
    expect(source).not.toMatch(/Circuit Sprint/);
    expect(source).not.toMatch(/mock-puzzle/);
  });

  it("does not switch on gameCode or gameKey for presentation", () => {
    expect(source).not.toMatch(/switch\s*\(\s*gameCode/);
    expect(source).not.toMatch(/switch\s*\(\s*.*gameKey/);
  });

  it("reads merchandising from game_catalogue_entry / GameCatalogueEntry", () => {
    expect(source).toMatch(/GameCatalogueEntry/);
    expect(source).toMatch(/ensureCatalogueEntries/);
  });
});

describe("game-catalogue-entry model mirrors", () => {
  it("model is byte-identical in both apps", () => {
    const main = readFileSync(
      join(process.cwd(), "database/models/games/game-catalogue-entry.model.ts"),
      "utf8",
    );
    const admin = readFileSync(
      join(
        process.cwd(),
        "apps/admin/database/models/games/game-catalogue-entry.model.ts",
      ),
      "utf8",
    );
    expect(admin).toBe(main);
  });

  it("service is byte-identical in both apps", () => {
    const main = readFileSync(
      join(
        process.cwd(),
        "lib/services/games/game-catalogue-entry.service.ts",
      ),
      "utf8",
    );
    const admin = readFileSync(
      join(
        process.cwd(),
        "apps/admin/lib/services/games/game-catalogue-entry.service.ts",
      ),
      "utf8",
    );
    expect(admin).toBe(main);
  });
});
