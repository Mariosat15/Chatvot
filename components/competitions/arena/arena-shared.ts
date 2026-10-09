import {
  gameDefinitions,
  getGameDefinition,
  resolveGameDefinition,
  type GameDefinition,
} from "@/lib/competitions/game-definitions";
import { buildCompetitionPresentation } from "@/lib/competitions/build-competition-presentation";
import type {
  CompetitionListItem,
  CompetitionPresentation,
} from "@/lib/competitions/types";
import type { TitleLevel } from "@/lib/constants/levels";
import { isRegistrationClosed } from "@/lib/utils/registration-deadline";
import { difficultyForCompetition } from "@/lib/competitions/competition-difficulty-input";
import type { ToolbarFilterOption } from "./CompetitionToolbar";

/**
 * Filter vocabularies and card data shared by the desktop arena and the phone
 * arena, so the two layouts cannot offer different filters or describe one
 * competition differently.
 */

export const ARENA_STATUS_OPTIONS: ToolbarFilterOption[] = [
  { value: "active,upcoming", label: "All Open" },
  { value: "active", label: "Live" },
  { value: "upcoming", label: "Starting Soon" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "active,upcoming,completed,cancelled", label: "All" },
];

export const ARENA_GAME_OPTIONS: ToolbarFilterOption[] = [
  { value: "all", label: "All Games" },
  { value: "trading", label: "Trading" },
  { value: "circuitSprint", label: "Circuit Sprint" },
  { value: "voltVelocity", label: "Volt Velocity" },
  { value: "voltStack", label: "Volt Stack" },
  { value: "provider", label: "Other Games" },
];

export const ARENA_DIFFICULTY_OPTIONS: ToolbarFilterOption[] = [
  { value: "", label: "All" },
  { value: "Novice", label: "Novice" },
  { value: "Apprentice", label: "Apprentice" },
  { value: "Skilled", label: "Skilled" },
  { value: "Expert", label: "Expert" },
  { value: "Elite", label: "Elite" },
  { value: "Master", label: "Master" },
];

export const ARENA_SORT_OPTIONS: ToolbarFilterOption[] = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "start", label: "Starting Soon" },
  { value: "prize", label: "Prize Pool" },
  { value: "participants", label: "Players" },
  { value: "entry", label: "Entry Fee" },
];

/** Which game's title and subtitle the arena header shows. */
export function resolveArenaHeaderGame(
  selectedGameId: string,
  competitions: CompetitionListItem[],
): GameDefinition {
  if (selectedGameId && selectedGameId !== "all") {
    return getGameDefinition(selectedGameId);
  }
  return competitions.length === 1
    ? resolveGameDefinition(competitions[0])
    : gameDefinitions.all;
}

/**
 * Reason: the difficulty filter runs on the server across every matching
 * competition (browse-competitions.ts), so the page arrives already filtered.
 */
export function buildArenaPresentations(
  competitions: CompetitionListItem[],
  opts: {
    userInCompetitions: Set<string>;
    userBalance: number;
    creditSymbol?: string;
    levelLadder: TitleLevel[];
    platformLeverage: number;
  },
): CompetitionPresentation[] {
  return competitions.map((c) => {
    const difficulty = difficultyForCompetition(c, opts.platformLeverage);
    return buildCompetitionPresentation(c, {
      isRegistered: opts.userInCompetitions.has(String(c._id)),
      userBalance: opts.userBalance,
      registrationClosed: isRegistrationClosed({
        registrationDeadline: (c as { registrationDeadline?: string })
          .registrationDeadline,
        startTime: c.startTime,
        gameType: c.gameType,
        playWindowEnd: (c as { playWindowEnd?: string }).playWindowEnd,
      }),
      creditSymbol: opts.creditSymbol,
      levelLadder: opts.levelLadder,
      difficultyLabel: difficulty.label,
    });
  });
}
