/**
 * Pure helpers for the player game page — safe for client components.
 */

import type { GamePageContest, GamePageData } from "./game-page.types";

export function getGameModes(game: Pick<GamePageData, "formats">): string[] {
  const modes: string[] = [];
  if (game.formats.competition) modes.push("Competition");
  if (game.formats.challenge) modes.push("1v1");
  if (game.formats.practice) modes.push("Practice");
  return modes;
}

export function formatRoundTimeLabel(
  typical?: number | null,
  max?: number | null,
): string | null {
  const toMin = (seconds: number) => Math.max(1, Math.round(seconds / 60));
  if (
    typeof typical === "number" &&
    Number.isFinite(typical) &&
    typical > 0 &&
    typeof max === "number" &&
    Number.isFinite(max) &&
    max > 0 &&
    max !== typical
  ) {
    return `${toMin(typical)}–${toMin(max)} min`;
  }
  const alone =
    typeof typical === "number" && Number.isFinite(typical) && typical > 0
      ? typical
      : typeof max === "number" && Number.isFinite(max) && max > 0
        ? max
        : null;
  if (alone === null) return null;
  return `~${toMin(alone)} min`;
}

/**
 * Where Play Now should send the player.
 *
 * Prefer a live contest, then an upcoming one, then practice, then challenge create.
 * Returns null when nothing is available — the UI shows a proper empty message.
 */
export function resolvePlayNowHref(
  game: Pick<GamePageData, "slug" | "formats">,
  contests: GamePageContest[],
): string | null {
  const active = contests.find((c) => c.status === "active");
  if (active) return `/competitions/${active.id}`;

  const upcoming = contests.find((c) => c.status === "upcoming");
  if (upcoming) return `/competitions/${upcoming.id}`;

  if (game.formats.practice) return practiceHref(game.slug);

  if (game.formats.challenge) {
    return `/challenges?create=1&game=${encodeURIComponent(game.slug)}`;
  }

  return null;
}

export function competitionBrowseHref(slug: string): string {
  return `/competitions?game=${encodeURIComponent(slug)}`;
}

/**
 * The practice area. Every game page links here, whether or not the title declares practice:
 * the practice page says why a game cannot be practised rather than the button vanishing.
 */
export function practiceHref(slug: string): string {
  return `/games/${encodeURIComponent(slug)}/practice`;
}

export function challengeCreateHref(slug: string): string {
  return `/challenges?create=1&game=${encodeURIComponent(slug)}`;
}
