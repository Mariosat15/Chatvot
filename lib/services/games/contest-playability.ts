/**
 * Whether a player can still PLAY or TRADE in a contest - the rule that must gate paid entry.
 *
 * THE DEFECT THIS CLOSES. Entry used to ask only "is the status open?" and "has the stored
 * registration deadline passed?". For provider contests the deadline is floored at the play
 * window end (owner rule, 2 Oct 2026) so late joiners can enter a *running* race. That is right
 * while the race is running. It is wrong once the shared race has finished or been cancelled at
 * the game: the play window can still have days left, Join still takes a fee, and Play then
 * refuses with "This race can no longer be joined". The player is charged and cannot compete.
 *
 * The same class of hole exists when the contest clock has ended but the status cron has not
 * yet marked the contest completed - Join would still admit against a status of `active`.
 *
 * ONE MODULE FOR ENTRY AND FOR LAUNCH. Entry refuses the fee; launch refuses the round. Both
 * ask the same facts so a player is never told they can join and then told they cannot play.
 *
 * Main-app only. `apps/admin` does not take player entry fees through this path.
 */

import mongoose from "mongoose";
import GameRound from "@/database/models/games/game-round.model";
import ProviderGame from "@/database/models/games/provider-game.model";
import {
  playNeverStarted,
  startWaitDeadline,
  type StartWaitRoundFacts,
} from "./start-wait";
import {
  SCORE_PRODUCING_ROUND_STATUSES,
} from "./round-types";
import { LIVE_ROUND_STATUSES } from "@/database/models/games/game-round.model";

export type ContestPlayabilityFacts = {
  _id?: unknown;
  status?: string | null;
  gameType?: string | null;
  gameKey?: string | null;
  playMode?: string | null;
  playWindowStart?: Date | string | null;
  playWindowEnd?: Date | string | null;
  endTime?: Date | string | null;
  startWaitSeconds?: unknown;
  isPaused?: boolean | null;
  pauseReason?: string | null;
  providerKey?: string | null;
  gameCode?: string | null;
};

export type PlayabilityBlock = {
  /**
   * Stable code for callers that map to toasts / HTTP. Entry maps these onto
   * `ContestEntryFailureCode`; launch maps them onto `LaunchRefusal`.
   */
  code:
    | "not_open"
    | "registration_closed"
    | "unplayable"
    | "contest_paused"
    | "title_unavailable";
  error: string;
};

function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function contestId(contest: ContestPlayabilityFacts): mongoose.Types.ObjectId | null {
  if (!contest._id) return null;
  try {
    return new mongoose.Types.ObjectId(String(contest._id));
  } catch {
    return null;
  }
}

/**
 * The contest's own clock has already ended, regardless of a stale `status`.
 *
 * Provider contests use `playWindowEnd` (derived from the contest end). Trading uses `endTime`.
 * Either past means a new entrant cannot play or trade, so taking a fee would strand them.
 */
export function contestClockHasEnded(
  contest: ContestPlayabilityFacts,
  now: Date = new Date(),
): string | null {
  if (contest.gameType === "provider") {
    const end = asDate(contest.playWindowEnd) ?? asDate(contest.endTime);
    if (end && now.getTime() > end.getTime()) {
      return "This competition has already ended. No new entries are accepted.";
    }
    return null;
  }

  const end = asDate(contest.endTime);
  if (end && now.getTime() > end.getTime()) {
    return "This competition has already ended. No new entries are accepted.";
  }
  return null;
}

/**
 * A together-start race that can no longer be joined at the game.
 *
 * Detected from platform facts only - never by calling the race server from a money path:
 *  - start-wait deadline passed and play never began (same facts as the cancel-and-refund sweep)
 *  - at least one score-producing round exists AND no live rounds remain (the shared race is over;
 *    a mid-race DNF alone must not close entry while others are still racing)
 *
 * Absent `playMode: "scheduled"` means this is not a together-start contest.
 */
export async function scheduledRaceUnjoinable(
  contest: ContestPlayabilityFacts,
  now: Date = new Date(),
): Promise<string | null> {
  if (contest.gameType !== "provider" || contest.playMode !== "scheduled") {
    return null;
  }

  const id = contestId(contest);
  if (!id) return null;

  const waitDeadline = startWaitDeadline({
    playMode: contest.playMode,
    playWindowStart: asDate(contest.playWindowStart),
    startWaitSeconds: contest.startWaitSeconds,
  });

  const rounds = await GameRound.find({ contestId: id })
    .select("userId status rawScore")
    .lean<StartWaitRoundFacts[]>();

  if (waitDeadline && now.getTime() >= waitDeadline.getTime()) {
    if (playNeverStarted(rounds)) {
      return "This competition can no longer be joined - fewer than two players were ready in time. No new entries are accepted.";
    }
  }

  // Reason: late join into a finished race is exactly what the game refuses. Require no live
  // rounds so a single abandoned/DNF mid-race does not strand would-be late joiners while the
  // shared race is still running.
  const hasLiveRound = rounds.some((round) =>
    (LIVE_ROUND_STATUSES as readonly string[]).includes(String(round.status)),
  );
  const hasScoredRound = rounds.some(
    (round) =>
      SCORE_PRODUCING_ROUND_STATUSES.includes(
        round.status as (typeof SCORE_PRODUCING_ROUND_STATUSES)[number],
      ) &&
      typeof round.rawScore === "number" &&
      Number.isFinite(round.rawScore),
  );
  if (hasScoredRound && !hasLiveRound) {
    return "This competition can no longer be joined - the race has already finished. No new entries are accepted.";
  }

  return null;
}

async function titleBlocksEntry(
  contest: ContestPlayabilityFacts,
): Promise<string | null> {
  if (contest.gameType !== "provider") return null;
  if (!contest.providerKey || !contest.gameCode) return null;

  const title = await ProviderGame.findOne({
    providerKey: contest.providerKey,
    gameCode: contest.gameCode,
  })
    .select("chartvoltEnabled providerStatus")
    .lean<{ chartvoltEnabled?: boolean; providerStatus?: string } | null>();

  if (!title) {
    return "This game is no longer available. No new entries are accepted.";
  }
  if (!title.chartvoltEnabled || title.providerStatus !== "active") {
    return "This game has been paused. No new entries are accepted.";
  }
  return null;
}

/**
 * Why paid entry must be refused because the caller could not play or trade afterwards.
 *
 * Returns null when entry is still meaningful. Does NOT re-check status / registration
 * deadline / wallet - those stay in `enterContest`. Ordered cheapest-first.
 */
export async function explainWhyEntryIsUnplayable(
  contest: ContestPlayabilityFacts,
  now: Date = new Date(),
): Promise<PlayabilityBlock | null> {
  if (contest.isPaused) {
    return {
      code: "contest_paused",
      error: contest.pauseReason
        ? `This competition is paused (${contest.pauseReason}). New entries are not accepted until it resumes.`
        : "This competition is paused. New entries are not accepted until it resumes.",
    };
  }

  const clock = contestClockHasEnded(contest, now);
  if (clock) {
    return { code: "registration_closed", error: clock };
  }

  const race = await scheduledRaceUnjoinable(contest, now);
  if (race) {
    return { code: "unplayable", error: race };
  }

  const title = await titleBlocksEntry(contest);
  if (title) {
    return { code: "title_unavailable", error: title };
  }

  return null;
}
