/**
 * First-run checklist steps for the player dashboard (chapter 20 section 5).
 *
 * Pure and model-free so the client card and the tests share one definition.
 * Trading-only steps must not appear when trading is switched off — otherwise a
 * games-only platform leaves new players with an impossible checklist item.
 */

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
): GettingStartedStepDef[] {
  const playCompleted = hasCompletedFirstPlay(facts);

  const playStep: GettingStartedStepDef = facts.tradingEnabled
    ? {
        id: "play",
        title: "Play Your First Contest",
        description: "Open a position or finish a game round",
        href: "/competitions",
        completed: playCompleted,
      }
    : {
        id: "play",
        title: "Play Your First Contest",
        description: "Finish a round in a competition",
        href: "/competitions",
        completed: playCompleted,
      };

  return [
    {
      id: "fund",
      title: "Fund Your Account",
      description: "Add credits to enter contests",
      href: "/wallet",
      completed: facts.hasFundedWallet,
    },
    {
      id: "competition",
      title: "Join a Competition",
      description: "Compete with other players",
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
      title: "Challenge a Player",
      description: "Go head-to-head in a 1v1 battle",
      href: "/challenges",
      completed: facts.hasChallengedUser,
    },
  ];
}
