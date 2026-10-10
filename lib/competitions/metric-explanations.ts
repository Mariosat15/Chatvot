import { describeCompetitionMode } from "./competition-mode-copy";
import type { MetricKey } from "./game-definitions";
import type { CompetitionMetric } from "./types";

/**
 * One plain sentence per competition stat, shown when a player taps it.
 *
 * Reason: a Map rather than an object, because the key comes from data and an
 * object lookup would walk the prototype chain.
 */
const METRIC_EXPLANATIONS = new Map<MetricKey, string>([
  ["prizePool", "Total Volts shared between the winners when the competition ends."],
  ["players", "Players who have joined so far, out of the maximum allowed."],
  ["duration", "How long the competition runs once it starts."],
  ["assets", "The markets you can trade in this competition."],
  ["entryFee", "Volts charged from your balance when you join."],
  ["leverage", "The highest leverage you may use on a trade."],
  ["difficulty", "How hard this competition is rated."],
  ["startingCapital", "The practice balance every trader starts with. It is not real money."],
  ["track", "The track this race is run on."],
  ["boardSize", "The size of the game board you play on."],
  ["rounds", "How many rounds are played."],
  ["laps", "How many laps each race has."],
  ["scoreTarget", "The score that counts as finishing."],
  ["scoring", "How your result is turned into a score."],
]);

export function explainCompetitionMetric(metric: CompetitionMetric): string {
  if (metric.key === "mode") return describeCompetitionMode(metric.value);
  return METRIC_EXPLANATIONS.get(metric.key) ?? metric.label;
}

export function explainCompetitionCountdown(kind: "starts" | "ends"): string {
  return kind === "starts"
    ? "Time remaining until this competition starts."
    : "Time remaining until this competition ends.";
}
