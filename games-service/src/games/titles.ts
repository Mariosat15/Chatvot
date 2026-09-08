/**
 * The two Circuit titles, as the catalogue endpoint reports them.
 *
 * ONE ENGINE, TWO TITLES, AND WHY THAT IS THE POINT
 * -------------------------------------------------
 * Both titles are the same puzzle. They differ only in how a session is framed and how the
 * number at the end is computed - `circuit-sprint` counts points upwards, `circuit-perfect`
 * counts milliseconds downwards.
 *
 * Two titles rather than one exists to make `scoreDirection` observable by something real. The
 * specification is blunt about the consequence of getting it wrong: "If this is wrong we rank
 * the entire field backwards and pay the worst player first." A platform whose only games are
 * higher-is-better has never executed that path.
 *
 * It also demonstrates the thing the provider abstraction claims - that a new *title* is data
 * and needs no code - because the second title reaches the platform through the same catalogue
 * response as the first.
 *
 * CIRCUIT PERFECT IS RETIRED (owner, 8 September 2026) AND THAT COSTS US THE PARAGRAPH ABOVE
 * ------------------------------------------------------------------------------------------
 * The owner asked for one shape of game: unlimited boards inside one clock, scored on how many
 * you solve and how fast you solve each one. That is Sprint exactly. Perfect is the opposite
 * shape - a fixed set of boards, scored on total time, lowest wins - so it was retired rather
 * than reshaped, because reshaping it would have produced a second Sprint differing only by
 * grid size.
 *
 * It is `deprecated`, NOT deleted, and the distinction is the same one the platform applies to
 * a provider it stops using: `gameKey` is the join key for every stat a title ever produced, so
 * a removed row orphans history while every screen still renders a key it cannot resolve. The
 * platform's contest pre-flight refuses a non-`active` title, so no new contest can be created
 * on it, while rounds already played still read and score correctly. Its engine, config and
 * scoring stay exactly where they are.
 *
 * THE CONSEQUENCE TO KEEP VISIBLE: nothing in the live catalogue is `lower_is_better` any more,
 * so the ranking path the specification warns loudest about is no longer exercised by a real
 * title. It is held by unit tests over `scoreRound` and by the platform's own direction
 * resolver - which is weaker than a game somebody plays, and is the price of the decision
 * rather than an oversight.
 *
 * ONLY `en` IS DECLARED, DELIBERATELY
 * -----------------------------------
 * The specification requires that "text fields above must exist in every locale you declare",
 * and the plan treats page content as contractual. Declaring `es`, `de` and `el` and shipping
 * English strings for them would be worse than declaring one locale: the platform would render
 * confident English copy on a Greek game page and nobody would get an error. Locales are added
 * here when the translations exist, not when the audience does.
 */

import { PuzzleShape } from "../engine/generate";
import { howToPlayProse } from "./instructions";

export type ScoreDirection = "higher_is_better" | "lower_is_better";
export type ScoreType = "integer" | "decimal" | "duration_ms";

export interface TitleDefinition {
  gameCode: string;
  displayName: string;
  tagline: string;
  description: string;
  rulesSummary: string;
  howToPlay: string;
  category: string;
  tags: string[];
  family: "independent";
  supportsCompetition: boolean;
  supportsOneVsOne: boolean;
  supportsPractice: boolean;
  supportsContentSeed: boolean;
  scoreDirection: ScoreDirection;
  scoreType: ScoreType;
  scoreRange: { min: number; max: number };
  typicalDurationSeconds: number;
  maxDurationSeconds: number;
  configSchema: Record<string, unknown>;
  locales: string[];
  platforms: string[];
  status: "active" | "deprecated" | "maintenance";
}

/**
 * Grid sizes offered as a difficulty setting.
 *
 * Deliberately an enum of named sizes rather than free width and height integers. Reason: a
 * provider setting reaches us from an operator's admin form, and `width: 40` would generate a
 * technically valid puzzle that is unplayable on a phone. A control that can be set to
 * something unusable is a control that will be.
 */
export const GRID_SIZES = ["small", "medium", "large"] as const;
export type GridSize = (typeof GRID_SIZES)[number];

const GRID_SHAPES: Record<GridSize, PuzzleShape> = {
  small: { width: 5, height: 5, minPairs: 3, maxPairs: 5 },
  medium: { width: 6, height: 6, minPairs: 4, maxPairs: 6 },
  large: { width: 7, height: 7, minPairs: 5, maxPairs: 8 },
};

export function shapeFor(size: GridSize): PuzzleShape {
  // `size` is one of three literal values, narrowed by the type and by `resolveConfig`'s
  // fallback before it can get here.
  // eslint-disable-next-line security/detect-object-injection
  return GRID_SHAPES[size];
}

export const SPRINT_CODE = "circuit-sprint";
export const PERFECT_CODE = "circuit-perfect";

/**
 * How long a Sprint session may be set to, in seconds.
 *
 * ONE DECLARATION, TWO READERS, AND THAT IS THE POINT. These bounds appear in the title's
 * `configSchema`, which the platform validates an operator's answer against, and again in
 * `resolveConfig`, which clamps whatever actually arrives. They used to be six literals in two
 * places. Two copies of one range is the failure shape this codebase has hit repeatedly: the
 * platform would accept a value its own form offered and this service would silently clamp it
 * to something else, so an operator's 45 minutes would run for 5 and the contest would still
 * report success.
 *
 * THE CEILING IS AN HOUR (owner, 8 September 2026), up from five minutes. The owner's example
 * was a ten-minute session, which the old 60-300 range could not express at all. `maximum`
 * here and `maxDurationSeconds` on the title must agree - the specification requires that a
 * round be impossible to extend beyond the declared maximum, so a schema permitting more than
 * the title admits is a promise this service would then break.
 */
export const SPRINT_DURATION = {
  min: 60,
  max: 3_600,
  default: 600,
} as const;

/*
 * The JSON Schema subset used below is deliberately conservative: `type`, `properties`,
 * `integer`/`string`/`boolean`, `minimum`, `maximum`, `enum`, `default`, `required`. Nothing
 * else.
 *
 * The specification asks for "valid JSON Schema" without saying which subset the platform
 * understands, which is recorded as an ambiguity - a provider using `pattern` or `oneOf` would
 * be writing perfectly valid JSON Schema and could still have the whole title refused. Sticking
 * to the basics is what a careful provider would do, and it is also the only choice that can be
 * made from the document alone.
 */

export const SPRINT: TitleDefinition = {
  gameCode: SPRINT_CODE,
  displayName: "Circuit Sprint",
  tagline: "Wire the grid. Beat the clock. As many boards as you can.",
  description:
    "A fast spatial puzzle. Each board has pairs of matching terminals, and you connect " +
    "each pair with a path so that no two paths cross and every square is used. Solve as " +
    "many boards as you can before the timer runs out. Every player in a contest gets the " +
    "same boards in the same order.",
  rulesSummary:
    "1,000 points for every board you complete, plus a speed bonus of up to 200 for solving " +
    "quickly. An unfinished board scores nothing. Highest total wins; ties are broken by the " +
    "time of your last completed board.",
  // Composed from the shared rules, so the game page and the pre-round panel cannot disagree.
  // See `instructions.ts` - they had already drifted when they were two hand-written copies.
  howToPlay: howToPlayProse("The next board appears as soon as you complete one."),
  category: "puzzle",
  tags: ["puzzle", "logic", "fast", "mobile-friendly", "no-text"],
  family: "independent",
  supportsCompetition: true,
  supportsOneVsOne: true,
  supportsPractice: true,
  supportsContentSeed: true,
  scoreDirection: "higher_is_better",
  scoreType: "integer",
  /*
    Max is a generous ceiling rather than a tight one: the specification says scores outside
    the range are rejected, so an over-tight bound turns an exceptional player into an
    unresolved round.

    IT HAD TO GROW WITH THE CLOCK, AND THE OLD FIGURE WAS ALREADY REACHABLE. A board is worth
    at most 1,200 points, so 60,000 is fifty boards. That was comfortably out of reach in a
    five-minute session and is nothing in an hour - and `scoreRound` clamps rather than
    refusing, so the failure would not have been an error. Every player past fifty boards
    would have reported exactly 60,000, TIED at the top of the leaderboard, and the pot would
    have been split between them by rounding rather than by skill. An hour at a brisk four
    seconds a board is around 900 boards, so the ceiling is set well clear of any human.
  */
  scoreRange: { min: 0, max: 2_000_000 },
  typicalDurationSeconds: SPRINT_DURATION.default,
  maxDurationSeconds: SPRINT_DURATION.max,
  configSchema: {
    type: "object",
    properties: {
      durationSeconds: {
        type: "integer",
        minimum: SPRINT_DURATION.min,
        maximum: SPRINT_DURATION.max,
        default: SPRINT_DURATION.default,
        /*
          THE PLATFORM NEEDS THIS NUMBER AND MUST NOT LEARN ITS NAME.

          How long one attempt lasts decides when the last attempt of a contest may start, how
          much result grace the contest needs, and what the operator is told about the contest
          clock and the game clock relating. Without a declared role the platform's only
          generic answer was `maxDurationSeconds`, the title's CEILING - so a contest set to
          two minutes had five reserved against it and refused every attempt from the moment
          it opened.

          Declaring the role lets the platform read this field without a line of code that
          knows the word "durationSeconds", which is what keeps a second provider's clock -
          called whatever they call it - working with no release.
        */
        format: "duration-seconds",
      },
      gridSize: {
        type: "string",
        enum: [...GRID_SIZES],
        default: "medium",
      },
    },
    required: ["durationSeconds", "gridSize"],
  },
  locales: ["en"],
  platforms: ["desktop", "mobile"],
  status: "active",
};

export const PERFECT: TitleDefinition = {
  gameCode: PERFECT_CODE,
  displayName: "Circuit Perfect",
  tagline: "Five boards. One clock. Every square counts.",
  description:
    "The same spatial puzzle as Circuit Sprint, scored the other way round. You are given a " +
    "fixed set of boards and your score is the total time you take to finish them all, so " +
    "the fastest player wins. Every player in a contest gets the same boards in the same " +
    "order.",
  rulesSummary:
    "Your score is your total time in milliseconds, and the LOWEST score wins. Every board " +
    "you leave unfinished adds a two-minute penalty to your time, so finishing all of them is " +
    "always better than rushing and giving up. Ties are broken by the number of boards " +
    "completed.",
  howToPlay: howToPlayProse(
    "The clock runs from your first move to your last, so a board you are still thinking " +
      "about is still costing you.",
  ),
  category: "puzzle",
  tags: ["puzzle", "logic", "time-trial", "mobile-friendly", "no-text"],
  family: "independent",
  supportsCompetition: true,
  supportsOneVsOne: true,
  supportsPractice: true,
  supportsContentSeed: true,
  scoreDirection: "lower_is_better",
  scoreType: "duration_ms",
  // Lower bound is not zero: a human cannot complete a board in under a second, and a reported
  // zero would win every contest. It is a safety net against our own bug as much as a cheat,
  // which is the reason the specification gives for wanting the range at all.
  scoreRange: { min: 1_000, max: 1_800_000 },
  typicalDurationSeconds: 240,
  maxDurationSeconds: 600,
  configSchema: {
    type: "object",
    properties: {
      boardCount: {
        type: "integer",
        minimum: 3,
        maximum: 10,
        default: 5,
      },
      gridSize: {
        type: "string",
        enum: [...GRID_SIZES],
        default: "medium",
      },
      unfinishedPenaltyMs: {
        type: "integer",
        minimum: 30_000,
        maximum: 300_000,
        default: 120_000,
      },
    },
    required: ["boardCount", "gridSize", "unfinishedPenaltyMs"],
  },
  locales: ["en"],
  platforms: ["desktop", "mobile"],
  // Retired by the owner, 8 September 2026. `deprecated` rather than removed from `TITLES`,
  // so history keyed on this game code still resolves and the platform's pre-flight refuses
  // any NEW contest on it. See the note at the top of this file for the reasoning and for
  // what retiring it costs.
  status: "deprecated",
};

export const TITLES: TitleDefinition[] = [SPRINT, PERFECT];

export function findTitle(gameCode: string): TitleDefinition | undefined {
  return TITLES.find((title) => title.gameCode === gameCode);
}

/* ------------------------------------------------------------------------------------------
 * Resolved configuration
 * ---------------------------------------------------------------------------------------- */

export interface SprintConfig {
  kind: "sprint";
  durationSeconds: number;
  gridSize: GridSize;
}

export interface PerfectConfig {
  kind: "perfect";
  boardCount: number;
  gridSize: GridSize;
  unfinishedPenaltyMs: number;
}

export type RoundConfig = SprintConfig | PerfectConfig;

function asGridSize(value: unknown, fallback: GridSize): GridSize {
  return GRID_SIZES.includes(value as GridSize) ? (value as GridSize) : fallback;
}

/**
 * Clamp a numeric setting into the range this title declared.
 *
 * WHY CLAMP RATHER THAN REFUSE
 * ----------------------------
 * The platform validates `config` against our `configSchema` before sending it, so an
 * out-of-range value should never arrive. That is exactly why this must not throw: the value
 * getting here at all means the two sides disagree about the schema, and refusing a paid
 * round mid-contest is a worse outcome than playing a 300-second board when 400 was asked
 * for.
 *
 * The disagreement is worth knowing about, so it is reported by the caller rather than
 * swallowed here.
 */
function clampInteger(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): { value: number; clamped: boolean } {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { value: fallback, clamped: value !== undefined };
  }
  const rounded = Math.round(value);
  if (rounded < min) return { value: min, clamped: true };
  if (rounded > max) return { value: max, clamped: true };
  return { value: rounded, clamped: false };
}

export interface ResolvedConfig {
  config: RoundConfig;
  /** Settings that had to be corrected, so the caller can log a schema disagreement. */
  corrected: string[];
}

export function resolveConfig(
  title: TitleDefinition,
  input: Record<string, unknown> | undefined,
): ResolvedConfig {
  const raw = input ?? {};
  const corrected: string[] = [];

  if (title.gameCode === SPRINT_CODE) {
    const duration = clampInteger(
      raw.durationSeconds,
      SPRINT_DURATION.min,
      SPRINT_DURATION.max,
      SPRINT_DURATION.default,
    );
    if (duration.clamped) corrected.push("durationSeconds");
    const gridSize = asGridSize(raw.gridSize, "medium");
    if (raw.gridSize !== undefined && gridSize !== raw.gridSize) corrected.push("gridSize");

    return {
      corrected,
      config: { kind: "sprint", durationSeconds: duration.value, gridSize },
    };
  }

  const boardCount = clampInteger(raw.boardCount, 3, 10, 5);
  if (boardCount.clamped) corrected.push("boardCount");
  const penalty = clampInteger(raw.unfinishedPenaltyMs, 30_000, 300_000, 120_000);
  if (penalty.clamped) corrected.push("unfinishedPenaltyMs");
  const gridSize = asGridSize(raw.gridSize, "medium");
  if (raw.gridSize !== undefined && gridSize !== raw.gridSize) corrected.push("gridSize");

  return {
    corrected,
    config: {
      kind: "perfect",
      boardCount: boardCount.value,
      gridSize,
      unfinishedPenaltyMs: penalty.value,
    },
  };
}

/**
 * How long a round may last, in milliseconds, from the config.
 *
 * The specification requires that "a round must be impossible to extend beyond"
 * `maxDurationSeconds`. For Sprint that is the configured clock; for Perfect there is no clock
 * in the rules, so the title's declared maximum is the hard stop.
 */
export function roundDurationMs(config: RoundConfig): number {
  return config.kind === "sprint"
    ? config.durationSeconds * 1000
    : PERFECT.maxDurationSeconds * 1000;
}
