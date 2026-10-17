/**
 * First-run checklist steps for the player dashboard (chapter 20 section 5).
 *
 * Pure and model-free so the client card and the tests share one definition.
 * Trading-only steps must not appear when trading is switched off — otherwise a
 * games-only platform leaves new players with an impossible checklist item.
 *
 * X8 pass 5: contest/challenge/player nouns come from the terminology pack.
 * Defaults keep today's wording when the caller passes nothing (tests).
 */

import { TERMS, type TerminologyPack } from "@/lib/constants/terminology";

export interface GettingStartedFacts {
  tradingEnabled: boolean;
  hasFundedWallet: boolean;
  hasJoinedCompetition: boolean;
  hasPlacedTrade: boolean;
  hasPlayedGame: boolean;
  hasCompletedMilestone: boolean;
  hasChallengedUser: boolean;
}

export interface GettingStartedStepDef {
  id: string;
  title: string;
  description: string;
  href: string;
  completed: boolean;
}

/**
 * Has the player done the "first play" step — a trade OR a scored/started game round.
 * Either counts; requiring trades alone strands games-only players.
 */
export function hasCompletedFirstPlay(facts: {
  hasPlacedTrade: boolean;
  hasPlayedGame: boolean;
}): boolean {
  return facts.hasPlacedTrade || facts.hasPlayedGame;
}

/**
 * Build the ordered checklist. The play step is game-aware; when trading is off
 * it never mentions trades or positions.
 */
export function buildGettingStartedSteps(
  facts: GettingStartedFacts,
  terms: TerminologyPack = TERMS,
): GettingStartedStepDef[] {
  const playCompleted = hasCompletedFirstPlay(facts);

  const playStep: GettingStartedStepDef = facts.tradingEnabled
    ? {
        id: "play",
        title: `Play Your First ${terms.contest}`,
        description: `Open a position or finish a ${terms.game} ${terms.round}`,
        href: "/competitions",
        completed: playCompleted,
      }
    : {
        id: "play",
        title: `Play Your First ${terms.contest}`,
        description: `Finish a ${terms.round} in a ${terms.contest}`,
        href: "/competitions",
        completed: playCompleted,
      };

  return [
    {
      id: "fund",
      title: "Fund Your Account",
      description: `Add credits to enter ${terms.contests}`,
      href: "/wallet",
      completed: facts.hasFundedWallet,
    },
    {
      id: "competition",
      title: `Join a ${terms.contest}`,
      description: `Compete with other ${terms.players}`,
      href: "/competitions",
      completed: facts.hasJoinedCompetition,
    },
    playStep,
    {
      id: "milestone",
      title: "Complete a Milestone",
      description: "Progress on your journey",
      href: "/profile?tab=journey",
      completed: facts.hasCompletedMilestone,
    },
    {
      id: "challenge",
      title: `${terms.challenge} a ${terms.player}`,
      description: `Go head-to-head in a 1v1 ${terms.challenge}`,
      href: "/challenges",
      completed: facts.hasChallengedUser,
    },
  ];
}
