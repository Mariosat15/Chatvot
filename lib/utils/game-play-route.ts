/**
 * Whether a path is a screen where a game is being played: a contest round, a
 * challenge round or a free practice round.
 *
 * Reason (owner, 14 Oct 2026): "when in game the notes on top shouldn't be shown -
 * nothing should disturb the game view". The announcement banner and the dashboard
 * tab strip are withheld on exactly these paths, on desktop and on phones.
 */
const GAME_PLAY_PATTERNS: readonly RegExp[] = [
  /^\/competitions\/[^/]+\/play\/?$/,
  /^\/challenges\/[^/]+\/play\/?$/,
  /^\/games\/[^/]+\/practice\/?$/,
];

export function isGamePlayRoute(pathname: string | null | undefined): boolean {
  if (typeof pathname !== "string") return false;
  return GAME_PLAY_PATTERNS.some((pattern) => pattern.test(pathname));
}
