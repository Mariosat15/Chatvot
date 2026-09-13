import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  startTestMongo,
  stopTestMongo,
  ensureCollections,
} from "../helpers/mongo-test-server";
import {
  isCompetitionIdShaped,
  logMalformedCompetitionId,
} from "@/lib/utils/competition-id";

/**
 * WHAT THIS PINS, and it is an owner report rather than a hypothetical.
 *
 * Production logged this three times for one request:
 *
 *   Error getting competition: Error: Invalid competition ID format
 *   Error getting leaderboard: Error: Invalid competition ID format
 *   Error loading competition: Error: Failed to get competition
 *
 * `/competitions/[id]` matches ANY single segment under `/competitions/`, so it is handed
 * whatever a crawler, a stale bookmark or a link built from an `undefined` asks for. Both reads
 * threw inside one `Promise.all` and the page's catch logged its own line on top - three stack
 * traces for a badly-formed request, which is not a fault at all.
 *
 * THE INTERESTING HALF IS NOT THE NOISE. Chasing it found that `getCompetitionById` threw for
 * BOTH kinds of absence - a malformed id and a missing document - and the catch re-wrapped both
 * as one message. So:
 *
 *  - every caller's `if (!competition)` was DEAD CODE. Three authors independently wrote one -
 *    the results page, the trading page and `GET /api/competitions/[id]/status` - and not one
 *    could ever run. The status route's careful 404 answered 500; the two pages' redirect to
 *    `/competitions` never fired, so a deleted contest showed a server-error boundary.
 *  - a deleted contest and a database outage produced the same message, so no caller could tell
 *    "this does not exist" from "we are broken".
 *
 * The contract now: null means it does not exist, a throw means something failed.
 */

const EXISTING_ID = new mongoose.Types.ObjectId();

let Competition: mongoose.Model<Record<string, unknown>>;

function contestInput() {
  const start = new Date(Date.now() + 60 * 60 * 1000);
  const end = new Date(Date.now() + 3 * 60 * 60 * 1000);

  // Reason the fixture is not trimmed to the fields these tests read: Mongoose validates the
  // whole document, and a fixture missing `slug` or `startingCapital` fails every test in a
  // file at once on one unrelated validation error. That has cost time here three times.
  return {
    _id: EXISTING_ID,
    name: "Id Guard Cup",
    description: "A trading contest.",
    slug: "id-guard-cup",
    entryFee: 10,
    startingCapital: 10_000,
    minParticipants: 2,
    maxParticipants: 100,
    currentParticipants: 0,
    startTime: start,
    endTime: end,
    registrationDeadline: start,
    status: "upcoming",
    competitionType: "time_based",
    prizePool: 0,
    platformFeePercentage: 10,
    prizeDistribution: [{ rank: 1, percentage: 100 }],
    createdBy: new mongoose.Types.ObjectId(),
  };
}

beforeAll(async () => {
  const uri = await startTestMongo();
  await mongoose.connect(uri);

  // Reason: the actions under test call `connectToDatabase()`, which throws when `MONGODB_URI`
  // is unset - and its catch reports the same generic message a real defect would, so the test
  // would read as a finding.
  process.env.MONGODB_URI = uri;

  Competition = (await import("@/database/models/trading/competition.model"))
    .default as unknown as mongoose.Model<Record<string, unknown>>;

  await ensureCollections(["competitions", "competitionparticipants"]);
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect();
  await stopTestMongo();
});

beforeEach(async () => {
  await Competition.deleteMany({});
});

describe("isCompetitionIdShaped", () => {
  it("accepts a stringified ObjectId in either case", () => {
    expect(isCompetitionIdShaped(EXISTING_ID.toString())).toBe(true);
    expect(isCompetitionIdShaped(EXISTING_ID.toString().toUpperCase())).toBe(
      true,
    );
  });

  it("agrees with ObjectId.isValid today, which is the point of asserting it", () => {
    /*
      THIS TEST EXISTS BECAUSE THE FIRST VERSION OF IT FAILED, AND THE CLAIM WAS WRONG RATHER THAN
      THE TEST. The helper's comment asserted that `ObjectId.isValid` accepts any 12-character
      string, so `isValid("competitions")` would be true and the narrow shape test was needed to
      refuse it. That was true of bson v4 and is **false here**: bson 5 removed 12-length string
      support from the constructor and `isValid` was synced to match (NODE-4770), and this
      repository runs Mongoose 8. The comment was corrected rather than the code changed, because
      the reason to keep an explicit shape survives the correction and is better than the one
      originally given: `isValid` is a DEPENDENCY'S opinion about what a URL segment may look
      like, it has already moved once in the direction of accepting more, and a widening arriving
      through a version bump would silently widen what these routes accept.

      So the assertion is agreement, not disagreement. If a future bson accepts something new,
      this goes red and somebody decides, rather than the URL parser quietly following it.
    */
    for (const candidate of [
      "competitions",
      "leaderboard",
      "abcdefghijkl",
      "000000000000",
      EXISTING_ID.toString(),
      "undefined",
      "zzzzzzzzzzzzzzzzzzzzzzzz",
    ]) {
      expect(isCompetitionIdShaped(candidate)).toBe(
        mongoose.Types.ObjectId.isValid(candidate),
      );
    }

    // And the one case they are always allowed to differ on, because ours is total: `isValid`
    // answers true for a NUMBER, which a URL segment can never usefully be.
    expect(mongoose.Types.ObjectId.isValid(12)).toBe(true);
    expect(isCompetitionIdShaped(12 as unknown as string)).toBe(false);
  });

  it("refuses the shapes a bad link actually produces", () => {
    for (const junk of [
      "undefined",
      "null",
      "",
      "  ",
      "id-guard-cup",
      `${EXISTING_ID.toString()}x`,
      EXISTING_ID.toString().slice(0, 23),
      "zzzzzzzzzzzzzzzzzzzzzzzz", // 24 characters, not hex
      "favicon.ico",
    ]) {
      expect(isCompetitionIdShaped(junk)).toBe(false);
    }
  });

  it("refuses a non-string without throwing", () => {
    expect(isCompetitionIdShaped(undefined)).toBe(false);
    expect(isCompetitionIdShaped(null)).toBe(false);

    /*
      THE ARRAY IS THE CASE THAT MATTERS, AND THE FIRST VERSION OF THIS TEST COULD NOT SEE IT.
      It asserted only `null` and `undefined`, which a plain `id != null` check also refuses -
      so a probe replacing the `typeof` test with one came back green. The difference the
      `typeof` test actually buys is here: `RegExp.test` COERCES, and `String(["<24 hex>"])` is
      that hex string, so a one-element array passes the shape check, reaches `findById`, and
      raises the CastError this whole change exists to stop logging.
    */
    const oneElement = [EXISTING_ID.toString()];
    expect(String(oneElement)).toMatch(/^[0-9a-f]{24}$/);
    expect(isCompetitionIdShaped(oneElement as unknown as string)).toBe(false);

    // And an ObjectId instance, which is what a caller passing `competition._id` by mistake
    // hands over. It would work, which is exactly why it must not be admitted by accident.
    expect(isCompetitionIdShaped(EXISTING_ID as unknown as string)).toBe(false);
  });

  it("names the route and the value, because that is the only attribution there is", () => {
    // Reason it logs at all: a bad id in the log is the only way to tell a crawler probing the
    // site from a link inside the application building a URL out of an `undefined`. A silent
    // guard would make an in-app defect invisible.
    const lines: unknown[][] = [];
    const original = console.warn;
    console.warn = (...args: unknown[]) => {
      lines.push(args);
    };
    try {
      logMalformedCompetitionId("/competitions/[id]", "undefined");
    } finally {
      console.warn = original;
    }

    expect(lines).toHaveLength(1);
    const message = String(lines[0]![0]);
    expect(message).toContain("/competitions/[id]");
    expect(message).toContain("undefined");
    expect(message).toContain("404");
  });
});

describe("absent is not an error", () => {
  it("returns null for a malformed id instead of throwing", async () => {
    const { getCompetitionById } = await import(
      "@/lib/actions/trading/competition.actions"
    );

    await expect(getCompetitionById("not-an-id")).resolves.toBeNull();
  });

  it("returns null for a well-formed id that is not there", async () => {
    // The case every caller's dead `if (!competition)` was written for: a deleted contest, or a
    // bookmark from another environment.
    const { getCompetitionById } = await import(
      "@/lib/actions/trading/competition.actions"
    );

    await expect(
      getCompetitionById(new mongoose.Types.ObjectId().toString()),
    ).resolves.toBeNull();
  });

  it("still returns the contest when it exists", async () => {
    // The half that matters most: a guard that refuses everything passes every test above.
    await Competition.create(contestInput());

    const { getCompetitionById } = await import(
      "@/lib/actions/trading/competition.actions"
    );

    const found = await getCompetitionById(EXISTING_ID.toString());
    expect(found).toBeTruthy();
    expect(found.name).toBe("Id Guard Cup");
  });

  it("returns an empty leaderboard for both kinds of absence", async () => {
    const { getCompetitionLeaderboard } = await import(
      "@/lib/actions/trading/competition.actions"
    );

    await expect(getCompetitionLeaderboard("not-an-id")).resolves.toEqual([]);
    await expect(
      getCompetitionLeaderboard(new mongoose.Types.ObjectId().toString()),
    ).resolves.toEqual([]);
  });
});

/*
  THE STRUCTURAL HALF.

  Every assertion below strips comments first. These files explain the defect in prose, and a
  test that reads prose fails in both directions: it flags a correct file for discussing the
  mistake, and it passes a broken one whose only mention of the right thing is a comment. That
  has already happened twice on this codebase.
*/
const ROOT = path.join(__dirname, "..", "..");

function sourceOf(relative: string): string {
  const raw = readFileSync(path.join(ROOT, relative), "utf8");
  return raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

/** Each route, and the first read it must not reach with a junk id. */
const GUARDED_ROUTES: Array<{ file: string; firstRead: string }> = [
  { file: "app/(root)/competitions/[id]/page.tsx", firstRead: "Promise.all" },
  {
    file: "app/(root)/competitions/[id]/results/page.tsx",
    firstRead: "getCompetitionById(",
  },
  {
    file: "app/(root)/competitions/[id]/trade/page.tsx",
    firstRead: "getCompetitionById(",
  },
  {
    file: "app/(root)/competitions/[id]/play/page.tsx",
    firstRead: "getPlayState(",
  },
  {
    file: "app/api/competitions/[id]/status/route.ts",
    firstRead: "getCompetitionById(",
  },
  {
    file: "apps/admin/app/competitions/view/[id]/page.tsx",
    firstRead: "getCompetitionById(",
  },
];

describe("every route under a competition id refuses a junk one first", () => {
  for (const { file, firstRead } of GUARDED_ROUTES) {
    it(`${file} guards before its first read`, () => {
      const code = sourceOf(file);

      const guard = code.indexOf("isCompetitionIdShaped(");
      const read = code.indexOf(firstRead);

      // Assert the slice found something. `indexOf` returning -1 orders before everything, so a
      // renamed helper or a moved read would otherwise pass this by accident.
      expect(guard).toBeGreaterThan(-1);
      expect(read).toBeGreaterThan(-1);
      expect(guard).toBeLessThan(read);

      // The refusal has to be reported once, or a bad link inside the application is
      // indistinguishable from a crawler.
      expect(code).toContain("logMalformedCompetitionId(");
    });
  }
});

describe("neither copy of the action treats absence as a failure", () => {
  for (const copy of [
    "lib/actions/trading/competition.actions.ts",
    "apps/admin/lib/actions/trading/competition.actions.ts",
  ]) {
    it(`${copy} no longer throws for a malformed or missing contest`, () => {
      const code = sourceOf(copy);

      /*
        Aimed at the throw, not at the words. `updateCompetitionStatus` in the same file still
        refuses a malformed id loudly, and that is deliberate - it is a write, and an id it
        cannot use should not be quietly ignored. So the assertion names the two messages the
        READS used to raise.
      */
      expect(code).not.toMatch(/throw new Error\("Competition not found"\)/);
      expect(code).not.toMatch(
        /getCompetition[\s\S]{0,600}throw new Error\("Invalid competition ID format"\)/,
      );

      // And the shape test the reads do use is the narrow one.
      expect(code).toContain("isCompetitionIdShaped(competitionId)");
    });
  }

  it("the two copies of the shape helper are byte-for-byte identical", () => {
    /*
      `check:mirrors` compares MODELS, so it has no opinion about this file at all. A text
      comparison is the only guard - and the risk is specific rather than tidiness: if one copy
      widened to accept a 12-character word, the same URL would 404 in one app and render in the
      other, which reads as a caching problem rather than as two different rules.
    */
    const main = readFileSync(
      path.join(ROOT, "lib/utils/competition-id.ts"),
      "utf8",
    );
    const admin = readFileSync(
      path.join(ROOT, "apps/admin/lib/utils/competition-id.ts"),
      "utf8",
    );

    expect(admin).toBe(main);
  });
});

describe("a page's catch must not swallow Next's own control flow", () => {
  for (const file of [
    "app/(root)/competitions/[id]/page.tsx",
    "apps/admin/app/competitions/view/[id]/page.tsx",
  ]) {
    it(`${file} re-throws the whole NEXT_ family`, () => {
      const code = sourceOf(file);

      /*
        `notFound()` and `redirect()` are both implemented by throwing, marked with a `digest`
        beginning `NEXT_`. These pages call `notFound()` INSIDE the try, so a catch matching only
        `NEXT_REDIRECT` logs the 404 as a failure with a stack trace and then re-issues it - the
        right answer, reported as a fault. That is the noise this whole commit is about, arriving
        by a second route.
      */
      expect(code).toMatch(/digest\.startsWith\("NEXT_"\)/);
      expect(code).not.toMatch(/startsWith\("NEXT_REDIRECT"\)/);
    });
  }
});
