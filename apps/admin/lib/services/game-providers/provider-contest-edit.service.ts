import { connectToDatabase } from "@/database/mongoose";
import Competition from "@/database/models/trading/competition.model";
import ProviderGame from "@/database/models/games/provider-game.model";
import {
  parseConfigSchema,
  validateConfigValues,
} from "@/lib/services/games/config-schema";
import type {
  AttemptsPolicy,
  UnresolvedRoundPolicy,
  UnscoredContestPolicy,
} from "@/lib/services/games/round-types";
// RELATIVE, NOT `@/lib/admin/...`, AND DO NOT "TIDY" IT BACK. `@` resolves to `apps/admin`
// under the admin Next build but to the REPO ROOT under vitest, and the root has no
// `lib/admin/contest-game-label`. With the alias, importing this service into a test fails
// to resolve - which is why the alias works fine for `@/database/...` and `@/lib/services/...`
// (both exist at the root) and not for these two. A relative path resolves identically in
// both, and a behavioural test for the freeze rules is only possible because of it.
import { hasProviderGameLabel } from "../../admin/contest-game-label";
import {
  isClosedToEdits,
  isEditableOnceEntered,
} from "../../admin/provider-contest-edit-policy";
import { preflightProviderContest } from "./provider-contest.service";

/**
 * Editing a provider-game contest (X6, chapter 12 section 2's "edit form parity").
 *
 * THE INTERESTING PART IS NOT WHICH FIELDS ARE EDITABLE, IT IS WHEN. A contest with no
 * participants is a document; a contest somebody has paid to enter is a promise. So the gate
 * is `currentParticipants > 0`, not the status - and that distinction is load-bearing,
 * because the trading route's existing guard is `status === "active" && participants > 0`,
 * which leaves an UPCOMING contest with twenty paid entrants fully rewritable: entry fee,
 * prize split, start time, the lot.
 *
 * Once anyone has entered, only three things stay editable, and each for a stated reason:
 *
 *   - `name` and `description` are presentational. Fixing a typo must not require cancelling
 *     a contest and refunding everyone.
 *   - `maxParticipants` may only go UP. Raising a cap adds seats and harms nobody; lowering
 *     it below the number already seated would make `currentParticipants > maxParticipants`,
 *     which every "is registration open" check reads, and the contest would silently look
 *     full while the operator believed they had merely tidied a number.
 *
 * Everything else is frozen, with the field named in the refusal. The three that would do
 * real damage are worth spelling out: changing `settings` means two players ranked against
 * each other played different games; changing `entryFee` means two players paid different
 * amounts into one pot; changing the play window can strand a player mid-round.
 *
 * GAME IDENTITY IS NEVER EDITABLE, at any status, including draft with zero participants.
 * `gameKey` is the immutable join key for every historical stat, and `providerKey`/`gameCode`
 * decide which game this is at all - so "editing" them is creating a different contest,
 * which is what the create wizard is for. `contentSeed` is frozen for the same fairness
 * reason as `settings`.
 */

export interface EditProviderContestInput {
  name?: string;
  description?: string;
  /** Operator answers for the title's `configSchema`. Replaces the stored set wholesale. */
  settings?: Record<string, unknown>;
  entryFee?: number;
  minParticipants?: number;
  maxParticipants?: number;
  platformFeePercentage?: number;
  prizeDistribution?: { rank: number; percentage: number }[];
  startTime?: Date;
  endTime?: Date;
  playWindowStart?: Date;
  playWindowEnd?: Date;
  attemptsPolicy?: AttemptsPolicy;
  attemptsAllowed?: number;
  unresolvedRoundPolicy?: UnresolvedRoundPolicy;
  unscoredContestPolicy?: UnscoredContestPolicy;
  resultGracePeriodSeconds?: number;
  perRoundCostAcknowledged?: boolean;
}

export interface EditProviderContestResult {
  success: boolean;
  error?: string;
  /** Hard refusals from the pre-flight checklist. */
  errors?: string[];
  /** Advisory notes. Present on success too. */
  warnings?: string[];
}

// The freeze list and the closed statuses live in a model-free module so the editor form
// imports the same rule this service enforces. See that file for why a second copy is not an
// option. Note `maxParticipants` being in the list means "may be submitted", not "may be set
// to anything" - the direction check is below.

export async function editProviderContest(
  competitionId: string,
  input: EditProviderContestInput,
): Promise<EditProviderContestResult> {
  await connectToDatabase();

  const competition = await Competition.findById(competitionId);
  if (!competition) {
    return { success: false, error: "That contest no longer exists." };
  }

  // Label only, matching the list screen and the trading route's refusal. A keyless provider
  // contest is still a provider contest, and is exactly the one an operator needs to fix.
  if (!hasProviderGameLabel(competition)) {
    return {
      success: false,
      error: "That is not a provider-game contest. Edit it from the trading form.",
    };
  }

  if (isClosedToEdits(competition.status)) {
    return {
      success: false,
      error: `A ${competition.status.replace("_", " ")} contest cannot be edited.`,
    };
  }

  const submitted = Object.keys(input).filter(
    (key) => input[key as keyof EditProviderContestInput] !== undefined,
  );
  if (submitted.length === 0) {
    return { success: false, error: "The update contained no fields." };
  }

  const entered = (competition.currentParticipants ?? 0) > 0;

  if (entered) {
    const frozen = submitted.filter((key) => !isEditableOnceEntered(key));
    if (frozen.length > 0) {
      return {
        success: false,
        error: `${competition.currentParticipants} player(s) have already entered, so ${frozen
          .map((f) => `"${f}"`)
          .join(", ")} can no longer be changed. Cancel and refund the contest to change it.`,
      };
    }
    if (
      input.maxParticipants !== undefined &&
      input.maxParticipants < competition.currentParticipants
    ) {
      return {
        success: false,
        error: `The cap cannot go below the ${competition.currentParticipants} player(s) already entered.`,
      };
    }
  }

  const basicError = validateEdit(competition, input);
  if (basicError) return { success: false, error: basicError };

  // Settings are re-validated against the title's live schema, not the schema they were
  // created under. A provider can change a title's `configSchema` between sync runs, and an
  // edit is the moment to discover that the stored answers no longer fit it.
  let coercedSettings: Record<string, unknown> | undefined;
  const providerKey = competition.gameConfig?.providerKey;
  const gameCode = competition.gameConfig?.gameCode;

  if (input.settings !== undefined) {
    if (!providerKey || !gameCode) {
      return {
        success: false,
        error:
          "This contest has no provider or game recorded, so its settings cannot be validated. Recreate it.",
      };
    }

    const title = await ProviderGame.findOne({ providerKey, gameCode }).lean();
    if (!title) {
      return {
        success: false,
        error: "That game is no longer in the catalogue. Sync the provider first.",
      };
    }

    const parsed = parseConfigSchema(title.configSchema);
    if (!parsed.ok) {
      // Fail closed, same as create: settings nothing has checked must not be saved.
      return {
        success: false,
        error: `This game's settings schema is not supported: ${parsed.error}`,
      };
    }

    const validated = validateConfigValues(parsed.fields, input.settings);
    if (!validated.ok) {
      return {
        success: false,
        error: "Settings failed validation.",
        errors: validated.errors,
      };
    }
    // Take the COERCED values, as create does - this is what turns "10" into 10 and drops
    // any key the schema does not declare, so nothing undeclared reaches the provider.
    coercedSettings = validated.values;
  }

  // Re-run the whole checklist against the contest as it WILL be, not as it was created.
  // A draft can outlive the switches that made it valid, so an edit is a second chance to
  // catch a title that has been disabled or a provider whose adapter has gone.
  let warnings: string[] = [];
  if (providerKey && gameCode) {
    const preflight = await preflightProviderContest({
      providerKey,
      gameCode,
      settings: coercedSettings ?? competition.gameConfig?.settings ?? {},
      minParticipants: input.minParticipants ?? competition.minParticipants,
      playWindowStart:
        input.playWindowStart ?? competition.playWindowStart ?? competition.startTime,
      playWindowEnd:
        input.playWindowEnd ?? competition.playWindowEnd ?? competition.endTime,
      attemptsPolicy: (input.attemptsPolicy ??
        competition.attemptsPolicy) as AttemptsPolicy,
      attemptsAllowed: input.attemptsAllowed ?? competition.attemptsAllowed,
      unresolvedRoundPolicy: (input.unresolvedRoundPolicy ??
        competition.unresolvedRoundPolicy) as UnresolvedRoundPolicy,
      resultGracePeriodSeconds:
        input.resultGracePeriodSeconds ??
        competition.resultGracePeriodSeconds ??
        0,
      perRoundCostAcknowledged: input.perRoundCostAcknowledged,
    });

    if (!preflight.ok) {
      return {
        success: false,
        error: "This contest cannot be saved yet.",
        errors: preflight.errors,
        warnings: preflight.warnings,
      };
    }
    warnings = preflight.warnings;
  }

  try {
    applyEdit(competition, input, coercedSettings);
    await competition.save();
    return { success: true, warnings };
  } catch (error) {
    console.error("❌ Failed to edit provider contest:", error);
    return {
      success: false,
      error: "Something went wrong. Please contact support.",
    };
  }
}

interface StoredContest {
  startTime: Date;
  endTime: Date;
  playWindowStart?: Date;
  playWindowEnd?: Date;
  minParticipants: number;
  maxParticipants: number;
}

/**
 * The same shape checks create runs, but applied to the MERGED contest.
 *
 * Reason this cannot just re-use `validateBasics`: an edit may submit `endTime` alone, and
 * whether that is legal depends on the stored `startTime`. Validating the submitted subset
 * in isolation is how a contest ends up ending before it starts.
 */
function validateEdit(
  stored: StoredContest,
  input: EditProviderContestInput,
): string | null {
  if (input.name !== undefined && !input.name.trim()) {
    return "A name is required.";
  }
  if (input.description !== undefined && !input.description.trim()) {
    return "A description is required.";
  }
  if (input.entryFee !== undefined && !(input.entryFee >= 0)) {
    return "The entry fee cannot be negative.";
  }
  if (
    input.platformFeePercentage !== undefined &&
    (input.platformFeePercentage < 0 || input.platformFeePercentage > 100)
  ) {
    return "The platform fee must be between 0 and 100 percent.";
  }

  const minParticipants = input.minParticipants ?? stored.minParticipants;
  const maxParticipants = input.maxParticipants ?? stored.maxParticipants;
  if (maxParticipants < minParticipants) {
    return "The maximum number of participants cannot be below the minimum.";
  }
  // No paid format is ever single-player - a competition is two or more players.
  if (minParticipants < 2) {
    return "A competition needs at least 2 players.";
  }

  const startTime = input.startTime ?? stored.startTime;
  const endTime = input.endTime ?? stored.endTime;
  if (endTime.getTime() <= startTime.getTime()) {
    return "The contest must end after it starts.";
  }

  if (input.prizeDistribution !== undefined) {
    if (input.prizeDistribution.length === 0) {
      return "At least one prize rank is required.";
    }
    const total = input.prizeDistribution.reduce(
      (sum, p) => sum + p.percentage,
      0,
    );
    // The same 0.01 tolerance the trading and create paths use: a three-way even split
    // cannot total exactly 100 in decimal.
    if (Math.abs(total - 100) > 0.01) {
      return `The prize distribution must total 100 percent - it currently totals ${total}.`;
    }
  }

  const windowStart =
    input.playWindowStart ?? stored.playWindowStart ?? startTime;
  const windowEnd = input.playWindowEnd ?? stored.playWindowEnd ?? endTime;
  if (windowEnd.getTime() <= windowStart.getTime()) {
    return "The play window must end after it starts.";
  }
  if (windowStart.getTime() < startTime.getTime()) {
    return "The play window cannot start before the contest does.";
  }
  if (windowEnd.getTime() > endTime.getTime()) {
    return "The play window cannot end after the contest does.";
  }

  return null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Writes the submitted fields onto the document.
 *
 * `any` on the document because the Mongoose `Document` type here is the mirrored model's
 * and indexing it by a computed key does not narrow. Every key written below is a literal in
 * this file, never caller input, so there is no injection surface - which is the property
 * that matters rather than the type.
 */
function applyEdit(
  competition: any,
  input: EditProviderContestInput,
  coercedSettings: Record<string, unknown> | undefined,
): void {
  if (input.name !== undefined) competition.name = input.name.trim();
  if (input.description !== undefined) {
    competition.description = input.description.trim();
  }
  if (input.entryFee !== undefined) competition.entryFee = input.entryFee;
  if (input.minParticipants !== undefined) {
    competition.minParticipants = input.minParticipants;
  }
  if (input.maxParticipants !== undefined) {
    competition.maxParticipants = input.maxParticipants;
  }
  if (input.platformFeePercentage !== undefined) {
    competition.platformFeePercentage = input.platformFeePercentage;
  }
  if (input.prizeDistribution !== undefined) {
    competition.prizeDistribution = input.prizeDistribution;
  }
  if (input.startTime !== undefined) {
    competition.startTime = input.startTime;
    // Registration closes when the contest starts, which is how create writes it. Leaving
    // the old deadline behind would silently keep registration open past the start, or
    // closed before it.
    competition.registrationDeadline = new Date(input.startTime);
  }
  if (input.endTime !== undefined) competition.endTime = input.endTime;
  if (input.playWindowStart !== undefined) {
    competition.playWindowStart = input.playWindowStart;
  }
  if (input.playWindowEnd !== undefined) {
    competition.playWindowEnd = input.playWindowEnd;
  }
  if (input.attemptsPolicy !== undefined) {
    competition.attemptsPolicy = input.attemptsPolicy;
    // Mirrors create: an allowance is meaningless for a single-attempt contest, and leaving
    // a stale one behind would show "3 attempts" on a contest that grants one.
    competition.attemptsAllowed =
      input.attemptsPolicy === "single"
        ? undefined
        : (input.attemptsAllowed ?? competition.attemptsAllowed);
  } else if (input.attemptsAllowed !== undefined) {
    competition.attemptsAllowed = input.attemptsAllowed;
  }
  if (input.unresolvedRoundPolicy !== undefined) {
    competition.unresolvedRoundPolicy = input.unresolvedRoundPolicy;
  }
  if (input.unscoredContestPolicy !== undefined) {
    competition.unscoredContestPolicy = input.unscoredContestPolicy;
  }
  if (input.resultGracePeriodSeconds !== undefined) {
    competition.resultGracePeriodSeconds = input.resultGracePeriodSeconds;
  }

  if (coercedSettings !== undefined) {
    // Replace the settings object wholesale rather than merging. A merge would leave a key
    // the operator removed from the form still in force, and `validateConfigValues` has
    // already dropped anything the schema does not declare.
    competition.gameConfig = {
      providerKey: competition.gameConfig.providerKey,
      gameCode: competition.gameConfig.gameCode,
      settings: coercedSettings,
    };
    competition.markModified("gameConfig");
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
