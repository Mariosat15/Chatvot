/**
 * Friday catalogue auto-sync + 7-day stale freshness helpers.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
  ensureCollections,
} from "../helpers/mongo-test-server";
import GameProvider from "../../database/models/games/game-provider.model";
import {
  CATALOGUE_STALE_MS,
  isCatalogueSyncStale,
  catalogueStaleFingerprint,
} from "../../lib/services/game-providers/catalogue-sync-freshness";
import {
  isUtcFriday,
  isUtcMidnightHour,
  fridayAutoSyncClaimKey,
  runCatalogueFridayAutoSync,
} from "../../lib/services/game-providers/catalogue-friday-auto-sync.service";
import {
  MockProviderAdapter,
  MOCK_PROVIDER_KEY,
} from "../../lib/services/game-providers/adapters/mock.adapter";
import { registerProviderAdapter } from "../../lib/services/game-providers/registry";

const REPO_ROOT = join(__dirname, "..", "..");

describe("catalogue sync freshness", () => {
  it("treats more than 7 days as stale, and 24h as fresh", () => {
    const now = new Date("2026-09-24T12:00:00.000Z");
    expect(CATALOGUE_STALE_MS).toBe(7 * 24 * 60 * 60 * 1000);

    expect(isCatalogueSyncStale(null, now)).toBe(true);
    expect(isCatalogueSyncStale(undefined, now)).toBe(true);
    expect(
      isCatalogueSyncStale(
        new Date(now.getTime() - CATALOGUE_STALE_MS - 1),
        now,
      ),
    ).toBe(true);
    expect(
      isCatalogueSyncStale(
        new Date(now.getTime() - 24 * 60 * 60 * 1000),
        now,
      ),
    ).toBe(false);
  });

  it("fingerprints by last sync so a successful sync starts a new episode", () => {
    const a = catalogueStaleFingerprint("mock", null);
    const b = catalogueStaleFingerprint(
      "mock",
      new Date("2026-01-01T00:00:00.000Z"),
    );
    const c = catalogueStaleFingerprint(
      "mock",
      new Date("2026-01-08T00:00:00.000Z"),
    );
    expect(a).toBe("catalogue-stale:mock:never");
    expect(b).not.toBe(c);
    expect(b).toContain("2026-01-01");
  });

  it("keeps the admin and main freshness helpers byte-identical", () => {
    const main = readFileSync(
      join(
        REPO_ROOT,
        "lib/services/game-providers/catalogue-sync-freshness.ts",
      ),
      "utf8",
    );
    const admin = readFileSync(
      join(
        REPO_ROOT,
        "apps/admin/lib/services/game-providers/catalogue-sync-freshness.ts",
      ),
      "utf8",
    );
    expect(admin).toBe(main);
  });
});

describe("Friday catalogue auto-sync", () => {
  beforeAll(async () => {
    await startTestMongo();
    await ensureCollections(["game_provider", "provider_game"]);
  });

  afterAll(async () => {
    await stopTestMongo();
  });

  beforeEach(async () => {
    await clearTestMongo();
    registerProviderAdapter(new MockProviderAdapter());
  });

  it("recognises Friday midnight UTC only", () => {
    // 2026-09-25 is a Friday.
    const fridayMidnight = new Date("2026-09-25T00:15:00.000Z");
    const fridayNoon = new Date("2026-09-25T12:00:00.000Z");
    const thursdayMidnight = new Date("2026-09-24T00:15:00.000Z");

    expect(isUtcFriday(fridayMidnight)).toBe(true);
    expect(isUtcMidnightHour(fridayMidnight)).toBe(true);
    expect(isUtcMidnightHour(fridayNoon)).toBe(false);
    expect(isUtcFriday(thursdayMidnight)).toBe(false);
    expect(fridayAutoSyncClaimKey(fridayMidnight)).toBe("2026-09-25");
  });

  it("skips when it is not Friday 00:00 UTC", async () => {
    await GameProvider.create({
      providerKey: MOCK_PROVIDER_KEY,
      displayName: "Mock",
      baseUrl: "https://mock.example",
      enabled: true,
      autoCatalogueSyncFriday: true,
    });

    const summary = await runCatalogueFridayAutoSync(
      new Date("2026-09-24T00:15:00.000Z"),
    );
    expect(summary.skippedReason).toBe("not_friday");
    expect(summary.synced).toBe(0);
  });

  it("syncs an opted-in provider once per Friday midnight window", async () => {
    await GameProvider.create({
      providerKey: MOCK_PROVIDER_KEY,
      displayName: "Mock",
      baseUrl: "https://mock.example",
      enabled: true,
      autoCatalogueSyncFriday: true,
    });

    const friday = new Date("2026-09-25T00:20:00.000Z");
    const first = await runCatalogueFridayAutoSync(friday);
    expect(first.skippedReason).toBeUndefined();
    expect(first.examined).toBe(1);
    expect(first.synced).toBe(1);

    const stored = await GameProvider.findOne({
      providerKey: MOCK_PROVIDER_KEY,
    });
    expect(stored?.lastFridayAutoSyncClaimKey).toBe("2026-09-25");
    expect(stored?.lastCatalogueSyncAt).toBeTruthy();

    const second = await runCatalogueFridayAutoSync(friday);
    expect(second.synced).toBe(0);
    expect(second.skippedAlreadyRun).toBe(1);
  });

  it("ignores providers that have not opted in", async () => {
    await GameProvider.create({
      providerKey: MOCK_PROVIDER_KEY,
      displayName: "Mock",
      baseUrl: "https://mock.example",
      enabled: true,
      autoCatalogueSyncFriday: false,
    });

    const summary = await runCatalogueFridayAutoSync(
      new Date("2026-09-25T00:20:00.000Z"),
    );
    expect(summary.examined).toBe(0);
    expect(summary.synced).toBe(0);
  });

  it("schedules the worker job hourly", () => {
    const worker = readFileSync(join(REPO_ROOT, "worker/index.ts"), "utf8");
    expect(worker).toMatch(
      /agenda\.every\(\s*"1 hour",\s*"catalogue-friday-auto-sync"\s*\)/,
    );
    expect(worker).toMatch(/runCatalogueFridayAutoSyncCheck/);
  });
});
