/**
 * Game Master competition defaults - the list of options (owner, 1 October 2026).
 *
 * Every option a Game Master can set when creating a competition, for trading and for games.
 * For each one the admin chooses a DEFAULT and whether the Game Master may CHANGE it. When the
 * switch is off the Game Master does not see the option and the server writes the admin's
 * value whatever the request says; when it is on, the Game Master's value is validated against
 * the same bounds an admin's is. Either way a Game Master can only ever create a competition
 * whose every option is one the platform considers correct.
 *
 * MODEL-FREE BY REQUIREMENT (R58): the admin screen and the Game Master forms are client
 * components and import this list directly. The database read lives in
 * `competition-defaults.service.ts`; the validation lives in `competition-defaults-apply.ts`.
 *
 * NOT HERE, deliberately:
 * - the platform fee, already admin-only (`platform-fee.ts`), never part of a GM request;
 * - start and end times, which are the Game Master's to choose - a default date is wrong the
 *   day after it is set;
 * - the latest moment an attempt may start, which the play shape decides per contest.
 *
 * The PLAY STYLE is here (owner, 2 Oct 2026) but only as a preference: the admin decides per
 * title which styles a game supports, and this default only chooses between them for a game
 * set to "Both". A game supporting one style ignores it and uses its own - the create service
 * falls back rather than refusing, because the Game Master never picked the value. The play
 * shape still forces the attempts policy at write time, so a locked attempts default never
 * overrides a synchronised race's single attempt.
 *
 * `path` is where the value sits in the create request body. It comes from this list and never
 * from a request, so walking it cannot be steered by a caller.
 */
import { GAME_TIE_RULES, GAME_TIE_RULE_COPY } from "@/lib/services/games/game-tie-rule";
import { PLAY_MODES, PLAY_MODE_COPY } from "@/lib/services/games/play-shape";
import {
  ATTEMPTS_POLICIES,
  UNRESOLVED_ROUND_POLICIES,
  UNSCORED_CONTEST_POLICIES,
  UNSCORED_CONTEST_POLICY_COPY,
} from "@/lib/services/games/round-types";

export type DefaultsGame = "trading" | "provider";

export interface DefaultsChoice {
  value: string;
  label: string;
}

export interface PrizeShare {
  rank: number;
  percentage: number;
}

interface OptionBase {
  key: string;
  label: string;
  description: string;
  /** Which kinds of competition the option belongs to. */
  games: readonly DefaultsGame[];
  /** The section it is listed under on the admin screen. */
  group: "General" | "Prizes" | "Ranking" | "Trading" | "Risk" | "Entry" | "Games";
  path: readonly string[];
}

export type CompetitionDefaultOption = OptionBase &
  (
    | {
        kind: "number";
        min: number;
        max: number;
        integer: boolean;
        defaultValue: number;
      }
    | { kind: "boolean"; defaultValue: boolean }
    | {
        kind: "choice";
        choices: readonly DefaultsChoice[];
        defaultValue: string;
      }
    | {
        kind: "multi";
        choices: readonly DefaultsChoice[];
        defaultValue: readonly string[];
      }
    | { kind: "prizes"; defaultValue: readonly PrizeShare[] }
  );

const BOTH: readonly DefaultsGame[] = ["trading", "provider"];
const TRADING: readonly DefaultsGame[] = ["trading"];
const GAMES: readonly DefaultsGame[] = ["provider"];

function choicesFromCopy<T extends string>(
  values: readonly T[],
  copy: ReadonlyMap<T, { label: string }>,
): DefaultsChoice[] {
  return values.map((value) => ({
    value,
    label: copy.get(value)?.label ?? value,
  }));
}

const RANKING_CHOICES: readonly DefaultsChoice[] = [
  { value: "pnl", label: "Profit and loss" },
  { value: "roi", label: "Return on investment" },
  { value: "total_capital", label: "Final account value" },
  { value: "win_rate", label: "Win rate" },
  { value: "total_wins", label: "Number of winning trades" },
  { value: "profit_factor", label: "Profit factor" },
];

const TRADING_TIE_BREAKERS: readonly DefaultsChoice[] = [
  { value: "trades_count", label: "Fewer trades wins" },
  { value: "win_rate", label: "Higher win rate wins" },
  { value: "total_capital", label: "Higher account value wins" },
  { value: "roi", label: "Higher return wins" },
  { value: "join_time", label: "Earlier sign-up wins" },
  { value: "split_prize", label: "They share the prize" },
];

const TRADING_TIE_PRIZE: readonly DefaultsChoice[] = [
  { value: "split_equally", label: "Split equally" },
  { value: "split_weighted", label: "Split by account value" },
  { value: "first_gets_all", label: "First in the order takes it all" },
];

const ATTEMPT_CHOICES: readonly DefaultsChoice[] = ATTEMPTS_POLICIES.map(
  (value) => ({
    value,
    label:
      value === "single"
        ? "One attempt"
        : value === "best_of_n"
          ? "Best of several attempts"
          : "Total of several attempts",
  }),
);

const UNRESOLVED_CHOICES: readonly DefaultsChoice[] =
  UNRESOLVED_ROUND_POLICIES.map((value) => ({
    value,
    label:
      value === "score_zero"
        ? "Score it zero and settle on time"
        : value === "exclude"
          ? "Remove the player and refund their entry fee"
          : "Hold settlement and alert an admin",
  }));

export const COMPETITION_DEFAULT_OPTIONS: readonly CompetitionDefaultOption[] = [
  // ---- General, every competition ----
  {
    key: "entryFee",
    label: "Entry fee",
    // Reason the floor is 1, not 0: the trading create route has always refused a zero fee
    // ("Missing required fields"), so a default of 0 would lock every Game Master out of
    // trading with a message that names nothing.
    description: "Credits each player pays to enter.",
    games: BOTH,
    group: "General",
    path: ["entryFee"],
    kind: "number",
    min: 1,
    max: 100000,
    integer: false,
    defaultValue: 10,
  },
  {
    key: "minParticipants",
    label: "Minimum players",
    description:
      "Below this the competition is cancelled and every entry fee refunded. Never fewer than 2.",
    games: BOTH,
    group: "General",
    path: ["minParticipants"],
    kind: "number",
    min: 2,
    max: 10000,
    integer: true,
    defaultValue: 2,
  },
  {
    key: "maxParticipants",
    label: "Maximum players",
    description:
      "The most players who can enter. The Game Master's package cap still applies on top.",
    games: BOTH,
    group: "General",
    path: ["maxParticipants"],
    kind: "number",
    min: 2,
    max: 10000,
    integer: true,
    defaultValue: 50,
  },
  {
    key: "prizeDistribution",
    label: "Prize split",
    description: "How the prize pool is shared between the top places. Must total 100%.",
    games: BOTH,
    group: "Prizes",
    path: ["prizeDistribution"],
    kind: "prizes",
    defaultValue: [
      { rank: 1, percentage: 70 },
      { rank: 2, percentage: 20 },
      { rank: 3, percentage: 10 },
    ],
  },
  // ---- Trading ----
  {
    key: "startingCapital",
    label: "Starting balance",
    description: "The practice money each trader starts with.",
    games: TRADING,
    group: "Trading",
    path: ["startingCapital"],
    kind: "number",
    min: 100,
    max: 10000000,
    integer: false,
    defaultValue: 10000,
  },
  {
    key: "leverage",
    label: "Leverage",
    description: "The leverage traders may use. Trading risk settings still cap it.",
    games: TRADING,
    group: "Trading",
    path: ["leverage"],
    kind: "number",
    min: 1,
    max: 500,
    integer: true,
    defaultValue: 30,
  },
  {
    key: "assetClasses",
    label: "Markets",
    description: "Which markets traders may trade. At least one.",
    games: TRADING,
    group: "Trading",
    path: ["assetClasses"],
    kind: "multi",
    choices: [
      { value: "forex", label: "Forex" },
      { value: "crypto", label: "Crypto" },
      { value: "stocks", label: "Stocks" },
    ],
    defaultValue: ["forex"],
  },
  {
    key: "rankingMethod",
    label: "How traders are ranked",
    description: "The figure that decides the leaderboard.",
    games: TRADING,
    group: "Ranking",
    path: ["rules", "rankingMethod"],
    kind: "choice",
    choices: RANKING_CHOICES,
    defaultValue: "pnl",
  },
  {
    key: "tieBreaker1",
    label: "If two traders are level",
    description: "What decides the order when the ranking figure is equal.",
    games: TRADING,
    group: "Ranking",
    path: ["rules", "tieBreaker1"],
    kind: "choice",
    choices: TRADING_TIE_BREAKERS,
    defaultValue: "trades_count",
  },
  {
    key: "tiePrizeDistribution",
    label: "Sharing a tied prize",
    description: "How tied traders divide the places they occupy.",
    games: TRADING,
    group: "Ranking",
    path: ["rules", "tiePrizeDistribution"],
    kind: "choice",
    choices: TRADING_TIE_PRIZE,
    defaultValue: "split_equally",
  },
  {
    key: "minimumTrades",
    label: "Minimum trades to qualify",
    description: "Traders with fewer closed trades cannot win a prize.",
    games: TRADING,
    group: "Ranking",
    path: ["rules", "minimumTrades"],
    kind: "number",
    min: 0,
    max: 1000,
    integer: true,
    defaultValue: 1,
  },
  {
    key: "disqualifyOnLiquidation",
    label: "Disqualify a liquidated account",
    description: "A trader whose account is wiped out cannot win a prize.",
    games: TRADING,
    group: "Ranking",
    path: ["rules", "disqualifyOnLiquidation"],
    kind: "boolean",
    defaultValue: true,
  },
  {
    key: "riskLimitsEnabled",
    label: "Risk limits",
    description: "Stop a trader who loses too much.",
    games: TRADING,
    group: "Risk",
    path: ["riskLimits", "enabled"],
    kind: "boolean",
    defaultValue: false,
  },
  {
    key: "maxDrawdownPercent",
    label: "Largest total loss (%)",
    description: "Used when risk limits are on.",
    games: TRADING,
    group: "Risk",
    path: ["riskLimits", "maxDrawdownPercent"],
    kind: "number",
    min: 1,
    max: 100,
    integer: true,
    defaultValue: 50,
  },
  {
    key: "dailyLossLimitPercent",
    label: "Largest daily loss (%)",
    description: "Used when risk limits are on.",
    games: TRADING,
    group: "Risk",
    path: ["riskLimits", "dailyLossLimitPercent"],
    kind: "number",
    min: 1,
    max: 100,
    integer: true,
    defaultValue: 20,
  },
  {
    key: "levelRequirementEnabled",
    label: "Level requirement",
    description: "Only players at or above a level may enter.",
    games: TRADING,
    group: "Entry",
    path: ["levelRequirement", "enabled"],
    kind: "boolean",
    defaultValue: false,
  },
  {
    key: "minLevel",
    label: "Lowest level allowed",
    description: "Used when the level requirement is on.",
    games: TRADING,
    group: "Entry",
    path: ["levelRequirement", "minLevel"],
    kind: "number",
    min: 1,
    max: 100,
    integer: true,
    defaultValue: 1,
  },
  {
    key: "difficultyMode",
    label: "Difficulty",
    description: "Worked out automatically, or set by hand.",
    games: TRADING,
    group: "Entry",
    path: ["difficulty", "mode"],
    kind: "choice",
    choices: [
      { value: "auto", label: "Automatic" },
      { value: "manual", label: "Set by hand" },
    ],
    defaultValue: "auto",
  },
  {
    key: "difficultyLevel",
    label: "Difficulty level",
    description: "Used when difficulty is set by hand.",
    games: TRADING,
    group: "Entry",
    path: ["difficulty", "manualLevel"],
    kind: "choice",
    choices: [
      { value: "beginner", label: "Beginner" },
      { value: "intermediate", label: "Intermediate" },
      { value: "advanced", label: "Advanced" },
      { value: "expert", label: "Expert" },
      { value: "extreme", label: "Extreme" },
    ],
    defaultValue: "intermediate",
  },
  // ---- Games ----
  {
    key: "playMode",
    label: "Play style",
    description:
      "Used only for a game set to Both. A game set to one style always uses that style.",
    games: GAMES,
    group: "Games",
    path: ["playMode"],
    kind: "choice",
    choices: choicesFromCopy(PLAY_MODES, PLAY_MODE_COPY),
    defaultValue: "anytime",
  },
  {
    key: "tieRule",
    label: "If two players have the same score",
    description: "The faster player wins, or they share the prize.",
    games: GAMES,
    group: "Games",
    path: ["tieRule"],
    kind: "choice",
    choices: choicesFromCopy(GAME_TIE_RULES, GAME_TIE_RULE_COPY),
    defaultValue: "fastest_wins",
  },
  {
    key: "unscoredContestPolicy",
    label: "If nobody scores",
    description: "Where the pot goes when no player records a score.",
    games: GAMES,
    group: "Games",
    path: ["unscoredContestPolicy"],
    kind: "choice",
    choices: choicesFromCopy(
      UNSCORED_CONTEST_POLICIES,
      UNSCORED_CONTEST_POLICY_COPY,
    ),
    defaultValue: "unclaimed_pool",
  },
  {
    key: "attemptsPolicy",
    label: "Attempts",
    description:
      "How many tries a player gets. A title that runs everybody at once always allows one.",
    games: GAMES,
    group: "Games",
    path: ["attemptsPolicy"],
    kind: "choice",
    choices: ATTEMPT_CHOICES,
    defaultValue: "single",
  },
  {
    key: "attemptsAllowed",
    label: "Number of attempts",
    description: "Used when more than one attempt is allowed.",
    games: GAMES,
    group: "Games",
    path: ["attemptsAllowed"],
    kind: "number",
    min: 2,
    max: 20,
    integer: true,
    defaultValue: 3,
  },
  {
    key: "unresolvedRoundPolicy",
    label: "If a game never reports a result",
    description: "What happens to an attempt the game provider never finishes.",
    games: GAMES,
    group: "Games",
    path: ["unresolvedRoundPolicy"],
    kind: "choice",
    choices: UNRESOLVED_CHOICES,
    defaultValue: "score_zero",
  },
];

const OPTIONS_BY_KEY: ReadonlyMap<string, CompetitionDefaultOption> = new Map(
  COMPETITION_DEFAULT_OPTIONS.map((option) => [option.key, option]),
);

/** A `Map` lookup, because the key arrives from a stored document or a request. */
export function findCompetitionDefaultOption(
  key: unknown,
): CompetitionDefaultOption | undefined {
  return typeof key === "string" ? OPTIONS_BY_KEY.get(key) : undefined;
}

export function optionsForGame(
  game: DefaultsGame,
): CompetitionDefaultOption[] {
  return COMPETITION_DEFAULT_OPTIONS.filter((option) =>
    option.games.includes(game),
  );
}

/** One option as the admin has configured it. */
export interface ResolvedCompetitionDefault {
  key: string;
  value: unknown;
  gmMayChange: boolean;
}
