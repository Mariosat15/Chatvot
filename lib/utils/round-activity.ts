import { humanizeMetric } from "@/lib/utils/humanize-metric";

/**
 * A round's state and the game's own figures, turned into something a player can read.
 *
 * ONE DEFINITION FOR EVERY SURFACE THAT DESCRIBES A ROUND. The standings row, the live-activity
 * feed and anything that follows them all answer the same question - what has this player been
 * doing - and two copies of that answer drift in the worst available direction: one screen
 * saying a player finished while the one beside it says they are still playing. That is the
 * "one rule, two copies" shape behind `referenceId`, `failedReason`, `challengeId` and the Game
 * Master `||`, none of which `check:mirrors` can see.
 *
 * IT KNOWS NOTHING ABOUT ANY GAME, and that is the property a test pins rather than a claim in
 * this comment. The words come from the ROUND's status, which every game has because the
 * platform defines it; the figures come from `scoreBreakdown`, which is free-form and belongs
 * to the game. A table mapping "boardsCompleted" to a nicer label is a `switch` on game code
 * wearing a different hat - it renders beautifully for the two titles somebody thought of and
 * blank for the third, which is worse than the plain version for all three.
 *
 * THE METRIC ORDER IS THE GAME'S, NOT OURS. `01` section 3.2 makes the breakdown display-only
 * and free-form; it arrives as an object, and both BSON and JavaScript preserve key order, so
 * the sequence a screen receives is the sequence the game wrote. Taking the first entries is
 * therefore deferring to the game rather than choosing for it. Picking a "primary" metric by
 * name would be the choosing, and would need re-deciding for every title ever added.
 *
 * MODEL-FREE BY REQUIREMENT, NOT BY PREFERENCE. It sits beside `humanize-metric.ts` because it
 * is the same kind of thing, and because a client component may eventually want it - reaching a
 * Mongoose model from a module a `"use client"` file imports is R58, which took the admin panel
 * down for a build.
 */

/** How a round's state should read, for colour rather than for wording. */
export type RoundActivityTone =
  /** Still in flight - the player is at the board now. */
  | "live"
  /** Finished and reported. */
  | "scored"
  /** Ended without finishing, or never reported. Still frequently carries a score (R48). */
  | "lapsed"
  /** Nothing has happened, or nothing that describes play. */
  | "idle";

export interface RoundActivitySummary {
  status: string;
  attemptNumber: number;
  /** Already filtered to statuses that produce one. Absent is not zero. */
  score?: number;
  breakdown?: Record<string, unknown>;
  /** The attempt's clock in milliseconds. Absent when there is nothing to time. */
  durationMs?: number;
}

export interface RoundActivityPhrase {
  /** What this player last did, in words. Always present, including for a player with none. */
  headline: string;
  tone: RoundActivityTone;
  /** The game's own figures, humanised, in the order the game declared them. */
  metrics: { label: string; value: string }[];
}

/**
 * A `Map` rather than an object, because the key comes from a stored document.
 *
 * Object indexing walks the prototype chain, so `"constructor"` resolves to something truthy
 * that survives a `!entry` test and fails later somewhere unrelated. The status is a schema
 * enum so it cannot happen today; "safe by accident is not safe" is the fourth instance of this
 * in the codebase and the cost of the `Map` is nothing.
 *
 * A `%d` placeholder rather than a template, so the wording and the substitution stay in one
 * place and a status that does not mention the attempt simply has no placeholder.
 */
const STATUS_COPY: ReadonlyMap<string, { headline: string; tone: RoundActivityTone }> =
  new Map([
    ["pending", { headline: "About to start", tone: "live" as const }],
    ["launched", { headline: "Playing now", tone: "live" as const }],
    ["completed", { headline: "Finished attempt %d", tone: "scored" as const }],
    // `expired` is the ORDINARY ending for anyone still playing at the final whistle, because
    // `createRound` clamps a round's expiry to the contest's play window. It is not a player
    // giving up, and R48 makes whatever they achieved count - so the wording says what
    // happened to the clock and never anything about the player.
    ["expired", { headline: "Time ran out", tone: "lapsed" as const }],
    ["abandoned", { headline: "Left attempt %d", tone: "lapsed" as const }],
    ["voided", { headline: "Attempt cancelled", tone: "idle" as const }],
    ["unresolved", { headline: "Result not reported", tone: "lapsed" as const }],
  ]);

/** What a player with no rounds at all reads as. */
const NOT_PLAYED: RoundActivityPhrase = {
  headline: "Not played yet",
  tone: "idle",
  metrics: [],
};

/**
 * Whether a breakdown entry is something a row can put in front of a player.
 *
 * A RENDERABILITY TEST, NOT A PREFERENCE. Nothing here favours one metric over another - it
 * excludes only values a short row physically cannot show: `null` and `undefined` have nothing
 * to say, and an object or array stringifies to JSON, which is debugging output rather than
 * copy. `NaN` is excluded because it renders as the word "NaN" beside a player's name.
 *
 * A boolean survives, because `humanizeMetric` turns it into Yes/No and a game reporting
 * "perfect: true" has said something worth showing.
 */
function isRenderable(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  if (typeof value === "string") return value.trim().length > 0;
  return false;
}

export function describeRoundActivity(
  activity: RoundActivitySummary | undefined,
  options: { maxMetrics?: number } = {},
): RoundActivityPhrase {
  if (!activity) return NOT_PLAYED;

  const copy = STATUS_COPY.get(activity.status);

  const metrics = Object.entries(activity.breakdown ?? {})
    .filter(([, value]) => isRenderable(value))
    .slice(0, options.maxMetrics ?? 2)
    .map(([key, value]) => humanizeMetric(key, value));

  /*
    An unrecognised status says so rather than guessing. A new status reaching a player screen
    as "Playing now" is the failure mode this platform keeps recording - a control that appears
    to work while reporting something untrue - and the model's enum is add-only, so one can
    legitimately arrive here before this map learns about it.
  */
  if (!copy) {
    return { headline: "In progress", tone: "idle", metrics };
  }

  return {
    headline: copy.headline.replace("%d", String(activity.attemptNumber)),
    tone: copy.tone,
    metrics,
  };
}

/**
 * An attempt's clock as a leaderboard reads it.
 *
 * `m:ss` below an hour and `h:mm:ss` above it, which is the shape the reference board uses and
 * the shape every stopwatch a player has ever seen uses. Minutes are NOT zero-padded at the
 * front: a column of `0:42` and `1:15` is what a stopwatch shows, and `00:42` reads as a
 * duration on a video player.
 *
 * SECONDS ARE FLOORED, NEVER ROUNDED. A round that lasted 41.8 seconds is in its forty-second
 * second, and rounding up shows a time the player had not yet reached - which on a lower-is-
 * better title is a figure slightly worse than the one they earned, next to a score that is
 * exactly right.
 *
 * An unusable figure answers `undefined` rather than `0:00`, because a zero here is the phantom
 * nought (R50) one field along: it reads as an instantaneous round rather than as an unknown.
 */
export function formatRoundClock(ms: number | undefined): string | undefined {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0) return undefined;

  const totalSeconds = Math.floor(ms / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);

  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");

  return hours > 0 ? `${hours}:${mm}:${ss}` : `${minutes}:${ss}`;
}

/** The tone as a text colour, so every surface tints an activity line the same way. */
export function roundActivityToneClass(tone: RoundActivityTone): string {
  if (tone === "live") return "text-sky-300";
  if (tone === "scored") return "text-emerald-300";
  if (tone === "lapsed") return "text-amber-300";
  return "text-gray-500";
}
