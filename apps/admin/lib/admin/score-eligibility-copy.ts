/**
 * What an operator is told the prize-eligibility rules will DO, in plain words.
 *
 * MODEL-FREE BY REQUIREMENT, not by preference, and the requirement is doubled here. The
 * dialog is `"use client"`, so a module reaching a Mongoose model cannot be imported by it -
 * the same constraint behind `game-content-fields.ts`, `contest-control-copy.ts` and
 * `components/games/play-state.ts`. And the real gate, `providerHasResult`, lives in
 * `lib/games/provider/`, which ESLint invariant 1 blocks from being imported outside the game
 * layer's public surface, so the dialog cannot call it either.
 *
 * THAT MAKES THIS A SECOND STATEMENT OF ONE RULE, which is the shape behind `referenceId`,
 * `failedReason`, `challengeId` and the Game Master `||`. It is accepted here for the reason
 * those were not - it is prose, not arithmetic, and nothing downstream reads it - but the
 * drift it could cause is exactly the dangerous kind: a screen telling an operator "a score
 * of 0 wins nothing" while settlement pays it. So it is pinned BEHAVIOURALLY. A test walks a
 * grid of scores through the real `providerHasResult` and asserts every sentence produced
 * here agrees with what the gate actually did. A structural test that this file merely
 * imports something would be satisfied by a copy that imports and then decides for itself.
 *
 * NOT MIRRORED. `apps/admin/lib/admin/` is admin-only.
 */

/**
 * How long a score unit may be, defined HERE rather than beside the parser that enforces it.
 *
 * IT LIVES IN THIS FILE BECAUSE OF WHO NEEDS IT, not because it is copy. The dialog sets
 * `maxLength` from it and `parseScoringRulesInput` refuses on it, so the input and the
 * validator must agree - but the parser's module opens with `@/database/mongoose` and the
 * `ProviderGame` model, and the dialog is `"use client"`. Importing the value from there
 * pulls the MongoDB driver into the browser bundle, where `fs`, `net`, `tls`, `dns` and
 * `child_process` cannot resolve, and **the admin app fails to build** - which is exactly
 * what it did on 9 September 2026 until this constant moved.
 *
 * SO THE SHARED VALUE MOVES TO THE MODEL-FREE MODULE AND THE SERVICE IMPORTS IT, rather than
 * each side keeping its own 16. A second copy is the "one rule, two copies" shape behind
 * `referenceId`, `failedReason`, `challengeId` and the Game Master `||`, and the drift here
 * would be the quiet kind: raise the parser's limit alone and the box silently truncates
 * before the operator reaches it; raise the box's alone and a full-length unit is refused by
 * a server error naming a length the form just permitted.
 *
 * The general rule this is an instance of: **a `"use client"` file may only import a value
 * from a module that reaches no model.** A `import type` is erased and therefore always
 * safe - `round-types.ts` does exactly that with `mongoose` - so it is the VALUE imports
 * that have to be checked, and the check is the module's transitive imports, not its name.
 */
export const SCORE_UNIT_MAX_LENGTH = 16;

export interface EligibilityCopyInput {
  zeroIsValidResult: boolean;
  /** `undefined` means no bar. A `0` is a real and different instruction. */
  minimumEligibleScore?: number;
  scoreDirection: "higher_is_better" | "lower_is_better";
  /** Display only, appended to numbers when present. */
  scoreUnit?: string;
}

/**
 * One sentence per rule in force, in the order a player would hit them.
 *
 * A LIST RATHER THAN A PARAGRAPH, because the two rules are independent and an operator
 * changing one needs to see which line moved. Joining them into a sentence also invites the
 * reading that the bar replaces the zero rule, and it does not: on a higher-is-better game
 * with the bar at 0, zero is still refused unless the switch says otherwise.
 */
export function describeScoreEligibility(input: EligibilityCopyInput): string[] {
  const unit = input.scoreUnit ? ` ${input.scoreUnit}` : "";
  const lines: string[] = [];

  lines.push(
    input.zeroIsValidResult
      ? "A score of exactly 0 COUNTS as a result and can win a prize."
      : "A score of exactly 0 wins nothing — it is treated as no result at all.",
  );

  if (input.minimumEligibleScore !== undefined) {
    // Reason: the wording changes with the direction, not just the comparison. Telling an
    // operator of a stopwatch game that a score "must reach 60000" is worse than saying
    // nothing: it reads as a floor, so they set the bar the wrong way round and refuse every
    // player who actually finished. This is the same asymmetry the gate itself carries.
    lines.push(
      input.scoreDirection === "lower_is_better"
        ? `A score above ${input.minimumEligibleScore}${unit} wins nothing — lower is better here, so the bar is a ceiling.`
        : `A score below ${input.minimumEligibleScore}${unit} wins nothing.`,
    );
  } else {
    lines.push("Any other score can win a prize, however low.");
  }

  // Reason: said explicitly rather than left implied. An operator reading two rules about
  // scores can reasonably conclude this screen decides everything about who is paid, and it
  // does not - the contest's own `minParticipants`, its tie rules and the liquidation switch
  // are elsewhere, and a player excluded here is still RANKED, just not paid.
  lines.push(
    "A player refused here keeps their place on the leaderboard; their prize is shared out among the players who did score.",
  );

  return lines;
}
