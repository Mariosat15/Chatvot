/**
 * Player-facing words for the provider game lobby, kept out of `ProviderContestLobby.tsx`
 * so the page composes rather than defines.
 *
 * Each policy has two forms on purpose (owner, 15 Oct 2026: "organise into categories like
 * the trading lobby"): a SHORT value that fits a rule row, and the FULL sentence that rides on
 * the row's ? tip. The short form must never say more than the sentence - it is a label for
 * it, not a second rule. Maps rather than records so a stored policy string can never reach a
 * prototype member.
 */

import type { LobbyStageFact } from "./LobbyCenterStage";

export const UNRESOLVED_POLICY_COPY = new Map<string, string>([
  [
    "score_zero",
    "If your round never reports a result, it is scored zero and the competition still settles on time. You will be told it happened.",
  ],
  [
    "exclude",
    "If your round never reports a result, you are removed from the ranking and your entry fee is refunded.",
  ],
  [
    "hold_and_alert",
    "If your round never reports a result, the competition is held and a person reviews it before anyone is paid.",
  ],
]);

export const UNRESOLVED_POLICY_SHORT = new Map<string, string>([
  ["score_zero", "Scored zero"],
  ["exclude", "Fee refunded"],
  ["hold_and_alert", "Held for review"],
]);

export const ATTEMPTS_POLICY_COPY = new Map<string, string>([
  ["single", "One attempt, and the score from it is final."],
  ["best_of_n", "Your best attempt counts."],
  ["sum_of_n", "Every attempt is added together."],
]);

export const ATTEMPTS_POLICY_SHORT = new Map<string, string>([
  ["single", "Final score"],
  ["best_of_n", "Best counts"],
  ["sum_of_n", "All add up"],
]);

export function formatRoundClock(seconds?: number | null): string {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) {
    return "—";
  }
  const whole = Math.floor(seconds);
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatUTC(value: Date | string | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toUTCString();
}

/** "15 Oct, 14:00 UTC" - short enough for the right-hand value of a rule row. */
export function formatUTCShort(value: Date | string | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const month = date.toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  return `${date.getUTCDate()} ${month}, ${hh}:${mm} UTC`;
}

/** Centre-stage blurb when the catalogue and the contest carry no description of their own. */
export const ANYTIME_STAGE_BLURB =
  "Play anytime before the competition ends and push for your best score. When the timer hits zero, everyone's final scores are compared and the winners are decided.";

/** Operator-authored Guides steps, or undefined so the timeline uses its own defaults. */
export function toHowItWorksSteps(
  steps: { title?: string; detail?: string }[] | undefined,
): { title: string; detail: string }[] | undefined {
  if (!steps?.length) return undefined;
  return steps.map((step) => ({ title: step.title || "Step", detail: step.detail || "" }));
}

/** The three short facts under the game name on the centre stage. */
export function buildStageFacts(
  roundSeconds: number | null | undefined,
  playMode: "anytime" | "scheduled",
): LobbyStageFact[] {
  const facts: LobbyStageFact[] = [];
  if (typeof roundSeconds === "number" && roundSeconds > 0) {
    facts.push({ kind: "clock", label: "Round", value: `Up to ${formatRoundClock(roundSeconds)}` });
  }
  facts.push(
    { kind: "start", label: "Start", value: playMode === "anytime" ? "Any time" : "All together" },
    { kind: "attempt", label: "Leaving", value: "Uses an attempt" },
  );
  return facts;
}
