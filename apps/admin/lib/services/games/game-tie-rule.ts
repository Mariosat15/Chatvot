/**
 * What happens when two players of a GAME contest finish on the same score.
 *
 * Owner's decision, 1 October 2026. A game contest offers exactly two answers, and an
 * operator or Game Master picks one by name rather than by editing raw ranking rules:
 *
 *   - `fastest_wins` (default): the shorter round wins, then the earlier finish. This is
 *     what every game contest already did - by accident of the schema defaults plus
 *     settlement's placeholder `tieBreaker2` - so the default changes nothing that ran.
 *   - `share_prize`: the tied players are not separated and share the prizes of every
 *     position they occupy (`mergeTiedRankShares` in `lib/utils/prize-shares.ts`).
 *
 * Trading's other tie options are deliberately NOT reachable for a game. `split_weighted`
 * divides by `currentCapital`, which a game participant does not have, and
 * `first_gets_all` decides by sign-up time - the first person to register wins money,
 * which no skill argument defends. The create services accept a `GameTieRule` and write
 * the stored rules from it, so neither can be stored on a game contest at all.
 *
 * Model-free on purpose: the admin wizard and the Game Master form are `"use client"`
 * and import the labels from here (R58). Mirrored into `apps/admin`, held by a
 * byte-for-byte test, since `check:mirrors` compares models only.
 */

export const GAME_TIE_RULES = ["fastest_wins", "share_prize"] as const;
export type GameTieRule = (typeof GAME_TIE_RULES)[number];

export const DEFAULT_GAME_TIE_RULE: GameTieRule = "fastest_wins";

const GAME_TIE_RULE_SET: ReadonlySet<string> = new Set(GAME_TIE_RULES);

export function isGameTieRule(value: unknown): value is GameTieRule {
  return typeof value === "string" && GAME_TIE_RULE_SET.has(value);
}

/** Labels shown to an operator or Game Master. A `Map`, because the key can come from a stored document. */
export const GAME_TIE_RULE_COPY: ReadonlyMap<
  GameTieRule,
  { label: string; description: string }
> = new Map([
  [
    "fastest_wins",
    {
      label: "Faster player wins",
      description:
        "The player whose round took less time is placed higher. If that is equal too, whoever finished first.",
    },
  ],
  [
    "share_prize",
    {
      label: "They share the prize",
      description:
        "Tied players are placed together and share the prizes of every position they occupy - two tied for first share first and second place.",
    },
  ],
]);

/** The three stored rule fields a tie rule decides. */
export interface GameTieRuleFields {
  tieBreaker1: "fastest_time" | "split_prize";
  tieBreaker2: "completed_at" | "split_prize";
  tiePrizeDistribution: "split_equally";
}

export function gameTieRuleToRules(rule: GameTieRule): GameTieRuleFields {
  if (rule === "share_prize") {
    return {
      tieBreaker1: "split_prize",
      tieBreaker2: "split_prize",
      tiePrizeDistribution: "split_equally",
    };
  }
  return {
    tieBreaker1: "fastest_time",
    tieBreaker2: "completed_at",
    tiePrizeDistribution: "split_equally",
  };
}

/**
 * Read the tie rule back off a stored contest. Anything that is not explicitly the
 * share-the-prize shape reads as `fastest_wins`, because that is what settlement does
 * with it: the provider scorer maps every other breaker name onto duration and finish time.
 */
export function resolveGameTieRule(
  rules: { tieBreaker1?: string | null } | null | undefined,
): GameTieRule {
  return rules?.tieBreaker1 === "split_prize" ? "share_prize" : DEFAULT_GAME_TIE_RULE;
}
