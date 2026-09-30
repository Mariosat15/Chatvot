/**
 * The words a competition card shows for a private Game Master contest, one answer per
 * `privateAccess` state (owner decision 30 Sep 2026: private contests are listed to everyone
 * signed in; see `lib/services/gamemaster/private-contest-listing.service.ts`).
 *
 * Model-free and client-reachable (R58): the card is `"use client"`, so the state type is
 * restated here as a literal union rather than imported from the gate service.
 */

export type PrivateCardAccess =
  | "member"
  | "joinable"
  | "locked"
  | "unavailable"
  | "join_disabled"
  | "signed_out";

export interface PrivateCardCopy {
  /** Replaces the ordinary entry button. Absent for a member - they get the normal card. */
  action?: string;
  /** One sentence under the button saying why. */
  hint?: string;
  /** Whether the action is the invitation (bright) or a closed door (muted). */
  tone: "invite" | "closed" | "member";
}

const KNOWN = new Set<PrivateCardAccess>([
  "member",
  "joinable",
  "locked",
  "unavailable",
  "join_disabled",
  "signed_out",
]);

export function isPrivateCardAccess(value: unknown): value is PrivateCardAccess {
  return typeof value === "string" && KNOWN.has(value as PrivateCardAccess);
}

export function privateContestCardCopy(
  access: PrivateCardAccess,
  gameMasterName: string | undefined,
): PrivateCardCopy {
  const gm = gameMasterName?.trim() || "this Game Master";
  switch (access) {
    case "member":
      return { tone: "member" };
    case "joinable":
      return {
        action: "Join GM to enter",
        hint: `Private competition. Join ${gm} to enter.`,
        tone: "invite",
      };
    case "locked":
      // Reason: D1 - a player under another Game Master is never offered a switch; only an
      // admin can move them. The card says so rather than offering a button that fails.
      return {
        action: "Members only",
        hint: `Only players under ${gm} can enter. You already belong to another Game Master - only an admin can move you.`,
        tone: "closed",
      };
    case "join_disabled":
      return {
        action: "Members only",
        hint: "Joining a Game Master is switched off right now.",
        tone: "closed",
      };
    case "signed_out":
      return { action: "Sign in to join", hint: `Private competition run by ${gm}.`, tone: "invite" };
    case "unavailable":
    default:
      return {
        action: "Members only",
        hint: `${gm} is not taking new players right now.`,
        tone: "closed",
      };
  }
}
