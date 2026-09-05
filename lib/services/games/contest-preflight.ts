import type { ConfigField } from "./config-schema";
import { validateConfigValues } from "./config-schema";
import type { AttemptsPolicy, UnresolvedRoundPolicy } from "./round-types";

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

  const roundSeconds = input.title.maxDurationSeconds;
  if (roundSeconds !== undefined) {
    if (windowSeconds > 0 && windowSeconds < roundSeconds) {
      // The clearest late failure on the list: nobody can finish a round, and the contest
      // settles with every player on zero.
      errors.push(
        `The play window is shorter than one round of this game (${roundSeconds} seconds), so no player could finish.`,
      );
    }

    const requiredGrace = roundSeconds + 5 * 60;
    if (input.resultGracePeriodSeconds < requiredGrace) {
      errors.push(
        `The result grace period must be at least ${requiredGrace} seconds - one full round plus five minutes - or a round started at the last moment is cut off before its result can arrive.`,
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
