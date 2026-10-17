/**
 * Registration-time platform interest (open question 16 / chapter `20` s1.2).
 *
 * Since 5 Oct 2026 the answer is MANDATORY and also sets the account's player
 * type (`user.role`: trader / gamer / both) - see `lib/utils/player-type.ts`.
 * It still does NOT gate matchmaking, challenges, or entry: a gamer may enter a
 * trading contest and becomes "both" when they do. Inference and per-game
 * declarations remain separate (X14: declaring interest is not consent to
 * invitations).
 */

export const SIGNUP_INTEREST_VALUES = ["trading", "games", "both"] as const;

export type SignupInterest = (typeof SIGNUP_INTEREST_VALUES)[number];

export const SIGNUP_INTEREST_OPTIONS: ReadonlyArray<{
  value: SignupInterest;
  label: string;
  hint: string;
}> = [
  {
    value: "trading",
    label: "Trader",
    hint: "Trading competitions on the markets",
  },
  {
    value: "games",
    label: "Gamer",
    hint: "Skill games and puzzles",
  },
  {
    value: "both",
    label: "Both",
    hint: "Trading and games",
  },
];

/** Accept only the three known answers; anything else is treated as missing. */
export function parseSignupInterest(
  value: unknown,
): SignupInterest | undefined {
  if (typeof value !== "string") return undefined;
  return (SIGNUP_INTEREST_VALUES as readonly string[]).includes(value)
    ? (value as SignupInterest)
    : undefined;
}
