/**
 * What KIND of Game Master competition a row is, for the dashboard badges and filters
 * (owner, 2 Oct 2026): Normal (public, players pay), Private (invite-only, players pay) or
 * Funded (invite-only, the Game Master pays every seat).
 *
 * Model-free so the client dashboard can import the labels (R58). Derived from the same two
 * resolvers the entry path uses, so a badge cannot disagree with how the contest behaves.
 */
import { resolveCompetitionVisibility } from "@/lib/services/gamemaster/competition-visibility";
import { isSponsoredContest } from "@/lib/utils/sponsored-contest-copy";

export type GmContestKind = "normal" | "private" | "funded";

export const GM_CONTEST_KINDS: readonly GmContestKind[] = ["normal", "private", "funded"];

export const GM_CONTEST_KIND_LABELS: ReadonlyMap<GmContestKind, string> = new Map([
  ["normal", "Normal"],
  ["private", "Private"],
  ["funded", "Funded"],
]);

/**
 * Reason: funded is checked first because a funded contest is always private too - showing
 * "Private" would hide the fact that matters most, that the Game Master pays the seats.
 */
export function gmContestKind(contest: {
  visibility?: unknown;
  fundingMode?: unknown;
  [key: string]: unknown;
}): GmContestKind {
  if (isSponsoredContest(contest.fundingMode)) return "funded";
  return resolveCompetitionVisibility(contest.visibility) === "gm_private" ? "private" : "normal";
}

/** Narrow an untrusted string (a filter value, an API field) to a kind, or `null`. */
export function parseGmContestKind(value: unknown): GmContestKind | null {
  return typeof value === "string" && (GM_CONTEST_KINDS as readonly string[]).includes(value)
    ? (value as GmContestKind)
    : null;
}
