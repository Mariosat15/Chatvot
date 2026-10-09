/**
 * Competition card artwork — same play-card family as Games / Dashboard / Suggested.
 *
 * Reason: Menuitems crop art was being used as generic landscape tiles. The overview
 * play-* cards keep logos readable; card heroes must share that set (with neon banners
 * as a wide fallback when a play card is missing).
 */

import type { CompetitionGameId } from "./game-definitions";

export interface CompetitionArtwork {
  src: string;
  alt: string;
  /** CSS object-position so game logos stay in frame */
  objectPosition: string;
}

const TRADING: CompetitionArtwork = {
  src: "/assets/neon/overview/play-trading.png",
  alt: "Trading competition card artwork",
  objectPosition: "center 45%",
};

const CIRCUIT_SPRINT: CompetitionArtwork = {
  src: "/assets/neon/overview/play-circuit-sprint.png",
  alt: "Circuit Sprint competition card artwork",
  objectPosition: "center",
};

const VOLT_STACK: CompetitionArtwork = {
  src: "/assets/neon/overview/play-volt-stack.png",
  alt: "Volt Stack competition card artwork",
  objectPosition: "center",
};

const VOLT_VELOCITY: CompetitionArtwork = {
  src: "/assets/neon/overview/play-volt-velocity.png",
  alt: "Volt Velocity competition card artwork",
  objectPosition: "center 55%",
};

const GENERIC: CompetitionArtwork = {
  src: "/assets/neon/overview/play-generic.webp",
  alt: "Competition artwork",
  objectPosition: "center",
};

// Reason: Map lookup — object indexing trips security/detect-object-injection.
const BY_GAME_ID = new Map<CompetitionGameId, CompetitionArtwork>([
  ["trading", TRADING],
  ["circuitSprint", CIRCUIT_SPRINT],
  ["voltStack", VOLT_STACK],
  ["voltVelocity", VOLT_VELOCITY],
  ["provider", GENERIC],
  ["all", GENERIC],
]);

const BY_GAME_CODE = new Map<string, CompetitionArtwork>([
  ["circuit-sprint", CIRCUIT_SPRINT],
  ["circuit-perfect", CIRCUIT_SPRINT],
  ["volt-stack", VOLT_STACK],
  ["volt-velocity", VOLT_VELOCITY],
  ["trading", TRADING],
]);

export function resolveCompetitionArtwork(input: {
  gameId: CompetitionGameId;
  gameCode?: string | null;
  bannerUrl?: string | null;
  gameName?: string | null;
}): CompetitionArtwork {
  const url = typeof input.bannerUrl === "string" ? input.bannerUrl.trim() : "";
  if (url) {
    return {
      src: url,
      alt: (input.gameName && input.gameName.trim()) || "Competition artwork",
      objectPosition: "center",
    };
  }
  const code = (input.gameCode || "").toLowerCase().trim();
  if (code) {
    const fromCode = BY_GAME_CODE.get(code);
    if (fromCode) return fromCode;
  }
  return BY_GAME_ID.get(input.gameId) ?? GENERIC;
}

/**
 * CTA artwork under /public.
 * Reason: only Join chrome was supplied as a reusable pill; other states reuse it with
 * tint overlays + label text, or fall back to CSS for results/details.
 */
export const COMPETITION_CTA_ASSET = {
  join: "/assets/neon/competitions/icons/btn-join-hires.png",
  joinCompact: "/assets/neon/competitions/icons/btn-join.png",
  joinSuggested: "/assets/neon/overview/suggested/btn-join-hr.png",
} as const;
