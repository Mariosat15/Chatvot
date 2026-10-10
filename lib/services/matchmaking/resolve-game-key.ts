/**
 * Resolve which game a matchmaking request is about.
 * Absent / blank → trading (backward compatible with MatchmakingCards).
 *
 * Reason: lives outside matchmaking.service.ts because that file is `"use server"`
 * and Next.js forbids sync exports from server-action modules.
 */
export function resolveMatchmakingGameKey(
  gameKey: string | null | undefined,
): string {
  const trimmed = typeof gameKey === "string" ? gameKey.trim() : "";
  return trimmed || "trading";
}
