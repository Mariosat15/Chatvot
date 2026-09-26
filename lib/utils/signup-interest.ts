/**
 * Registration-time platform interest (open question 16 / chapter `20` s1.2).
 *
 * Informational only — stored on the user document for later product use
 * (catalogue defaults, onboarding copy). It does NOT gate matchmaking,
 * challenges, or entry. Inference and per-game declarations remain separate
 * (X14: paying / declaring interest is not consent to invitations).
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
    label: "Trading",
    hint: "Competitions on the markets",
  },
  {
    value: "games",
    label: "Games",
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
