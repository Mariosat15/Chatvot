import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import mongoose from "mongoose";
import { startTestMongo, stopTestMongo } from "../helpers/mongo-test-server";
import {
  COMPETITION_VISIBILITIES,
  DEFAULT_COMPETITION_VISIBILITY,
  resolveCompetitionVisibility,
} from "@/lib/services/gamemaster/competition-visibility";
import {
  buildSubscriptionLimits,
  resolveAllowedVisibility,
  DEFAULT_ALLOWED_VISIBILITY,
} from "@/lib/services/gamemaster/subscription-limits";
import Competition from "@/database/models/trading/competition.model";
import GameMasterSubscription from "@/database/models/gamemaster/gamemaster-subscription.model";
import { MarketplaceItem } from "@/database/models/marketplace/marketplace-item.model";
import UserReferral, {
  ACTIVE_REFERRAL_INDEX_NAME,
  AFFILIATION_SOURCES,
} from "@/database/models/user-referral.model";
import SitePage from "@/database/models/site-page.model";
import TermsAcceptance from "@/database/models/terms-acceptance.model";
import { NEVER_EDITABLE_FIELDS } from "@/apps/admin/lib/admin/competition-update-fields";
import {
  migrateAffiliationSource,
  isAffiliationMigrationComplete,
  LEGACY_AFFILIATION_SOURCE,
  LEGACY_UNIQUE_USER_INDEX_NAME,
} from "../../lib/services/gamemaster/affiliation-migration";

/**
 * Gamemaster Program v2, step 1 (`External game plans/24` s2): the data model.
 *
 * Nothing here is player-visible yet. What it pins is the shape later steps rely on:
 * a contest's visibility, a package's allowed visibilities, a referral's permanent
 * source, and the D4 index that lets a player whose Game Master expired join a new one.
 */

const root = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(root, p), "utf8");
const code = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

const USER_A = "64b000000000000000000001";
const GM_1 = "64b0000000000000000000a1";
const GM_2 = "64b0000000000000000000a2";

describe("resolveCompetitionVisibility", () => {
  it("reads every missing shape as public, so pre-v2 contests are unchanged", () => {
    for (const missing of [undefined, null, "", "   "]) {
      expect(resolveCompetitionVisibility(missing)).toBe("public");
    }
    expect(DEFAULT_COMPETITION_VISIBILITY).toBe("public");
  });

  it("fails CLOSED on an unknown stored value", () => {
    // Reason: a private contest leaking to every player is the harm; a public one hidden
    // is a visible complaint. An unknown string is not permission to be public.
    expect(resolveCompetitionVisibility("gm_private")).toBe("gm_private");
    expect(resolveCompetitionVisibility("PUBLIC")).toBe("gm_private");
    expect(resolveCompetitionVisibility("friends")).toBe("gm_private");
    expect(resolveCompetitionVisibility(42)).toBe("gm_private");
  });

  it("passes public through", () => {
    expect(resolveCompetitionVisibility("public")).toBe("public");
  });
});

describe("resolveAllowedVisibility", () => {
  it("defaults to public only for a missing or empty list", () => {
    expect(DEFAULT_ALLOWED_VISIBILITY).toEqual(["public"]);
    for (const missing of [undefined, null, [], "public", 3]) {
      expect(resolveAllowedVisibility(missing)).toEqual(["public"]);
    }
  });

  it("keeps known values, trims, de-duplicates and drops unknowns", () => {
    expect(resolveAllowedVisibility(["public", "gm_private"])).toEqual([
      "public",
      "gm_private",
    ]);
    expect(resolveAllowedVisibility([" gm_private ", "gm_private"])).toEqual([
      "gm_private",
    ]);
    expect(resolveAllowedVisibility(["friends", 7, null])).toEqual(["public"]);
  });

  it("buildSubscriptionLimits carries it onto the cached copy", () => {
    expect(
      buildSubscriptionLimits({ allowedVisibility: ["gm_private"] })
        .allowedVisibility,
    ).toEqual(["gm_private"]);
    expect(buildSubscriptionLimits({}).allowedVisibility).toEqual(["public"]);
  });
});

describe("the schemas agree with the vocabulary", () => {
  it("Competition.visibility enumerates exactly COMPETITION_VISIBILITIES, default public", () => {
    const path = Competition.schema.path("visibility") as unknown as {
      enumValues: string[];
      defaultValue: unknown;
    };
    expect([...path.enumValues].sort()).toEqual([...COMPETITION_VISIBILITIES].sort());
    expect(path.defaultValue).toBe("public");
  });

  it("the allowed-visibility arrays enumerate the same values and carry NO default", () => {
    // Reason: a schema default would store ["public"] on every row the moment it is saved,
    // making "nobody chose" indistinguishable from "public was chosen".
    for (const path of [
      GameMasterSubscription.schema.path("limits.allowedVisibility"),
      MarketplaceItem.schema.path("gameMasterConfig.allowedVisibility"),
    ]) {
      const caster = (path as unknown as { caster: { enumValues: string[] } }).caster;
      expect([...caster.enumValues].sort()).toEqual([...COMPETITION_VISIBILITIES].sort());
      expect((path as unknown as { defaultValue?: unknown }).defaultValue).toBeUndefined();
    }
    // Behavioural half: a hydrated document must not gain an implicit [] either.
    expect(new MarketplaceItem({}).toObject().gameMasterConfig?.allowedVisibility).toBeUndefined();
  });

  it("UserReferral.source has no default and enumerates the two sources", () => {
    const path = UserReferral.schema.path("source") as unknown as {
      enumValues: string[];
      defaultValue?: unknown;
      isRequired?: boolean;
    };
    expect([...path.enumValues].sort()).toEqual([...AFFILIATION_SOURCES].sort());
    expect(path.defaultValue).toBeUndefined();
  });

  it("SitePage.version and TermsAcceptance.termsVersion exist with no default", () => {
    expect(SitePage.schema.path("version")).toBeDefined();
    expect(
      (SitePage.schema.path("version") as unknown as { defaultValue?: unknown })
        .defaultValue,
    ).toBeUndefined();
    expect(TermsAcceptance.schema.path("termsVersion")).toBeDefined();
    expect(TermsAcceptance.schema.path("context.gameMasterId")).toBeDefined();
  });

  it("the admin Competition copy declares the same enum and default", () => {
    // Reason: never import both copies into one test - the second import returns the first
    // model. `check:mirrors` compares enum values; this pins the default, which it does not.
    // Raw text, not `code()`: a stray `/*` inside a line comment makes the block stripper
    // swallow real code in this file.
    const admin = read("apps/admin/database/models/trading/competition.model.ts");
    expect(admin).toMatch(
      /visibility:\s*\{\s*type:\s*String,\s*enum:\s*\["public",\s*"gm_private"\],\s*default:\s*"public",?\s*\}/,
    );
  });

  it("visibility can never be edited after creation", () => {
    expect(NEVER_EDITABLE_FIELDS).toContain("visibility");
  });
});

describe("mirrored non-model files are byte-identical", () => {
  for (const file of [
    "lib/services/gamemaster/competition-visibility.ts",
    "lib/services/gamemaster/subscription-limits.ts",
    "database/models/user-referral.model.ts",
  ]) {
    it(`${file} matches its admin copy`, () => {
      expect(read(`apps/admin/${file}`)).toBe(read(file));
    });
  }
});

describe("every referral writer labels its source", () => {
  it("the signup writer stores gm_referral_link with the signup surface", () => {
    // Reason: re-pointed in step 2, claim unchanged. Sign-up used to raw-insert the row and
    // write `source` itself; it now hands the channel to the single writer, which stores it
    // as `source`. The behavioural proof is in gm-affiliation-service.test.ts.
    // Re-pointed again in s5.3, claim unchanged: sign-up now records a claim and the
    // player's accepted claim is what calls the writer, so the label lives there.
    const src = code("lib/services/gamemaster/referral-claim.service.ts");
    expect(src).toMatch(/channel:\s*"gm_referral_link"/);
    expect(src).toMatch(/surface:\s*"signup"/);
    expect(code("lib/services/gamemaster/affiliation.service.ts")).toMatch(
      /source:\s*input\.channel/,
    );
  });

  it("the admin index list no longer rebuilds a plain unique userId_1", () => {
    const src = code("apps/admin/app/api/admin/database/indexes/required-indexes.ts");
    const block = src.slice(src.indexOf("userreferrals:"), src.indexOf("],", src.indexOf("userreferrals:")));
    expect(block.length).toBeGreaterThan(20);
    expect(block).not.toMatch(/name:\s*"userId_1"/);
    expect(block).toContain(`name: "${ACTIVE_REFERRAL_INDEX_NAME}"`);
    expect(block).toMatch(/partialFilterExpression:\s*\{\s*isActive:\s*true\s*\}/);
  });
});

describe("the D4 partial unique index and the migration", () => {
  beforeAll(async () => {
    await startTestMongo();
    await UserReferral.init();
  }, 120_000);

  afterAll(async () => {
    await stopTestMongo();
  });

  const referral = (over: Record<string, unknown> = {}) => ({
    userId: USER_A,
    userEmail: "player@test.com",
    userName: "Player",
    gameMasterId: GM_1,
    gameMasterEmail: "gm@test.com",
    referralCode: "GMONE",
    referredAt: new Date(),
    isActive: true,
    totalEntryFees: 0,
    totalGMEarnings: 0,
    competitionsEntered: 0,
    challengesEntered: 0,
    ...over,
  });

  describe("with the schema's own indexes", () => {
    beforeEach(async () => {
      await UserReferral.deleteMany({});
    });

    it("allows a new active row once the previous one has ended", async () => {
      // Reason: TWO ended rows, not one. A plain unique {userId, isActive} without the
      // partial filter still admits one ended plus one active row (they differ on isActive),
      // so a single ended row cannot tell the partial index from the unfiltered one. A player
      // who has outlived two Game Masters is exactly the D4 case the filter exists for.
      await UserReferral.create(referral({ isActive: false, endedReason: "gm_expired" }));
      await UserReferral.create(
        referral({ gameMasterId: GM_2, isActive: false, endedReason: "gm_deleted" }),
      );
      await expect(UserReferral.create(referral({ gameMasterId: GM_1 }))).resolves.toBeDefined();
      expect(await UserReferral.countDocuments({ userId: USER_A })).toBe(3);
    });

    it("refuses a second ACTIVE row for the same user", async () => {
      await UserReferral.create(referral());
      await expect(
        UserReferral.create(referral({ gameMasterId: GM_2 })),
      ).rejects.toMatchObject({ code: 11000 });
    });
  });

  describe("migrateAffiliationSource on a legacy collection", () => {
    const coll = () => mongoose.connection.db!.collection("userreferrals");

    beforeEach(async () => {
      await coll().drop().catch(() => undefined);
      await coll().createIndex({ userId: 1 }, { unique: true, name: LEGACY_UNIQUE_USER_INDEX_NAME });
    });

    it("labels all three missing shapes and never overwrites a stored source", async () => {
      await coll().insertMany([
        referral({ userId: "u1" }),
        referral({ userId: "u2", source: null }),
        referral({ userId: "u3", source: "" }),
        referral({ userId: "u4", source: "chartvolt_join_gm" }),
      ]);

      const result = await migrateAffiliationSource(true);

      expect(result.needingSource).toBe(3);
      expect(result.labelled).toBe(3);
      const rows = await coll().find({}).sort({ userId: 1 }).toArray();
      expect(rows.map((r) => r.source)).toEqual([
        LEGACY_AFFILIATION_SOURCE,
        LEGACY_AFFILIATION_SOURCE,
        LEGACY_AFFILIATION_SOURCE,
        "chartvolt_join_gm",
      ]);
    });

    it("a report run writes nothing and touches no index", async () => {
      await coll().insertOne(referral({ userId: "u1" }));

      const result = await migrateAffiliationSource(false);

      expect(result.needingSource).toBe(1);
      expect(result.labelled).toBe(0);
      expect(result.legacyUniqueIndexPresent).toBe(true);
      expect(result.activeIndexPresent).toBe(false);
      expect((await coll().findOne({ userId: "u1" }))?.source).toBeUndefined();
      const names = (await coll().indexes()).map((i) => i.name);
      expect(names).toContain(LEGACY_UNIQUE_USER_INDEX_NAME);
      expect(names).not.toContain(ACTIVE_REFERRAL_INDEX_NAME);
    });

    it("builds the partial index, then drops userId_1, so re-joining becomes possible", async () => {
      await coll().insertOne(referral({ isActive: false }));

      const result = await migrateAffiliationSource(true);

      expect(result.activeIndexCreated).toBe(true);
      expect(result.legacyUniqueIndexDropped).toBe(true);
      const names = (await coll().indexes()).map((i) => i.name);
      expect(names).toContain(ACTIVE_REFERRAL_INDEX_NAME);
      expect(names).not.toContain(LEGACY_UNIQUE_USER_INDEX_NAME);
      await expect(coll().insertOne(referral({ gameMasterId: GM_2 }))).resolves.toBeDefined();
    });

    it("refuses the index build while a user holds two active rows", async () => {
      // Only reachable on a collection that never had userId_1 (e.g. a restored dump).
      await coll().dropIndex(LEGACY_UNIQUE_USER_INDEX_NAME);
      await coll().insertMany([referral(), referral({ gameMasterId: GM_2 })]);

      const result = await migrateAffiliationSource(true);

      expect(result.duplicateActiveUsers).toBe(1);
      expect(result.refusedReason).toMatch(/more than one active referral/);
      expect(result.activeIndexCreated).toBe(false);
      expect((await coll().indexes()).map((i) => i.name)).not.toContain(
        ACTIVE_REFERRAL_INDEX_NAME,
      );
    });

    it("is idempotent", async () => {
      await coll().insertOne(referral());
      await migrateAffiliationSource(true);
      const second = await migrateAffiliationSource(true);
      expect(second.needingSource).toBe(0);
      expect(second.activeIndexCreated).toBe(false);
      expect(second.legacyUniqueIndexDropped).toBe(false);
    });

    it("reports complete only once rows are labelled and the old rule is gone", async () => {
      await coll().insertOne(referral({ userId: "u1" }));
      expect(isAffiliationMigrationComplete(await migrateAffiliationSource(false))).toBe(false);
      await migrateAffiliationSource(true);
      expect(isAffiliationMigrationComplete(await migrateAffiliationSource(false))).toBe(true);
    });

    it("treats the old index already gone as done when two admins run it at once", async () => {
      // Reason: the second click sees userId_1 in its listing and the first click drops it
      // before the second one's drop lands. That loser must not report "Something went wrong".
      const spy = vi
        .spyOn(Object.getPrototypeOf(coll()), "dropIndex")
        .mockRejectedValueOnce(Object.assign(new Error("index not found"), { code: 27 }));
      try {
        await coll().insertOne(referral({ userId: "u1" }));
        const result = await migrateAffiliationSource(true);
        expect(result.legacyUniqueIndexDropped).toBe(false);
        expect(result.legacyUniqueIndexPresent).toBe(false);
      } finally {
        spy.mockRestore();
      }
    });

    it("still fails on any other drop error, so a real fault is not reported as done", async () => {
      const spy = vi
        .spyOn(Object.getPrototypeOf(coll()), "dropIndex")
        .mockRejectedValueOnce(Object.assign(new Error("not authorised"), { code: 13 }));
      try {
        await coll().insertOne(referral({ userId: "u1" }));
        await expect(migrateAffiliationSource(true)).rejects.toThrow(/not authorised/);
      } finally {
        spy.mockRestore();
      }
    });
  });
});
