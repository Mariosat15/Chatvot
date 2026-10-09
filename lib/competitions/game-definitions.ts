/**
 * Game-agnostic catalogue metadata for the competitions browser.
 *
 * Reason: cards and filters must not hardcode Trading. A new title is added here —
 * accent, artwork, which metrics render — without rewriting the card component.
 * Metric keys are only shown when the competition actually carries a value.
 */

export type CompetitionGameId =
  | "trading"
  | "circuitSprint"
  | "voltVelocity"
  | "voltStack"
  | "provider"
  | "all";

export type MetricKey =
  | "prizePool"
  | "players"
  | "duration"
  | "assets"
  | "entryFee"
  | "leverage"
  | "difficulty"
  | "startingCapital"
  | "track"
  | "boardSize"
  | "mode"
  | "rounds"
  | "laps"
  | "scoreTarget";

export interface GameTheme {
  primary: string;
  secondary: string;
  glow: string;
}

export interface GameDefinition {
  id: CompetitionGameId;
  label: string;
  arenaTitle: string;
  subtitle: string;
  accent: string;
  theme: GameTheme;
  /** Card hero art under /public */
  artwork: string;
  /** Arena header icon */
  icon: string;
  primaryMetrics: MetricKey[];
  secondaryMetrics: MetricKey[];
  /** Filter keys relevant to this game (assets only for trading, etc.) */
  filters: Array<"assets" | "difficulty" | "mode" | "track">;
}

const ICON_BASE = "/assets/neon/competitions/icons";

export const gameDefinitions: Record<CompetitionGameId, GameDefinition> = {
  trading: {
    id: "trading",
    label: "Trading",
    arenaTitle: "TRADING ARENA",
    subtitle: "Compete with traders worldwide • Win massive prizes",
    accent: "#00D8FF",
    theme: {
      primary: "#00D8FF",
      secondary: "#10B981",
      glow: "rgba(0,216,255,.35)",
    },
    artwork: `${ICON_BASE}/art-trading.png`,
    icon: `${ICON_BASE}/icon-chart.png`,
    primaryMetrics: ["prizePool", "players", "duration", "assets"],
    secondaryMetrics: ["entryFee", "leverage", "difficulty", "startingCapital"],
    filters: ["assets", "difficulty"],
  },
  circuitSprint: {
    id: "circuitSprint",
    label: "Circuit Sprint",
    arenaTitle: "CIRCUIT SPRINT ARENA",
    subtitle: "Beat the clock • Solve fast • Climb the leaderboard",
    accent: "#FFB020",
    theme: {
      primary: "#FFB020",
      secondary: "#FF6B00",
      glow: "rgba(255,176,32,.35)",
    },
    artwork: `${ICON_BASE}/art-circuit-sprint.png`,
    icon: `${ICON_BASE}/icon-games.png`,
    primaryMetrics: ["prizePool", "players", "duration", "track"],
    secondaryMetrics: ["entryFee", "mode", "difficulty", "rounds"],
    filters: ["difficulty", "mode", "track"],
  },
  voltVelocity: {
    id: "voltVelocity",
    label: "Volt Velocity",
    arenaTitle: "VOLT VELOCITY ARENA",
    subtitle: "Race real players • Chase the fastest time • Win Volts",
    accent: "#159DFF",
    theme: {
      primary: "#159DFF",
      secondary: "#7C3AED",
      glow: "rgba(21,157,255,.35)",
    },
    artwork: `${ICON_BASE}/art-volt-velocity.png`,
    icon: `${ICON_BASE}/icon-bolt.png`,
    primaryMetrics: ["prizePool", "players", "duration", "track"],
    secondaryMetrics: ["entryFee", "laps", "mode", "difficulty"],
    filters: ["difficulty", "mode", "track"],
  },
  voltStack: {
    id: "voltStack",
    label: "Volt Stack",
    arenaTitle: "VOLT STACK ARENA",
    subtitle: "Stack higher • Chase scores • Win Volts",
    accent: "#D94CFF",
    theme: {
      primary: "#D94CFF",
      secondary: "#A855F7",
      glow: "rgba(217,76,255,.35)",
    },
    artwork: `${ICON_BASE}/art-volt-stack.png`,
    icon: `${ICON_BASE}/icon-prize.png`,
    primaryMetrics: ["prizePool", "players", "duration", "boardSize"],
    secondaryMetrics: ["entryFee", "rounds", "difficulty", "scoreTarget"],
    filters: ["difficulty", "mode"],
  },
  provider: {
    id: "provider",
    label: "Games",
    arenaTitle: "COMPETITION ARENA",
    subtitle: "Play skill games • Climb the board • Win Volts",
    accent: "#00D8FF",
    theme: {
      primary: "#00D8FF",
      secondary: "#D94CFF",
      glow: "rgba(0,216,255,.3)",
    },
    artwork: `${ICON_BASE}/art-circuit-sprint.png`,
    icon: `${ICON_BASE}/icon-games.png`,
    primaryMetrics: ["prizePool", "players", "duration", "mode"],
    secondaryMetrics: ["entryFee", "difficulty", "rounds"],
    filters: ["difficulty"],
  },
  all: {
    id: "all",
    label: "All Games",
    arenaTitle: "COMPETITION ARENA",
    subtitle: "Browse every contest • Pick your game • Win Volts",
    accent: "#00D8FF",
    theme: {
      primary: "#00D8FF",
      secondary: "#FFB020",
      glow: "rgba(0,216,255,.3)",
    },
    artwork: `${ICON_BASE}/art-trading.png`,
    icon: `${ICON_BASE}/icon-trophy-gold.png`,
    primaryMetrics: ["prizePool", "players", "duration"],
    secondaryMetrics: ["entryFee", "difficulty"],
    filters: ["difficulty"],
  },
};

// Reason: Map lookup — object indexing trips security/detect-object-injection.
const GAME_DEFINITION_BY_ID = new Map<string, GameDefinition>(
  Object.entries(gameDefinitions),
);

/** Safe lookup for a selected filter game id (never indexes the record directly). */
export function getGameDefinition(id: string | null | undefined): GameDefinition {
  if (!id || id === "all") return gameDefinitions.all;
  return GAME_DEFINITION_BY_ID.get(id) ?? gameDefinitions.all;
}

/** Resolve a definition from contest fields without enumerating titles in the card. */
export function resolveGameDefinition(input: {
  gameType?: string | null;
  gameKey?: string | null;
  gameCode?: string | null;
  name?: string | null;
}): GameDefinition {
  const key = (input.gameKey || "").toLowerCase();
  const code = (input.gameCode || "").toLowerCase();
  const name = (input.name || "").toLowerCase();
  const hay = `${key} ${code} ${name}`;

  if (hay.includes("circuit") || hay.includes("sprint") || hay.includes("perfect")) {
    return gameDefinitions.circuitSprint;
  }
  if (hay.includes("velocity") || hay.includes("volt-velocity")) {
    return gameDefinitions.voltVelocity;
  }
  if (hay.includes("stack") || hay.includes("volt-stack")) {
    return gameDefinitions.voltStack;
  }
  if (input.gameType === "provider" || key.startsWith("provider:")) {
    return gameDefinitions.provider;
  }
  // Reason: invariant 5 — absent label is trading.
  return gameDefinitions.trading;
}

export const COMPETITIONS_ARENA_BG =
  "/assets/neon/competitions/arena-bg.jpg";

export const COMPETITION_ICON = {
  live: `${ICON_BASE}/icon-live-pulse.png`,
  soon: `${ICON_BASE}/icon-calendar-gold.png`,
  prize: `${ICON_BASE}/icon-prize.png`,
  clock: `${ICON_BASE}/icon-clock.png`,
  players: `${ICON_BASE}/icon-players.png`,
  volts: `${ICON_BASE}/icon-volts.png`,
  wallet: `${ICON_BASE}/icon-wallet.png`,
  topup: `${ICON_BASE}/icon-topup.png`,
  bolt: `${ICON_BASE}/icon-bolt.png`,
  trophyGold: `${ICON_BASE}/icon-trophy-gold.png`,
} as const;
