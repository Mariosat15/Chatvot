import { NEON_ICON } from "@/lib/services/games/overview-assets";
import { contestHowItWorks } from "@/components/competitions/lobby/contest-lobby-copy";
import type { TradingOverviewCopy } from "@/components/competitions/lobby/trading-overview-copy";
import { formatRoundClock } from "./game-lobby-copy";

/**
 * Overview tab copy for a provider-game contest, same shape as
 * `buildTradingOverviewCopy` so `TradingOverview` / the shared tab strip can draw it.
 *
 * Pure data in/out (R39). No game codes — format, scoring and steps come from stored
 * contest / catalogue fields only.
 */

export type GameOverviewCopy = TradingOverviewCopy;

export function buildGameOverviewCopy(input: {
  playModeLabel: string;
  playModeDetail: string;
  scoreLabel: string;
  scoringNote: string;
  roundSeconds?: number | null;
  attemptsShort?: string | null;
  /** Operator-authored steps; falls back to the kind="game" defaults. */
  howItWorksSteps?: { title: string; detail: string }[] | null;
}): GameOverviewCopy {
  const roundLabel =
    typeof input.roundSeconds === "number" &&
    Number.isFinite(input.roundSeconds) &&
    input.roundSeconds > 0
      ? `Up to ${formatRoundClock(input.roundSeconds)}`
      : null;

  const formatFacts = [
    {
      icon: "clock" as const,
      strong: input.playModeLabel,
      tail: input.playModeDetail,
    },
  ];
  if (roundLabel) {
    formatFacts.push({
      icon: "clock" as const,
      lead: "Each round lasts",
      strong: roundLabel,
    });
  }
  if (input.attemptsShort) {
    formatFacts.push({
      icon: "player" as const,
      lead: "Attempts:",
      strong: input.attemptsShort,
    });
  }

  const winStrong =
    input.scoreLabel === "Time" ? "Fastest time" : "Highest score";

  const authored = (input.howItWorksSteps ?? []).filter(
    (s) => s.title.trim() && s.detail.trim(),
  );
  const steps =
    authored.length > 0
      ? authored.map((s) => ({ title: s.title, detail: s.detail }))
      : contestHowItWorks("game");

  return {
    features: [
      {
        iconSrc: NEON_ICON("swords"),
        title: "How you play",
        facts: formatFacts.slice(0, 2),
      },
      {
        iconSrc: NEON_ICON("target-purple"),
        title: "How you win",
        facts: [
          {
            icon: "trophy",
            strong: winStrong,
            tail: input.scoringNote,
          },
        ],
      },
    ],
    steps: steps.slice(0, 4),
  };
}
