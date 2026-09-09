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
import {
  guardCallPattern,
  handlerPattern,
  stripComments,
} from "../helpers/route-guard-audit";

/**
 * Which scores are worth a prize, decided per catalogue title. Task document 14.
 *
 * WHAT THIS CLOSES. Until now "a score of zero wins nothing" was a hard-coded line inside
 * `providerHasResult` - correct as the platform rule, and unanswerable for a game where zero
 * is a genuine achievement (no penalties, no mistakes, no seconds lost). There was also no way
 * to say "a score this bad is not worth paying" at all. Both are now per-title fields with
 * their own screen, route and audit line.
 *
 * THE ONE THAT WILL BITE, and the reason half this file exists: `minimumEligibleScore` IS
 * DIRECTIONAL. The test is "at least as good as", so it reads `score >= bar` on a points game
 * and `score <= bar` on a stopwatch. Written with `>=` in both directions - which is what the
 * word "minimum" invites, and what the first draft of the model comment implied - it refuses
 * every finisher of a race whose time is *under* the bar. That is not a partial failure: the
 * better a player did, the more certainly they are excluded, and the whole pot lands in the
 * unclaimed pool with no error and nothing in a log. Pinned in both directions, and probed.
 *
 * THE SECOND, WHICH LOOKS LIKE TIDINESS: an absent bar and a stored `0` are different facts.
 * `undefined` means no bar; `0` on a points game admits a zero score through the bar and is
 * then refused (or not) by `zeroIsValidResult`. Every layer has to preserve that distinction -
 * the resolver's `Number.isFinite`, the route's `null`-means-clear, the service's `$unset`,
 * the dialog's `draftFrom`, the row summary - and a `??` or a truthiness test anywhere on that
 * path silently turns a configured bar into an unset one. Same class as `entryBlockThreshold`.
 *
 * THE THIRD IS THAT THE PREVIEW MUST NOT DRIFT FROM THE GATE. The dialog explains in sentences
 * what the two switches will do, and an operator sets a money rule from those sentences. So
 * `describeScoreEligibility` is not asserted against expected strings - it is asserted
 * BEHAVIOURALLY against `providerHasResult`, by scoring a real participant and checking that
 * the sentence and the gate agree. A copy test would pass forever while the wording described
 * the opposite of what settlement does.
 *
 * AND THESE ARE NOT CONTENT. They decide who is paid out of a pot people have bought into, so
 * the tagline dialog must not be able to write them - same reasoning as `chartvoltEnabled` and
 * `playModeOverride`, and for the same reason: an audit trail reading "content edited" is not
 * an answer to "who moved the prize bar and when".
 */

const ROOT = process.cwd();

function readCode(relativePath: string): string {
  return stripComments(readFileSync(join(ROOT, relativePath), "utf8"));
}

function readRaw(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

vi.mock("@/database/mongoose", () => ({
  connectToDatabase: async () => mongoose.connection,
  default: async () => mongoose.connection,
}));

const { providerHasResult } = await import("@/lib/games/provider/scoring");
const { resolveScoringRules, resolveScoreDirection } = await import(
  "@/lib/services/games/score-direction.service"
);
const ProviderGame = (
  await import("../../database/models/games/provider-game.model")
).default;
const { describeScoreEligibility } = await import(
  "../../apps/admin/lib/admin/score-eligibility-copy"
);
const {
  parseScoringRulesInput,
  setGameScoringRules,
  SCORE_UNIT_MAX_LENGTH,
} = await import(
  "../../apps/admin/lib/services/game-providers/game-scoring-rules.service"
);
const { NEVER_EDITABLE_CONTENT_FIELDS, validateGameContent } = await import(
  "../../apps/admin/lib/admin/game-content-fields"
);
const { MOCK_PROVIDER_KEY, MockProviderAdapter } = await import(
  "@/lib/services/game-providers/adapters/mock.adapter"
);
const { syncProviderCatalogue } = await import(
  "@/lib/services/game-providers/catalogue.service"
);

const SCORING_ROUTE =
  "apps/admin/app/api/games/providers/[providerKey]/games/scoring/route.ts";
const DIALOG = "apps/admin/components/admin/games/GameScoringDialog.tsx";
const LIST = "apps/admin/components/admin/games/ProviderCatalogueDialog.tsx";
const COPY = "apps/admin/lib/admin/score-eligibility-copy.ts";

/** A participant carrying only what the gate reads. */
function participant(over: Record<string, unknown>) {
  return {
    userId: "a".repeat(24),
    status: "active",
    score: 0,
    ...over,
  } as never;
}

// =======================================================================================
// providerHasResult - the gate itself
// =======================================================================================

describe("providerHasResult with per-title eligibility rules", () => {
  it("refuses a zero by default, because an absent declaration is the platform rule", () => {
    // The behaviour that used to be hard-coded, and which must not change for the ~all of the
    // catalogue that declares nothing. `!== true` rather than `=== false` is what makes an
    // absent field and an explicit `false` the same answer - deliberately the OPPOSITE
    // reading to `entryBlockThreshold`, because here the absent case is the overwhelming
    // majority and means "nobody has said otherwise", which IS the rule.
    expect(providerHasResult(participant({ score: 0 }))).toBe(false);
    expect(providerHasResult(participant({ score: 0, zeroIsValidResult: false }))).toBe(
      false,
    );
  });

  it("admits a zero once the title says zero is a result", () => {
    expect(providerHasResult(participant({ score: 0, zeroIsValidResult: true }))).toBe(true);
  });

  it("still refuses a missing or non-finite score however the title is configured", () => {
    // `zeroIsValidResult` answers "is nought an achievement", never "pay somebody who did not
    // play". A NaN is worse than absent: the comparator places it arbitrarily, so it would be
    // paid from whatever position the sort happened to leave it in.
    for (const score of [undefined, null, NaN, "0"]) {
      expect(providerHasResult(participant({ score, zeroIsValidResult: true }))).toBe(false);
    }
  });

  it("applies a minimum UPWARD on a higher-is-better game", () => {
    const rules = { scoreDirection: "higher_is_better", minimumEligibleScore: 500 };
    expect(providerHasResult(participant({ score: 499, ...rules }))).toBe(false);
    expect(providerHasResult(participant({ score: 500, ...rules }))).toBe(true);
    expect(providerHasResult(participant({ score: 12_000, ...rules }))).toBe(true);
  });

  it("applies a minimum DOWNWARD on a lower-is-better game, which is the whole trap", () => {
    // 60,000 ms is the worst time still worth paying. Written with `>=` in both directions,
    // the 48-second finisher below - the best player in the contest - is refused, and the
    // 90-second one is paid. The suite would still be green on every other assertion here.
    const rules = { scoreDirection: "lower_is_better", minimumEligibleScore: 60_000 };
    expect(providerHasResult(participant({ score: 48_000, ...rules }))).toBe(true);
    expect(providerHasResult(participant({ score: 60_000, ...rules }))).toBe(true);
    expect(providerHasResult(participant({ score: 90_000, ...rules }))).toBe(false);
  });

  it("treats a bar of zero as a real instruction and an absent bar as no bar", () => {
    // The `entryBlockThreshold` distinction, one field along. A stored 0 on a points game
    // admits every non-negative score through the bar; it does NOT mean "no bar", and it does
    // not by itself admit a zero score - `zeroIsValidResult` still decides that.
    expect(
      providerHasResult(
        participant({ score: -5, minimumEligibleScore: 0, scoreDirection: "higher_is_better" }),
      ),
    ).toBe(false);
    expect(
      providerHasResult(
        participant({ score: 7, minimumEligibleScore: 0, scoreDirection: "higher_is_better" }),
      ),
    ).toBe(true);
    // Absent bar: any score at all, however low, other than the zero rule above.
    expect(providerHasResult(participant({ score: -5 }))).toBe(true);
  });

  it("ignores a non-finite bar rather than refusing everybody", () => {
    // A `NaN` bar makes both comparisons false, so an unguarded version pays nobody and routes
    // the entire pot to the unclaimed pool. `Number.isFinite` on the bar is what stops that,
    // and the resolver strips it as well - two guards, because the field can also reach the
    // participant from a caller that never went through the resolver.
    expect(
      providerHasResult(participant({ score: 10, minimumEligibleScore: NaN as number })),
    ).toBe(true);
    expect(
      providerHasResult(
        participant({ score: 10, minimumEligibleScore: undefined as unknown as number }),
      ),
    ).toBe(true);
  });

  it("checks the bar AFTER the zero rule, so a zero cannot pass on the bar alone", () => {
    // Ordering, not redundancy. With a bar of 0 on a points game, a score of exactly 0 clears
    // the bar - so if the bar were tested first and returned early, `zeroIsValidResult: false`
    // would be bypassed and every non-scorer paid.
    expect(
      providerHasResult(
        participant({ score: 0, minimumEligibleScore: 0, zeroIsValidResult: false }),
      ),
    ).toBe(false);
    expect(
      providerHasResult(
        participant({ score: 0, minimumEligibleScore: 0, zeroIsValidResult: true }),
      ),
    ).toBe(true);
  });
});

// =======================================================================================
// The preview - asserted against the gate, never against expected strings
// =======================================================================================

describe("describeScoreEligibility agrees with the gate it describes", () => {
  /**
   * The load-bearing test in this file.
   *
   * An operator sets a money rule by reading these sentences. If the wording says "a score
   * below 500 wins nothing" while the gate refuses everything ABOVE 500, the screen is worse
   * than blank - it is confidently wrong, and there is no failure anywhere to notice. So the
   * assertion is not on the copy: it is that the sentence's claim and `providerHasResult`'s
   * answer are the same, for scores either side of every bar in both directions.
   */
  const cases = [
    { zeroIsValidResult: false, scoreDirection: "higher_is_better" as const },
    { zeroIsValidResult: true, scoreDirection: "higher_is_better" as const },
    {
      zeroIsValidResult: false,
      scoreDirection: "higher_is_better" as const,
      minimumEligibleScore: 500,
    },
    {
      zeroIsValidResult: false,
      scoreDirection: "lower_is_better" as const,
      minimumEligibleScore: 60_000,
    },
    {
      zeroIsValidResult: true,
      scoreDirection: "lower_is_better" as const,
      minimumEligibleScore: 0,
    },
  ];

  for (const rules of cases) {
    it(`the zero sentence matches the gate for ${JSON.stringify(rules)}`, () => {
      const lines = describeScoreEligibility(rules);
      const zeroLine = lines[0];
      const gateAdmitsZero = providerHasResult(participant({ ...rules, score: 0 }));

      // The sentence either promises a zero can win or promises it wins nothing. Whichever it
      // says, the gate must agree - that is the entire contract.
      const sentencePromisesPayment = /COUNTS as a result/.test(zeroLine);
      expect(sentencePromisesPayment).toBe(gateAdmitsZero);
    });

    if (rules.minimumEligibleScore !== undefined) {
      it(`the bar sentence points the right way for ${JSON.stringify(rules)}`, () => {
        const bar = rules.minimumEligibleScore as number;
        const lines = describeScoreEligibility(rules);
        const barLine = lines[1];

        // "above X wins nothing" must only ever appear when the gate really does refuse
        // scores above X - which is the downward case and nothing else.
        const claimsAboveIsRefused = /above /.test(barLine);
        const claimsBelowIsRefused = /below /.test(barLine);

        const above = providerHasResult(participant({ ...rules, score: bar + 10 }));
        const below = providerHasResult(participant({ ...rules, score: bar - 10 }));

        if (claimsAboveIsRefused) expect(above).toBe(false);
        if (claimsBelowIsRefused) expect(below).toBe(false);
        // And it must claim exactly one of the two, or it is describing neither direction.
        expect(claimsAboveIsRefused !== claimsBelowIsRefused).toBe(true);
      });
    }
  }

  it("says there is no bar when there is none, rather than staying silent", () => {
    // A screen that simply omits the sentence reads as "we have not thought about it". Two
    // switches whose consequences are only sometimes explained is how an operator concludes
    // the preview is decorative and stops reading it.
    const lines = describeScoreEligibility({
      zeroIsValidResult: false,
      scoreDirection: "higher_is_better",
    });
    expect(lines.some((line) => /however low/i.test(line))).toBe(true);
  });

  it("always says what happens to a refused player's share", () => {
    // The consequence an operator most needs and would never guess: a refusal does not shrink
    // the pot, it moves money to the other winners. Task document 2-7's redistribution.
    for (const rules of cases) {
      const lines = describeScoreEligibility(rules);
      expect(lines.some((line) => /shared out|spread/i.test(line))).toBe(true);
    }
  });

  it("names the unit when one is set, in the sentence that carries the number", () => {
    const lines = describeScoreEligibility({
      zeroIsValidResult: false,
      scoreDirection: "lower_is_better",
      minimumEligibleScore: 60_000,
      scoreUnit: "ms",
    });
    expect(lines[1]).toContain("60000 ms");
  });

  it("names no game, no game code and no provider", () => {
    // The no-developer-needed claim, in the one place it is easiest to break: a `switch` on
    // game code to make one title's wording read better.
    const code = readCode(COPY);
    for (const forbidden of ["gameCode", "gameKey", "providerKey", "circuit"]) {
      expect(code.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });
});

// =======================================================================================
// parseScoringRulesInput - the edge, where null must survive
// =======================================================================================

describe("parseScoringRulesInput", () => {
  it("accepts a cleared bar as null and a set bar as a number", () => {
    const cleared = parseScoringRulesInput({
      zeroIsValidResult: false,
      minimumEligibleScore: null,
      scoreUnit: null,
    });
    expect(cleared.ok).toBe(true);
    if (cleared.ok) expect(cleared.input.minimumEligibleScore).toBeNull();

    const set = parseScoringRulesInput({
      zeroIsValidResult: false,
      minimumEligibleScore: 500,
      scoreUnit: "points",
    });
    expect(set.ok).toBe(true);
    if (set.ok) expect(set.input.minimumEligibleScore).toBe(500);
  });

  it("keeps a bar of zero rather than reading it as cleared", () => {
    // The distinction the whole feature turns on. A `|| null` or a truthiness test here is
    // one character and it silently deletes a rule an operator deliberately set.
    const parsed = parseScoringRulesInput({
      zeroIsValidResult: false,
      minimumEligibleScore: 0,
      scoreUnit: null,
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.input.minimumEligibleScore).toBe(0);
  });

  it("refuses a non-finite bar instead of storing it", () => {
    // Stored, a NaN bar refuses every participant in every future contest on that title and
    // pays the whole pot to the unclaimed pool. It must not reach the database at all, which
    // is why this is a refusal here and a `Number.isFinite` strip in the resolver - the two
    // are not redundant, because the resolver also has to cope with rows written before this.
    for (const bad of [NaN, Infinity, "500", {}, []]) {
      const parsed = parseScoringRulesInput({
        zeroIsValidResult: false,
        minimumEligibleScore: bad,
        scoreUnit: null,
      });
      expect(parsed.ok).toBe(false);
    }
  });

  it("refuses a missing zero flag rather than defaulting it", () => {
    // A body that omits it must not be read as "off". This route's job is to record a
    // decision, and inferring one from an absent field is how a malformed request silently
    // changes a prize rule.
    const parsed = parseScoringRulesInput({
      minimumEligibleScore: null,
      scoreUnit: null,
    });
    expect(parsed.ok).toBe(false);
  });

  it("refuses an over-long unit and trims a short one", () => {
    const long = parseScoringRulesInput({
      zeroIsValidResult: false,
      minimumEligibleScore: null,
      scoreUnit: "x".repeat(SCORE_UNIT_MAX_LENGTH + 1),
    });
    expect(long.ok).toBe(false);

    const padded = parseScoringRulesInput({
      zeroIsValidResult: false,
      minimumEligibleScore: null,
      scoreUnit: "  points  ",
    });
    expect(padded.ok).toBe(true);
    if (padded.ok) expect(padded.input.scoreUnit).toBe("points");
  });

  it("reads an empty unit as cleared, because a blank box means no unit", () => {
    // The opposite reading to a credential field, and correct here for the reason recorded
    // with the provider dialog: the safe meaning of an empty input depends on whether the
    // user can see what is already there. A unit is displayed in the box, so blank means
    // blank; a secret is not, so blank means keep.
    const parsed = parseScoringRulesInput({
      zeroIsValidResult: false,
      minimumEligibleScore: null,
      scoreUnit: "   ",
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.input.scoreUnit).toBeNull();
  });
});

// =======================================================================================
// Against a real database
// =======================================================================================

const GAME_CODE = "mock-trivia";
const GAME_KEY = `provider:${MOCK_PROVIDER_KEY}:${GAME_CODE}`;

describe("the rules round-trip through the catalogue", () => {
  beforeAll(async () => {
    await startTestMongo();
    await ensureCollections(["provider_game"]);
  }, 120_000);

  afterAll(async () => {
    await stopTestMongo();
  });

  beforeEach(async () => {
    await clearTestMongo();
  });

  async function seedTitle(over: Record<string, unknown> = {}) {
    await ProviderGame.create({
      providerKey: MOCK_PROVIDER_KEY,
      gameCode: GAME_CODE,
      gameKey: GAME_KEY,
      displayName: "Mock Trivia",
      family: "independent",
      supportsCompetition: true,
      supportsContentSeed: true,
      maxDurationSeconds: 300,
      scoreDirection: "higher_is_better",
      scoreType: "integer",
      providerStatus: "active",
      chartvoltEnabled: true,
      ...over,
    });
  }

  /**
   * The raw document, straight off the driver.
   *
   * A `.lean()` read cannot tell a stored `null` from an absent key - both arrive as something
   * a `??` swallows - and that difference is the whole of the cleared-versus-zero rule. `in`
   * on the raw document is the only assertion that can see it.
   */
  async function rawTitle() {
    return mongoose.connection.db
      ?.collection("provider_game")
      .findOne({ providerKey: MOCK_PROVIDER_KEY, gameCode: GAME_CODE });
  }

  it("stores a bar and reads it back through the resolver", async () => {
    await seedTitle();
    const saved = await setGameScoringRules(MOCK_PROVIDER_KEY, GAME_CODE, {
      zeroIsValidResult: true,
      minimumEligibleScore: 500,
      scoreUnit: "points",
    });
    expect(saved.success).toBe(true);

    const rules = await resolveScoringRules(GAME_KEY);
    expect(rules.zeroIsValidResult).toBe(true);
    expect(rules.minimumEligibleScore).toBe(500);
    expect(rules.direction).toBe("higher_is_better");
  });

  it("clears a bar with $unset, so the field is absent rather than empty", async () => {
    // The `playModeOverride` lesson: a stored `""` or `null` satisfies "the field is present"
    // while meaning nothing, and every reader then has to guess. `$unset` makes the absence
    // real, so `Number.isFinite` and `=== true` are answering about a fact rather than a
    // placeholder.
    await seedTitle({ minimumEligibleScore: 500, scoreUnit: "points" });
    await setGameScoringRules(MOCK_PROVIDER_KEY, GAME_CODE, {
      zeroIsValidResult: false,
      minimumEligibleScore: null,
      scoreUnit: null,
    });

    const raw = await rawTitle();
    expect(raw).toBeTruthy();
    expect(raw && "minimumEligibleScore" in raw).toBe(false);
    expect(raw && "scoreUnit" in raw).toBe(false);

    const rules = await resolveScoringRules(GAME_KEY);
    expect(rules.minimumEligibleScore).toBeUndefined();
  });

  it("stores a bar of zero as a stored zero, distinguishable from cleared", async () => {
    await seedTitle();
    await setGameScoringRules(MOCK_PROVIDER_KEY, GAME_CODE, {
      zeroIsValidResult: false,
      minimumEligibleScore: 0,
      scoreUnit: null,
    });

    const raw = await rawTitle();
    expect(raw?.minimumEligibleScore).toBe(0);

    const rules = await resolveScoringRules(GAME_KEY);
    expect(rules.minimumEligibleScore).toBe(0);
  });

  it("refuses a game code that is not in the provider's catalogue", async () => {
    await seedTitle();
    const result = await setGameScoringRules(MOCK_PROVIDER_KEY, "not-a-game", {
      zeroIsValidResult: true,
      minimumEligibleScore: null,
      scoreUnit: null,
    });
    expect(result.success).toBe(false);
  });

  it("survives a catalogue sync while the provider's own direction is rewritten", async () => {
    // THE TEST THE FEATURE MOST NEEDS, and the one whose weak version would pass forever.
    //
    // The row is seeded disagreeing with the mock adapter on the direction AND carrying our
    // two eligibility fields. A passing run therefore proves two separate things: the sync
    // really did write in this pass, and it wrote only the provider's field. Asserting our
    // fields survived on its own would pass just as happily against a sync that failed and
    // changed nothing - which is precisely how the "reverted on the next pull, no error,
    // nothing in a log" defect gets through.
    await seedTitle({
      scoreDirection: "lower_is_better",
      zeroIsValidResult: true,
      minimumEligibleScore: 500,
      scoreUnit: "points",
    });

    const result = await syncProviderCatalogue(new MockProviderAdapter());
    expect(result.success).toBe(true);

    const after = await rawTitle();
    // The provider owns this one, so the sync must have put it back.
    expect(after?.scoreDirection).toBe("higher_is_better");
    // Ours must be untouched.
    expect(after?.zeroIsValidResult).toBe(true);
    expect(after?.minimumEligibleScore).toBe(500);
    expect(after?.scoreUnit).toBe("points");
  });

  it("does not invent eligibility rules for a title the sync CREATES", async () => {
    // The create branch is a separate code path from the update branch and spreads a different
    // field group, so a default landing only there would be invisible to the test above, which
    // seeds the row itself. A sync writing `zeroIsValidResult: false` explicitly would also be
    // wrong in a subtler way: a stored `false` is indistinguishable from an operator's
    // deliberate `false`, so the audit trail loses the difference.
    await syncProviderCatalogue(new MockProviderAdapter());

    const created = await rawTitle();
    expect(created).toBeTruthy();
    expect(created && "zeroIsValidResult" in created).toBe(false);
    expect(created && "minimumEligibleScore" in created).toBe(false);
    expect(created && "scoreUnit" in created).toBe(false);
  });

  it("answers the platform rule for a title that carries none of the fields", async () => {
    // The whole existing catalogue. Nothing must settle differently until an operator sets
    // something, so the defaults have to equal the old hard-coded behaviour exactly.
    await seedTitle();
    const rules = await resolveScoringRules(GAME_KEY);
    expect(rules).toEqual({
      direction: "higher_is_better",
      zeroIsValidResult: false,
      minimumEligibleScore: undefined,
    });
  });

  it("answers the platform rule for a missing title and for an absent gameKey", async () => {
    // Fails towards the platform rule, never towards paying: an operator deleting a catalogue
    // row must not retroactively make every zero-scoring entrant of a live contest a winner.
    for (const key of [undefined, "provider:mock:deleted"]) {
      const rules = await resolveScoringRules(key);
      expect(rules.zeroIsValidResult).toBe(false);
      expect(rules.minimumEligibleScore).toBeUndefined();
      expect(rules.direction).toBe("higher_is_better");
    }
  });

  it("strips a stored non-finite bar instead of refusing every player", async () => {
    // A row written before the route's guard existed, or edited straight in the database. A
    // `NaN` bar makes both comparisons in `providerHasResult` false, so every participant is
    // refused and the entire pot lands in the unclaimed pool - with no error and nothing in a
    // log. Seeded through the raw driver, because the schema would reject it.
    await seedTitle();
    await mongoose.connection.db
      ?.collection("provider_game")
      .updateOne({ gameCode: GAME_CODE }, { $set: { minimumEligibleScore: null } });

    const rules = await resolveScoringRules(GAME_KEY);
    expect(rules.minimumEligibleScore).toBeUndefined();
  });

  it("resolveScoreDirection returns exactly what the wider read says, in every case", async () => {
    // Pins the delegation rather than trusting it. Two functions each doing their own findOne
    // would be two definitions of "what does this title say", and their defaults would drift
    // apart precisely as the direction's own history in that file describes.
    for (const direction of ["higher_is_better", "lower_is_better"]) {
      await clearTestMongo();
      await seedTitle({ scoreDirection: direction });
      const [narrow, wide] = await Promise.all([
        resolveScoreDirection(GAME_KEY),
        resolveScoringRules(GAME_KEY),
      ]);
      expect(narrow).toBe(wide.direction);
    }
    expect(await resolveScoreDirection(undefined)).toBe(
      (await resolveScoringRules(undefined)).direction,
    );
  });
});

// =======================================================================================
// The fields are ours, not the provider's and not content
// =======================================================================================

describe("who is allowed to write these fields", () => {
  it("keeps all three out of the content editor", () => {
    // They decide who is paid. Accepting them here would let a prize rule change as a side
    // effect of fixing a typo in a tagline, with the audit trail recording a content edit -
    // and an operator then cannot answer "when did this change and who did it".
    for (const field of ["zeroIsValidResult", "minimumEligibleScore", "scoreUnit"]) {
      expect(NEVER_EDITABLE_CONTENT_FIELDS.has(field)).toBe(true);
    }
  });

  it("refuses a content save that carries one of them, naming the field", () => {
    // Refused, never dropped. A dropped field means the save reports success while doing
    // nothing, which is this codebase's recurring failure mode - the operator concludes they
    // misclicked and tries again.
    //
    // A bar of ZERO is used deliberately: a validator written with a truthiness test would
    // wave it through, and zero is exactly the value whose refusal matters most, because it
    // is the one an operator would set by accident.
    // ASSERT WHICH REFUSAL FIRED, not merely that one did. `minimumEligibleScore` is absent
    // from `EDITABLE_CONTENT_FIELDS` as well, so removing it from the never-editable map
    // leaves it falling through to the unknown-field arm - which refuses it too, and whose
    // message ALSO contains the field name. A probe doing exactly that came back green
    // against `toContain("minimumEligibleScore")`. Same trap as `competition-update-fields.ts`,
    // where dropping `gameKey` from the never-editable list stayed green for the same reason.
    //
    // The distinction is not academic. The unknown-field arm is what a field nobody has
    // thought about gets; the never-editable arm is a decision, and it is the one that has to
    // survive somebody later adding these three to the content editor's allow-list.
    const result = validateGameContent({ minimumEligibleScore: 0 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("minimumEligibleScore");
      expect(result.error).toContain("cannot be edited here");
      expect(result.error).toContain("Prize eligibility control");
    }
  });

  it("keeps all three out of BOTH copies of the sync allow-list", () => {
    // THE BEHAVIOURAL TEST ABOVE EXERCISES THE WRONG COPY, and that is not fixable by
    // importing the other one. `catalogue.service.ts` exists twice, vitest aliases `@` to the
    // repository root, and the copy an operator's Sync catalogue button actually runs is the
    // one in `apps/admin` - reached through that app's own `@`, which no runtime assertion
    // here can see.
    //
    // So a change adding these to the ADMIN allow-list alone would revert every operator's
    // prize decision on the next sync while every behavioural test in this file stayed green.
    // "One rule, two copies", and `check:mirrors` compares models so it cannot see this
    // either. A text comparison is the only guard available.
    const main = readRaw("lib/services/game-providers/catalogue.service.ts");
    const admin = readRaw("apps/admin/lib/services/game-providers/catalogue.service.ts");
    expect(admin).toBe(main);

    // And the property the byte match stands in for, asserted on the copy this file can read.
    const owned = stripComments(main);
    for (const field of ["zeroIsValidResult", "minimumEligibleScore", "scoreUnit"]) {
      expect(owned).not.toContain(field);
    }
    // The provider DOES still own the direction, which is the whole reason the dialog shows
    // it read-only rather than offering a control that a sync would revert.
    expect(owned).toContain("scoreDirection");
  });
});

// =======================================================================================
// The route
// =======================================================================================

describe("the scoring route", () => {
  it("guards every exported handler on section access", () => {
    // Counted, not merely found. A file whose PATCH is guarded and whose GET is not passes any
    // mention-based check while leaving a mutation open - the shape behind R40, R51 and R57.
    const code = readCode(SCORING_ROUTE);
    const handlers = code.match(handlerPattern()) ?? [];
    const guards = code.match(guardCallPattern()) ?? [];
    expect(handlers.length).toBeGreaterThan(0);
    expect(guards.length).toBe(handlers.length);
  });

  it("guards on the games section, not on admin-at-all", () => {
    // `requireAdminAuth` / `verifyAdminToken` ask whether the caller is an admin at all, so an
    // employee granted one unrelated section passes. Ninth-instance class; the grant is the
    // section that owns the calling screen.
    const code = readCode(SCORING_ROUTE);
    expect(code).toContain('guardSection("game-providers")');
    expect(code).not.toContain("verifyAdminToken");
    expect(code).not.toContain("requireAdminAuth");
  });

  it("writes an audit line saying what the rule now is", () => {
    // Not "scoring updated". The value is the point: an operator reconciling a contest that
    // paid nobody needs to know the bar was moved and to what.
    //
    // ASSERTED INSIDE `newValue`, NOT ANYWHERE IN THE FILE. A probe deleting the whole
    // `newValue` block stayed green against a bare `toMatch(/zeroIsValidResult/)`, because the
    // human-readable `description` template one line above names both fields too - so the file
    // still mentioned them while the machine-readable record was gone. That is the same shape
    // as `!expectedOrigin`, `canTransitionRound` and `MIN_REASON_LENGTH`: one identifier, two
    // jobs, and the structural test cannot tell which one it found.
    //
    // The two halves are separate obligations. The sentence is what a person reads in the log;
    // `newValue` is what a later reconciliation can be filtered and diffed on, and it is the
    // one that has to survive somebody rewording the sentence.
    const code = readCode(SCORING_ROUTE);
    expect(code).toContain("auditLogService.log");

    const at = code.indexOf("newValue:");
    expect(at).toBeGreaterThan(-1);
    const newValueBlock = code.slice(at, code.indexOf("}", code.indexOf("{", at)));
    // Reason: a slice that found nothing passes everything asked of it, so its length is
    // asserted before its contents - the `return (` lesson from the lifecycle-controls suite.
    expect(newValueBlock.length).toBeGreaterThan(40);
    expect(newValueBlock).toContain("zeroIsValidResult");
    expect(newValueBlock).toContain("minimumEligibleScore");
    expect(newValueBlock).toContain("scoreUnit");

    // And the sentence still has to say it in words, with the value rather than just the name.
    const description = code.slice(code.indexOf("description:"), at);
    expect(description).toContain("wins nothing");
    expect(description).toContain("result.minimumEligibleScore");
  });

  it("validates through the shared parser rather than reading the body directly", () => {
    // One definition of what a valid rule is. A route with its own `typeof` checks is the
    // "one rule, two copies" shape, and here the drift would be a bar the screen refuses and
    // the API accepts.
    const code = readCode(SCORING_ROUTE);
    expect(code).toContain("parseScoringRulesInput");
    expect(code).toMatch(/parsed\.ok/);
  });
});

// =======================================================================================
// The screens
// =======================================================================================

describe("the eligibility dialog", () => {
  it("names no game, no game code and no provider key", () => {
    // A schema-driven screen's one failure mode: something that enumerates games. `providerKey`
    // is threaded as a prop and used in the fetch URL, so the assertion is on a literal branch
    // rather than the identifier.
    const code = readCode(DIALOG);
    expect(code).not.toMatch(/gameCode\s*===/);
    expect(code).not.toMatch(/gameKey\s*===/);
    expect(code).not.toMatch(/providerKey\s*===/);
    expect(code).not.toMatch(/switch\s*\(\s*title\.game/);
  });

  it("renders the preview from the shared module and hand-rolls no line inside it", () => {
    // The negative assertion is the load-bearing half: importing the module is trivially
    // satisfied by a screen that imports it and then writes an extra line beside the mapped
    // ones, which is exactly how a preview drifts from the gate it claims to describe.
    //
    // IT IS SCOPED TO THE PREVIEW PANEL, not to the file. The first version of this guard
    // searched the whole component for the phrase "wins nothing" and went red on CORRECT code,
    // because the zero switch's own help text legitimately explains what the switch does - a
    // guard that fails on a correct file is the kind the first person it inconveniences
    // deletes. The panel is located by index rather than scanned towards, for the reason the
    // fixed-character Edit guard established: a leftmost-first regex opens at an unrelated
    // element several hundred characters earlier and swallows legitimate content.
    const code = readCode(DIALOG);
    expect(code).toContain("describeScoreEligibility");

    const start = code.indexOf("What this will do");
    expect(start).toBeGreaterThan(-1);
    const panel = code.slice(start, code.indexOf("</DialogFooter>"));
    expect(panel.length).toBeGreaterThan(100);

    // Exactly one producer of the lines, and no literal sentence beside them.
    expect((panel.match(/preview\.map\(/g) ?? []).length).toBe(1);
    expect(panel).not.toMatch(/wins nothing/);
    expect(panel).not.toMatch(/COUNTS as a result/);
    expect(panel).not.toMatch(/<li[^>]*>\s*[A-Z]/);
  });

  it("shows the direction and offers no control to change it", () => {
    // Read-only for the `playMode` reason: `scoreDirection` is provider-owned, so an editor
    // here would save, toast and be reverted by the next sync. It is rendered because a bar
    // is meaningless without it.
    const code = readCode(DIALOG);
    expect(code).toContain("Lower is better");
    expect(code).not.toMatch(/scoreDirection:\s*(draft|next|value)/);
    expect(code).not.toMatch(/setDraft\([^)]*scoreDirection/);
  });

  it("distinguishes a stored zero from an absent bar when it loads the form", () => {
    // `title.minimumEligibleScore ?? ""` renders a configured bar of zero as an empty box, so
    // opening the dialog and pressing Save deletes it. The guard is the explicit
    // undefined/null pair, and it is asserted because it reads like defensive noise.
    const code = readCode(DIALOG);
    expect(code).toMatch(/minimumEligibleScore === undefined/);
    expect(code).toMatch(/minimumEligibleScore === null/);
    expect(code).not.toMatch(/title\.minimumEligibleScore \?\? ""/);
  });

  it("sends null to clear the bar rather than omitting the field", () => {
    const code = readCode(DIALOG);
    expect(code).toMatch(/minimumEligibleScore:\s*barNumber === undefined \? null : barNumber/);
  });
});

describe("the games list row", () => {
  it("summarises the rule and distinguishes a bar of zero from no bar", () => {
    // The one screen an operator uses to check what they set. Collapsing `0` and absent with a
    // truthiness test makes a configured bar invisible exactly where it would be verified.
    const code = readCode(LIST);
    expect(code).toContain("describeScoringSummary");
    expect(code).toMatch(/bar !== undefined && bar !== null/);
  });

  it("mounts the eligibility dialog and merges its answer without a fallback", () => {
    // `?? row.minimumEligibleScore` here would restore a bar the operator had just cleared, so
    // the row would keep claiming a rule the database no longer has. The whole answer replaces
    // the three fields.
    const code = readCode(LIST);
    expect(code).toContain("<GameScoringDialog");
    expect(code).toMatch(/minimumEligibleScore: rules\.minimumEligibleScore,/);
    expect(code).not.toMatch(/rules\.minimumEligibleScore \?\?/);
  });

  it("offers the control at any provider status, like play style and content", () => {
    // A deprecated title keeps its history and its contest pages, so correcting how it was run
    // is useful. Only the enable switch is gated on the provider's status.
    //
    // THE WINDOW IS BOUNDED AT BOTH ENDS, and getting that wrong is what this comment is for.
    // The first version sliced from `setScoring` back 800 characters and ran to the END of the
    // file - which swallowed the enable switch's entirely correct `disabled={... providerStatus
    // !== "active"}` and reported a defect in code that was right. Locate the construct; do
    // not scan past it.
    const code = readCode(LIST);
    const anchor = code.indexOf("setScoring(title)");
    expect(anchor).toBeGreaterThan(-1);
    const cell = code.slice(anchor, code.indexOf("</td>", anchor));
    expect(cell.length).toBeGreaterThan(40);
    expect(cell).not.toMatch(/disabled/);
  });
});

// =======================================================================================
// Settlement threads the rules in
// =======================================================================================

describe("settlement hands the rules to the module", () => {
  const paths = [
    "lib/services/settlement/provider-settlement.service.ts",
    "apps/admin/lib/services/settlement/provider-settlement.service.ts",
  ];

  for (const path of paths) {
    it(`${path} resolves the rules once and puts them on every row`, () => {
      // Once per contest, never per row from the database: R32/R33 established that per-row
      // storage lets two rows in one leaderboard disagree, and a half-negated board is
      // incoherent rather than merely wrong.
      const code = readCode(path);
      expect(code).toContain("resolveScoringRules");
      expect((code.match(/resolveScoringRules\(/g) ?? []).length).toBe(1);
      expect(code).toMatch(/zeroIsValidResult:\s*scoringRules\.zeroIsValidResult/);
      expect(code).toMatch(/minimumEligibleScore:\s*scoringRules\.minimumEligibleScore/);
    });
  }

  it("the two settlement copies agree byte for byte", () => {
    // `check:mirrors` compares models, so it has never had an opinion about this file. A text
    // comparison is the only guard, and R42 is the standing proof that a mirrored file can be
    // present, agreeing and unreachable.
    const [main, admin] = paths.map((path) => readRaw(path));
    expect(admin).toBe(main);
  });

  it("the score-direction service and the scoring module are mirrored byte for byte", () => {
    for (const relative of [
      "lib/services/games/score-direction.service.ts",
      "lib/games/provider/scoring.ts",
      "lib/games/types.ts",
    ]) {
      expect(readRaw(`apps/admin/${relative}`)).toBe(readRaw(relative));
    }
  });
});
