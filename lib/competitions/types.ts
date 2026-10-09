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
  | "already_in"
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
  /** CSS object-position for the hero so game logos stay visible */
  artworkObjectPosition: string;
  gameAccent: string;
  /** Game badge icon (top-right of the card) */
  gameIcon: string;
  theme: GameDefinition["theme"];
  creatorName: string;
  creatorType: "admin" | "gm" | "unknown";
  status: CompetitionStatusKey;
  statusLabel: string;
  countdownLabel?: string;
  /** Live clock target: upcoming counts to the start, live counts to the end */
  countdown?: { kind: "starts" | "ends"; target: string };
  tags: CompetitionTag[];
  primaryMetrics: CompetitionMetric[];
  secondaryMetrics: CompetitionMetric[];
  prizePool: number;
  entryFee: number;
  visibility: "public" | "private";
  gmFunded: boolean;
  /** "Free to enter - X pays every seat…" — present only when `gmFunded`. */
  gmFundedNote?: string;
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
  /** `gm_private` = only players affiliated to the Game Master */
  visibility?: string;
  /** `gm_funded` = the Game Master pays every seat */
  fundingMode?: string;
  gameMasterId?: string;
  privateAccess?: string;
  privateGameMasterName?: string;
  createdByType?: string;
  createdByName?: string;
  gameMasterName?: string;
  gameSettings?: Record<string, unknown>;
  attemptsPolicy?: string;
  attemptsAllowed?: number;
  playMode?: string;
  refunded?: boolean;
  cancellationReason?: string;
  /** Catalogue / operator banner when browse enrichment attached it */
  bannerUrl?: string | null;
}
