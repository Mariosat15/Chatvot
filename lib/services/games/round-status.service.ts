import mongoose from "mongoose";
import { connectToDatabase } from "@/database/mongoose";
import Competition from "@/database/models/trading/competition.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import GameRound, {
  LIVE_ROUND_STATUSES,
  type RoundStatus,
} from "@/database/models/games/game-round.model";
import { attemptsPermitted } from "./round.service";
import { contestRoundConfig, isProviderContest } from "./contest-config";
import type { ProviderContestFields } from "./contest-config";

/**
 * What one player may know about their own rounds in a provider contest.
 *
 * WHY A READ SERVICE EXISTS AT ALL, given the browser has just been told the round finished:
 * because that message came from the provider's iframe, and **the iframe is not a source of
 * truth about anything that decides money.** The real result arrives separately, at the
 * signed callback, from the provider's servers. So when the frame says "finished", the only
 * correct next move is to ask our own database whether a result actually landed - which is
 * what this answers.
 *
 * THE ONE SECURITY PROPERTY THAT MATTERS HERE IS THE `userId` FILTER, and it is easy to lose.
 * Every query below is scoped to the caller's own id, taken from the session by the route and
 * never from the request. Without it this becomes a way to read another player's score before
 * the leaderboard is published - which in a contest where money depends on relative
 * performance is not a privacy nicety, it is an edge. Note the failure would be invisible:
 * the endpoint returns 200 with correct-looking data.
 *
 * It deliberately reports **attempts**, not just the live round. The pre-flight panel needs
 * to say "2 of 3 attempts left" before the player commits, and re-deriving that number in the
 * UI is how it comes to disagree with the number `createRound` enforces. Same reasoning as
 * never letting a migration carry its own copy of a constant: `attemptsPermitted` and the
 * consumed-attempt rule are imported, not restated.
 */

/** One of the caller's own rounds, in the shape a player screen can render. */
export interface PlayerRoundView {
  roundId: string;
  attemptNumber: number;
  status: RoundStatus;
  /** Present only on a scored round. See `scoreOf` for why it is not always sent. */
  score?: number;
  /**
   * Display only, and it stays that way on the client too. Chapter 01 section 5.4: ranking on
   * a breakdown component would make the result depend on data we never agreed a meaning for.
   */
  scoreBreakdown?: Record<string, unknown>;
  startedAt?: string;
  completedAt?: string;
  expiresAt: string;
  /** A dead launch URL is fixable by relaunching - the same round is returned with a new one. */
  launchUrlExpiresAt?: string;
  replayUrl?: string;
  /** True while a result may still arrive for this round. */
  isLive: boolean;
}

export type PlayStateRefusal =
  | "not_found"
  | "not_provider_contest"
  | "not_a_participant"
  | "misconfigured"
  | "failed";

export interface PlayState {
  contestStatus: string;
  gameKey?: string;
  attemptsPolicy: string;
  attemptsPermitted: number;
  /** Rounds that count against the allowance. A voided round returns the attempt. */
  attemptsUsed: number;
  attemptsRemaining: number;
  /** The round to resume, if one is still in flight. */
  liveRound: PlayerRoundView | null;
  /** The caller's own rounds, newest attempt first. */
  rounds: PlayerRoundView[];
  playWindowStart?: string;
  playWindowEnd?: string;
  /** The caller's own contest score, as ranking will read it. */
  participantScore: number;
}

export type PlayStateOutcome =
  | { success: true; state: PlayState }
  | { success: false; refusal: PlayStateRefusal; error: string };

/**
 * A round's score, or nothing.
 *
 * Reason it is withheld on a non-terminal round rather than sent as 0: a `launched` round has
 * no score yet, and 0 is a legitimate score. Sending zero for "not yet known" would show a
 * player they scored nothing while they were still playing, and the two cases are
 * indistinguishable once the number has been flattened.
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

function toView(round: StoredRound): PlayerRoundView {
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

/**
 * Everything one player may know about their own play in one provider contest.
 *
 * `userId` must come from the session. The route is the only caller and it takes it from
 * there; a variant reading it from a query parameter is the defect this comment exists to
 * prevent.
 */
export async function getPlayState(
  competitionId: string,
  userId: string,
): Promise<PlayStateOutcome> {
  if (!mongoose.Types.ObjectId.isValid(competitionId)) {
    return { success: false, refusal: "not_found", error: "Competition not found." };
  }

  try {
    await connectToDatabase();

    const contest = await Competition.findById(competitionId).lean<
      | (ProviderContestFields & {
          _id: mongoose.Types.ObjectId;
          status: string;
          gameKey?: string;
        })
      | null
    >();

    if (!contest) {
      return { success: false, refusal: "not_found", error: "Competition not found." };
    }

    // The same strict question the launch path asks, and for the same reason: a contest
    // labelled provider with no provider key cannot be played, so answering as though it
    // could only moves the failure to the moment the player presses the button.
    if (!isProviderContest(contest)) {
      return {
        success: false,
        refusal: "not_provider_contest",
        error: "This competition is not played through a game provider.",
      };
    }

    const participant = await CompetitionParticipant.findOne({
      competitionId,
      userId,
    })
      .select("score")
      .lean<{ score?: number } | null>();

    if (!participant) {
      return {
        success: false,
        refusal: "not_a_participant",
        error: "You have not joined this competition.",
      };
    }

    const config = contestRoundConfig(contest);
    if (!config.ok) {
      // Neutral message to the player, specific one to the operator - the gap is on our side.
      console.error(
        `❌ Provider contest ${competitionId} has unusable round settings: ${config.error}`,
      );
      return {
        success: false,
        refusal: "misconfigured",
        error: "This game is temporarily unavailable. Please try again later.",
      };
    }

    // EVERY query scoped to this one player. See the file header.
    const rounds = await GameRound.find({
      contestId: contest._id,
      userId,
    })
      .sort({ attemptNumber: -1 })
      .select(
        "roundId attemptNumber status rawScore scoreBreakdown startedAt completedAt expiresAt launchUrlExpiresAt replayUrl",
      )
      .lean<StoredRound[]>();

    const views = rounds.map(toView);
    const permitted = attemptsPermitted(config.config);

    // Reason it counts here rather than calling `countConsumedAttempts`: that helper is
    // private to the round service and issues its own query, and we already hold every round.
    // The RULE is what must not be restated, and it is not - `voided` returns the attempt,
    // exactly as the round service defines it. Pinned by a test so the two cannot drift.
    const used = rounds.filter((round) => round.status !== "voided").length;

    return {
      success: true,
      state: {
        contestStatus: contest.status,
        gameKey: contest.gameKey,
        attemptsPolicy: config.config.attemptsPolicy,
        attemptsPermitted: permitted,
        attemptsUsed: used,
        attemptsRemaining: Math.max(0, permitted - used),
        liveRound: views.find((round) => round.isLive) ?? null,
        rounds: views,
        playWindowStart: contest.playWindowStart
          ? new Date(contest.playWindowStart).toISOString()
          : undefined,
        playWindowEnd: contest.playWindowEnd
          ? new Date(contest.playWindowEnd).toISOString()
          : undefined,
        participantScore: participant.score ?? 0,
      },
    };
  } catch (error) {
    console.error("❌ Failed to read provider play state:", error);
    return {
      success: false,
      refusal: "failed",
      error: "Something went wrong. Please contact support.",
    };
  }
}
