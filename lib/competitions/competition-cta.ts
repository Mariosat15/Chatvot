/**
 * Presentation-only CTA engine for the competitions browser.
 *
 * Reason: Join GM is NOT performed here — the lobby's PrivateContestGate owns that.
 * This only chooses the label / href / variant so grid and list stay in sync.
 */

import { privateContestCardCopy } from "@/lib/utils/private-contest-card-copy";
import { isSponsoredContest } from "@/lib/utils/sponsored-contest-copy";
import type { CompetitionCta, CompetitionListItem } from "./types";

export interface CompetitionCtaInput {
  competition: CompetitionListItem;
  isRegistered: boolean;
  userBalance: number;
  registrationClosed: boolean;
}

function lobbyHref(id: string): string {
  return `/competitions/${id}`;
}

function resultsHref(id: string): string {
  return `/competitions/${id}/results`;
}

export function getCompetitionCTA(input: CompetitionCtaInput): CompetitionCta {
  const { competition: c, isRegistered, userBalance, registrationClosed } = input;
  const id = String(c._id);
  const status = c.status;
  const entryFee = Number(c.entryFeeCredits ?? c.entryFee ?? 0) || 0;
  const current = Number(c.currentParticipants ?? 0);
  const max = Number(c.maxParticipants ?? 0);
  const isFull = max > 0 && current >= max;
  // Reason: a Game Master-funded seat is never paid from the player's wallet, so a card must
  // not send them to top up the entry fee. The lobby's entry button applies the admin's
  // minimum-balance rule and explains it; the card only gets them through the door.
  const canAfford = isSponsoredContest(c.fundingMode) || userBalance >= entryFee;
  const privateAccess = c.privateAccess;

  if (status === "cancelled") {
    const refunded =
      c.refunded === true ||
      /refund/i.test(String(c.cancellationReason || ""));
    return {
      label: refunded ? "View Details" : "View Details",
      href: lobbyHref(id),
      variant: "details",
      disabled: false,
      reason: refunded ? "Cancelled / refunded" : "Cancelled",
    };
  }

  if (status === "completed") {
    return {
      label: "View Results",
      href: resultsHref(id),
      variant: "results",
      disabled: false,
    };
  }

  // Private GM path — reuse existing copy; always link to lobby (never join from list).
  if (
    privateAccess &&
    privateAccess !== "member" &&
    !isRegistered &&
    status !== "completed"
  ) {
    const copy = privateContestCardCopy(
      privateAccess as never,
      c.privateGameMasterName || c.gameMasterName,
    );
    if (copy.action) {
      const isInvite = copy.tone === "invite";
      const pendingTerms =
        /terms/i.test(copy.action) || /terms/i.test(copy.hint || "");
      return {
        label: copy.action.toUpperCase(),
        href: lobbyHref(id),
        variant: pendingTerms ? "terms" : isInvite ? "join_gm" : "disabled",
        disabled: copy.tone === "closed",
        reason: copy.hint,
      };
    }
  }

  if (isRegistered) {
    if (status === "active") {
      return {
        label: "Play Now",
        href: lobbyHref(id),
        variant: "play",
        disabled: false,
      };
    }
    // Reason: Image 1 state machine — seated but not live uses Already In asset.
    return {
      label: "Already In",
      href: lobbyHref(id),
      variant: "already_in",
      disabled: false,
    };
  }

  if (registrationClosed) {
    return {
      label: "Registration Closed",
      href: lobbyHref(id),
      variant: "disabled",
      disabled: true,
      reason: "Registration has closed",
    };
  }

  if (isFull) {
    return {
      label: "Competition Full",
      href: lobbyHref(id),
      variant: "disabled",
      disabled: true,
    };
  }

  if (!canAfford && entryFee > 0) {
    return {
      label: "Top Up to Join",
      href: "/wallet",
      variant: "disabled",
      disabled: false,
      reason: `Need ${Math.ceil(entryFee - userBalance)} more Volts`,
    };
  }

  if (status === "upcoming") {
    return {
      label: "Reserve Spot",
      href: lobbyHref(id),
      variant: "reserve",
      disabled: false,
    };
  }

  if (status === "active") {
    return {
      label: "Join Competition",
      href: lobbyHref(id),
      variant: "join",
      disabled: false,
    };
  }

  return {
    label: "View Details",
    href: lobbyHref(id),
    variant: "details",
    disabled: false,
  };
}
