import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

import ChallengeParticipant from "@/database/models/trading/challenge-participant.model";
import { buildChallengeParticipantSeat } from "@/lib/services/challenges/challenge-participant-seat";
import { stripComments } from "../helpers/route-guard-audit";

/**
 * X10, R50's challenge half: a challenge seat records that somebody was matched, never that
 * they scored.
 *
 * `ChallengeParticipant.score` was `required: true, default: 0` from X1 until 12 September
 * 2026 - the same declaration R50 corrected on `CompetitionParticipant` five days earlier, and
 * left in place here deliberately, with a test saying so, because no provider challenge
 * existed to fall into it. This suite closes it, and the shape of the assertions follows two
 * findings that are specific to challenges rather than inherited from the competition fix.
 *
 * FIRST, THE TYPECHECK CANNOT HELP. `IChallengeParticipant` is exported and imported nowhere,
 * and `models?.ChallengeParticipant || model(...)` widens the default export, so every
 * consumer of this model is untyped. Making the field optional produces no compiler error
 * anywhere, which means a future edit restoring the default produces none either. The guard
 * has to be a test.
 *
 * SECOND, THERE ARE TWO WAYS THE NOUGHT COMES BACK AND ONLY ONE OF THEM IS THE SCHEMA. The
 * competition half had three writers - the seat, the schema and a `?? 0` on the read path -
 * and any one of them re-armed the defect on its own. Here there is no read path yet, so
 * there are two: the schema default, and a seat that names the field. Both are probed
 * separately, and the round-trip test below is the one assertion that fails for either,
 * because it puts the builder's output through the real model.
 *
 * The seat builder is a named function rather than the inline object it used to be for the
 * reason `buildParticipantSeat` is: its keys can be compared against `Model.schema.paths`,
 * and no assertion on a SAVED document can, because strict mode has already discarded the
 * evidence by then. That is how the simulator's batch route was found to be dropping six
 * participant fields.
 */

const ROOT = join(__dirname, "..", "..");
const ACCEPT_ROUTE = join(
  ROOT,
  "app",
  "api",
  "challenges",
  "[id]",
  "accept",
  "route.ts",
);

// Reason: `Get-Content`-style globbing is not involved here, but the path contains `[id]`,
// so it is assembled with `join` rather than written as a single string a shell might expand.
const routeCode = stripComments(readFileSync(ACCEPT_ROUTE, "utf8"));

function seat(overrides: Record<string, unknown> = {}) {
  return buildChallengeParticipantSeat({
    challengeId: "6501f2a1b3c4d5e6f7081920",
    userId: "6501f2a1b3c4d5e6f7081921",
    username: "Ada",
    email: "ada@example.com",
    role: "challenger",
    startingCapital: 10000,
    joinedAt: new Date("2026-09-12T10:00:00.000Z"),
    ...overrides,
  });
}

describe("a challenge seat records an entry, not a result", () => {
  it("names no score at all", () => {
    /*
      BEHAVIOURAL, ON THE RETURNED OBJECT, because that is the only thing a probe can break
      without also breaking the schema. A seat writing `score: 0` re-arms R50 even with the
      default gone: `providerHasResult` is `Number.isFinite(participant.score)`, so a stored
      nought says the player attempted the game and scored nothing, and both sides of a
      two-player board would hold one from the moment of acceptance.
    */
    const keys = Object.keys(seat());

    expect(keys).not.toContain("score");
    expect(seat()).not.toHaveProperty("score");
  });

  it("survives the round trip through the real model with no score", () => {
    /*
      THE ONE ASSERTION THAT FAILS FOR EITHER WRITER. The two probes attack different files -
      the schema's default and the builder's key list - and each is caught here, because this
      hands the builder's own output to Mongoose and asks what was stored.
    */
    const doc = new ChallengeParticipant(seat());

    expect(doc.score).toBeUndefined();
    expect(doc.validateSync()?.errors?.score).toBeUndefined();
  });

  it("declares every key it writes, so strict mode discards nothing", () => {
    const declared = Object.keys(ChallengeParticipant.schema.paths);

    for (const key of Object.keys(seat())) {
      expect(
        declared,
        `the seat writes ${key} and ChallengeParticipant does not declare it - strict mode drops it in silence while the write reports success`,
      ).toContain(key);
    }
  });

  it("copies the game label from the challenge rather than letting it default", () => {
    /*
      A DEFAULTED LABEL IS A WRONG LABEL. The schema defaults `gameKey` to "trading", so a
      seat that omits it stamps a provider challenge as a trading one. Nothing throws, the row
      saves, and because `gameKey` is immutable an aggregate grouping by it files the player
      under the wrong game for ever. Same harm as R7, one model along.
    */
    const provider = seat({ gameKey: "provider:acme:trivia-blitz" });

    expect(provider.gameKey).toBe("provider:acme:trivia-blitz");
    expect(new ChallengeParticipant(provider).gameKey).toBe(
      "provider:acme:trivia-blitz",
    );
  });

  it("falls back to trading for an absent or empty label", () => {
    // Reason: "missing" has three shapes and only one is obvious. A challenge written before
    // the label existed carries none, and such a challenge IS a trading challenge.
    expect(seat().gameKey).toBe("trading");
    expect(seat({ gameKey: null }).gameKey).toBe("trading");
    expect(seat({ gameKey: "" }).gameKey).toBe("trading");
  });
});

describe("both schema copies leave score without a default", () => {
  it("the admin copy matches the main copy after comments, so a default cannot hide in one", () => {
    /*
      check:mirrors COMPARES FIELD PATHS AND ENUM VALUES, AND A DEFAULT IS NEITHER. Restoring
      `required: true, default: 0` in the admin copy alone leaves that guard green, and it
      leaves every runtime test here green too: vitest aliases `@` to the repository root, so
      importing both copies into one test returns the FIRST registration twice. The comments
      in both files name `required: true, default: 0` as history, so a whole-file search for
      those words is green on the defect and red on correct code. Strip first, then look at
      the live path.
    */
    const main = stripComments(
      readFileSync(
        join(ROOT, "database", "models", "trading", "challenge-participant.model.ts"),
        "utf8",
      ),
    );
    const admin = stripComments(
      readFileSync(
        join(
          ROOT,
          "apps",
          "admin",
          "database",
          "models",
          "trading",
          "challenge-participant.model.ts",
        ),
        "utf8",
      ),
    );

    const scorePath = /score:\s*\{\s*type:\s*Number,\s*required:\s*false,\s*\}/;

    expect(main).toMatch(scorePath);
    expect(admin).toMatch(scorePath);
    expect(main).not.toMatch(/score:\s*\{[^}]*default:\s*0/);
    expect(admin).not.toMatch(/score:\s*\{[^}]*default:\s*0/);
  });
});

describe("the accept route is the only writer and it goes through the builder", () => {
  it("builds both seats with the shared builder", () => {
    /*
      COUNTED, NOT MERELY FOUND. Both players are seated in one `create` call, so a version
      that converts the challenger and leaves the challenged side inline satisfies any check
      that only asks whether the builder is mentioned - and the inline copy is exactly where a
      `score: 0` would survive.
    */
    const calls = routeCode.match(/buildChallengeParticipantSeat\(\{/g) ?? [];

    expect(calls).toHaveLength(2);
  });

  it("mentions no score of its own", () => {
    // Comments are stripped first: this route explains R50 in prose, and a test that reads
    // prose fails on a correct file for discussing the mistake.
    expect(routeCode).not.toMatch(/score\s*:/);
  });
});
