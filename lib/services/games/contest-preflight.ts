import type { ConfigField } from "./config-schema";
import { resolveAttemptSeconds, validateConfigValues } from "./config-schema";
import type {
  AttemptsPolicy,
  RoundStartPolicy,
  UnresolvedRoundPolicy,
} from "./round-types";

/**
 * Pre-flight validation for a provider contest ("External game plans/03" section 4.1).
 *
 * These are the checks that stop the operator mistakes which are cheap to make and
 * expensive to discover, because every one of them fails LATE - at play time, with real
 * players and real entry fees already taken. A contest whose play window is shorter than a
 * single round cannot be completed by anybody; a contest on a deprecated title launches
 * rounds the provider refuses. Neither shows a problem at creation time without this.
 *
 * PURE, AND TAKES ITS FACTS AS ARGUMENTS. No database, no settings read. Reason: the whole
 * value here is being able to test every refusal cheaply, and a checklist that needs a
 * seeded provider, title and settings document to exercise one boolean gets tested once and
 * then trusted. The caller does the reads.
 *
 * WARNINGS ARE NOT FAILURES. Two items on the checklist - a per-round billing
 * acknowledgement and a recent sandbox round - are things an operator may legitimately
 * proceed without. Conflating them with the hard refusals would either block a legitimate
 * contest or, far more likely, get the whole check bypassed.
 */

export interface PreflightInput {
  format: "competition" | "challenge";
  minParticipants: number;

  /** From the `provider_game` row. */
  title: {
    displayName: string;
    providerStatus: "active" | "deprecated" | "maintenance";
    supportsCompetition: boolean;
    supportsOneVsOne: boolean;
    /**
     * Whether the provider guarantees identical content from one seed - `01` s4.3.
     *
     * Reason: this is required rather than optional even though it is the newest field here.
     * It was declared, validated on ingest, stored, transported and rendered as a badge for
     * six days while being read by nothing, and three separate comments asserted it gated
     * paid entry. An optional field would let a caller omit it and fail open again.
     */
    supportsContentSeed: boolean;
    maxDurationSeconds?: number;
  };

  /** From the `game_provider` row and platform settings. */
  provider: {
    enabled: boolean;
    adapterInstalled: boolean;
  };
  chartvoltEnabled: boolean;
  externalGamesEnabled: boolean;

  /** The parsed settings schema and the operator's answers. */
  schemaFields: ConfigField[];
  settings: Record<string, unknown>;

  playWindowStart: Date;
  playWindowEnd: Date;
  resultGracePeriodSeconds: number;
  attemptsPolicy: AttemptsPolicy;
  attemptsAllowed?: number;
  unresolvedRoundPolicy: UnresolvedRoundPolicy;
  /**
   * How late a player may start a round. Absent means `reserve_full_round`, matching the
   * schema, so a contest saved before the field existed is checked against the rule it was
   * created under.
   */
  roundStartPolicy?: RoundStartPolicy;

  /**
   * Operator ticked "I accept the per-round cost".
   *
   * Consulted for any multi-attempt policy, NOT only for providers known to bill per
   * round - because nothing records whether a provider does. `provider_game` has no
   * billing field, and inventing one here would be a guess dressed as a fact. Warning
   * whenever the policy multiplies rounds is the honest version: it is occasionally
   * unnecessary, where the alternative is occasionally an unexpected invoice.
   */
  perRoundCostAcknowledged?: boolean;
  /** When a sandbox round last succeeded for this title and configuration. */
  lastSandboxRoundAt?: Date | null;

  now?: Date;
}

export interface PreflightResult {
  ok: boolean;
  /** Hard refusals. The contest must not be created. */
  errors: string[];
  /** Things an operator should see and may proceed past. */
  warnings: string[];
}

const SANDBOX_FRESHNESS_HOURS = 24;

/**
 * How much longer than the attempt itself a contest must keep accepting results.
 *
 * EXPORTED BECAUSE THE WIZARD DERIVES THE VALUE THIS CHECK THEN DEMANDS. The grace period is
 * not an operator field - nobody has a basis for choosing it - so the wizard computes it from
 * the playing time. Two copies of this margin is the one-rule-two-copies shape, and it fails
 * in a way an operator cannot act on: the wizard would derive a number the pre-flight then
 * refuses, on a field no screen offers, so the contest simply cannot be saved and the message
 * names a setting that is not there.
 */
export const RESULT_GRACE_MARGIN_SECONDS = 5 * 60;

/**
 * A duration an operator can read without doing arithmetic.
 *
 * Reason this exists rather than interpolating the raw number: these refusals are about two
 * clocks not fitting inside each other, and "3600 seconds is longer than 1800 seconds" makes
 * the reader do the conversion that the message exists to save them. The owner's report of
 * this area being confusing was about exactly that kind of sentence.
 *
 * It deliberately keeps seconds for anything under a minute and for a value that is not a
 * whole number of minutes, because rounding "90 seconds" to "1 minute" in a message about
 * whether something FITS would be wrong in the one direction that matters.
 */
function describeSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`;
  if (seconds % 3600 === 0) {
    const hours = seconds / 3600;
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  if (seconds % 60 === 0) {
    const minutes = seconds / 60;
    return minutes === 1 ? "1 minute" : `${minutes} minutes`;
  }
  return `${seconds} seconds`;
}

export function runPreflight(input: PreflightInput): PreflightResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const now = input.now ?? new Date();

  // --- the game must be one we can actually reach -------------------------------------

  if (!input.provider.adapterInstalled) {
    errors.push(
      "No code connector is installed for this provider, so rounds cannot be launched.",
    );
  }
  if (!input.provider.enabled) {
    errors.push("This provider is disabled. Enable it before creating a contest on it.");
  }
  if (!input.chartvoltEnabled) {
    errors.push(
      `"${input.title.displayName}" is not enabled on ChartVolt. Turn it on in the provider's game list first.`,
    );
  }
  if (input.title.providerStatus !== "active") {
    // Reason: launching against a deprecated or maintenance title produces provider
    // refusals at play time, which reach the player as a broken game rather than as an
    // operator mistake.
    errors.push(
      `The provider reports "${input.title.displayName}" as ${input.title.providerStatus}, not active.`,
    );
  }

  // The master switch is a WARNING, not an error, and the distinction is deliberate:
  // scheduling a contest while the feature is off is legitimate - it is how you prepare a
  // launch. Refusing would force an operator to switch external games on platform-wide
  // just to draft a contest, which is exactly the wrong pressure to create.
  if (!input.externalGamesEnabled) {
    warnings.push(
      "External games are switched off platform-wide, so this contest cannot run until that master switch is on.",
    );
  }

  // --- format ---------------------------------------------------------------------------

  if (input.format === "competition" && !input.title.supportsCompetition) {
    errors.push(`"${input.title.displayName}" does not support competitions.`);
  }
  if (input.format === "challenge" && !input.title.supportsOneVsOne) {
    errors.push(`"${input.title.displayName}" does not support one-against-one challenges.`);
  }

  // Reason: `01` s4.3 - every player in one contest must face identical content, or they are
  // ranked against each other having faced challenges of unknown relative difficulty. That is
  // also what preserves the skill-not-chance position the regulatory defence pack rests on:
  // if content difficulty varies per player, the outcome stops being decided purely by skill.
  //
  // Deliberately not scoped to `competition`, although that is the word `01` s4.3 and the
  // model comment both use. A challenge ranks two players against each other for money on
  // exactly the same basis, so the reasoning does not narrow to the many-player case. Today
  // the challenge half is a tripwire - provider challenges are E8 and unbuilt - which is why
  // it is written as one unconditional check rather than a branch per format. Both formats
  // this function accepts are paid; practice never reaches it.
  if (!input.title.supportsContentSeed) {
    errors.push(
      `"${input.title.displayName}" does not guarantee identical content for every player, ` +
        `so scores could not be compared fairly. The provider must declare ` +
        `supportsContentSeed before this title can take entry fees.`,
    );
  }

  // No paid format is ever single-player. A competition is two or more; a challenge is
  // exactly two. This is a hard platform rule, not a per-game setting.
  if (input.format === "competition" && input.minParticipants < 2) {
    errors.push("A competition needs at least 2 participants.");
  }
  if (input.format === "challenge" && input.minParticipants !== 2) {
    errors.push("A challenge is exactly 2 participants.");
  }

  // --- settings -------------------------------------------------------------------------

  const settingsCheck = validateConfigValues(input.schemaFields, input.settings);
  for (const error of settingsCheck.errors) errors.push(error);

  // --- timing ---------------------------------------------------------------------------

  const windowSeconds =
    (input.playWindowEnd.getTime() - input.playWindowStart.getTime()) / 1000;

  if (!(windowSeconds > 0)) {
    errors.push("The play window must end after it starts.");
  }
  if (input.playWindowEnd.getTime() <= now.getTime()) {
    errors.push("The play window has already closed.");
  }

  /*
    THIS IS THE LENGTH THIS CONTEST'S ATTEMPTS ACTUALLY RUN FOR, and every message below says
    so in the operator's own numbers.

    IT USED TO BE THE CATALOGUE CEILING, and a long comment here defended that as failing
    closed - "do not fix the gate to read the configured value instead". Two things retired
    that argument on 8 September 2026 and the reasoning is worth keeping, because the old
    version reads perfectly sensibly.

    The first is that the ceiling was never a fact about this contest. Circuit Sprint reserved
    300 seconds whatever the operator configured, so a four-minute contest refused every
    attempt from the instant it opened while a countdown beside it said minutes remained. That
    was the owner's report, and no rewording fixes an arithmetic error.

    The second is that the ceiling only worked as a proxy while it was CLOSE to the configured
    length. Sprint's clock now runs to an hour, so a ten-minute contest would have had an hour
    reserved against it - and, worse, `requiredGrace` below would have demanded 65 minutes of
    result grace on a ten-minute contest and refused it outright. Widening the game without
    fixing this would have broken creation for every provider contest.

    What replaces it is not "read the setting", which would have meant platform code knowing
    that Circuit Sprint calls its clock `durationSeconds`. The title DECLARES which of its
    settings is the play clock (`CONFIG_FIELD_FORMATS`), and `resolveAttemptSeconds` reads it
    generically, falling back to the ceiling for a title that declares nothing. The fail-closed
    property survives in the fallback: the ceiling is never shorter than the real length, so
    the mistake it can still make is over-reserving, which is the visible one.
  */
  const roundSeconds = resolveAttemptSeconds(
    input.schemaFields,
    input.settings,
    input.title.maxDurationSeconds,
  );
  const reservesFullRound = input.roundStartPolicy !== "until_window_closes";
  if (roundSeconds !== undefined) {
    if (windowSeconds > 0 && windowSeconds < roundSeconds) {
      /*
        THE SAME FACT IS A REFUSAL OR A WARNING DEPENDING ON THE START POLICY, and it has to
        be, or the setting that exists for short contests cannot be used to create one.

        Reserving: nobody can start a round at all, for the entire contest. That is the
        clearest late failure on the list - every player settles on zero - so it stays a
        refusal.

        Until-close: the contest is legitimate and the operator has chosen it deliberately,
        but they should still see that no attempt can run to its natural length here.
      */
      if (reservesFullRound) {
        errors.push(
          `The playing time you have set (${describeSeconds(roundSeconds)}) is longer than the contest itself (${describeSeconds(Math.floor(windowSeconds))}), so nobody could ever start an attempt. Either shorten the playing time or lengthen the contest.`,
        );
      } else {
        warnings.push(
          `The playing time you have set (${describeSeconds(roundSeconds)}) is longer than the contest itself (${describeSeconds(Math.floor(windowSeconds))}), so every attempt will be cut short when the contest ends. Players are told how long they will actually get. That is fine if a partial run still scores meaningfully in this game.`,
        );
      }
    }

    /*
      THE GRACE PERIOD ONLY HAS TO COVER A ROUND THAT CAN ACTUALLY HAPPEN. Under
      until-close, `resolveExpiry` clamps a round to the contest end, so no round can be
      longer than the window however long the configured playing time is. Demanding grace for
      the full length would refuse a short contest for a round it cannot produce.
    */
    const longestPossibleRound =
      reservesFullRound || !(windowSeconds > 0)
        ? roundSeconds
        : Math.min(roundSeconds, Math.ceil(windowSeconds));
    const requiredGrace = longestPossibleRound + RESULT_GRACE_MARGIN_SECONDS;
    if (input.resultGracePeriodSeconds < requiredGrace) {
      errors.push(
        `The result grace period must be at least ${requiredGrace} seconds - the longest attempt this contest can produce (${describeSeconds(longestPossibleRound)}) plus five minutes - or a round started at the last moment is cut off before its result can arrive.`,
      );
    }
  }

  // --- attempts -------------------------------------------------------------------------

  if (input.attemptsPolicy !== "single") {
    if (input.attemptsAllowed === undefined || input.attemptsAllowed < 2) {
      errors.push(
        `The "${input.attemptsPolicy}" attempts policy needs an attempts allowance of at least 2.`,
      );
    }
    if (!input.perRoundCostAcknowledged) {
      warnings.push(
        `This policy lets each player start up to ${input.attemptsAllowed ?? "several"} rounds. If this provider bills per round, the cost multiplies by that much - confirm you accept it.`,
      );
    }
  } else if (input.attemptsAllowed !== undefined && input.attemptsAllowed > 1) {
    // Reason: `single` ignores the allowance, so a form leaving 3 behind would read as
    // "three attempts" on the review step while the engine grants one.
    warnings.push(
      "The attempts allowance is ignored by the single-attempt policy and will not be saved.",
    );
  }

  // --- the sandbox smoke round ----------------------------------------------------------

  if (!input.lastSandboxRoundAt) {
    warnings.push(
      "No sandbox round has succeeded for this game and configuration. Run one before taking real entry fees.",
    );
  } else {
    const ageHours =
      (now.getTime() - input.lastSandboxRoundAt.getTime()) / (1000 * 60 * 60);
    if (ageHours > SANDBOX_FRESHNESS_HOURS) {
      warnings.push(
        `The last successful sandbox round for this configuration was ${Math.floor(ageHours)} hours ago. Run a fresh one.`,
      );
    }
  }

  // --- the unresolved-round policy ------------------------------------------------------

  if (input.unresolvedRoundPolicy === "exclude") {
    // The warning is kept, but it no longer says the refund is manual - that became false
    // the moment settlement started paying it, and a stale caution is worse than none: an
    // operator who reads it either avoids a policy that now works, or refunds by hand on
    // top of the automatic one. It now describes what the policy DOES, because removing a
    // paid entrant and re-splitting a pool is a consequential choice either way.
    warnings.push(
      "The exclude policy removes a player whose result never arrives: their entry fee is returned automatically at settlement and the prize pool is re-split without them, so the winners share a smaller pot than the one advertised at entry.",
    );
  }

  return { ok: errors.length === 0, errors, warnings };
}
