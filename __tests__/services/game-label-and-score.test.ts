import { describe, it, expect } from "vitest";

import Competition from "@/database/models/trading/competition.model";
import Challenge from "@/database/models/trading/challenge.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import ChallengeParticipant from "@/database/models/trading/challenge-participant.model";

/**
 * X1, seams 1 and 2: the game label and the game-agnostic score.
 *
 * Four fields were added so the contest engine can tell which game a contest belongs to
 * and rank its players without reading a trading metric:
 *
 *   Competition / Challenge                    gameType, gameKey
 *   CompetitionParticipant / ChallengeParticipant   score, gameKey
 *
 * Three failure modes are pinned here, and each one has already happened at least once
 * in this codebase, which is why the assertions are shaped the way they are.
 *
 *   1. THE FIELD IS NOT DECLARED. Mongoose runs in strict mode, so a write to an
 *      undeclared path is discarded in silence while the write reports success. This is
 *      how `referenceId`, `challengeId` and `suspensionEndsAt` were all lost. Asserting
 *      against `schema.paths` catches it; asserting against a saved document cannot,
 *      because strict mode has already destroyed the evidence by then.
 *
 *   2. THE DEFAULT DOES NOT APPLY. Invariant 5 in "External game plans/11" says a missing
 *      game label on read means trading. During a rolling deploy, old code writes
 *      contests with no game label at all. If the default did not fire, an unlabelled
 *      contest would later be handed to whichever module the reader guessed - and
 *      settling a provider contest with trading code pays the wrong players, silently.
 *      So the test constructs documents the way OLD code does: with no game fields.
 *
 *   3. A NON-DEFAULT VALUE IS STRIPPED. A field can be declared and defaulted and still
 *      be useless if the real value cannot be stored. This is exactly what happened with
 *      `brandingFiles`, where the sync changed the failure mode without removing it. So
 *      a provider-shaped gameKey is round-tripped rather than only the default.
 *
 * No database is needed: `new Model()` applies schema defaults and strict-mode filtering
 * in memory. Only the main-app copies are imported - importing both apps' copies of one
 * model into a single test returns the FIRST registration twice, so the test would
 * examine the wrong schema while appearing to pass. The two apps are proved to agree by
 * `npm run check:mirrors`, which is a separate guard.
 */

const CONTEST_MODELS = [
  { name: "Competition", model: Competition },
  { name: "Challenge", model: Challenge },
] as const;

const PARTICIPANT_MODELS = [
  { name: "CompetitionParticipant", model: CompetitionParticipant },
  { name: "ChallengeParticipant", model: ChallengeParticipant },
] as const;

describe("the game label is declared on both contest models", () => {
  for (const { name, model } of CONTEST_MODELS) {
    it(`${name} declares gameType and gameKey`, () => {
      const paths = Object.keys(model.schema.paths);

      for (const field of ["gameType", "gameKey"]) {
        expect(
          paths,
          `${name}.${field} is not declared, so every write to it is discarded by strict mode while reporting success`,
        ).toContain(field);
      }
    });

    it(`${name} defaults to trading when old code writes no game label`, () => {
      // Reason: this is the rolling-deploy case. Constructed exactly as pre-X1 code
      // does it - no gameType, no gameKey anywhere in the payload.
      const doc = new model({});

      expect(
        doc.gameType,
        `${name} written without a game label did not default to "trading" - an unlabelled contest can be settled by the wrong game module`,
      ).toBe("trading");
      expect(doc.gameKey).toBe("trading");
    });

    it(`${name} stores a provider gameKey without stripping it`, () => {
      // Reason: a declared, defaulted field can still fail to hold a real value.
      // Proving the default alone would not have caught the brandingFiles bug.
      const doc = new model({
        gameType: "provider",
        gameKey: "provider:acme:trivia-blitz",
      });

      expect(doc.gameType).toBe("provider");
      expect(
        doc.gameKey,
        `${name}.gameKey did not retain a provider-shaped value, so the join key for all historical stats cannot be written`,
      ).toBe("provider:acme:trivia-blitz");
    });
  }
});

describe("every participant carries a game-agnostic score", () => {
  for (const { name, model } of PARTICIPANT_MODELS) {
    it(`${name} declares score and gameKey`, () => {
      const paths = Object.keys(model.schema.paths);

      for (const field of ["score", "gameKey"]) {
        expect(
          paths,
          `${name}.${field} is not declared - invariant 4 requires every participant to have a score whatever the game`,
        ).toContain(field);
      }
    });

    it(`${name} defaults score to 0 and gameKey to trading`, () => {
      const doc = new model({});

      expect(
        doc.score,
        `${name}.score did not default to 0, so existing rows and every current writer would be invalid`,
      ).toBe(0);
      expect(doc.gameKey).toBe("trading");
    });

    it(`${name} stores a real score rather than discarding it`, () => {
      const doc = new model({ score: 4821, gameKey: "provider:acme:trivia-blitz" });

      expect(doc.score).toBe(4821);
      expect(doc.gameKey).toBe("provider:acme:trivia-blitz");
    });
  }
});

describe("the addition is additive - no trading field was displaced", () => {
  it("CompetitionParticipant still declares the trading metrics ranking reads today", () => {
    const paths = Object.keys(CompetitionParticipant.schema.paths);

    // Reason: these six are the ranking metrics in competition-ranking.service.ts.
    // X1 must not remove any of them - trading has to behave identically afterwards.
    for (const field of [
      "pnl",
      "pnlPercentage",
      "currentCapital",
      "winRate",
      "winningTrades",
      "losingTrades",
    ]) {
      expect(
        paths,
        `${field} disappeared from CompetitionParticipant - trading ranking reads it`,
      ).toContain(field);
    }
  });

  it("Competition still declares the fields the contest engine already relies on", () => {
    const paths = Object.keys(Competition.schema.paths);

    for (const field of ["status", "entryFee", "prizePool", "startTime", "endTime"]) {
      expect(paths).toContain(field);
    }
  });
});
