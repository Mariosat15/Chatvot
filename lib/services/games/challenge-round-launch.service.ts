import mongoose from "mongoose";
import { connectToDatabase } from "@/database/mongoose";
import Challenge from "@/database/models/trading/challenge.model";
import ChallengeParticipant from "@/database/models/trading/challenge-participant.model";
import ProviderGame from "@/database/models/games/provider-game.model";
import { createRound } from "./round.service";
import { challengeRoundConfig, isProviderChallenge } from "./challenge-round-config";
import { deriveChallengeWindow } from "./challenge-window";
import { resolveAttemptSecondsFromSchema } from "./config-schema";
import { publicBaseUrl } from "./public-base-url";
import type { ChallengeContestFields } from "./challenge-round-config";
import type { CreateRoundOutcome, CreateRoundRefusal } from "./round-types";

/**
 * Launching a round in a provider challenge - the challenge-side sibling of
 * `round-launch.service.ts`.
 *
 * A SEPARATE FILE FROM THE COMPETITION VERSION, on the same precedent
 * `challenge-settlement.service.ts` set: `createRound` already owns provider resolution, the
 * attempts policy, the one-live-round rule, the play-window fit and idempotency, and neither
 * copy re-implements any of it. What differs between a competition and a challenge is the
 * SEAT and the WINDOW, which is exactly the surface this file exists to hold - not the
 * lower-level mechanics, which stay imported from one place each.
 *
 * WHAT IT ADDS, mirroring the competition file's own list:
 *
 *   - the caller holds a seat in this challenge (one of its two participants)
 *   - the challenge is open for play, and the derived play window has actually started
 *   - the round can be timed against the title's own maximum duration
 *   - the provider gets a callback URL that can really reach us
 *
 * NO PAUSE GATE, deliberately, because `Challenge` carries no `isPaused` field - there is no
 * operator control to honour and inventing one here would be a control that appears to work
 * and does nothing, the exact failure this codebase keeps finding elsewhere.
 */

export type ChallengeLaunchRefusal =
  | "not_found"
  | "not_provider_challenge"
  | "not_a_participant"
  | "challenge_not_open"
  | "play_window_not_started"
  | "title_unavailable"
  | "misconfigured"
  | CreateRoundRefusal
  | "failed";

export type ChallengeLaunchOutcome =
  | {
      success: true;
      roundId: string;
      launchUrl: string;
      attemptNumber: number;
      idempotent: boolean;
    }
  | { success: false; refusal: ChallengeLaunchRefusal; error: string };

export interface LaunchChallengeRoundActor {
  userId: string;
  /** Shown to the provider. Never an email - a provider receives no identifying data. */
  displayName?: string;
  locale?: string;
  country?: string;
}

const refuse = (
  refusal: ChallengeLaunchRefusal,
  error: string,
): ChallengeLaunchOutcome => ({
  success: false,
  refusal,
  error,
});

/**
 * Statuses in which a player may start a round.
 *
 * `pending` is excluded because the challenge has not been accepted, and `finalizing` for
 * the same reason `round-launch.service.ts` excludes it on a competition: ranking is already
 * being computed from participant scores.
 */
const PLAYABLE_STATUSES = new Set(["active"]);

interface StoredTitle {
  maxDurationSeconds?: number;
  displayName?: string;
  configSchema?: unknown;
}

export async function launchChallengeRound(
  challengeId: string,
  actor: LaunchChallengeRoundActor,
): Promise<ChallengeLaunchOutcome> {
  if (!mongoose.Types.ObjectId.isValid(challengeId)) {
    return refuse("not_found", "That challenge id is not valid.");
  }

  const baseUrl = publicBaseUrl();
  if (!baseUrl) {
    console.error(
      `❌ NEXT_PUBLIC_BASE_URL is unusable as a provider result callback, so no provider round can be launched. ` +
        `It must be an absolute URL, and in production it must be https on a non-loopback host. ` +
        `Current value: ${process.env.NEXT_PUBLIC_BASE_URL ?? "(unset)"}`,
    );
    return refuse(
      "misconfigured",
      "This game is temporarily unavailable. Please try again later.",
    );
  }

  try {
    await connectToDatabase();

    const challenge = await Challenge.findById(challengeId).lean<
      | (ChallengeContestFields & {
          _id: mongoose.Types.ObjectId;
          status: string;
          gameKey?: string;
        })
      | null
    >();

    if (!challenge) {
      return refuse("not_found", "Challenge not found.");
    }

    // Reason: `isProviderChallenge` checks the label AND that a provider key and game code
    // are present - the same strict question `isProviderContest` asks of a competition.
    if (!isProviderChallenge(challenge)) {
      return refuse(
        "not_provider_challenge",
        "This challenge is not played through a game provider.",
      );
    }

    if (!PLAYABLE_STATUSES.has(challenge.status)) {
      return refuse(
        "challenge_not_open",
        challenge.status === "pending" || challenge.status === "accepted"
          ? "This challenge has not started yet."
          : "This challenge is no longer accepting rounds.",
      );
    }

    // The play window is derived from [startTime, endTime] rather than stored separately -
    // see `challenge-window.ts`. `createRound` enforces the END of the window; only this
    // check knows about the START, exactly as the competition launch service does for its
    // own `playWindowStart`.
    const window = deriveChallengeWindow(challenge);
    if (!window || new Date() < window.playWindowStart) {
      return refuse(
        "play_window_not_started",
        "Play has not opened for this challenge yet.",
      );
    }

    // THE SEAT CHECK. Without it, either player of a signed-in pair could launch a ranked
    // round in a challenge they are not seated in - the same reasoning the competition file's
    // header carries in full.
    const participant = await ChallengeParticipant.findOne({
      challengeId,
      userId: actor.userId,
    })
      .select("_id")
      .lean<{ _id: mongoose.Types.ObjectId } | null>();

    if (!participant) {
      return refuse(
        "not_a_participant",
        "You are not a participant in this challenge, so you cannot play a round in it.",
      );
    }

    const config = challengeRoundConfig(challenge);
    if (!config.ok) {
      // Reason: this is a configuration gap on OUR side, so the player gets a neutral
      // message while the operator gets the specific one in the log - matching the
      // competition file's own choice.
      console.error(
        `❌ Provider challenge ${challengeId} cannot launch a round: ${config.error}`,
      );
      return refuse(
        "misconfigured",
        "This game is temporarily unavailable. Please try again later.",
      );
    }

    // The title's clock lives on the catalogue row, not the challenge, so it is read here
    // rather than in the bridge - same reasoning as the competition launch service.
    const title = await ProviderGame.findOne({
      providerKey: config.providerKey,
      gameCode: config.gameCode,
    })
      .select("maxDurationSeconds configSchema displayName chartvoltEnabled providerStatus")
      .lean<(StoredTitle & { chartvoltEnabled?: boolean; providerStatus?: string }) | null>();

    if (!title) {
      return refuse(
        "title_unavailable",
        "This game is no longer available. Please contact support.",
      );
    }

    // The per-title switch, checked at PLAY time and not only at creation time - same
    // reasoning as the competition launch service. Scores already earned stand; a disabled
    // game's history is retired rather than deleted.
    if (!title.chartvoltEnabled || title.providerStatus !== "active") {
      return refuse(
        "title_unavailable",
        "This game has been paused. Any rounds you have already completed still count.",
      );
    }

    const outcome: CreateRoundOutcome = await createRound({
      providerKey: config.providerKey,
      gameCode: config.gameCode,
      gameKey: challenge.gameKey ?? "",
      userId: actor.userId,
      contestType: "challenge",
      contestId: challenge._id,
      participantId: participant._id,
      config: {
        ...config.config,
        maxDurationSeconds: title.maxDurationSeconds,
        attemptSeconds: resolveAttemptSecondsFromSchema(
          title.configSchema,
          config.config.settings,
          title.maxDurationSeconds,
        ),
      },
      returnUrl: `${baseUrl}/challenges/${challengeId}`,
      resultCallbackUrl: `${baseUrl}/api/games/providers/${config.providerKey}/events`,
      // Supplied unconditionally, exactly as the competition launch service does - see
      // `contract.ts` for why the provider's use of it is optional.
      progressCallbackUrl: `${baseUrl}/api/games/providers/${config.providerKey}/progress`,
      displayName: actor.displayName,
      locale: actor.locale,
      country: actor.country,
    });

    if (!outcome.success) {
      // Passed through unchanged, code and message - `createRound`'s refusals already
      // distinguish attempts exhausted from a live round from a provider being down.
      return refuse(outcome.refusal, outcome.error);
    }

    return {
      success: true,
      roundId: outcome.roundId,
      launchUrl: outcome.launchUrl,
      attemptNumber: outcome.attemptNumber,
      idempotent: outcome.idempotent,
    };
  } catch (error) {
    console.error("❌ Failed to launch provider challenge round:", error);
    return refuse("failed", "Something went wrong. Please contact support.");
  }
}
