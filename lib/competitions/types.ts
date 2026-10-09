import type { GameDefinition, MetricKey } from "./game-definitions";

export type CompetitionStatusKey =
  | "live"
  | "starting_soon"
  | "open"
  | "private_gm"
  | "gm_funded"
  | "completed"
  | "cancelled"
  | "refunded"
  | "full"
  | "in_progress";

export type CtaVariant =
  | "join"
  | "reserve"
  | "join_gm"
  | "play"
  | "results"
  | "details"
  | "disabled"
  | "terms";

export interface CompetitionMetric {
  key: MetricKey;
  icon: string;
  label: string;
  value: string;
  subvalue?: string;
  emphasize?: boolean;
}

export interface CompetitionTag {
  label: string;
  tone: "neutral" | "game" | "creator" | "skill" | "private" | "funded";
}

export interface CompetitionCta {
  label: string;
  href: string;
  variant: CtaVariant;
  disabled: boolean;
  reason?: string;
}

export interface CompetitionPresentation {
  id: string;
  title: string;
  description: string;
  gameId: string;
  gameName: string;
  gameArtwork: string;
  gameAccent: string;
  theme: GameDefinition["theme"];
  creatorName: string;
  creatorType: "admin" | "gm" | "unknown";
  status: CompetitionStatusKey;
  statusLabel: string;
  countdownLabel?: string;
  tags: CompetitionTag[];
  primaryMetrics: CompetitionMetric[];
  secondaryMetrics: CompetitionMetric[];
  prizePool: number;
  entryFee: number;
  visibility: "public" | "private";
  gmFunded: boolean;
  cta: CompetitionCta;
}

/** Raw list row — loose so provider + trading fields coexist. */
export interface CompetitionListItem {
  _id: string;
  name: string;
  description?: string;
  status: "upcoming" | "active" | "completed" | "cancelled" | string;
  entryFee?: number;
  entryFeeCredits?: number;
  prizePool?: number;
  prizePoolCredits?: number;
  startingCapital?: number;
  startingTradingPoints?: number;
  currentParticipants?: number;
  maxParticipants?: number;
  minParticipants?: number;
  startTime: string;
  endTime: string;
  assetClasses?: string[];
  leverageAllowed?: number;
  leverage?: {
    enabled?: boolean;
    min?: number;
    max?: number;
    default?: number;
  };
  rules?: {
    rankingMethod?: string;
    minimumTrades?: number;
  };
  levelRequirement?: {
    enabled?: boolean;
    minLevel?: number;
    maxLevel?: number;
  };
  gameType?: string;
  gameKey?: string;
  gameCode?: string;
  providerKey?: string;
  isPrivate?: boolean;
  privateAccess?: string;
  privateGameMasterName?: string;
  createdByType?: string;
  createdByName?: string;
  gameMasterName?: string;
  gameSettings?: Record<string, unknown>;
  attemptsPolicy?: string;
  playMode?: string;
  refunded?: boolean;
  cancellationReason?: string;
}
