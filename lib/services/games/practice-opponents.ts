/**
 * Computer opponents in a FREE practice round.
 *
 * The operator sets `provider_game.practiceAiPilots` on the title; the practice launcher reads
 * it through this one function and forwards it as `practiceOpponents`. It is never read on a
 * ranked round, and the provider refuses it there too, so a paid contest can never contain a
 * computer pilot.
 */
export const MAX_PRACTICE_OPPONENTS = 15;

/** The operator's count, or undefined when unset or not a whole number from 1 to 15. */
export function practiceOpponentsFor(title: { practiceAiPilots?: unknown }): number | undefined {
  const n = title.practiceAiPilots;
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= MAX_PRACTICE_OPPONENTS
    ? n
    : undefined;
}
