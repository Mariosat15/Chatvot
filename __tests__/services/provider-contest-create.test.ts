import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  parseConfigSchema,
  validateConfigValues,
} from "@/lib/services/games/config-schema";
import { runPreflight } from "@/lib/services/games/contest-preflight";
import type { PreflightInput } from "@/lib/services/games/contest-preflight";
import {
  contestRoundConfig,
  isProviderContest,
} from "@/lib/services/games/contest-config";

/**
 * X6 contest creation: the settings schema, the pre-flight checklist, and the bridge that
 * reads round settings off a stored contest.
 *
 * Every test here is against a PURE function, deliberately. The value of the checklist is
 * that each refusal can be exercised in isolation; a suite needing a seeded provider,
 * title, settings document and adapter to check one boolean gets written once, run twice,
 * and then quietly skipped.
 */

const ROOT = process.cwd();

function readCode(relativePath: string): string {
  // Comments stripped before matching. Reason: a structural test that matches a comment
  // asserting a behaviour rather than the code performing it passes while the behaviour is
  // absent - which has already happened twice in this project.
  return readFileSync(join(ROOT, relativePath), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

// ---------------------------------------------------------------------------------------
// The settings schema
// ---------------------------------------------------------------------------------------

describe("parseConfigSchema", () => {
  it("turns a provider schema into a renderable field list", () => {
    const result = parseConfigSchema({
      type: "object",
      properties: {
        rounds: { type: "integer", minimum: 1, maximum: 20, default: 5 },
        difficulty: { type: "string", enum: ["easy", "hard"], default: "easy" },
        timed: { type: "boolean" },
      },
      required: ["rounds"],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.fields.map((f) => f.name)).toEqual([
      "rounds",
      "difficulty",
      "timed",
    ]);
    expect(result.fields[0]).toMatchObject({
      type: "integer",
      required: true,
      minimum: 1,
      maximum: 20,
      default: 5,
    });
    expect(result.fields[1]?.options).toEqual(["easy", "hard"]);
    expect(result.fields[2]?.required).toBe(false);
  });

  it("treats an absent schema as no settings, not as an error", () => {
    // A game with nothing to configure is ordinary. Refusing would make every such title
    // uncreatable.
    expect(parseConfigSchema(undefined)).toEqual({ ok: true, fields: [] });
    expect(parseConfigSchema(null)).toEqual({ ok: true, fields: [] });
  });

  it("FAILS CLOSED on a keyword it does not implement", () => {
    // The whole point of the hand-written parser. `allOf` composes schemas; ignoring it
    // would render a form that silently omits half the real constraints, and then validate
    // against the half it understood - reporting success while accepting invalid settings.
    const result = parseConfigSchema({
      type: "object",
      allOf: [{ properties: { a: { type: "integer" } } }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("allOf");
  });

  it("fails closed on an unimplemented keyword inside a single field", () => {
    const result = parseConfigSchema({
      type: "object",
      properties: { name: { type: "string", pattern: "^[a-z]+$" } },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("pattern");
  });

  it("refuses a schema that requires a setting it never describes", () => {
    // Otherwise the field is unrenderable and permanently unsatisfiable: the operator is
    // told something is required with no control to supply it.
    const result = parseConfigSchema({
      type: "object",
      properties: { a: { type: "integer" } },
      required: ["a", "b"],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('"b"');
  });

  it("refuses a minimum above its maximum", () => {
    const result = parseConfigSchema({
      type: "object",
      properties: { n: { type: "integer", minimum: 10, maximum: 2 } },
    });
    expect(result.ok).toBe(false);
  });

  it("refuses an enum on a non-string field", () => {
    const result = parseConfigSchema({
      type: "object",
      properties: { n: { type: "integer", enum: ["1", "2"] } },
    });
    expect(result.ok).toBe(false);
  });

  it("accepts a declared `format`, and fails closed on one it does not know", () => {
    /*
      WHY THE KEYWORD EXISTS. The platform needs to know which of a game's settings is its
      play clock, in order to reserve the right amount of time at the end of a contest and to
      offer a duration control rather than a number box. It cannot know the field's NAME
      without becoming per-game code, so the title declares the field's ROLE instead.

      FAIL CLOSED, exactly as the unimplemented-keyword rule does. A format we do not
      understand and silently ignore leaves the platform quietly treating a declared clock as
      an ordinary integer - the contest still saves, and the reservation is wrong.
    */
    const good = parseConfigSchema({
      type: "object",
      properties: {
        playSeconds: { type: "integer", format: "duration-seconds" },
      },
    });
    expect(good.ok).toBe(true);
    expect(good.ok && good.fields[0].format).toBe("duration-seconds");

    const unknown = parseConfigSchema({
      type: "object",
      properties: { when: { type: "integer", format: "unix-millis" } },
    });
    expect(unknown.ok).toBe(false);
    expect(!unknown.ok && unknown.error).toMatch(/unix-millis/);
  });

  it("refuses a duration format on a field that is not a number", () => {
    // A clock has to be arithmetic. Declared on a string, every reservation would be NaN -
    // and NaN comparisons are all false, so every gate would silently OPEN.
    const result = parseConfigSchema({
      type: "object",
      properties: { playSeconds: { type: "string", format: "duration-seconds" } },
    });
    expect(result.ok).toBe(false);
  });

  it("refuses two fields claiming to be the same clock", () => {
    /*
      Two duration fields is not a schema we can act on: whichever the resolver picked would
      be arbitrary, so a contest's reserved time would depend on property order. Refusing
      names the problem to whoever wrote the schema; picking one hides it until a payout.
    */
    const result = parseConfigSchema({
      type: "object",
      properties: {
        playSeconds: { type: "integer", format: "duration-seconds" },
        alsoPlaySeconds: { type: "integer", format: "duration-seconds" },
      },
    });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/duration-seconds/);
  });

  it("refuses a schema that is not an object type", () => {
    expect(parseConfigSchema({ type: "array" }).ok).toBe(false);
    expect(parseConfigSchema("nonsense").ok).toBe(false);
  });
});

describe("validateConfigValues", () => {
  const parsed = parseConfigSchema({
    type: "object",
    properties: {
      rounds: { type: "integer", minimum: 1, maximum: 20 },
      ratio: { type: "number", minimum: 0, maximum: 1 },
      difficulty: { type: "string", enum: ["easy", "hard"] },
      timed: { type: "boolean" },
      label: { type: "string", default: "standard" },
    },
    required: ["rounds", "difficulty"],
  });
  const fields = parsed.ok ? parsed.fields : [];

  it("coerces a form's string into the declared number type", () => {
    // Reason: every HTML input yields a string. Storing "5" where the provider expects 5
    // is the kind of thing that works until the provider's JSON parser is strict.
    const result = validateConfigValues(fields, {
      rounds: "5",
      difficulty: "easy",
    });
    expect(result.ok).toBe(true);
    expect(result.values.rounds).toBe(5);
    expect(typeof result.values.rounds).toBe("number");
  });

  it("drops any key the schema does not declare", () => {
    // So nothing an operator or a tampered request invents reaches the provider.
    const result = validateConfigValues(fields, {
      rounds: 5,
      difficulty: "easy",
      injected: "should not survive",
    });
    expect(result.ok).toBe(true);
    expect(Object.keys(result.values)).not.toContain("injected");
  });

  it("applies a declared default when the operator leaves a field blank", () => {
    const result = validateConfigValues(fields, {
      rounds: 5,
      difficulty: "easy",
      label: "",
    });
    expect(result.ok).toBe(true);
    expect(result.values.label).toBe("standard");
  });

  it("reports a missing required field, and names it", () => {
    const result = validateConfigValues(fields, { rounds: 5 });
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("difficulty");
  });

  it("rejects a whole number requirement given a decimal", () => {
    const result = validateConfigValues(fields, {
      rounds: 2.5,
      difficulty: "easy",
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/whole number/i);
  });

  it("enforces both ends of a declared range", () => {
    expect(
      validateConfigValues(fields, { rounds: 0, difficulty: "easy" }).ok,
    ).toBe(false);
    expect(
      validateConfigValues(fields, { rounds: 21, difficulty: "easy" }).ok,
    ).toBe(false);
    expect(
      validateConfigValues(fields, { rounds: 20, difficulty: "easy" }).ok,
    ).toBe(true);
  });

  it("rejects a value outside a declared enum", () => {
    const result = validateConfigValues(fields, {
      rounds: 5,
      difficulty: "impossible",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a non-numeric string in a number field rather than storing NaN", () => {
    const result = validateConfigValues(fields, {
      rounds: "five",
      difficulty: "easy",
    });
    expect(result.ok).toBe(false);
    expect(result.values.rounds).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------------------
// The pre-flight checklist
// ---------------------------------------------------------------------------------------

function preflightInput(overrides: Partial<PreflightInput> = {}): PreflightInput {
  const now = new Date("2026-09-04T12:00:00Z");
  return {
    format: "competition",
    minParticipants: 2,
    title: {
      displayName: "Tile Sprint",
      providerStatus: "active",
      supportsCompetition: true,
      supportsOneVsOne: true,
      supportsContentSeed: true,
      maxDurationSeconds: 300,
    },
    provider: { enabled: true, adapterInstalled: true },
    chartvoltEnabled: true,
    externalGamesEnabled: true,
    schemaFields: [],
    settings: {},
    playWindowStart: new Date("2026-09-05T10:00:00Z"),
    playWindowEnd: new Date("2026-09-05T18:00:00Z"),
    resultGracePeriodSeconds: 900,
    attemptsPolicy: "single",
    unresolvedRoundPolicy: "score_zero",
    perRoundCostAcknowledged: true,
    lastSandboxRoundAt: new Date("2026-09-04T11:00:00Z"),
    now,
    ...overrides,
  };
}

describe("runPreflight - the hard refusals", () => {
  it("passes a correctly configured contest with no errors and no warnings", () => {
    const result = runPreflight(preflightInput());
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("refuses when no adapter is installed for the provider", () => {
    const result = runPreflight(
      preflightInput({ provider: { enabled: true, adapterInstalled: false } }),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/connector/i);
  });

  it("refuses when the provider is disabled", () => {
    const result = runPreflight(
      preflightInput({ provider: { enabled: false, adapterInstalled: true } }),
    );
    expect(result.ok).toBe(false);
  });

  it("refuses when we have not enabled the title, even if the provider reports it active", () => {
    // The second of the two switches. A provider's opinion is an input, never a decision.
    const result = runPreflight(preflightInput({ chartvoltEnabled: false }));
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("Tile Sprint");
  });

  it("refuses a deprecated or maintenance title", () => {
    for (const status of ["deprecated", "maintenance"] as const) {
      const result = runPreflight(
        preflightInput({
          title: { ...preflightInput().title, providerStatus: status },
        }),
      );
      expect(result.ok, status).toBe(false);
      expect(result.errors.join(" ")).toContain(status);
    }
  });

  it("refuses a competition on a title that does not support competitions", () => {
    const result = runPreflight(
      preflightInput({
        title: { ...preflightInput().title, supportsCompetition: false },
      }),
    );
    expect(result.ok).toBe(false);
  });

  it("refuses a challenge on a title that does not support one-against-one", () => {
    const result = runPreflight(
      preflightInput({
        format: "challenge",
        minParticipants: 2,
        title: { ...preflightInput().title, supportsOneVsOne: false },
      }),
    );
    expect(result.ok).toBe(false);
  });

  it("refuses either paid format on a title with no content seed, naming the capability", () => {
    // Reason: `01` s4.3. Without an identical content guarantee, players are ranked against
    // each other having faced challenges of unknown relative difficulty - and it is what
    // preserves the skill-not-chance position, so it is a fairness gate rather than a
    // feature flag. It was read by nothing for six days while THREE separate comments said
    // it gated paid entry: the model, the ChartVolt Games adapter and the catalogue service.
    for (const format of ["competition", "challenge"] as const) {
      const result = runPreflight(
        preflightInput({
          format,
          minParticipants: 2,
          title: { ...preflightInput().title, supportsContentSeed: false },
        }),
      );
      expect(result.ok).toBe(false);
      // The refusal must name the missing capability. A generic "cannot be used" sends the
      // operator to the provider without knowing what to ask for.
      expect(result.errors.join(" ")).toContain("supportsContentSeed");
    }
  });

  it("does not confuse the content-seed refusal with the two format refusals", () => {
    // Reason: all three live in the same block and all three refuse. A probe removing the
    // content-seed gate stayed green against an `ok === false` assertion alone, because a
    // title lacking it in these fixtures also lacked nothing else - so this pins that a
    // title supporting BOTH formats and lacking only the seed is still refused, and refused
    // for the seed. Same trap as the `gameKey` allow-list probe in `12` s2.2.
    const result = runPreflight(
      preflightInput({
        title: {
          ...preflightInput().title,
          supportsCompetition: true,
          supportsOneVsOne: true,
          supportsContentSeed: false,
        },
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).not.toContain("does not support competitions");
    expect(result.errors.join(" ")).toContain("identical content");
  });

  it("refuses a single-player paid contest, in both formats", () => {
    // A hard platform rule, not a per-game setting: no paid format is ever single-player.
    expect(runPreflight(preflightInput({ minParticipants: 1 })).ok).toBe(false);
    expect(
      runPreflight(preflightInput({ format: "challenge", minParticipants: 3 })).ok,
    ).toBe(false);
    expect(
      runPreflight(preflightInput({ format: "challenge", minParticipants: 2 })).ok,
    ).toBe(true);
  });

  it("refuses a play window shorter than one round of the game", () => {
    // The clearest late failure on the checklist: without this the contest runs, nobody
    // can finish, and it settles with every player on zero.
    const result = runPreflight(
      preflightInput({
        playWindowStart: new Date("2026-09-05T10:00:00Z"),
        playWindowEnd: new Date("2026-09-05T10:02:00Z"),
      }),
    );
    expect(result.ok).toBe(false);

    /*
      REWORDED TWICE, AND THE SECOND TIME THE FIGURE CHANGED TOO. Both revisions are recorded
      because the second one contradicts the first, and a reader who sees only the current
      assertion cannot tell that the message was once believed correct.

      Originally: "shorter than one round of this game (300 seconds)" - the CEILING, so an
      operator who had just set Circuit Sprint's `durationSeconds` to 120 was refused in the
      name of a number appearing on no form. The owner reported that as confusing.

      7 Sep 2026: reworded to say the figure was the game's longest possible round rather than
      the length they had set. Honest about the number, and it left the operator with nothing
      to do about it.

      8 Sep 2026: the number itself became the CONFIGURED playing time. A title now declares
      which of its settings is its play clock, so the pre-flight compares the contest against
      the length the operator actually chose - and both sides of the comparison are named, so
      they can see which of the two to change.
    */
    const message = result.errors.join(" ");
    expect(message).toMatch(/playing time you have set/i);
    // Both numbers. Naming only one leaves the operator guessing which is too big.
    expect(message).toMatch(/5 minutes/);
    expect(message).toMatch(/2 minutes/);
    // And the phrase that named a ceiling the operator could not see must not come back.
    expect(message).not.toMatch(/longest possible round/i);
  });

  it("compares the contest against the CONFIGURED playing time, not the ceiling", () => {
    /*
      THE ARITHMETIC DEFECT BEHIND THE OWNER'S REPORT, pinned so it cannot return.

      Circuit Sprint's catalogue ceiling is 300 seconds; a contest configured at 60 seconds of
      play fits comfortably inside a two-minute window. The old gate reserved 300 either way
      and refused it, telling players "there is not enough time left in this competition" from
      the instant the contest opened.

      The declared clock is what makes this general: platform code learns no field name, the
      title says which setting is its duration.
    */
    const schema = parseConfigSchema({
      type: "object",
      properties: {
        durationSeconds: {
          type: "integer",
          minimum: 30,
          maximum: 300,
          format: "duration-seconds",
        },
      },
      required: ["durationSeconds"],
    });
    expect(schema.ok).toBe(true);

    const fits = runPreflight(
      preflightInput({
        schemaFields: schema.ok ? schema.fields : [],
        settings: { durationSeconds: 60 },
        playWindowStart: new Date("2026-09-05T10:00:00Z"),
        playWindowEnd: new Date("2026-09-05T10:02:00Z"),
        // Grace must cover the configured length, not the ceiling, or this refuses for an
        // unrelated reason and the test proves nothing about the window.
        resultGracePeriodSeconds: 60 + 5 * 60,
      }),
    );

    expect(fits.errors).toEqual([]);
    expect(fits.ok).toBe(true);

    // And the same window with the same title still refuses once the operator asks for more
    // play than the contest has - so the gate did not simply stop checking.
    const doesNot = runPreflight(
      preflightInput({
        schemaFields: schema.ok ? schema.fields : [],
        settings: { durationSeconds: 300 },
        playWindowStart: new Date("2026-09-05T10:00:00Z"),
        playWindowEnd: new Date("2026-09-05T10:02:00Z"),
      }),
    );
    expect(doesNot.ok).toBe(false);
  });

  it("asks for grace against the configured playing time, not the ceiling", () => {
    /*
      The half of the same defect that would have blocked creation outright once Sprint's clock
      was widened to an hour. `requiredGrace` was ceiling + 5 minutes, so a ten-minute contest
      on an hour-capable title would have demanded 65 minutes of result grace and refused every
      contest an operator could build.
    */
    const schema = parseConfigSchema({
      type: "object",
      properties: {
        durationSeconds: {
          type: "integer",
          minimum: 60,
          maximum: 3600,
          format: "duration-seconds",
        },
      },
      required: ["durationSeconds"],
    });

    const result = runPreflight(
      preflightInput({
        schemaFields: schema.ok ? schema.fields : [],
        settings: { durationSeconds: 600 },
        title: { ...preflightInput().title, maxDurationSeconds: 3600 },
        resultGracePeriodSeconds: 600 + 5 * 60,
      }),
    );

    expect(result.errors).toEqual([]);
  });

  it("refuses a grace period below one round plus five minutes", () => {
    // A round started at the last legal moment needs its full duration plus slack, or its
    // result is cut off and the player is scored zero for a round they completed.
    const belowBoundary = runPreflight(
      preflightInput({ resultGracePeriodSeconds: 300 + 5 * 60 - 1 }),
    );
    expect(belowBoundary.ok).toBe(false);

    const atBoundary = runPreflight(
      preflightInput({ resultGracePeriodSeconds: 300 + 5 * 60 }),
    );
    expect(atBoundary.ok).toBe(true);
  });

  it("refuses a play window that ends before it starts, or in the past", () => {
    expect(
      runPreflight(
        preflightInput({
          playWindowStart: new Date("2026-09-05T18:00:00Z"),
          playWindowEnd: new Date("2026-09-05T10:00:00Z"),
        }),
      ).ok,
    ).toBe(false);

    expect(
      runPreflight(
        preflightInput({
          playWindowStart: new Date("2026-09-01T10:00:00Z"),
          playWindowEnd: new Date("2026-09-01T18:00:00Z"),
        }),
      ).ok,
    ).toBe(false);
  });

  it("refuses a multi-attempt policy with no usable allowance", () => {
    for (const allowed of [undefined, 0, 1]) {
      const result = runPreflight(
        preflightInput({ attemptsPolicy: "best_of_n", attemptsAllowed: allowed }),
      );
      expect(result.ok, String(allowed)).toBe(false);
    }
    expect(
      runPreflight(
        preflightInput({ attemptsPolicy: "best_of_n", attemptsAllowed: 3 }),
      ).ok,
    ).toBe(true);
  });

  it("surfaces a settings error from the schema as a refusal", () => {
    const parsed = parseConfigSchema({
      type: "object",
      properties: { rounds: { type: "integer", minimum: 1 } },
      required: ["rounds"],
    });
    const result = runPreflight(
      preflightInput({
        schemaFields: parsed.ok ? parsed.fields : [],
        settings: {},
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("rounds");
  });

  it("accumulates every problem rather than stopping at the first", () => {
    // An operator fixing one refusal at a time through four submissions will give up.
    const result = runPreflight(
      preflightInput({
        provider: { enabled: false, adapterInstalled: false },
        chartvoltEnabled: false,
        minParticipants: 1,
      }),
    );
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
  });
});

describe("runPreflight - warnings that must not become refusals", () => {
  it("warns, but does not refuse, when external games are off platform-wide", () => {
    // Scheduling ahead of a launch is legitimate. Refusing would push an operator to flip
    // the platform master switch on just to draft a contest.
    const result = runPreflight(preflightInput({ externalGamesEnabled: false }));
    expect(result.ok).toBe(true);
    expect(result.warnings.join(" ")).toMatch(/master switch/i);
  });

  it("warns that the exclude policy shrinks the pool the winners were promised", () => {
    // FLIPPED, NOT DELETED, when settlement started paying the refund. This test used to
    // pin the honest admission that `exclude` owed a refund nothing paid; keeping the same
    // test and inverting what it asserts is what stops the warning silently reverting to a
    // caution that is now false. The reason for a warning at all has changed: not "this is
    // half-built" but "this removes a paid entrant and the winners share a smaller pot".
    const result = runPreflight(
      preflightInput({ unresolvedRoundPolicy: "exclude" }),
    );
    expect(result.ok).toBe(true);
    expect(result.warnings.join(" ")).toMatch(/re-split/i);
    expect(result.warnings.join(" ")).not.toMatch(/not yet automatic/i);
  });

  it("warns when no sandbox round has ever succeeded for the title", () => {
    const result = runPreflight(preflightInput({ lastSandboxRoundAt: null }));
    expect(result.ok).toBe(true);
    expect(result.warnings.join(" ")).toMatch(/sandbox/i);
  });

  it("warns when the last sandbox round is stale", () => {
    const result = runPreflight(
      preflightInput({ lastSandboxRoundAt: new Date("2026-09-01T12:00:00Z") }),
    );
    expect(result.ok).toBe(true);
    expect(result.warnings.join(" ")).toMatch(/hours ago/i);
  });

  it("warns about per-round cost only until it is acknowledged", () => {
    const unacknowledged = runPreflight(
      preflightInput({
        attemptsPolicy: "best_of_n",
        attemptsAllowed: 5,
        perRoundCostAcknowledged: false,
      }),
    );
    expect(unacknowledged.ok).toBe(true);
    expect(unacknowledged.warnings.join(" ")).toMatch(/cost multiplies/i);

    const acknowledged = runPreflight(
      preflightInput({
        attemptsPolicy: "best_of_n",
        attemptsAllowed: 5,
        perRoundCostAcknowledged: true,
      }),
    );
    expect(acknowledged.warnings).toEqual([]);
  });

  it("warns that an attempts allowance is ignored by the single-attempt policy", () => {
    // Otherwise the review step reads "3 attempts" while the engine grants one.
    const result = runPreflight(
      preflightInput({ attemptsPolicy: "single", attemptsAllowed: 3 }),
    );
    expect(result.ok).toBe(true);
    expect(result.warnings.join(" ")).toMatch(/ignored/i);
  });
});

// ---------------------------------------------------------------------------------------
// The bridge: reading round settings off a stored contest (X3's deferral)
// ---------------------------------------------------------------------------------------

describe("contestRoundConfig", () => {
  const stored = {
    gameType: "provider",
    gameConfig: {
      providerKey: "mock",
      gameCode: "tile-sprint",
      settings: { rounds: 5 },
    },
    contentSeed: "abc123",
    playWindowEnd: new Date("2026-09-05T18:00:00Z"),
    attemptsPolicy: "best_of_n",
    attemptsAllowed: 3,
    unresolvedRoundPolicy: "score_zero",
  };

  it("reads a complete contest into the config the round service wants", () => {
    const result = contestRoundConfig(stored);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.providerKey).toBe("mock");
    expect(result.gameCode).toBe("tile-sprint");
    expect(result.config).toMatchObject({
      attemptsPolicy: "best_of_n",
      attemptsAllowed: 3,
      contentSeed: "abc123",
      settings: { rounds: 5 },
    });
  });

  it("REFUSES a contest missing round settings instead of defaulting them", () => {
    // The tempting alternative - fall back to single-attempt with a grace period - would
    // let the contest run under settings no operator ever chose, governing real money.
    expect(contestRoundConfig({ ...stored, playWindowEnd: undefined }).ok).toBe(
      false,
    );
    expect(contestRoundConfig({ ...stored, attemptsPolicy: undefined }).ok).toBe(
      false,
    );
    expect(contestRoundConfig({ ...stored, gameConfig: undefined }).ok).toBe(false);
  });

  it("refuses an attempts policy it does not recognise", () => {
    const result = contestRoundConfig({
      ...stored,
      attemptsPolicy: "best_of_everything",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("best_of_everything");
  });

  it("drops a stale allowance under the single-attempt policy", () => {
    const result = contestRoundConfig({
      ...stored,
      attemptsPolicy: "single",
      attemptsAllowed: 7,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.attemptsAllowed).toBeUndefined();
  });

  it("normalises the round-start policy, failing CLOSED on anything unrecognised", () => {
    /*
      ADDED BECAUSE A PROBE FOUND NOTHING COVERING THIS. Reversing the comparison here - reading
      anything that is not `reserve_full_round` as permissive - left the whole round-lifecycle
      suite green, because every test in it hands `createRound` a hand-built config and never
      goes through this normaliser. Third instance of a green probe meaning "no test exists",
      after the mass-assignment guard and the game badge.

      Fail closed, for the same reason as the market-hours gate: wrongly reserving refuses play
      visibly and somebody complains, wrongly permitting lets a round start that the contest end
      cuts short on a title where a partial run scores nothing.

      An absent value is the case that matters most in practice - every contest created before
      the field existed - and it must read as the rule those contests were created under.
    */
    const policyOf = (roundStartPolicy?: string) => {
      const result = contestRoundConfig({ ...stored, roundStartPolicy });
      expect(result.ok).toBe(true);
      return result.ok ? result.config.roundStartPolicy : undefined;
    };

    expect(policyOf("until_window_closes")).toBe("until_window_closes");
    expect(policyOf("reserve_full_round")).toBe("reserve_full_round");

    expect(policyOf(undefined)).toBe("reserve_full_round");
    expect(policyOf("")).toBe("reserve_full_round");
    // A typo, which a cast would have carried straight into the gate.
    expect(policyOf("until_window_close")).toBe("reserve_full_round");
  });
});

describe("isProviderContest", () => {
  it("requires both the label and a usable provider game", () => {
    // A contest labelled provider but carrying no provider key cannot launch a round, so
    // treating it as one would only move the failure later.
    expect(
      isProviderContest({
        gameType: "provider",
        gameConfig: { providerKey: "mock", gameCode: "tile-sprint" },
      }),
    ).toBe(true);

    expect(isProviderContest({ gameType: "provider" })).toBe(false);
    expect(
      isProviderContest({
        gameType: "trading",
        gameConfig: { providerKey: "mock", gameCode: "tile-sprint" },
      }),
    ).toBe(false);
    expect(isProviderContest(null)).toBe(false);
    expect(isProviderContest(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------
// Structural invariants
// ---------------------------------------------------------------------------------------

describe("structural: a draft cannot reach a player", () => {
  it("the player competition list excludes draft in the query itself", () => {
    // The whole safety argument for creating provider contests now rests on this line.
    const code = readCode("app/api/competitions/route.ts");
    expect(code).toMatch(/status:\s*\{\s*\$ne:\s*"draft"\s*\}/);
  });

  it("the create service writes status draft and never a visible status", () => {
    const code = readCode(
      "apps/admin/lib/services/game-providers/provider-contest.service.ts",
    );
    expect(code).toMatch(/status:\s*"draft"/);

    // Collected rather than asserted one at a time, so a failure names every visible
    // status that leaked in rather than only the first.
    const visibleWrites = [...code.matchAll(/status:\s*"(\w+)"/g)]
      .map((match) => match[1])
      .filter((status) => status !== "draft");
    expect(visibleWrites).toEqual([]);
  });
});

describe("structural: trading contest creation is untouched", () => {
  it("the trading wizard page and its form are not imported by the provider path", () => {
    // Chapter 12 requires both "a provider contest needs no trading field" and "trading
    // creation is unchanged". Two separate paths is how both hold.
    const code = readCode(
      "apps/admin/lib/services/game-providers/provider-contest.service.ts",
    );
    expect(code).not.toContain("CompetitionCreatorForm");
    expect(code).not.toContain("competition.actions");
  });

  it("the provider create path sets no trading field", () => {
    const code = readCode(
      "apps/admin/lib/services/game-providers/provider-contest.service.ts",
    );
    for (const tradingField of [
      "startingCapital",
      "leverage",
      "assetClasses",
      "allowedSymbols",
      "maxPositions",
    ]) {
      expect(code, tradingField).not.toContain(`${tradingField}:`);
    }
  });

  it("startingCapital is still required for a trading competition", () => {
    // The conditional must narrow the requirement, never remove it. An unlabelled contest
    // resolves to trading, so the predicate has to treat a missing gameType as trading too.
    const code = readCode("database/models/trading/competition.model.ts");
    expect(code).toMatch(/startingCapital:\s*\{[\s\S]*?required:\s*function/);
    expect(code).toMatch(/gameType\s*\?\?\s*"trading"\)\s*===\s*"trading"/);
  });

  it("both copies of the contest model agree on that predicate", () => {
    const main = readCode("database/models/trading/competition.model.ts");
    const admin = readCode("apps/admin/database/models/trading/competition.model.ts");
    const predicate = /gameType\s*\?\?\s*"trading"\)\s*===\s*"trading"/;
    expect(main).toMatch(predicate);
    expect(admin).toMatch(predicate);
  });
});

describe("structural: the settings form is game-agnostic", () => {
  it("the field renderer branches on declared type, never on a game or provider", () => {
    // The moment a `switch` on game code appears here, "no developer needed for a new
    // title" silently stops being true.
    const code = readCode(
      "apps/admin/components/admin/games/ConfigSchemaFields.tsx",
    );
    expect(code).not.toMatch(/gameCode|gameKey|providerKey/);
  });

  it("the contest API is guarded on competitions, not on provider credentials", () => {
    // Running contests and reaching provider API secrets are different jobs, and the
    // per-section grant is what keeps them apart.
    const code = readCode("apps/admin/app/api/games/contests/route.ts");
    expect(code).toMatch(/guardSection\("competitions"\)/);
    expect(code).not.toMatch(/guardSection\("game-providers"\)/);
  });
});
