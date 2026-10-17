import { badRequest } from "../http/errors";
import type { TitleDefinition } from "../games/titles";

/**
 * What kind of contest a round belongs to - optional on `POST /v1/rounds` since requirements
 * HTML 1.22.
 *
 * Needed because two contests can look identical on the wire otherwise: a challenge and an
 * "each plays alone" competition both arrive with no `scheduledStartAt`, and Volt Velocity must
 * seat the first pair in one shared room and every player of the second in a room of their own.
 *
 * Absent means "not stated" and keeps the behaviour every round had before 1.22, so a platform
 * that never sends it sees nothing change.
 */
export type ContestType = "competition" | "challenge" | "practice";

const CONTEST_TYPES: ReadonlySet<string> = new Set(["competition", "challenge", "practice"]);

export function parseContestType(value: unknown): ContestType | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string" || !CONTEST_TYPES.has(value)) {
    throw badRequest("'contestType' must be 'competition', 'challenge' or 'practice' when present.");
  }
  return value as ContestType;
}

/**
 * On a challenge, every setting the title declares a `challengeValue` for takes that value,
 * whatever the request carried.
 *
 * The platform already stores the pinned value (`applyChallengeValues` there), so on a
 * well-behaved platform this changes nothing. It is here because the rule is the game's: a
 * challenge that raced a different lap count from every other challenge would be a different
 * game, and a caller should not be able to choose that by sending a number.
 */
export function pinChallengeSettings(
  title: TitleDefinition,
  contestType: ContestType | undefined,
  requested: Record<string, unknown>,
): Record<string, unknown> {
  if (contestType !== "challenge") return requested;
  const properties = title.configSchema.properties;
  if (!properties || typeof properties !== "object") return requested;

  const fixed = Object.entries(properties as Record<string, unknown>).flatMap(([name, field]) =>
    field && typeof field === "object" && "challengeValue" in field
      ? [[name, (field as { challengeValue: unknown }).challengeValue] as const]
      : [],
  );
  return { ...requested, ...Object.fromEntries(fixed) };
}
