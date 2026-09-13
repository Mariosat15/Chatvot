import mongoose from "mongoose";
import { connectToDatabase } from "@/database/mongoose";
import Challenge from "@/database/models/trading/challenge.model";
import ChallengeParticipant from "@/database/models/trading/challenge-participant.model";
import GameRound, {
  LIVE_ROUND_STATUSES,
  type RoundStatus,
} from "@/database/models/games/game-round.model";
import ProviderGame from "@/database/models/games/provider-game.model";
import { attemptsPermitted } from "./round.service";
import { challengeRoundConfig, isProviderChallenge } from "./challenge-round-config";
import { deriveChallengeWindow } from "./challenge-window";
import { resolveAttemptSecondsFromSchema } from "./config-schema";
import type { ChallengeContestFields } from "./challenge-round-config";

/**
 * What one player may know about their own rounds in a provider challenge - the
 * challenge-side sibling of `round-status.service.ts`. See that file's header for why a read
 * service exists at all (the iframe is not a source of truth about anything that decides
 * money) and why the `userId` filter on every query is the one property that must not be
 * lost.
 */

/** One of the caller's own rounds, in the shape a player screen can render. */
export interface ChallengePlayerRoundView {
  roundId: string;
  attemptNumber: number;
  status: RoundStatus;
  score?: number;
  scoreBreakdown?: Record<string, unknown>;
  startedAt?: string;
  completedAt?: string;
  expiresAt: string;
  launchUrlExpiresAt?: string;
  replayUrl?: string;
  isLive: boolean;
}

export type ChallengePlayStateRefusal =
  | "not_found"
  | "not_provider_challenge"
  | "not_a_participant"
  | "misconfigured"
  | "failed";

export interface ChallengePlayState {
  /**
   * Named `contestStatus`, not `challengeStatus`, on purpose: `contestId` and `contestType`
   * already use "contest" to mean "competition or challenge", and matching that lets this
   * shape be handed to the same client components a competition uses (`RoundPreflight`,
   * `RoundResultPanel`) with no branch anywhere on which kind of contest produced it.
   */
  contestStatus: string;
  /** The server's clock, at the moment this state was read. See `PlayState.serverNow`. */
  serverNow: string;
  maxRoundSeconds?: number;
  roundStartPolicy: "reserve_full_round" | "until_window_closes";
  /**
   * Always `false`. `Challenge` carries no `isPaused` field - see
   * `challenge-round-launch.service.ts`'s header for why there is deliberately no pause gate
   * for a 1v1 - but the field is declared here anyway so this shape matches `PlayState`'s
   * exactly and the shared client components need no challenge-specific branch.
   */
  isPaused: false;
  gameKey?: string;
  attemptsPolicy: string;
  attemptsPermitted: number;
  attemptsUsed: number;
  attemptsRemaining: number;
  liveRound: ChallengePlayerRoundView | null;
  rounds: ChallengePlayerRoundView[];
  playWindowStart?: string;
  playWindowEnd?: string;
  /** The caller's own challenge score, as ranking will read it. Absent means no result yet. */
  participantScore?: number;
}

export type ChallengePlayStateOutcome =
  | { success: true; state: ChallengePlayState }
  | { success: false; refusal: ChallengePlayStateRefusal; error: string };

/**
 * A round's score, or nothing. See `scoreOf` in `round-status.service.ts` for why 0 is never
 * substituted for "not yet known".
 */
function scoreOf(round: { status: string; rawScore?: number }): number | undefined {
  if (round.status !== "completed") return undefined;
  return typeof round.rawScore === "number" ? round.rawScore : undefined;
}

interface StoredRound {
  roundId: string;
  attemptNumber: number;
  status: RoundStatus;
  rawScore?: number;
  scoreBreakdown?: Record<string, unknown>;
  startedAt?: Date;
  completedAt?: Date;
  expiresAt: Date;
  launchUrlExpiresAt?: Date;
  replayUrl?: string;
}

function toView(round: StoredRound): ChallengePlayerRoundView {
  return {
    roundId: round.roundId,
    attemptNumber: round.attemptNumber,
    status: round.status,
    score: scoreOf(round),
    scoreBreakdown: round.scoreBreakdown,
    startedAt: round.startedAt?.toISOString(),
    completedAt: round.completedAt?.toISOString(),
    expiresAt: round.expiresAt.toISOString(),
    launchUrlExpiresAt: round.launchUrlExpiresAt?.toISOString(),
    replayUrl: round.replayUrl,
    isLive: LIVE_ROUND_STATUSES.includes(round.status),
  };
}

interface StoredTitle {
  maxDurationSeconds?: number;
  configSchema?: unknown;
}

/**
 * Everything one player may know about their own play in one provider challenge.
 *
 * `userId` must come from the session - the route is the only caller, and it takes it from
 * there, exactly as `getPlayState` requires of its own caller.
 */
export async function getChallengePlayState(
  challengeId: string,
  userId: string,
): Promise<ChallengePlayStateOutcome> {
  if (!mongoose.Types.ObjectId.isValid(challengeId)) {
    return { success: false, refusal: "not_found", error: "Challenge not found." };
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
      return { success: false, refusal: "not_found", error: "Challenge not found." };
    }

    if (!isProviderChallenge(challenge)) {
      return {
        success: false,
        refusal: "not_provider_challenge",
        error: "This challenge is not played through a game provider.",
      };
    }

    const participant = await ChallengeParticipant.findOne({
      challengeId,
      userId,
    })
      .select("score")
      .lean<{ score?: number } | null>();

    if (!participant) {
      return {
        success: false,
        refusal: "not_a_participant",
        error: "You are not a participant in this challenge.",
      };
    }

    const config = challengeRoundConfig(challenge);
    if (!config.ok) {
      console.error(
        `❌ Provider challenge ${challengeId} has unusable round settings: ${config.error}`,
      );
      return {
        success: false,
        refusal: "misconfigured",
        error: "This game is temporarily unavailable. Please try again later.",
      };
    }

    // EVERY query scoped to this one player. See the file header.
    const rounds = await GameRound.find({
      contestId: challenge._id,
      userId,
    })
      .sort({ attemptNumber: -1 })
      .select(
        "roundId attemptNumber status rawScore scoreBreakdown startedAt completedAt expiresAt launchUrlExpiresAt replayUrl",
      )
      .lean<StoredRound[]>();

    const views = rounds.map(toView);
    const permitted = attemptsPermitted(config.config);
    const used = rounds.filter((round) => round.status !== "voided").length;

    const title = await ProviderGame.findOne({
      providerKey: config.providerKey,
      gameCode: config.gameCode,
    })
      .select("maxDurationSeconds configSchema")
      .lean<StoredTitle | null>();

    const attemptSeconds = resolveAttemptSecondsFromSchema(
      title?.configSchema,
      config.config.settings,
      title?.maxDurationSeconds,
    );

    const window = deriveChallengeWindow(challenge);

    return {
      success: true,
      state: {
        contestStatus: challenge.status,
        serverNow: new Date().toISOString(),
        maxRoundSeconds: attemptSeconds,
        roundStartPolicy: config.config.roundStartPolicy ?? "reserve_full_round",
        isPaused: false,
        gameKey: challenge.gameKey,
        attemptsPolicy: config.config.attemptsPolicy,
        attemptsPermitted: permitted,
        attemptsUsed: used,
        attemptsRemaining: Math.max(0, permitted - used),
        liveRound: views.find((round) => round.isLive) ?? null,
        rounds: views,
        playWindowStart: window?.playWindowStart.toISOString(),
        playWindowEnd: window?.playWindowEnd.toISOString(),
        // Passed through, never defaulted - see the field's declaration.
        participantScore: participant.score,
      },
    };
  } catch (error) {
    console.error("❌ Failed to read provider challenge play state:", error);
    return {
      success: false,
      refusal: "failed",
      error: "Something went wrong. Please contact support.",
    };
  }
}
