import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
  ensureCollections,
} from "../helpers/mongo-test-server";
import {
  classifyReferral,
  effectiveSourceExpression,
  referralKindExpression,
  referralSurfaceExpression,
  REFERRAL_KIND_LABELS,
} from "@/lib/services/gamemaster/referral-kind";
import {
  parseReferredPlayersQuery,
  escapeRegex,
  MAX_PAGE_LIMIT,
  MAX_SEARCH_LENGTH,
} from "@/lib/services/gamemaster/referral-report-filter";
import {
  readReferredPlayers,
  buildReferredPlayersPipeline,
  ACTIVE_WINDOW_DAYS,
} from "@/lib/services/gamemaster/referral-read-model";

/**
 * Task 3 (1 Oct 2026) - the referral data foundation (`External game plans/24` s7.1).
 *
 * Pins: one classifier for own/external with every legacy shape; the Mongo spelling agrees with
 * the JavaScript one ROW BY ROW against a real database; earnings and activity are scoped to the
 * affiliation window and exclude cancelled rows; the filters are allow-listed; the four shared
 * files are byte-identical in both apps; the admin route is section-guarded.
 */

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const COLLECTIONS = [
  "userreferrals",
  "competitionparticipants",
  "challengeparticipants",
  "gamemasterearnings",
];
const GM = "aaaaaaaaaaaaaaaaaaaaaaaa";
const GM2 = "bbbbbbbbbbbbbbbbbbbbbbbb";
const NOW = new Date("2026-10-01T12:00:00Z");
const DAY = 86_400_000;
const ago = (days: number) => new Date(NOW.getTime() - days * DAY);
const db = () => mongoose.connection.db!;
let seq = 0;
const uid = () => (++seq).toString(16).padStart(24, "c");

async function referral(overrides: Record<string, unknown> = {}) {
  const row = {
    userId: uid(),
    userEmail: `p${seq}@x.test`,
    userName: `Player ${seq}`,
    gameMasterId: GM,
    gameMasterEmail: "gm@x.test",
    referralCode: "CODE",
    referredAt: ago(60),
    isActive: true,
    ...overrides,
  };
  await db().collection("userreferrals").insertOne(row);
  return row;
}

async function earning(userId: string, overrides: Record<string, unknown> = {}) {
  await db().collection("gamemasterearnings").insertOne({
    gameMasterId: GM,
    referredUserId: userId,
    entryFeeAmount: 100,
    netEarning: 10,
    status: "pending",
    createdAt: ago(5),
    ...overrides,
  });
}

const all = (extra: Record<string, string> = {}) =>
  parseReferredPlayersQuery(new URLSearchParams(extra));

beforeAll(async () => {
  await startTestMongo();
  await ensureCollections(COLLECTIONS);
}, 60_000);
afterAll(async () => stopTestMongo());
beforeEach(async () => clearTestMongo());

describe("classifyReferral - one answer to own or external", () => {
  it.each([
    ["absent source is a legacy link row", {}, "own", "signup"],
    ["null source is legacy", { source: null }, "own", "signup"],
    ["empty-string source is legacy", { source: "" }, "own", "signup"],
    ["referral link is own", { source: "gm_referral_link" }, "own", "signup"],
    ["Join GM is external", { source: "chartvolt_join_gm" }, "external", "leaderboard"],
    [
      "a stored surface beats the default",
      { source: "chartvolt_join_gm", affiliatedVia: { surface: "private_contest" } },
      "external",
      "private_contest",
    ],
    [
      "an unrecognised stored surface falls back to the default",
      { source: "chartvolt_join_gm", affiliatedVia: { surface: "__proto__" } },
      "external",
      "leaderboard",
    ],
    ["an unknown source is unclassified", { source: "bulk_import" }, "unclassified", null],
    [
      "an unknown source carries no surface even if one is stored",
      { source: "bulk_import", affiliatedVia: { surface: "signup" } },
      "unclassified",
      null,
    ],
    ["a prototype key is not a source", { source: "__proto__" }, "unclassified", null],
  ])("%s", (_name, row, kind, surface) => {
    const c = classifyReferral(row);
    expect(c.kind).toBe(kind);
    expect(c.surface).toBe(surface);
  });

  it("every kind has a label", () => {
    expect(REFERRAL_KIND_LABELS.own).toBe("Own referral");
    expect(REFERRAL_KIND_LABELS.external).toBe("External");
  });
});

describe("the Mongo spelling agrees with the JavaScript one", () => {
  it("row by row, for every shape", async () => {
    const shapes: Array<Record<string, unknown>> = [
      {},
      { source: null },
      { source: "" },
      { source: "gm_referral_link" },
      { source: "gm_referral_link", affiliatedVia: { surface: "gm_profile" } },
      { source: "chartvolt_join_gm" },
      { source: "chartvolt_join_gm", affiliatedVia: { surface: "private_contest" } },
      { source: "chartvolt_join_gm", affiliatedVia: { surface: "nonsense" } },
      { source: "chartvolt_join_gm", affiliatedVia: null },
      { source: "bulk_import" },
      { source: "bulk_import", affiliatedVia: { surface: "signup" } },
      { source: 7 },
    ];
    const coll = db().collection("userreferrals");
    await coll.insertMany(shapes.map((s, i) => ({ i, ...s })));
    const out = await coll
      .aggregate([
        { $addFields: { _eff: effectiveSourceExpression() } },
        {
          $project: {
            i: 1,
            kind: referralKindExpression("$_eff"),
            surface: referralSurfaceExpression("$_eff"),
          },
        },
        { $sort: { i: 1 } },
      ])
      .toArray();
    expect(out).toHaveLength(shapes.length);
    for (const doc of out) {
      const expected = classifyReferral(shapes[doc.i as number]);
      expect({ i: doc.i, kind: doc.kind, surface: doc.surface ?? null }).toEqual({
        i: doc.i,
        kind: expected.kind,
        surface: expected.surface,
      });
    }
  });
});

describe("readReferredPlayers - money and activity", () => {
  it("sums non-cancelled earnings and splits paid from pending", async () => {
    const r = await referral({ source: "gm_referral_link" });
    await earning(r.userId, { status: "paid", netEarning: 7, entryFeeAmount: 70 });
    await earning(r.userId, { status: "pending", netEarning: 3, entryFeeAmount: 30 });
    await earning(r.userId, { status: "cancelled", netEarning: 100, entryFeeAmount: 1000 });
    const { rows } = await readReferredPlayers(db(), all().filter, all().paging, NOW);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "own", entryFees: 100, earned: 10, paid: 7, pending: 3 });
  });

  it("never counts another Game Master's earnings on the same player", async () => {
    const r = await referral();
    await earning(r.userId, { gameMasterId: GM2, netEarning: 50 });
    const { rows } = await readReferredPlayers(db(), all().filter, all().paging, NOW);
    expect(rows[0].earned).toBe(0);
  });

  it("an ended affiliation stops earning at endedAt", async () => {
    const r = await referral({ isActive: false, endedAt: ago(10), endedReason: "admin_detached" });
    await earning(r.userId, { createdAt: ago(20), netEarning: 4 });
    await earning(r.userId, { createdAt: ago(5), netEarning: 99 });
    const { rows } = await readReferredPlayers(db(), all().filter, all().paging, NOW);
    expect(rows[0]).toMatchObject({ earned: 4, isCurrent: false, endedReason: "admin_detached" });
  });

  it("a Join GM row earns only from its own start", async () => {
    const r = await referral({ source: "chartvolt_join_gm", referredAt: ago(10) });
    await earning(r.userId, { createdAt: ago(20), netEarning: 99 });
    await earning(r.userId, { createdAt: ago(5), netEarning: 6 });
    const { rows } = await readReferredPlayers(db(), all().filter, all().paging, NOW);
    expect(rows[0]).toMatchObject({ kind: "external", earned: 6 });
  });

  it("a link row is not windowed by a late referredAt", async () => {
    const r = await referral({ source: "gm_referral_link", referredAt: ago(2) });
    await earning(r.userId, { createdAt: ago(20), netEarning: 8 });
    const { rows } = await readReferredPlayers(db(), all().filter, all().paging, NOW);
    expect(rows[0].earned).toBe(8);
  });

  it("active means current AND a seat inside the window", async () => {
    const recent = await referral();
    const stale = await referral();
    const ended = await referral({ isActive: false, endedAt: ago(1) });
    await db().collection("competitionparticipants").insertMany([
      { userId: recent.userId, competitionId: "c1", enteredAt: ago(3) },
      { userId: stale.userId, competitionId: "c2", enteredAt: ago(ACTIVE_WINDOW_DAYS + 5) },
      { userId: ended.userId, competitionId: "c3", enteredAt: ago(3) },
    ]);
    await db()
      .collection("challengeparticipants")
      .insertOne({ userId: recent.userId, challengeId: "h1", joinedAt: ago(1) });

    const report = await readReferredPlayers(db(), all().filter, all().paging, NOW);
    const by = new Map(report.rows.map((r) => [r.userId, r]));
    expect(by.get(recent.userId)).toMatchObject({
      isActive: true,
      competitionsEntered: 1,
      challengesEntered: 1,
      lastActivityAt: ago(1).toISOString(),
    });
    expect(by.get(stale.userId)?.isActive).toBe(false);
    expect(by.get(ended.userId)?.isActive).toBe(false);

    const active = await readReferredPlayers(db(), all({ activity: "active" }).filter, all().paging, NOW);
    expect(active.rows.map((r) => r.userId)).toEqual([recent.userId]);
  });
});

describe("readReferredPlayers - filters, summary, privacy", () => {
  it("filters by kind and surface and summarises by kind", async () => {
    await referral();
    await referral({ source: "chartvolt_join_gm", affiliatedVia: { surface: "private_contest" } });
    await referral({ source: "chartvolt_join_gm", affiliatedVia: { surface: "gm_profile" } });

    const ext = await readReferredPlayers(db(), all({ kind: "external" }).filter, all().paging, NOW);
    expect(ext.total).toBe(2);
    const priv = await readReferredPlayers(
      db(),
      all({ surface: "private_contest" }).filter,
      all().paging,
      NOW,
    );
    expect(priv.rows.map((r) => r.surface)).toEqual(["private_contest"]);

    const full = await readReferredPlayers(db(), all().filter, all().paging, NOW);
    expect(full.summary.all.players).toBe(3);
    expect(full.summary.byKind.own.players).toBe(1);
    expect(full.summary.byKind.external.players).toBe(2);
  });

  it("scopes to the given Game Masters", async () => {
    await referral();
    await referral({ gameMasterId: GM2 });
    const mine = await readReferredPlayers(db(), { gameMasterIds: [GM2] }, all().paging, NOW);
    expect(mine.rows.map((r) => r.gameMasterId)).toEqual([GM2]);
  });

  it("search is a literal substring, never a pattern", async () => {
    await referral({ userEmail: "plain@x.test" });
    const dotStar = await readReferredPlayers(db(), { search: ".*" }, all().paging, NOW);
    expect(dotStar.total).toBe(0);
  });

  it("never returns the signup IP or user agent", async () => {
    await referral({ signupIP: "1.2.3.4", signupUserAgent: "UA" });
    const { rows } = await readReferredPlayers(db(), all().filter, all().paging, NOW);
    expect(JSON.stringify(rows)).not.toContain("1.2.3.4");
    expect(JSON.stringify(rows)).not.toContain("signupUserAgent");
  });

  // Reason: the row mapper copies named fields only, so the test above cannot see the
  // projection - a probe removing it stayed green. This reads the raw pipeline output, which
  // is what a future caller logging or exporting the facet would see.
  it("the pipeline itself never selects the signup IP", async () => {
    await referral({ signupIP: "1.2.3.4", signupUserAgent: "UA" });
    const [facet] = await db()
      .collection("userreferrals")
      .aggregate(buildReferredPlayersPipeline({}, { page: 1, limit: 25 }, NOW))
      .toArray();
    expect(facet.rows).toHaveLength(1);
    expect(facet.rows[0]).not.toHaveProperty("signupIP");
    expect(facet.rows[0]).not.toHaveProperty("signupUserAgent");
  });

  // Reason: phone and country live on the Better Auth `user` document, whose identity is `_id`
  // (R68). A lookup on an `id` field alone reads perfectly and finds nothing, so this is
  // behavioural: the row must carry the profile's values, and nothing else from the account.
  it("reads phone and country from the player profile, and only those", async () => {
    const withProfile = await referral();
    const without = await referral();
    await db().collection("user").insertOne({
      _id: new mongoose.Types.ObjectId(withProfile.userId),
      email: "secret-account@x.test",
      phone: "+35799000000",
      country: "Cyprus",
    });
    const { rows } = await readReferredPlayers(db(), all().filter, all().paging, NOW);
    const found = rows.find((r) => r.userId === withProfile.userId);
    expect(found).toMatchObject({ phone: "+35799000000", country: "Cyprus" });
    expect(rows.find((r) => r.userId === without.userId)).toMatchObject({ phone: null, country: null });
    expect(JSON.stringify(rows)).not.toContain("secret-account");
  });

  it("termsAccepted reflects a stored acceptance only", async () => {
    await referral({ termsAcceptanceId: "t1" });
    await referral();
    const { rows } = await readReferredPlayers(db(), all().filter, all().paging, NOW);
    expect(rows.map((r) => r.termsAccepted).sort()).toEqual([false, true]);
  });
});

describe("parseReferredPlayersQuery - allow-listed", () => {
  it("drops values outside the allow-lists", () => {
    const { filter, paging } = parseReferredPlayersQuery(
      new URLSearchParams({
        kind: "__proto__",
        surface: "constructor",
        status: "deleted",
        activity: "maybe",
        gameMasterId: '{"$ne":null},' + GM,
        joinedFrom: "not-a-date",
        limit: "99999",
        page: "-3",
      }),
    );
    expect(filter).toEqual({ gameMasterIds: [GM] });
    expect(paging).toEqual({ page: 1, limit: MAX_PAGE_LIMIT });
  });

  it("a plain date covers the whole day", () => {
    const { filter } = parseReferredPlayersQuery(
      new URLSearchParams({ joinedFrom: "2026-09-01", joinedTo: "2026-09-30" }),
    );
    expect(filter.joinedFrom?.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(filter.joinedTo?.toISOString()).toBe("2026-09-30T23:59:59.999Z");
  });

  it("caps the search and escapes metacharacters", () => {
    const { filter } = parseReferredPlayersQuery(
      new URLSearchParams({ search: "x".repeat(500) }),
    );
    expect(filter.search).toHaveLength(MAX_SEARCH_LENGTH);
    expect(escapeRegex("a.b*(c)")).toBe("a\\.b\\*\\(c\\)");
  });
});

describe("wiring", () => {
  it.each([
    "referral-kind.ts",
    "referral-report-filter.ts",
    "referral-read-model.ts",
    "affiliation-migration.ts",
  ])("%s is byte-identical in both apps", (file) => {
    expect(read(`apps/admin/lib/services/gamemaster/${file}`)).toBe(
      read(`lib/services/gamemaster/${file}`),
    );
  });

  it("the admin report route is section-guarded", () => {
    const src = stripComments(read("apps/admin/app/api/gamemasters/referred-players/route.ts"));
    expect(src).toMatch(/guardSection\(\s*"gamemaster-management"\s*\)/);
    expect(src).toMatch(/readReferredPlayers\(/);
  });

  it("the writer takes its default surface from the shared table", () => {
    const src = stripComments(read("lib/services/gamemaster/affiliation.service.ts"));
    expect(src).toMatch(/input\.surface \?\? defaultSurfaceForSource\(input\.channel\)/);
  });

  it("the migration re-exports the legacy source instead of defining its own", () => {
    const src = stripComments(read("lib/services/gamemaster/affiliation-migration.ts"));
    expect(src).not.toMatch(/LEGACY_AFFILIATION_SOURCE\s*[:=]/);
  });

  // Reason: flipped in task 5. This used to pin the route's own `classifyReferral` call and its
  // own escaped search - correct labelling, but over raw rows spread with `...r`, which handed
  // every Game Master each player's email, sign-up IP and browser string. The route now reads
  // through the shared read model (which classifies and escapes for it) and the D6 view.
  it("the Game Master referrals list reads the shared model through the D6 view", () => {
    const src = stripComments(read("app/api/gamemaster/referrals/route.ts"));
    expect(src).toMatch(/readReferredPlayers\(/);
    // Reason: since 1 Oct 2026 the mapper also takes the package's external-details switch.
    expect(src).toMatch(/\.map\(\(row\)\s*=>\s*toGameMasterReferralView\(row,\s*\{\s*showExternalDetails\s*\}\)/);
    expect(src).not.toMatch(/\.\.\.r\b/);
  });
});
