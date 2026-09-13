import GameProvider from "@/database/models/games/game-provider.model";
import ProviderGame from "@/database/models/games/provider-game.model";
import { WhiteLabel } from "@/database/models/whitelabel.model";
import { getProviderAdapter } from "@/lib/services/game-providers/registry";
import {
  parseConfigSchema,
  resolveAttemptSeconds,
  validateConfigValues,
} from "@/lib/services/games/config-schema";
import {
  runPreflight,
  RESULT_GRACE_MARGIN_SECONDS,
} from "@/lib/services/games/contest-preflight";
import {
  DEFAULT_RESULT_GRACE_SECONDS,
  type RoundStartPolicy,
} from "@/lib/services/games/round-types";
import { resolveChallengeStartPolicy } from "@/lib/services/games/challenge-defaults";

/**
 * Resolving and pre-flighting a provider game for a NEW challenge (X10/E8, item 3 of the
 * roadmap).
 *
 * SEPARATE FROM `apps/admin/lib/services/game-providers/provider-contest.service.ts`'s
 * `preflightProviderContest`, on purpose, for the same reason `challengeable-titles.service.ts`
 * is a separate reader rather than a shared one: that function serves an operator drafting a
 * competition, which has a legitimate "not ready yet" state (`status: "draft"`) and therefore
 * treats `externalGamesEnabled` as a warning. A challenge has no draft state - a player who
 * submits the create form is trying to play right now - so this resolver treats the same
 * field as a HARD refusal, exactly as `listChallengeableTitles` already does for the picker
 * that feeds this route. The two must agree, or a title the picker offered could still be
 * refused for a reason the player was never shown, or worse, a title the picker withheld could
 * somehow still be created by a stale client replaying an old payload.
 *
 * THIS FILE DOES NOT STORE ANYTHING. It is a pure resolution + validation step; the caller
 * (`POST /api/challenges`) is the only writer, exactly as `contest-preflight.ts` itself takes
 * its facts as arguments and does no I/O. Read/parse/validate lives here so the route stays
 * under the line-count limit; the actual `Challenge.create()` call stays in the route, next to
 * every other field the trading branch already sets, so there is one create call to read, not
 * two.
 *
 * A CHALLENGE HAS NO STORED PLAY WINDOW, NO STORED RESULT GRACE PERIOD, AND NO STORED
 * UNRESOLVED-ROUND POLICY - unlike Competition, per `challenge.model.ts`'s own comment: the
 * window is derived from `startTime`/`endTime`, which are not known until acceptance
 * (`app/api/challenges/[id]/accept/route.ts`). `runPreflight` demands all three regardless,
 * because it also enforces the ordinary "does a round fit inside the window" and "is the
 * result grace period sufficient" checks that ARE meaningful before any date is chosen - a
 * game whose configured play clock is longer than the challenge's own duration cannot be
 * fixed by picking a start time later. So this resolver builds a SYNTHETIC window of exactly
 * the requested duration, anchored at `now`, and a result grace period computed from the same
 * formula the check itself demands (`RESULT_GRACE_MARGIN_SECONDS` above the round length) -
 * which exists solely to satisfy a pure function's own internal arithmetic and is discarded
 * immediately after. Nothing here is a second copy of a stored value, because nothing here is
 * stored.
 *
 * THE ATTEMPTS POLICY IS HARD-CODED TO "single" for a provider challenge, deliberately
 * narrower than what Competition allows: a challenge is exactly two players facing one round
 * each, and multi-attempt policies exist to give an operator control over a many-player
 * contest's economics, which has no equivalent question for a 1v1.
 *
 * THE ROUND START POLICY IS NOT, AND IT IS THE ONE THING HERE THAT COMES FROM THE CATALOGUE.
 * Owner decision, 13 September 2026: a challenge does not reserve a whole round out of its own
 * window unless an operator has said so for that title (`challengeDefaults.roundStartPolicy`),
 * so `until_window_closes` is the rule for every game we run and a player who presses Play late
 * gets a SHORTENED round rather than a refusal. Two properties of that read matter. It is taken
 * from the STORED title and never from the request, so a client cannot choose its own play rule
 * - the same reasoning as deriving the market-hours gate's game type from the stored label. And
 * the value resolved here is passed to `runPreflight` AND returned for the route to store, from
 * one resolution: a pre-flight approving a challenge under the permissive rule while the strict
 * one is stored is exactly the defect below, arriving through the control built to prevent it.
 * It used to be
 * `reserve_full_round`, which is correct code enforcing a rule nobody had chosen, and the
 * arithmetic made it far worse than it reads: the reservation is the game's own configured
 * play clock, so a fifteen-minute challenge of a ten-minute game refused every round from the
 * fifth minute onwards - both players paid, neither could play, and the refusal named the
 * clock rather than the setting behind it. The premise `03` s1.2 argues from - that a
 * cut-short round is worth nothing - stopped holding when R48 made a partial run count, and a
 * 1v1 has the additional property that both players face the same window, so a late start
 * costs the person who was late and nobody else.
 */

export interface ChallengeProviderGameInput {
  providerKey: string;
  gameCode: string;
  /** Raw, possibly-empty client submission. Coerced and defaulted below. */
  settings: Record<string, unknown>;
  /** Minutes. The same value the trading branch stores as `Challenge.duration`. */
  durationMinutes: number;
  now?: Date;
}

export interface ChallengeProviderGameResolved {
  ok: true;
  gameKey: string;
  displayName: string;
  /** Coerced, schema-defaulted settings - what gets stored in `gameConfig.settings`. */
  settings: Record<string, unknown>;
  /**
   * How late a player may start a round, resolved from the title's own operator-set default.
   *
   * RETURNED RATHER THAN LEFT TO THE ROUTE to import the constant, because the pre-flight above
   * has already been run against this exact value. If the route decided for itself, a title
   * whose operator reinstated the reservation would be approved permissively and then stored
   * strictly - and every round of it refused, which is R73.
   */
  roundStartPolicy: RoundStartPolicy;
  warnings: string[];
}

export interface ChallengeProviderGameRefused {
  ok: false;
  /** A single human-readable summary, for the generic error field. */
  error: string;
  /** The full pre-flight refusal list, when it got that far. */
  errors: string[];
}

export type ChallengeProviderGameResult =
  | ChallengeProviderGameResolved
  | ChallengeProviderGameRefused;

export async function resolveChallengeProviderGame(
  input: ChallengeProviderGameInput,
): Promise<ChallengeProviderGameResult> {
  const now = input.now ?? new Date();

  const [provider, title, whitelabel] = await Promise.all([
    GameProvider.findOne({ providerKey: input.providerKey }).lean<{
      enabled: boolean;
    } | null>(),
    ProviderGame.findOne({
      providerKey: input.providerKey,
      gameCode: input.gameCode,
    }).lean(),
    WhiteLabel.findOne()
      .select("externalGamesEnabled")
      .lean<{ externalGamesEnabled?: boolean } | null>(),
  ]);

  if (!title) {
    return {
      ok: false,
      error: "That game is not in our catalogue.",
      errors: ["That game is not in our catalogue."],
    };
  }

  // Reason: the hard gate - see the module comment. A challenge has no draft state, so the
  // master switch being off must refuse creation outright rather than warn, matching
  // `listChallengeableTitles`'s own hard gate on the picker feeding this route.
  const externalGamesEnabled = Boolean(whitelabel?.externalGamesEnabled);
  if (!externalGamesEnabled) {
    return {
      ok: false,
      error: "External games are switched off platform-wide right now.",
      errors: ["External games are switched off platform-wide right now."],
    };
  }

  const parsedSchema = parseConfigSchema(title.configSchema);
  if (!parsedSchema.ok) {
    return {
      ok: false,
      error: `This game's settings are not supported: ${parsedSchema.error}`,
      errors: [`This game's settings are not supported: ${parsedSchema.error}`],
    };
  }

  // Re-validated with the coerced result kept, not the submitted one, so `"7"` from a number
  // input never reaches the provider as a string. The dialog sends the player's own choices
  // since 13 Sep 2026 (`ChallengeSettingsFields.tsx`) - it sent nothing at all before that -
  // and this is still what turns an empty submission into the schema's own defaults, which is
  // what an API caller sending no settings gets.
  const validated = validateConfigValues(parsedSchema.fields, input.settings ?? {});
  if (!validated.ok) {
    return {
      ok: false,
      error: "Settings failed validation.",
      errors: validated.errors,
    };
  }

  // Resolved BEFORE the pre-flight, so one value governs both the checks below and what the
  // route stores. Read off the stored title, never the request - see the module comment.
  const roundStartPolicy = resolveChallengeStartPolicy(title.challengeDefaults);

  const durationSeconds = Math.max(1, Math.round(input.durationMinutes * 60));
  const playWindowStart = now;
  const playWindowEnd = new Date(now.getTime() + durationSeconds * 1000);

  // Satisfies `runPreflight`'s own internal grace-sufficiency check by construction - see the
  // module comment. Nothing here is stored; `Challenge` has no `resultGracePeriodSeconds`.
  const roundSeconds = resolveAttemptSeconds(
    parsedSchema.fields,
    validated.values,
    title.maxDurationSeconds,
  );
  const resultGracePeriodSeconds =
    roundSeconds !== undefined
      ? roundSeconds + RESULT_GRACE_MARGIN_SECONDS
      : DEFAULT_RESULT_GRACE_SECONDS;

  const preflight = runPreflight({
    format: "challenge",
    minParticipants: 2,
    title: {
      displayName: title.displayName,
      providerStatus: title.providerStatus,
      supportsCompetition: Boolean(title.supportsCompetition),
      supportsOneVsOne: Boolean(title.supportsOneVsOne),
      supportsContentSeed: Boolean(title.supportsContentSeed),
      maxDurationSeconds: title.maxDurationSeconds,
    },
    provider: {
      enabled: Boolean(provider?.enabled),
      adapterInstalled: Boolean(getProviderAdapter(input.providerKey)),
    },
    chartvoltEnabled: Boolean(title.chartvoltEnabled),
    externalGamesEnabled,
    schemaFields: parsedSchema.fields,
    settings: input.settings ?? {},
    playWindowStart,
    playWindowEnd,
    resultGracePeriodSeconds,
    attemptsPolicy: "single",
    // Passed to the pre-flight as well as stored, from the one resolution above: otherwise
    // creation refuses a title whose round is longer than the challenge while play would have
    // permitted it, or approves one permissively that play then refuses - one gate answering a
    // question the other has stopped asking.
    roundStartPolicy,
    unresolvedRoundPolicy: "score_zero",
    lastSandboxRoundAt: title.lastSuccessfulRoundAt ?? null,
    now,
  });

  if (!preflight.ok) {
    return {
      ok: false,
      error: "This challenge cannot be created yet.",
      errors: preflight.errors,
    };
  }

  return {
    ok: true,
    gameKey: title.gameKey,
    displayName: title.displayName,
    settings: validated.values,
    roundStartPolicy,
    warnings: preflight.warnings,
  };
}
