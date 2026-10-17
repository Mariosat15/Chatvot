/**
 * Turning a provider's `scoreBreakdown` keys into something a player can read.
 *
 * THE PROBLEM THIS SOLVES, and the constraint that rules out the obvious answer. A provider
 * sends its breakdown as free-form JSON - `{ boardsCompleted: 7, penaltyMs: 2400 }` - and
 * `RoundResultPanel` printed the keys verbatim, so players saw "penaltyMs 2400". A lookup table
 * of nice labels per key is the natural fix and it is the wrong one: it would need an entry for
 * every metric of every title of every provider, which is exactly the "no additional coding"
 * property the whole platform is built around. The first title with an unmapped key then shows
 * a blank label instead of an ugly one, which is worse.
 *
 * So this knows nothing about any game. It applies two rules that hold for any camelCase
 * identifier in any language a provider might send:
 *
 *   1. Split on case and digit boundaries, then sentence-case the result.
 *   2. Read a UNIT off the suffix, and only off a suffix, so the value can be formatted in
 *      something human. `penaltyMs` is milliseconds whatever game produced it.
 *
 * Anything it cannot recognise it passes through as a split label and a stringified value,
 * which is still strictly better than the raw key and never worse than what it replaced.
 *
 * If a provider wants exact wording, that is a contract question for
 * `01-provider-contract-specification.md`, not a table in here.
 */

/**
 * Suffixes whose meaning is unambiguous across games.
 *
 * Deliberately short. Every entry is a claim that no provider will ever use that suffix to mean
 * something else, and a wrong guess here silently mislabels a real number - which is worse than
 * not guessing, because the player has no way to tell. `Count`, `Total` and `Score` are absent
 * on purpose: they carry no unit, so splitting the label is already the whole answer.
 */
const UNIT_SUFFIXES: {
  suffix: string;
  format: (value: number) => string;
  /** Replaces the suffix in the label, so "penaltyMs" reads "Penalty" not "Penalty ms". */
  labelSuffix: string;
}[] = [
  {
    suffix: "Ms",
    labelSuffix: "",
    // Reason for switching units at a second: "2400 ms" is arithmetic the player has to do,
    // and "0.04 s" for a 40ms figure hides the precision that made it worth reporting.
    format: (value) =>
      Math.abs(value) >= 1000
        ? `${(value / 1000).toFixed(2)}s`
        : `${Math.round(value)}ms`,
  },
  {
    suffix: "Seconds",
    labelSuffix: "",
    format: (value) => `${formatNumber(value)}s`,
  },
  {
    suffix: "Percent",
    labelSuffix: "",
    format: (value) => `${formatNumber(value)}%`,
  },
  {
    suffix: "Pct",
    labelSuffix: "",
    format: (value) => `${formatNumber(value)}%`,
  },
];

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  // Integers stay integers; a fractional value keeps two places. Reason: a score of 7 should
  // not render as "7.00", and a duration of 12.3456 should not render in full.
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/**
 * `boardsCompleted` -> `Boards completed`, `penaltyMs` -> `Penalty`, `level3Bonus` -> `Level 3 bonus`.
 *
 * Sentence case rather than title case, because a title-cased label built from an unknown
 * identifier reads like a proper noun ("Boards Completed") and looks like a bug next to the
 * platform's own sentence-cased labels.
 */
export function humanizeMetricKey(key: string): string {
  const matched = UNIT_SUFFIXES.find(
    (unit) => key.length > unit.suffix.length && key.endsWith(unit.suffix),
  );

  const stem = matched ? key.slice(0, key.length - matched.suffix.length) : key;

  const words = stem
    // camelCase and PascalCase boundaries.
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    // Runs of capitals followed by a word, so "HTTPRequests" splits before "Requests".
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    // A digit run is its own word: "level3Bonus" -> "level 3 Bonus".
    .replace(/([a-zA-Z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-zA-Z])/g, "$1 $2")
    // snake_case and kebab-case, in case a provider sends either.
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();

  if (words.length === 0) return key;

  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * The value beside a humanised key, formatted with any unit the key implied.
 *
 * Booleans become Yes/No rather than "true", and `null`/`undefined` become a dash - the same
 * dash an absent score uses everywhere else on the player surface, so absence reads as absence
 * rather than as zero.
 */
export function formatMetricValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";

  if (typeof value === "number") {
    const matched = UNIT_SUFFIXES.find(
      (unit) => key.length > unit.suffix.length && key.endsWith(unit.suffix),
    );
    return matched ? matched.format(value) : formatNumber(value);
  }

  // An object or array from a provider is not something a metric row can render. Reason it is
  // stringified rather than dropped: a breakdown entry that vanishes looks like the provider
  // sent nothing, and an operator debugging a payload needs to see that it arrived.
  if (typeof value === "object") return JSON.stringify(value);

  return String(value);
}

/** Both halves at once, for a component mapping over `Object.entries`. */
export function humanizeMetric(
  key: string,
  value: unknown,
): { label: string; value: string } {
  return {
    label: humanizeMetricKey(key),
    value: formatMetricValue(key, value),
  };
}
