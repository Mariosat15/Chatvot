/**
 * One definition of "what difficulty is this competition" for the arena.
 *
 * Reason: the card label is computed in the browser and the difficulty filter on the server.
 * Two copies of the input mapping would let a card read "Expert" under a filter that
 * selected it as "Skilled". Model-free so client components can import it (R58).
 */

import {
  calculateCompetitionDifficulty,
  getAllDifficultyLevels,
  type DifficultyAnalysis,
  type DifficultyLevel,
} from "@/lib/utils/competition-difficulty";

export interface DifficultySource {
  entryFeeCredits?: unknown;
  entryFee?: unknown;
  startingCapital?: unknown;
  startingTradingPoints?: unknown;
  leverage?: { max?: number } | null;
  maxParticipants?: number;
  currentParticipants?: number;
  startTime?: unknown;
  endTime?: unknown;
  rules?: unknown;
  levelRequirement?: unknown;
}

/** Fields the server must read to answer the difficulty filter. */
export const DIFFICULTY_SOURCE_FIELDS =
  "entryFeeCredits entryFee startingCapital startingTradingPoints leverage maxParticipants currentParticipants startTime endTime rules levelRequirement";

const LEVELS = new Set<string>(getAllDifficultyLevels().map((l) => l.value));

export function isDifficultyLevel(value: unknown): value is DifficultyLevel {
  return typeof value === "string" && LEVELS.has(value);
}

export function difficultyForCompetition(
  c: DifficultySource,
  platformLeverage: number,
): DifficultyAnalysis {
  return calculateCompetitionDifficulty({
    entryFeeCredits: Number(c.entryFeeCredits ?? c.entryFee ?? 0) || 0,
    startingCapital:
      Number(c.startingCapital ?? c.startingTradingPoints ?? 10000) || 10000,
    leverageAllowed: c.leverage?.max || platformLeverage,
    maxParticipants: c.maxParticipants,
    participantCount: c.currentParticipants,
    durationHours:
      (new Date(c.endTime as string).getTime() -
        new Date(c.startTime as string).getTime()) /
      (1000 * 60 * 60),
    rules: c.rules as never,
    levelRequirement: c.levelRequirement as never,
  });
}
