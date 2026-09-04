import mongoose from "mongoose";
import { connectToDatabase } from "@/database/mongoose";
import Competition from "@/database/models/trading/competition.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import ProviderGame from "@/database/models/games/provider-game.model";
import { createRound } from "./round.service";
import { contestRoundConfig, isProviderContest } from "./contest-config";
import type { ProviderContestFields } from "./contest-config";
import type { CreateRoundOutcome, CreateRoundRefusal } from "./round-types";

/**
 * Launching a round in a provider contest - the player-facing half of X3.
 *
 * X3 built `createRound`, which owns provider resolution, the attempts policy, the
 * one-live-round rule, the play-window fit and idempotency. This adds only the things that
 * require knowing about a CONTEST, and deliberately re-implements none of them.
 *
 * WHAT IT ADDS, and each is a refusal that `createRound` cannot make on its own:
 *
 *   - the caller holds a paid seat in this contest
 *   - the contest is open for play, and the play window has actually started
 *   - the round can be timed against the title's own maximum duration
 *   - the provider gets a callback URL that can really reach us
 *
 * THE SEAT CHECK IS THE LOAD-BEARING ONE. Without it, any signed-in user could launch a
 * ranked round in a contest they never paid to enter. It would not obviously break: the
 * round is created, the provider is billed for it, a score comes back, and ingestion writes
 * it against a contest where the player has no participant row - so it is silently dropped
 * at settlement while the player watches a score they think counts. The failure surfaces as
 * a support ticket about a missing result, weeks from the code that caused it.
 */

/**
 * Why a launch was refused.
 *
 * It INCLUDES the round-lifecycle refusals rather than folding them into a generic code,
 * because they are the ones the UI must react to differently: "you have used all your
 * attempts" disables the button, "a round is already live" offers to resume it, and "the
 * provider is down" offers to retry. Collapsing them into `contest_not_open` was the first
 * version of this type and it lied - the contest is open, the player simply cannot start
 * another round.
 */
export type LaunchRefusal =
  | "not_found"
  | "not_provider_contest"
  | "not_a_participant"
  | "contest_not_open"
  | "play_window_not_started"
  | "title_unavailable"
  | "misconfigured"
  | CreateRoundRefusal
  | "failed";

export type LaunchOutcome =
  | {
      success: true;
      roundId: string;
      launchUrl: string;
      attemptNumber: number;
      idempotent: boolean;
    }
  | { success: false; refusal: LaunchRefusal; error: string };

export interface LaunchRoundActor {
  userId: string;
  /** Shown to the provider. Never an email - a provider receives no identifying data. */
  displayName?: string;
  locale?: string;
  country?: string;
}

const refuse = (refusal: LaunchRefusal, error: string): LaunchOutcome => ({
  success: false,
  refusal,
  error,
});

/**
 * Statuses in which a player may start a round.
 *
 * `upcoming` is excluded because the contest has not begun, and `finalizing` because
 * ranking is already being computed from participant scores - a round started then may or
 * may not be counted depending purely on timing, which is worse than a clean refusal.
 */
const PLAYABLE_STATUSES = new Set(["active"]);

/**
 * The public base URL, or null.
 *
 * Reason for refusing rather than defaulting to localhost: this value becomes the address
 * the provider posts every result to. A localhost fallback would let a misconfigured
 * deployment launch real rounds whose results can never arrive - the provider POSTs into
 * nothing, our reconciliation eventually writes the player off under the unresolved-round
 * policy, and the only visible symptom is players complaining their scores vanished.
 */
function publicBaseUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) return null;
  return raw.replace(/\/+$/, "");
}

interface StoredTitle {
  maxDurationSeconds?: number;
  displayName?: string;
}

export async function launchContestRound(
  competitionId: string,
  actor: LaunchRoundActor,
): Promise<LaunchOutcome> {
  if (!mongoose.Types.ObjectId.isValid(competitionId)) {
    return refuse("not_found", "That competition id is not valid.");
  }

  const baseUrl = publicBaseUrl();
  if (!baseUrl) {
    console.error(
      "❌ NEXT_PUBLIC_BASE_URL is not set to an absolute http(s) URL, so no provider round can be launched - the result callback would be unreachable.",
    );
    return refuse(
      "misconfigured",
      "This game is temporarily unavailable. Please try again later.",
    );
  }

  try {
    await connectToDatabase();

    const contest = await Competition.findById(competitionId).lean<
      (ProviderContestFields & { _id: mongoose.Types.ObjectId; status: string; playWindowStart?: Date; gameKey?: string }) | null
    >();

    if (!contest) {
      return refuse("not_found", "Competition not found.");
    }

    // Reason: `isProviderContest` checks the label AND that a provider key and game code
    // are present, because a contest labelled provider with neither cannot launch anything
    // and treating it as one only moves the failure later.
    if (!isProviderContest(contest)) {
      return refuse(
        "not_provider_contest",
        "This competition is not played through a game provider.",
      );
    }

    if (!PLAYABLE_STATUSES.has(contest.status)) {
      return refuse(
        "contest_not_open",
        contest.status === "upcoming"
          ? "This competition has not started yet."
          : "This competition is no longer accepting rounds.",
      );
    }

    // The play window is narrower than the contest, so a contest can be active while play
    // has not opened. `createRound` enforces the END of the window; only the contest knows
    // about the start.
    if (contest.playWindowStart && new Date() < new Date(contest.playWindowStart)) {
      return refuse(
        "play_window_not_started",
        "Play has not opened for this competition yet.",
      );
    }

    // THE SEAT CHECK. See the file header for why this cannot be skipped.
    const participant = await CompetitionParticipant.findOne({
      competitionId,
      userId: actor.userId,
    })
      .select("_id")
      .lean<{ _id: mongoose.Types.ObjectId } | null>();

    if (!participant) {
      return refuse(
        "not_a_participant",
        "You have not joined this competition, so you cannot play a round in it.",
      );
    }

    const config = contestRoundConfig(contest);
    if (!config.ok) {
      // Reason: this is a configuration gap on OUR side, so the player gets a neutral
      // message while the operator gets the specific one in the log. A stored contest
      // missing its round settings is refused, never defaulted - see `contest-config.ts`.
      console.error(
        `❌ Provider contest ${competitionId} cannot launch a round: ${config.error}`,
      );
      return refuse(
        "misconfigured",
        "This game is temporarily unavailable. Please try again later.",
      );
    }

    // `maxDurationSeconds` lives on the catalogue row, not the contest, so it is read here
    // rather than in the bridge. It is what lets `createRound` refuse a round that could
    // not finish before the play window shuts.
    const title = await ProviderGame.findOne({
      providerKey: config.providerKey,
      gameCode: config.gameCode,
    })
      .select("maxDurationSeconds displayName chartvoltEnabled providerStatus")
      .lean<(StoredTitle & { chartvoltEnabled?: boolean; providerStatus?: string }) | null>();

    if (!title) {
      return refuse(
        "title_unavailable",
        "This game is no longer available. Please contact support.",
      );
    }

    // The per-title switch, checked at PLAY time and not only at creation time. An operator
    // disabling a title mid-contest is a deliberate stop signal, and a contest already in
    // flight must not keep billing us for rounds of a game we have switched off.
    //
    // Note this does NOT cancel or unrank the contest: scores already earned stand, per the
    // rule that a disabled game's history is retired rather than deleted.
    if (!title.chartvoltEnabled || title.providerStatus !== "active") {
      return refuse(
        "title_unavailable",
        "This game has been paused. Any rounds you have already completed still count.",
      );
    }

    const outcome: CreateRoundOutcome = await createRound({
      providerKey: config.providerKey,
      gameCode: config.gameCode,
      gameKey: contest.gameKey ?? "",
      userId: actor.userId,
      contestType: "competition",
      contestId: contest._id,
      participantId: participant._id,
      config: { ...config.config, maxDurationSeconds: title.maxDurationSeconds },
      returnUrl: `${baseUrl}/competitions/${competitionId}`,
      resultCallbackUrl: `${baseUrl}/api/games/providers/${config.providerKey}/events`,
      displayName: actor.displayName,
      locale: actor.locale,
      country: actor.country,
    });

    if (!outcome.success) {
      // Passed through unchanged, code and message. `createRound`'s refusals already
      // distinguish attempts exhausted from a live round from a provider being down, and
      // the UI needs all three to behave differently.
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
    console.error("❌ Failed to launch provider round:", error);
    return refuse(
      "failed",
      "Something went wrong. Please contact support.",
    );
  }
}