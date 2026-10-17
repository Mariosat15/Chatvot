/**
 * Wording for a Game Master-funded ("Free Private") competition, shown on every card and in
 * the lobby so a player knows before opening it that entry costs them nothing.
 *
 * Model-free and client-reachable (R58): the cards are `"use client"` components.
 */

const FALLBACK_SPONSOR = "your Game Master";

/** Only a stored `gm_funded` is sponsored; anything else, including absent, is player-paid. */
export function isSponsoredContest(fundingMode: unknown): boolean {
  return fundingMode === "gm_funded";
}

/** The sponsor's display name, never blank. */
export function sponsorDisplayName(gameMasterName: unknown): string {
  return typeof gameMasterName === "string" && gameMasterName.trim()
    ? gameMasterName.trim()
    : FALLBACK_SPONSOR;
}

export function sponsoredContestCopy(gameMasterName: unknown): {
  headline: string;
  detail: string;
  entryLabel: string;
} {
  const name = sponsorDisplayName(gameMasterName);
  return {
    headline: `Sponsored competition by ${name}`,
    detail: `Free to enter - ${name} pays every seat. You pay nothing and only receive any prize you win.`,
    entryLabel: "FREE",
  };
}
