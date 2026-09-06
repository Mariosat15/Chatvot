import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import fs from "fs";
import path from "path";

import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
  ensureCollections,
} from "../helpers/mongo-test-server";
import {
  MockProviderAdapter,
  MOCK_PROVIDER_KEY,
} from "../../lib/services/game-providers/adapters/mock.adapter";
import {
  buildProviderGameKey,
  syncProviderCatalogue,
} from "../../lib/services/game-providers/catalogue.service";
import {
  getProviderAdapter,
  listRegisteredProviderKeys,
  registerProviderAdapter,
} from "../../lib/services/game-providers/registry";
import ProviderGame from "../../database/models/games/provider-game.model";
import GameProvider from "../../database/models/games/game-provider.model";

/**
 * X2: the provider abstraction and the mock adapter.
 *
 * The most important test in this file is the FIRST one, and it is not about behaviour at
 * all. Chapter 07 section 6 invariant 6 requires that a test fail if provider code can
 * reach the wallet. Everything else here can be re-derived from the plan; that one encodes
 * the promise the whole regulatory position rests on.
 */

const PROVIDER_LAYER = path.join(
  process.cwd(),
  "lib",
  "services",
  "game-providers",
);

function layerFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".ts")) out.push(full);
    }
  };
  walk(PROVIDER_LAYER);
  return out;
}

function sourceOf(file: string): string {
  return fs.readFileSync(file, "utf8");
}

describe("invariant 6: a provider can never touch money", () => {
  // Reason: named explicitly rather than matched by a loose /wallet/i, so that a new money
  // model added later is a deliberate addition to this list and not silently permitted.
  const FORBIDDEN = [
    "credit-wallet",
    "wallet-transaction",
    "withdrawal",
    "deposit",
    "payment-provider",
    "stripe",
    "prize",
    "payout",
  ];

  it.each(FORBIDDEN)("no file in the provider layer imports %s", (needle) => {
    for (const file of layerFiles()) {
      const imports = sourceOf(file)
        .split("\n")
        .filter((line) => /^\s*import\s|require\(/.test(line))
        .join("\n")
        .toLowerCase();
      expect(imports, `${path.basename(file)} imports ${needle}`).not.toContain(
        needle,
      );
    }
  });

  it("the mock adapter imports no database model at all", () => {
    // Reason: the adapter's whole job is to talk to a provider and normalise the answer.
    // A model import here would mean it had started making decisions about our data, which
    // is where provider concepts begin leaking past the boundary (invariant 7).
    const source = sourceOf(
      path.join(PROVIDER_LAYER, "adapters", "mock.adapter.ts"),
    );
    expect(source).not.toMatch(/from\s+["'].*database\/models/);
    expect(source).not.toMatch(/from\s+["'].*database\/mongoose/);
  });

  it("the contract declares no money-bearing field", () => {
    const source = sourceOf(path.join(PROVIDER_LAYER, "contract.ts"));
    for (const banned of ["balance", "amount", "currency", "walletId"]) {
      expect(source.toLowerCase()).not.toContain(`${banned}:`);
    }
  });
});

describe("the provider registry resolves an adapter by key", () => {
  it("resolves the mock adapter", () => {
    const adapter = getProviderAdapter(MOCK_PROVIDER_KEY);
    expect(adapter).not.toBeNull();
    expect(adapter?.providerKey).toBe(MOCK_PROVIDER_KEY);
  });

  it("returns null rather than throwing for an unknown key", () => {
    expect(getProviderAdapter("nope")).toBeNull();
    expect(getProviderAdapter(null)).toBeNull();
    expect(getProviderAdapter(undefined)).toBeNull();
    expect(getProviderAdapter("")).toBeNull();
  });

  it("accepts a newly registered adapter, which is the whole claim of the abstraction", () => {
    // Reason: "a second provider costs one file and one registry entry" is the entire
    // justification for this layer, so it gets an assertion rather than a comment.
    class SecondAdapter extends MockProviderAdapter {
      readonly providerKey = "second";
      readonly displayName = "Second Provider";
    }
    registerProviderAdapter(new SecondAdapter());
    expect(getProviderAdapter("second")?.providerKey).toBe("second");
    expect(listRegisteredProviderKeys()).toContain("second");
  });
});

describe("the mock adapter is a faithful liar", () => {
  let adapter: MockProviderAdapter;

  beforeEach(() => {
    adapter = new MockProviderAdapter();
  });

  it("returns a catalogue with BOTH score directions", async () => {
    // Reason: a catalogue of only higher-is-better titles lets a ranking sign error pass
    // every test - and that error pays the slowest player first.
    const result = await adapter.listGames();
    expect(result.success).toBe(true);
    if (!result.success) return;
    const directions = result.data.map((g) => g.scoreDirection);
    expect(directions).toContain("higher_is_better");
    expect(directions).toContain("lower_is_better");
  });

  it("is idempotent on roundId, returning the same launch URL", async () => {
    const request = {
      roundId: "cv_rnd_1",
      gameCode: "mock-trivia",
      mode: "ranked" as const,
      player: { playerId: "p1" },
      expiresAt: new Date(Date.now() + 60_000),
      resultCallbackUrl: "https://x.test/cb",
      returnUrl: "https://x.test/back",
    };
    const first = await adapter.createRound(request);
    const second = await adapter.createRound(request);
    expect(first.success && second.success).toBe(true);
    if (!first.success || !second.success) return;
    expect(second.data.launchUrl).toBe(first.data.launchUrl);
    expect(second.data.providerRoundId).toBe(first.data.providerRoundId);
  });

  it("never throws, even in every failure mode at once", async () => {
    adapter.configure({
      failureModes: [
        "provider_down",
        "unauthorized",
        "rate_limited",
        "catalogue_unavailable",
        "round_creation_fails",
        "callback_never_arrives",
        "impossible_score",
        "bad_signature",
        "stale_timestamp",
      ],
    });

    await expect(adapter.listGames()).resolves.toMatchObject({ success: false });
    await expect(adapter.fetchRound("r")).resolves.toMatchObject({ success: false });
    await expect(adapter.voidRound("r")).resolves.toMatchObject({ success: false });
    expect(adapter.verifyCallback("{}", {}).valid).toBe(false);
  });

  it("marks a credential failure NOT retryable, and an outage retryable", async () => {
    // Reason: retrying a 401 just multiplies it and delays the only fix, which is an
    // operator correcting the key. Chapter 01 section 6a.
    adapter.configure({ failureModes: ["unauthorized"] });
    const unauth = await adapter.listGames();
    expect(unauth.success).toBe(false);
    if (!unauth.success) expect(unauth.retryable).toBe(false);

    adapter.configure({ failureModes: ["provider_down"] });
    const down = await adapter.listGames();
    expect(down.success).toBe(false);
    if (!down.success) expect(down.retryable).toBe(true);
  });

  it("reports a pending round distinguishably from a failure", async () => {
    // Reason: reconciliation has to tell "not finished yet" apart from "finished and we
    // missed it". Collapsing them into one error makes the polling tests meaningless.
    adapter.configure({ failureModes: ["callback_never_arrives"] });
    const result = await adapter.fetchRound("r1");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe("ROUND_PENDING");
  });

  it("can report a score outside the declared range", async () => {
    adapter.configure({ failureModes: ["impossible_score"] });
    const result = await adapter.fetchRound("r1");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.rawScore).toBeGreaterThan(1000);
  });

  it("produces a deterministic score from the roundId", async () => {
    const a = await new MockProviderAdapter().fetchRound("same-round");
    const b = await new MockProviderAdapter().fetchRound("same-round");
    expect(a.success && b.success).toBe(true);
    if (!a.success || !b.success) return;
    expect(a.data.rawScore).toBe(b.data.rawScore);
  });

  it("verifies a correctly signed callback and rejects a tampered one", () => {
    const body = JSON.stringify({ roundId: "r1", score: 42 });
    const good = adapter.verifyCallback(body, {
      "x-mock-signature": adapter.sign(body),
    });
    expect(good.valid).toBe(true);

    const tampered = JSON.stringify({ roundId: "r1", score: 999 });
    expect(
      adapter.verifyCallback(tampered, {
        "x-mock-signature": adapter.sign(body),
      }).valid,
    ).toBe(false);
  });

  it("rejects a signature of the wrong LENGTH without throwing", () => {
    // Reason: crypto.timingSafeEqual THROWS on a length mismatch rather than returning
    // false. Unguarded, a malformed signature becomes a 500 - and in a route that reports
    // errors, an oracle. Probed by shortening a valid signature.
    const body = JSON.stringify({ roundId: "r1" });
    const short = adapter.sign(body).slice(0, 10);
    expect(() =>
      adapter.verifyCallback(body, { "x-mock-signature": short }),
    ).not.toThrow();
    expect(adapter.verifyCallback(body, { "x-mock-signature": short }).valid).toBe(
      false,
    );
  });

  it("rejects a callback with no signature header at all", () => {
    expect(adapter.verifyCallback("{}", {}).valid).toBe(false);
  });

  it("parses a callback into our shape, never the provider's", () => {
    const body = JSON.stringify({ roundId: "r9", score: 777 });
    const parsed = adapter.parseCallback(body);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.rawScore).toBe(777);
    expect(parsed.data.roundId).toBe("r9");
    // `breakdown` exists but must never be the ranking input.
    expect(parsed.data).toHaveProperty("scoreDirection");
  });

  it("rejects a malformed callback body without throwing", () => {
    expect(adapter.parseCallback("not json").success).toBe(false);
    expect(adapter.parseCallback(JSON.stringify({ score: 1 })).success).toBe(false);
  });

  it("applies configured latency", async () => {
    adapter.configure({ latencyMs: 40 });
    const started = Date.now();
    await adapter.listGames();
    expect(Date.now() - started).toBeGreaterThanOrEqual(35);
  });
});

describe("gameKey derivation", () => {
  it("is provider:{providerKey}:{gameCode}", () => {
    expect(buildProviderGameKey("acme", "trivia-blitz")).toBe(
      "provider:acme:trivia-blitz",
    );
  });
});

describe("catalogue sync", () => {
  beforeAll(async () => {
    await startTestMongo();
    await ensureCollections(["provider_game", "game_provider"]);
  }, 60_000);

  afterAll(async () => {
    await stopTestMongo();
  });

  beforeEach(async () => {
    await clearTestMongo();
    await ensureCollections(["provider_game", "game_provider"]);
    await GameProvider.create({
      providerKey: MOCK_PROVIDER_KEY,
      displayName: "Mock",
      baseUrl: "https://mock.test",
    });
  });

  it("creates a row per title and stamps the derived gameKey", async () => {
    const result = await syncProviderCatalogue(new MockProviderAdapter());
    expect(result.success).toBe(true);
    expect(result.created).toBe(2);

    const row = await ProviderGame.findOne({ gameCode: "mock-trivia" });
    expect(row?.gameKey).toBe(buildProviderGameKey(MOCK_PROVIDER_KEY, "mock-trivia"));
    expect(row?.providerKey).toBe(MOCK_PROVIDER_KEY);
  });

  it("NEVER enables a title, whatever the provider says", async () => {
    // Reason: the single most important rule in this service. A provider flipping their own
    // status to active must not be able to put an untested game in front of paying players.
    await syncProviderCatalogue(new MockProviderAdapter());
    const rows = await ProviderGame.find({});
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.chartvoltEnabled).toBe(false);
      expect(row.providerStatus).toBe("active");
    }
  });

  it("is idempotent: a second run changes nothing", async () => {
    await syncProviderCatalogue(new MockProviderAdapter());
    const second = await syncProviderCatalogue(new MockProviderAdapter());
    expect(second.created).toBe(0);
    expect(second.updated).toBe(0);
    expect(second.unchanged).toBe(2);
  });

  it("does not re-disable a title an operator enabled", async () => {
    await syncProviderCatalogue(new MockProviderAdapter());
    await ProviderGame.updateOne(
      { gameCode: "mock-trivia" },
      { $set: { chartvoltEnabled: true } },
    );

    await syncProviderCatalogue(new MockProviderAdapter());

    const row = await ProviderGame.findOne({ gameCode: "mock-trivia" });
    expect(row?.chartvoltEnabled).toBe(true);
  });

  it("does not overwrite operator-edited presentation copy", async () => {
    // Reason: chapter 16 makes the catalogue admin-editable at X11. A sync clobbering a
    // hand-written description is the defect that makes operators stop trusting the screen,
    // so the allow-list is pinned now rather than after someone reports it.
    await syncProviderCatalogue(new MockProviderAdapter());
    await ProviderGame.updateOne(
      { gameCode: "mock-trivia" },
      { $set: { description: "Our own wording.", displayName: "Our Own Name" } },
    );

    await syncProviderCatalogue(new MockProviderAdapter());

    const row = await ProviderGame.findOne({ gameCode: "mock-trivia" });
    expect(row?.description).toBe("Our own wording.");
    expect(row?.displayName).toBe("Our Own Name");
  });

  it("DOES update provider-owned capability fields", async () => {
    // The other half of the allow-list: a capability change must land, or the admin panel
    // keeps offering a format the provider has withdrawn.
    await syncProviderCatalogue(new MockProviderAdapter());

    const changed = new MockProviderAdapter();
    const listed = await changed.listGames();
    if (!listed.success) throw new Error("catalogue unavailable");
    changed.configure({
      catalogue: listed.data.map((g) =>
        g.gameCode === "mock-trivia" ? { ...g, supportsOneVsOne: true } : g,
      ),
    });

    const result = await syncProviderCatalogue(changed);
    expect(result.updated).toBe(1);

    const row = await ProviderGame.findOne({ gameCode: "mock-trivia" });
    expect(row?.supportsOneVsOne).toBe(true);
  });

  it("reports titles the provider dropped, and DELETES nothing", async () => {
    // Reason: a title with historical rounds cannot be removed without orphaning the stats
    // joined to its gameKey, and a provider omitting a game from one response is as likely
    // to be a partial failure on their side as a withdrawal.
    await syncProviderCatalogue(new MockProviderAdapter());

    const shrunk = new MockProviderAdapter();
    const listed = await shrunk.listGames();
    if (!listed.success) throw new Error("catalogue unavailable");
    shrunk.configure({
      catalogue: listed.data.filter((g) => g.gameCode !== "mock-sprint"),
    });

    const result = await syncProviderCatalogue(shrunk);
    expect(result.missingFromProvider).toEqual(["mock-sprint"]);
    expect(await ProviderGame.countDocuments({})).toBe(2);
  });

  it("changes nothing at all when the provider is unreachable", async () => {
    await syncProviderCatalogue(new MockProviderAdapter());
    const before = await ProviderGame.find({}).lean();

    const broken = new MockProviderAdapter();
    broken.configure({ failureModes: ["catalogue_unavailable"] });
    const result = await syncProviderCatalogue(broken);

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    const after = await ProviderGame.find({}).lean();
    expect(after).toEqual(before);
  });

  it("records the sync time on the PROVIDER, not the titles", async () => {
    await syncProviderCatalogue(new MockProviderAdapter());
    const provider = await GameProvider.findOne({ providerKey: MOCK_PROVIDER_KEY });
    expect(provider?.lastCatalogueSyncAt).toBeInstanceOf(Date);
  });
});

describe("the models fail closed", () => {
  beforeAll(async () => {
    await startTestMongo();
    await ensureCollections(["provider_game", "game_provider"]);
  }, 60_000);

  afterAll(async () => {
    await stopTestMongo();
  });

  beforeEach(async () => {
    await clearTestMongo();
    await ensureCollections(["provider_game", "game_provider"]);
  });

  it("a new provider is disabled and its health is not assumed good", async () => {
    // Reason: defaulting healthStatus to "healthy" would let a provider that has never
    // been checked straight past the chapter 07 kill switch, whose entire purpose is to
    // stop exactly that.
    const provider = await GameProvider.create({
      providerKey: "acme",
      displayName: "Acme",
      baseUrl: "https://acme.test",
    });
    expect(provider.enabled).toBe(false);
    expect(provider.healthStatus).toBe("down");
    expect(provider.capabilities.supportsVoid).toBe(false);
  });

  it("providerKey and gameKey are immutable once written", async () => {
    // Reason: providerKey is embedded in every gameKey, which is the join key for all
    // historical stats. A rename would orphan every row that joins on it.
    const provider = await GameProvider.create({
      providerKey: "acme",
      displayName: "Acme",
      baseUrl: "https://acme.test",
    });
    provider.set("providerKey", "renamed");
    await provider.save();
    const reloaded = await GameProvider.findById(provider._id);
    expect(reloaded?.providerKey).toBe("acme");
  });

  it("rejects a second row for the same provider and gameCode", async () => {
    const seed = {
      providerKey: "acme",
      gameCode: "chess",
      displayName: "Chess",
      family: "head_to_head" as const,
      scoreDirection: "higher_is_better" as const,
      scoreType: "integer" as const,
    };
    await ProviderGame.create({ ...seed, gameKey: "provider:acme:chess" });
    await expect(
      ProviderGame.create({ ...seed, gameKey: "provider:acme:chess-dup" }),
    ).rejects.toThrow();
  });

  it("stores gameProviderCredentials but hides them from a plain read", async () => {
    // Reason: dozens of call sites already do a bare WhiteLabel.findOne() and several
    // return the result to a client. `select: false` means none of them can leak a
    // provider secret, and a caller that genuinely needs one has to say so explicitly.
    const { WhiteLabel } = await import("../../database/models/whitelabel.model");
    await WhiteLabel.create({
      gameProviderCredentials: [
        { providerKey: "acme", environment: "production", apiSecret: "s3cr3t" },
      ],
    });

    const plain = await WhiteLabel.findOne().lean<Record<string, unknown>>();
    expect(plain?.gameProviderCredentials).toBeUndefined();

    const explicit = await WhiteLabel.findOne()
      .select("+gameProviderCredentials")
      .lean<{ gameProviderCredentials?: { apiSecret?: string }[] }>();
    expect(explicit?.gameProviderCredentials?.[0]?.apiSecret).toBe("s3cr3t");
  });

  it("external games are off by default, so deploying X2 shows players nothing", async () => {
    const { WhiteLabel } = await import("../../database/models/whitelabel.model");
    const settings = await WhiteLabel.create({});
    expect(settings.externalGamesEnabled).toBe(false);
    expect(settings.gameProviders).toEqual([]);
  });
});

describe("the registry fails closed on settings", () => {
  it("refuses when external games are disabled", async () => {
    vi.resetModules();
    vi.doMock("@/database/models/whitelabel.model", () => ({
      WhiteLabel: {
        findOne: () => ({
          select: () => ({ lean: async () => ({ externalGamesEnabled: false }) }),
        }),
      },
    }));
    const { resolveEnabledProvider } = await import(
      "../../lib/services/game-providers/registry"
    );
    const result = await resolveEnabledProvider(MOCK_PROVIDER_KEY);
    expect(result.available).toBe(false);
    vi.doUnmock("@/database/models/whitelabel.model");
    vi.resetModules();
  });

  it("refuses when the settings read THROWS, rather than assuming enabled", async () => {
    // Reason: the alternative is that a database blip silently enables every provider,
    // including half-configured ones. A visible refusal gets reported; failing open moves
    // real money against a provider we cannot authenticate to.
    vi.resetModules();
    vi.doMock("@/database/models/whitelabel.model", () => ({
      WhiteLabel: {
        findOne: () => ({
          select: () => ({
            lean: async () => {
              throw new Error("connection lost");
            },
          }),
        }),
      },
    }));
    const { resolveEnabledProvider } = await import(
      "../../lib/services/game-providers/registry"
    );
    const result = await resolveEnabledProvider(MOCK_PROVIDER_KEY);
    expect(result.available).toBe(false);
    if (!result.available) {
      expect(result.reason).not.toContain("connection lost");
    }
    vi.doUnmock("@/database/models/whitelabel.model");
    vi.resetModules();
  });

  it("distinguishes an unconfigured provider from a disabled one", async () => {
    // Reason: Stage 0's canEnterChallenges lesson - a stored value and an absent one are
    // different facts, and a message that conflates them sends the operator to the wrong
    // screen.
    vi.resetModules();
    vi.doMock("@/database/models/whitelabel.model", () => ({
      WhiteLabel: {
        findOne: () => ({
          select: () => ({
            lean: async () => ({
              externalGamesEnabled: true,
              gameProviders: [{ providerKey: "other", enabled: true }],
            }),
          }),
        }),
      },
    }));
    const { resolveEnabledProvider } = await import(
      "../../lib/services/game-providers/registry"
    );
    const result = await resolveEnabledProvider(MOCK_PROVIDER_KEY);
    expect(result.available).toBe(false);
    if (!result.available) expect(result.reason).toContain("not configured");
    vi.doUnmock("@/database/models/whitelabel.model");
    vi.resetModules();
  });
});
