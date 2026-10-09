/**
 * Competition card artwork — same play-card family as Games / Dashboard / Suggested.
 *
 * Reason: cards must auto-pick the real game image by gameId / gameCode the same way
 * the Games catalogue resolves banners — never a generic landscape crop.
 */

import type { CompetitionGameId } from "./game-definitions";
import type { CtaVariant } from "./types";

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
  // Reason: catalogue / operator upload wins — same preference as Games catalogue.
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

const CTA_BASE = "/assets/neon/competitions/cta";

/**
 * Owner-supplied CTA / ribbon PNGs (Menuitems). Text state uses its own asset —
 * do not tint one Join pill to fake the others.
 */
export const COMPETITION_CTA_ASSET = {
  // Reason: `-r2` — a replacement written over the old filename is served from a
  // returning visitor's cache for hours (R54).
  join: `${CTA_BASE}/btn-join-competition-r2.png`,
  reserve: `${CTA_BASE}/btn-reserve-spot-r2.png`,
  join_gm: `${CTA_BASE}/btn-join-gm-r2.png`,
  results: `${CTA_BASE}/btn-view-results-r2.png`,
  already_in: `${CTA_BASE}/btn-already-in.png`,
} as const;

/** Owner-supplied corner ribbon; rendered only for a cancelled competition. */
export const COMPETITION_CANCELLED_RIBBON_ASSET =
  `${CTA_BASE}/ribbon-cancelled-refunded-r2.png`;

// Reason: Map — request-supplied / variant keys must not walk Object.prototype.
const CTA_BY_VARIANT = new Map<CtaVariant, string>([
  ["join", COMPETITION_CTA_ASSET.join],
  ["reserve", COMPETITION_CTA_ASSET.reserve],
  ["join_gm", COMPETITION_CTA_ASSET.join_gm],
  ["terms", COMPETITION_CTA_ASSET.join_gm],
  ["results", COMPETITION_CTA_ASSET.results],
  ["already_in", COMPETITION_CTA_ASSET.already_in],
  // Play uses Join chrome — no separate Play asset was supplied.
  ["play", COMPETITION_CTA_ASSET.join],
  // Cancelled / details use View Results chrome (muted by the component).
  ["details", COMPETITION_CTA_ASSET.results],
]);

export function resolveCtaAsset(variant: CtaVariant): string | null {
  return CTA_BY_VARIANT.get(variant) ?? null;
}
