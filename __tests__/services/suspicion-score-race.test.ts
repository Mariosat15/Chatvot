/**
 * SuspicionScore under concurrency.
 *
 * Found while unifying the competition entry path (Stage 0, Defect 1, 1 Sep 2026). It is
 * worth being precise about how, because the lesson generalises: this race was NOT
 * introduced by the unified service. It had always been reachable, but the old entry path
 * admitted only about one concurrent join in twenty - the losers never reached the fraud
 * services at all. Giving both gates a retry loop removed that bottleneck, twenty joins
 * arrived, and the race behind it became visible immediately.
 *
 *   Removing a bottleneck exposes every race the bottleneck was hiding.
 *
 * The defect itself is `getOrCreateScore`: it reads, finds nothing, and creates. `userId`
 * carries a unique index, so when two callers interleave, the loser's `create` throws
 * E11000 and its score contribution is discarded. The callers are fire-and-forget fraud
 * detectors that log and swallow, so nothing surfaces.
 *
 * Why that matters rather than being merely untidy: the entry fraud gate reads
 * `totalScore` to decide whether to refuse an entry. A dropped contribution means the gate
 * under-reports, and coordinated entry - many accounts joining the same contest in the
 * same second - is exactly the shape that both triggers the detector and provokes the race.
 * The detection is weakest precisely when it is needed.
 *
 * These tests assert against the OBSERVED surviving score, never against the attempt
 * count, so they keep working after the fix and would catch a regression that reintroduced
 * partial loss.
 */

import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import mongoose from "mongoose";
import {
  clearTestMongo,
  ensureCollections,
  startTestMongo,
  stopTestMongo,
} from "../helpers/mongo-test-server";

// Reason: the harness owns the connection. The real helper would dial the configured
// MONGODB_URI, which in a test run is either absent or, worse, production.
vi.mock("@/database/mongoose", () => ({
  connectToDatabase: async () => mongoose.connection,
  default: async () => mongoose.connection,
}));

const USER = "6600000000000000000000f1";

/** Every collection the scoring service and its auto-restrict branch may write. */
const COLLECTIONS = [
  "suspicionscores",
  "fraudalerts",
  "fraudsettings",
  "userrestrictions",
  "fraudhistories",
];

/** The fields these tests read back. `.lean()` is untyped here, so state it once. */
interface StoredScore {
  totalScore: number;
  riskLevel: string;
  scoreBreakdown: Record<string, { percentage: number }>;
  scoreHistory: unknown[];
}

/**
 * Classify a rejection so that a genuine finding cannot be inflated by test-server noise,
 * and - the trap in the other direction - so that noise matching cannot hide a real one.
 */
function classify(error: unknown): "duplicate" | "artifact" | "unknown" {
  const e = error as { code?: number; message?: string };
  if (e?.code === 11000) return "duplicate";
  const message = e?.message || String(error);
  if (message.includes("due to catalog changes")) return "artifact";
  return "unknown";
}

describe("SuspicionScore concurrency", () => {
  let SuspicionScore: mongoose.Model<Record<string, unknown>>;
  let SuspicionScoringService: {
    updateScore: (
      userId: string,
      update: {
        method: string;
        percentage: number;
        evidence: string;
      },
    ) => Promise<unknown>;
    getOrCreateScore: (userId: string) => Promise<unknown>;
  };

  const readScore = async (): Promise<StoredScore | null> =>
    (await SuspicionScore.findOne({
      userId: USER,
    }).lean()) as unknown as StoredScore | null;

  beforeAll(async () => {
    await startTestMongo();

    SuspicionScore = (
      await import("@/database/models/fraud/suspicion-score.model")
    ).default as unknown as mongoose.Model<Record<string, unknown>>;

    // Reason: the service registers other models on import, so importing it before
    // ensureCollections would leave their index builds to land mid-test.
    SuspicionScoringService = (
      await import("@/lib/services/fraud/suspicion-scoring.service")
    ).SuspicionScoringService as unknown as typeof SuspicionScoringService;

    await ensureCollections(COLLECTIONS);
  }, 120_000);

  afterAll(async () => {
    await stopTestMongo();
  });

  beforeEach(async () => {
    await clearTestMongo();
  });

  it("creates exactly one score document when 20 detectors race to create it", async () => {
    // The shape a burst of competition entries produces: many detectors, one user, no
    // score document yet. Every one of them calls getOrCreateScore.
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () =>
        SuspicionScoringService.getOrCreateScore(USER),
      ),
    );

    const rejections = results.filter((r) => r.status === "rejected");
    const buckets = { duplicate: 0, artifact: 0, unknown: 0 };
    for (const r of rejections) {
      buckets[classify((r as PromiseRejectedResult).reason)]++;
    }

    // Reason: an artifact or an unrecognised error would mean this test is measuring the
    // test server rather than the code, so fail loudly instead of quietly counting it.
    expect(buckets.artifact).toBe(0);
    expect(buckets.unknown).toBe(0);

    // The fix must serve all twenty callers, not merely avoid crashing.
    expect(buckets.duplicate).toBe(0);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(20);

    // The unique index means the count can only ever be 0 or 1; the point is that it is
    // not 0, i.e. nobody was turned away empty-handed.
    await expect(SuspicionScore.countDocuments({ userId: USER })).resolves.toBe(
      1,
    );
  }, 60_000);

  it("keeps every score contribution when 20 detectors race on a new user", async () => {
    // One method, so the per-method cap makes the expected total exact and independent of
    // interleaving: coordinatedEntry caps at 25.
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, (_, i) =>
        SuspicionScoringService.updateScore(USER, {
          method: "coordinatedEntry",
          percentage: 25,
          evidence: `detector ${i}`,
        }),
      ),
    );

    const buckets = { duplicate: 0, artifact: 0, unknown: 0 };
    for (const r of results.filter((r) => r.status === "rejected")) {
      buckets[classify((r as PromiseRejectedResult).reason)]++;
    }

    expect(buckets.artifact).toBe(0);
    expect(buckets.unknown).toBe(0);
    expect(buckets.duplicate).toBe(0);

    const stored = await readScore();
    expect(stored).not.toBeNull();

    // Reason: the score the fraud gate actually reads. A dropped contribution shows up
    // here as a total below the cap, which is the harm - the gate under-reports.
    expect(stored!.totalScore).toBe(25);
    expect(stored!.riskLevel).toBe("low"); // 25 is below the 30 medium threshold
  }, 60_000);

  it("does not lose a second detection method to a concurrent first one", async () => {
    // Two different methods arriving together is the case a per-method cap cannot mask:
    // if one save clobbers the other, the total is 40 or 25 rather than 65.
    const results = await Promise.allSettled([
      SuspicionScoringService.updateScore(USER, {
        method: "deviceMatch",
        percentage: 40,
        evidence: "same device",
      }),
      SuspicionScoringService.updateScore(USER, {
        method: "coordinatedEntry",
        percentage: 25,
        evidence: "same second",
      }),
    ]);

    const buckets = { duplicate: 0, artifact: 0, unknown: 0 };
    for (const r of results.filter((r) => r.status === "rejected")) {
      buckets[classify((r as PromiseRejectedResult).reason)]++;
    }
    expect(buckets.artifact).toBe(0);
    expect(buckets.unknown).toBe(0);
    expect(buckets.duplicate).toBe(0);

    const stored = (await readScore())!;

    expect(stored.scoreBreakdown.deviceMatch.percentage).toBe(40);
    expect(stored.scoreBreakdown.coordinatedEntry.percentage).toBe(25);
    expect(stored.totalScore).toBe(65);
    // 65 crosses the 50 high threshold, which is what would have been missed.
    expect(stored.riskLevel).toBe("high");
  }, 60_000);

  it("still returns the existing document when the score already exists", async () => {
    // The unremarkable path, asserted so that a fix which always upserts a fresh document
    // - losing the accumulated score - cannot pass the tests above.
    await SuspicionScoringService.updateScore(USER, {
      method: "ipMatch",
      percentage: 30,
      evidence: "first",
    });

    await SuspicionScoringService.getOrCreateScore(USER);

    const stored = (await readScore())!;
    expect(stored.totalScore).toBe(30);
    expect(stored.scoreHistory.length).toBeGreaterThan(0);
    await expect(SuspicionScore.countDocuments({ userId: USER })).resolves.toBe(
      1,
    );
  }, 60_000);
});
