import crypto from "crypto";
import GameRound, {
  LIVE_ROUND_STATUSES,
} from "@/database/models/games/game-round.model";
import { resolveEnabledProvider } from "@/lib/services/game-providers/registry";
import type {
  CreateRoundInput,
  CreateRoundOutcome,
  RoundContestConfig,
} from "./round-types";

/**
 * Round creation and the attempts policy (X3, chapter 09 E2).
 *
 * Returns result objects and never throws, for the reason given across this codebase:
 * Next.js strips thrown error messages in production builds, so a throw reaches a player as
 * "An error occurred in Server Components render" instead of a usable reason.
 *
 * TWO RULES THAT LOOK LIKE DETAILS AND ARE NOT
 * --------------------------------------------
 * 1. AN ATTEMPT IS CONSUMED WHEN A ROUND IS CREATED, NOT WHEN IT COMPLETES (chapter 03
 *    section 1.3). Otherwise a player abandons a bad round and retries for free, forever,
 *    which is the whole abandon-and-peek exploit.
 *
 * 2. A PROVIDER FAILURE MUST NOT CONSUME ONE (chapter 01 section 6a, chapter 07 section 7).
 *    Rule 1 makes this awkward: the round row has to exist before we call the provider, or
 *    two concurrent requests both pass the attempt check. So creation writes a `pending`
 *    row, calls the provider, and DELETES that row if the call fails. Deleting is
 *    deliberate rather than marking it `voided` - the unique index on
 *    `{contestId, userId, attemptNumber}` means a surviving row of any status permanently
 *    burns that attempt number. Nothing was played, so there is nothing to audit; the
 *    failure is logged and, for a real provider, lands in `provider_event`.
 */

/** Chapter 01 section 4: our id, and the idempotency key the provider must honour. */
export function generateRoundId(): string {
  return `cv_rnd_${crypto.randomBytes(12).toString("hex")}`;
}

/**
 * How many attempts a contest permits under its policy.
 *
 * Reason `single` ignores `attemptsAllowed`: the two could disagree, and a contest
 * configured `single` with `attemptsAllowed: 3` must mean one. Trusting the number would
 * let a misconfiguration hand out extra attempts silently.
 */
export function attemptsPermitted(config: RoundContestConfig): number {
  if (config.attemptsPolicy === "single") return 1;
  const allowed = config.attemptsAllowed ?? 1;
  return allowed > 0 ? Math.floor(allowed) : 1;
}

/**
 * Rounds that count against the allowance.
 *
 * Excludes `voided`, because chapter 01 section 5.1 says a voided round returns the attempt
 * to the player. Note this is deliberately NOT the same as `attemptNumber`, which stays
 * monotonic: if attempt 1 is voided, the next round is attempt 2 even though the player has
 * used none. Reusing number 1 would collide with the unique index.
 */
async function countConsumedAttempts(
  contestId: CreateRoundInput["contestId"],
  userId: string,
): Promise<number> {
  return GameRound.countDocuments({
    contestId: contestId ?? null,
    userId,
    status: { $ne: "voided" },
  });
}

/** The next attempt number. Monotonic over ALL rounds, voided ones included. */
async function nextAttemptNumber(
  contestId: CreateRoundInput["contestId"],
  userId: string,
): Promise<number> {
  const highest = await GameRound.findOne({
    contestId: contestId ?? null,
    userId,
  })
    .sort({ attemptNumber: -1 })
    .select("attemptNumber")
    .lean<{ attemptNumber?: number } | null>();
  return (highest?.attemptNumber ?? 0) + 1;
}

/**
 * The latest round for this player in this contest that is still live.
 *
 * Used to answer a double-click idempotently rather than with an error: chapter 07 section 4
 * requires the second click to return the SAME launch URL, not a refusal and not a second
 * round.
 */
async function findLiveRound(
  contestId: CreateRoundInput["contestId"],
  userId: string,
) {
  return GameRound.findOne({
    contestId: contestId ?? null,
    userId,
    status: { $in: LIVE_ROUND_STATUSES },
  }).sort({ attemptNumber: -1 });
}

/**
 * Whether the round could finish before the play window closes.
 *
 * Chapter 03 section 1.2: startable only if `now + maxDurationSeconds <= playWindowEnd`.
 *
 * NOW THE CONTEST'S CHOICE RATHER THAN A LAW, and `RoundStartPolicy` carries the reasoning.
 *
 * TWO SEPARATE THINGS WERE WRONG HERE AND ONLY ONE OF THEM WAS THE POLICY. The rule reserved
 * the CATALOGUE ceiling rather than the length this contest was configured for, so a contest
 * shorter than the title's maximum refused every round from the instant it opened. That was
 * arithmetic, it was fixed on 8 September 2026 by reading `attemptSeconds`, and it would have
 * been a defect under either policy. Separately, the rule's fairness premise - that a
 * cut-short round is scored on a partial game and is therefore worthless - stopped holding
 * once partial performance became the basis for winning, which is what made the policy a
 * choice rather than a law.
 *
 * ABSENT MEANS THE OLD BEHAVIOUR, deliberately. A contest written before the field existed
 * must not silently change the rule its entrants signed up under, and the reserving branch is
 * still the correct answer for a title where a shortened round is meaningless.
 *
 * Under `until_window_closes` the round is not unbounded: `resolveExpiry` still clamps
 * `expiresAt` to the window end, so it is shortened rather than allowed to outlive the
 * contest. The player is told how long they will get by `RoundPreflight` before they spend
 * the attempt.
 */
function roundFitsInWindow(config: RoundContestConfig, now: Date): boolean {
  if (config.roundStartPolicy === "until_window_closes") return true;

  // The length THIS contest's attempts run for, not the catalogue ceiling. Reserving the
  // ceiling is what refused every attempt of a contest shorter than the title's maximum, from
  // the instant it opened. `attemptSeconds` on `RoundContestConfig` carries the full reasoning
  // and why the fallback direction is the safe one.
  const attemptMs =
    (config.attemptSeconds ?? config.maxDurationSeconds ?? 0) * 1000;
  return now.getTime() + attemptMs <= config.playWindowEnd.getTime();
}

/**
 * `expiresAt`, always at or before the play window end (chapter 07 section 4).
 *
 * Reason for the Math.min: a round that can outlive its contest is a score that arrives
 * after settlement, which is the single most expensive failure in this whole integration.
 *
 * IT READS THE CEILING WHERE THE GATE ABOVE READS `attemptSeconds`, AND THAT IS DELIBERATE.
 * They look like the same question and they are opposites. The gate asks "may this attempt
 * start", where reserving too much refuses a player, so it wants the real length. This asks
 * "by when is this round certainly over", where being too tight EXPIRES A PLAYER MID-GAME:
 * the game's own clock starts when the browser loads the board, a second or two after the
 * round is created, so an expiry set to the exact configured length lands just before the
 * player's last board. Generous is correct for a safety net. Anyone tidying these into one
 * field is choosing one of the two failures.
 *
 * THE GENEROSITY HAD TO BE MADE EXPLICIT, because it was borrowed from the gap between the two
 * fields and that gap closes. The paragraph above is right that the ceiling is the generous
 * reading - but only while the operator has configured something SHORTER than it. Pick the
 * longest round the title allows and `attemptSeconds` equals `maxDurationSeconds`, so this
 * expiry lands one configured length after the round was CREATED while the game's own clock
 * runs one configured length from when the player pressed Start. The player is then cut off a
 * few seconds early, every time, and the round is reported `expired` rather than `completed` -
 * which is not a wrong payment, since a partial run counts (R48), but it does mean the title's
 * `lastSuccessfulRoundAt` never refreshes and every full-length round lands in the expiry
 * bucket on the screen that decides whether a game keeps running.
 *
 * So the safety net now says how much slack it wants instead of inferring it. This is still
 * clamped to the window, so nothing here can let a round outlive its contest.
 */

/**
 * Slack between the longest a round could run and the moment the platform assumes it is over.
 *
 * Covers loading the frame and reading the intro screen, which happen after the round exists
 * and before its clock starts. A player who leaves the intro open for longer than this loses
 * the difference - disclosed to them, because the game reports the time it will actually
 * honour rather than the nominal length - and there is deliberately no attempt to cover an
 * unbounded wait: the alternative is a safety net so loose it stops being one.
 */
const ROUND_EXPIRY_HEADROOM_SECONDS = 120;

function resolveExpiry(config: RoundContestConfig, now: Date): Date {
  const maxDuration =
    ((config.maxDurationSeconds ?? 300) + ROUND_EXPIRY_HEADROOM_SECONDS) * 1000;
  return new Date(
    Math.min(now.getTime() + maxDuration, config.playWindowEnd.getTime()),
  );
}

export async function createRound(
  input: CreateRoundInput,
): Promise<CreateRoundOutcome> {
  const now = new Date();

  if (now.getTime() >= input.config.playWindowEnd.getTime()) {
    return {
      success: false,
      refusal: "play_window_closed",
      error: "This contest is no longer accepting play.",
    };
  }

  if (!roundFitsInWindow(input.config, now)) {
    return {
      success: false,
      refusal: "play_window_too_short",
      error:
        "There is not enough time left in this contest to finish a round.",
    };
  }

  // Reason: resolved BEFORE any round row is written, so a disabled provider cannot leave a
  // pending round behind. Fails closed on a settings read error - see the registry.
  const resolution = await resolveEnabledProvider(input.providerKey);
  if (!resolution.available) {
    return {
      success: false,
      refusal: "provider_unavailable",
      error: resolution.reason,
    };
  }
  const adapter = resolution.adapter;

  // A live round is answered with itself. Chapter 07 section 4's double-click case.
  const live = await findLiveRound(input.contestId, input.userId);
  if (live) {
    // Reason: re-asking the provider is what makes this genuinely idempotent rather than
    // merely non-duplicating. The contract guarantees the same roundId returns the same
    // launch URL, so this is one call, not a new round.
    const replay = await adapter.createRound({
      roundId: live.roundId,
      gameCode: live.gameCode,
      mode: live.mode,
      player: { playerId: live.userId, displayName: input.displayName },
      config: input.config.settings,
      contentSeed: live.contentSeed,
      expiresAt: live.expiresAt,
      resultCallbackUrl: input.resultCallbackUrl,
      progressCallbackUrl: input.progressCallbackUrl,
      returnUrl: input.returnUrl,
    });

    if (!replay.success) {
      return {
        success: false,
        refusal: "provider_error",
        error: "Your round could not be reopened. Please try again shortly.",
      };
    }

    return {
      success: true,
      roundId: live.roundId,
      launchUrl: replay.data.launchUrl,
      attemptNumber: live.attemptNumber,
      idempotent: true,
    };
  }

  const permitted = attemptsPermitted(input.config);
  const consumed = await countConsumedAttempts(input.contestId, input.userId);
  if (consumed >= permitted) {
    return {
      success: false,
      refusal: "attempts_exhausted",
      error:
        permitted === 1
          ? "You have already used your attempt in this contest."
          : `You have used all ${permitted} of your attempts in this contest.`,
    };
  }

  const roundId = generateRoundId();
  const attemptNumber = await nextAttemptNumber(input.contestId, input.userId);
  const expiresAt = resolveExpiry(input.config, now);

  let round;
  try {
    round = await GameRound.create({
      roundId,
      providerKey: input.providerKey,
      gameCode: input.gameCode,
      gameKey: input.gameKey,
      userId: input.userId,
      contestType: input.contestType,
      contestId: input.contestId ?? null,
      participantId: input.participantId ?? null,
      attemptNumber,
      mode: input.contestType === "practice" ? "practice" : "ranked",
      // Frozen now. The contest's config may change before this round reports, and the
      // round must be judged by the rules it was played under (chapter 04 section 3.3).
      configSnapshot: {
        attemptsPolicy: input.config.attemptsPolicy,
        attemptsAllowed: permitted,
        settings: input.config.settings ?? {},
      },
      contentSeed: input.config.contentSeed,
      status: "pending",
      expiresAt,
    });
  } catch (error) {
    // Reason: the partial unique index `one_live_round_per_player_per_contest` is what makes
    // this reachable - two requests can both pass the checks above and only one can write.
    // Treated as a refusal rather than an error because the loser's correct next action is
    // to reload and use the round that now exists, not to retry blindly.
    if (isDuplicateKeyError(error)) {
      return {
        success: false,
        refusal: "round_already_live",
        error: "You already have a round in progress for this contest.",
      };
    }
    console.error("❌ Round creation failed before the provider call:", error);
    return {
      success: false,
      refusal: "provider_error",
      error: "Your round could not be started. Please try again shortly.",
    };
  }

  const created = await adapter.createRound({
    roundId,
    gameCode: input.gameCode,
    mode: round.mode,
    player: {
      playerId: input.userId,
      displayName: input.displayName,
      locale: input.locale,
      country: input.country,
    },
    config: input.config.settings,
    contentSeed: input.config.contentSeed,
    expiresAt,
    resultCallbackUrl: input.resultCallbackUrl,
    progressCallbackUrl: input.progressCallbackUrl,
    returnUrl: input.returnUrl,
  });

  if (!created.success) {
    // See rule 2 in the file comment: delete, do not void. A surviving row of any status
    // permanently burns this attempt number, and nothing was played.
    await GameRound.deleteOne({ _id: round._id }).catch((error) => {
      console.error(
        `❌ Could not roll back round ${roundId} after a provider failure. It will burn an attempt:`,
        error,
      );
    });

    console.warn(
      `⚠️ Provider "${input.providerKey}" refused round creation: ${created.error}`,
    );
    return {
      success: false,
      refusal: "provider_error",
      error: "The game could not be started right now. Please try again shortly.",
    };
  }

  round.status = "launched";
  round.providerRoundId = created.data.providerRoundId;
  round.launchUrlExpiresAt = created.data.launchUrlExpiresAt;
  await round.save();

  return {
    success: true,
    roundId,
    launchUrl: created.data.launchUrl,
    attemptNumber,
    idempotent: false,
  };
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: number }).code === 11000
  );
}
