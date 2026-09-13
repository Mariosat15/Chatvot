import { connectToDatabase } from "@/database/mongoose";
import ProviderGame from "@/database/models/games/provider-game.model";
// Reason: RELATIVE, not `@/lib/admin/...`, unlike its neighbours in this folder. `vitest.config.ts`
// aliases `@` to the REPOSITORY root, where `lib/admin/` does not exist - it is admin-only - so the
// alias form resolves in Next and fails in the test that imports this module for real. The
// neighbouring services get away with the alias only because their suites read their source as text
// rather than importing them.
import { SCORE_UNIT_MAX_LENGTH } from "../../admin/score-eligibility-copy";

/**
 * Set - or clear - our answer to "which scores are worth a prize on this title?".
 *
 * TASK DOCUMENT 14. The owner's rule of 9 September 2026 is that a score of zero wins
 * nothing, and it shipped as a hard-coded `> 0` inside `providerHasResult`. Task 14 then
 * asked for eligibility to be game-configurable "while setting the correct defaults for our
 * existing games", which is what this writes. The rule is unchanged; it is now a default.
 *
 * WHY IT IS NOT PART OF THE CONTENT EDITOR, which is the obvious place to put three more
 * fields. That dialog writes copy an operator can get wrong harmlessly - a typo in a tagline
 * is embarrassing and reversible. These two decide WHO GETS PAID out of a pot people have
 * bought into, so they follow `playModeOverride`'s precedent exactly: their own route, their
 * own section guard, their own audit line. `zeroIsValidResult` is in
 * `NEVER_EDITABLE_CONTENT_FIELDS` for the same reason `chartvoltEnabled` and
 * `playModeOverride` are - accepting it through the content door would let an operator change
 * a prize rule as a side effect of fixing a typo, with the audit trail recording a content
 * edit.
 *
 * WHY IT WRITES OUR OWN FIELDS AND NOT THE PROVIDER'S. `scoreDirection` and `scoreType` are
 * in `providerOwnedFields` in `catalogue.service.ts`, so a control writing there saves,
 * toasts, and is reverted by the next catalogue pull with no error and nothing in a log - the
 * "appears to work and does nothing" shape already on record four times over. The three
 * fields here are in no sync list at all, which is a property of that allow-list rather than
 * of anything written in this file, so it is asserted by a test that runs a real sync.
 *
 * ADMIN-ONLY AND NOT MIRRORED, matching `game-play-style.service.ts` and
 * `game-content.service.ts`. The player app RESOLVES these rules - through
 * `resolveScoringRules` - and must never write them. A second writer in the app with the
 * widest reach and no operator behind it is the door this deliberately does not build.
 */

export interface ScoringRulesInput {
  /** Does a score of exactly zero count as a result worth paying? */
  zeroIsValidResult: boolean;
  /** `null` clears the bar. A `0` is a real and different instruction - see below. */
  minimumEligibleScore: number | null;
  /** Display only. `null` or `""` clears it. */
  scoreUnit: string | null;
}

export type ScoringRulesResult =
  | {
      success: true;
      zeroIsValidResult: boolean;
      /** `undefined` once the bar is cleared. */
      minimumEligibleScore?: number;
      scoreUnit?: string;
    }
  | { success: false; error: string };

/**
 * Re-exported so server-side callers and the test keep one import path, while the DIALOG
 * imports it from `score-eligibility-copy` directly.
 *
 * Reason: a `"use client"` component importing any value from this module pulls
 * `@/database/mongoose` above into the browser bundle and the admin build fails on
 * unresolvable Node builtins. See that module for the full account.
 */
export { SCORE_UNIT_MAX_LENGTH };

/**
 * What the route may be handed.
 *
 * EVERY KEY MUST BE PRESENT, and that is not pedantry. `null` is the CLEAR case for the bar
 * and for the unit, because "there is no minimum after all" is a decision an operator has to
 * be able to take back. If an absent key meant the same thing, a malformed body arriving as
 * `{}` would silently clear both settings while reporting success - so absence is an error
 * and `null` is the instruction.
 *
 * A STORED `0` IS NOT THE SAME AS `null`, which is the trap this parser exists to keep open.
 * On a higher-is-better game a bar of zero ADMITS a zero score, which is a legitimate thing
 * to configure and the exact opposite of having no bar. Collapsing them - `value || null` -
 * would make the one setting an operator cannot express the one they are most likely to want
 * on a title where zero is a real result. This is the falsy-guard lesson from R31's
 * `referralFeePercentage || 5` in a new place.
 */
export function parseScoringRulesInput(
  body: unknown,
): { ok: true; input: ScoringRulesInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Expected an object of scoring rules." };
  }

  const raw = body as Record<string, unknown>;

  if (typeof raw.zeroIsValidResult !== "boolean") {
    return {
      ok: false,
      error: "Whether a score of zero counts must be true or false.",
    };
  }

  if (!("minimumEligibleScore" in raw)) {
    return {
      ok: false,
      error: "A minimum eligible score must be a number, or null for no minimum.",
    };
  }

  let minimumEligibleScore: number | null = null;
  if (raw.minimumEligibleScore !== null) {
    // Reason: `Number.isFinite` and not `typeof === "number"`. These values arrive from
    // `parseFloat` on an admin form, so `NaN` is one keystroke away - and a `NaN` bar stored
    // on a title makes every comparison in `providerHasResult` false, refusing EVERY
    // participant and routing the whole pot to the unclaimed pool with nothing in a log.
    // `resolveScoringRules` guards it on the way out too; both ends, because one of them
    // being enough is an argument that stops being true when somebody adds a third writer.
    if (!Number.isFinite(raw.minimumEligibleScore)) {
      return {
        ok: false,
        error: "A minimum eligible score must be a number, or null for no minimum.",
      };
    }
    minimumEligibleScore = raw.minimumEligibleScore as number;
  }

  if (!("scoreUnit" in raw)) {
    return { ok: false, error: "A score unit must be text, or null for none." };
  }

  let scoreUnit: string | null = null;
  if (raw.scoreUnit !== null) {
    if (typeof raw.scoreUnit !== "string") {
      return { ok: false, error: "A score unit must be text, or null for none." };
    }
    const trimmed = raw.scoreUnit.trim();
    if (trimmed.length > SCORE_UNIT_MAX_LENGTH) {
      return {
        ok: false,
        error: `A score unit must be ${SCORE_UNIT_MAX_LENGTH} characters or fewer.`,
      };
    }
    scoreUnit = trimmed === "" ? null : trimmed;
  }

  return {
    ok: true,
    input: { zeroIsValidResult: raw.zeroIsValidResult, minimumEligibleScore, scoreUnit },
  };
}

export async function setGameScoringRules(
  providerKey: string,
  gameCode: string,
  input: ScoringRulesInput,
): Promise<ScoringRulesResult> {
  await connectToDatabase();

  // Matched on the pair rather than on `gameKey`, matching `updateGameContent` and
  // `setGamePlayStyle`: it is the unique index the catalogue is keyed by, and a
  // caller-supplied `gameKey` would be a way to edit a DIFFERENT provider's title through
  // this provider's URL.
  const title = await ProviderGame.findOne({ providerKey, gameCode }).lean();
  if (!title) {
    return { success: false, error: "That game is not in this provider's catalogue." };
  }

  const set: Record<string, unknown> = { zeroIsValidResult: input.zeroIsValidResult };
  const unset: Record<string, string> = {};

  // Clearing is `$unset` and never a stored `null`, for the reason `setGamePlayStyle` gives:
  // `resolveScoringRules` asks whether we have taken a decision at all, and a stored `null`
  // satisfies "the key is there" while meaning nothing. It also survives the lean read as a
  // `null`, which `Number.isFinite` would then have to catch on every settlement - a guard
  // covering for a write that should not have happened.
  if (input.minimumEligibleScore === null) unset.minimumEligibleScore = "";
  else set.minimumEligibleScore = input.minimumEligibleScore;

  if (input.scoreUnit === null) unset.scoreUnit = "";
  else set.scoreUnit = input.scoreUnit;

  await ProviderGame.updateOne(
    { providerKey, gameCode },
    Object.keys(unset).length > 0 ? { $set: set, $unset: unset } : { $set: set },
  );

  return {
    success: true,
    zeroIsValidResult: input.zeroIsValidResult,
    minimumEligibleScore: input.minimumEligibleScore ?? undefined,
    scoreUnit: input.scoreUnit ?? undefined,
  };
}
