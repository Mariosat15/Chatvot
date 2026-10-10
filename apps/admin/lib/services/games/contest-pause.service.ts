/**
 * Pause and resume a live competition (shared by admin UI and X9 outage worker).
 *
 * THE EXTEND MATH IS THE LOAD-BEARING PART. Resume adds the pause duration to
 * `endTime` AND to `playWindowEnd` (provider play is gated on the window, not
 * `endTime`). `playWindowStart` moves only while still in the future.
 *
 * Mirrored into `apps/admin/lib/services/games/` — byte-identical test.
 */

import Competition from "@/database/models/trading/competition.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import { notificationService } from "@/lib/services/notification.service";

/** Marker written into `pauseHistory.pausedBy` for automatic provider outages. */
export const SYSTEM_OUTAGE_PAUSED_BY = "system:provider-outage";

/** Player-facing reason when the outage worker pauses a contest. */
export const SYSTEM_OUTAGE_PAUSE_REASON =
  "Provider outage — play is paused until the game is reachable again. Your attempts and scores are safe.";

export type ContestPauseResult =
  | {
      success: true;
      competitionId: string;
      name: string;
      isPaused: true;
      pausedAt: Date;
      pauseReason: string;
    }
  | {
      success: false;
      error: string;
      code:
        | "not_found"
        | "not_active"
        | "already_paused"
        | "reason_required";
    };

export type ContestResumeResult =
  | {
      success: true;
      competitionId: string;
      name: string;
      isPaused: false;
      pauseDurationMs: number;
      endTime: Date;
      playWindowEnd?: Date;
      playWindowStart?: Date;
      totalPauseDuration: number;
    }
  | {
      success: false;
      error: string;
      code: "not_found" | "not_active" | "not_paused";
    };

function activityNounFor(competition: {
  gameType?: string | null;
}): "Play" | "Trading" {
  // Reason: absent label resolves to trading (invariant 5). Provider label → Play.
  return (competition.gameType || "trading") === "provider" ? "Play" : "Trading";
}

async function notifyParticipants(
  competitionId: string,
  payload: {
    type: "competition_paused" | "competition_resumed";
    title: string;
    message: string;
    icon: string;
    priority: "urgent" | "high";
    color: string;
  },
): Promise<void> {
  const participants = await CompetitionParticipant.find({
    competitionId,
    status: { $in: ["active", "joined"] },
  }).select("userId");

  for (const participant of participants) {
    await notificationService.createCustom({
      userId: participant.userId.toString(),
      type: payload.type,
      title: payload.title,
      message: payload.message,
      icon: payload.icon,
      category: "trading",
      priority: payload.priority,
      color: payload.color,
    });
  }
}

/**
 * Pause an active competition. Idempotent refusal when already paused.
 */
export async function pauseContest(input: {
  competitionId: string;
  reason: string;
  pausedBy: string;
  notify?: boolean;
  now?: Date;
  /** Override noun; defaults from stored gameType. */
  activityNoun?: "Play" | "Trading";
}): Promise<ContestPauseResult> {
  const now = input.now ?? new Date();
  const reason = input.reason?.trim();
  if (!reason) {
    return {
      success: false,
      error: "Pause reason is required",
      code: "reason_required",
    };
  }

  const competition = await Competition.findById(input.competitionId);
  if (!competition) {
    return { success: false, error: "Competition not found", code: "not_found" };
  }
  if (competition.status !== "active") {
    return {
      success: false,
      error: `Cannot pause a competition with status: ${competition.status}. Only active competitions can be paused.`,
      code: "not_active",
    };
  }
  if (competition.isPaused) {
    return {
      success: false,
      error: "Competition is already paused",
      code: "already_paused",
    };
  }

  competition.isPaused = true;
  competition.pausedAt = now;
  competition.pauseReason = reason;
  if (!competition.pauseHistory) {
    competition.pauseHistory = [];
  }
  competition.pauseHistory.push({
    pausedAt: now,
    reason,
    pausedBy: input.pausedBy,
  });
  await competition.save();

  if (input.notify !== false) {
    const noun = input.activityNoun ?? activityNounFor(competition);
    await notifyParticipants(input.competitionId, {
      type: "competition_paused",
      title: "⏸️ Competition Paused",
      message: `${competition.name} has been paused. ${noun} is temporarily suspended. Reason: ${reason}`,
      icon: "pause-circle",
      priority: "urgent",
      color: "yellow",
    });
  }

  return {
    success: true,
    competitionId: String(competition._id),
    name: competition.name,
    isPaused: true,
    pausedAt: now,
    pauseReason: reason,
  };
}

/**
 * Resume a paused competition and extend the clocks by the pause duration.
 */
export async function resumeContest(input: {
  competitionId: string;
  resumedBy: string;
  notify?: boolean;
  now?: Date;
  activityNoun?: "Play" | "Trading";
}): Promise<ContestResumeResult> {
  const now = input.now ?? new Date();

  const competition = await Competition.findById(input.competitionId);
  if (!competition) {
    return { success: false, error: "Competition not found", code: "not_found" };
  }
  if (competition.status !== "active") {
    return {
      success: false,
      error: `Cannot resume a competition with status: ${competition.status}. Only active competitions can be resumed.`,
      code: "not_active",
    };
  }
  if (!competition.isPaused) {
    return {
      success: false,
      error: "Competition is not paused",
      code: "not_paused",
    };
  }

  const pausedAt = competition.pausedAt || now;
  const pauseDuration = now.getTime() - pausedAt.getTime();

  competition.isPaused = false;
  competition.pauseReason = undefined;
  competition.totalPauseDuration =
    (competition.totalPauseDuration || 0) + pauseDuration;

  const currentEndTime = new Date(competition.endTime);
  competition.endTime = new Date(currentEndTime.getTime() + pauseDuration);

  /*
    AND THE PLAY WINDOW, because for a provider contest `endTime` is not what gates play.
    `createRound` enforces `playWindowEnd`; the launch service enforces `playWindowStart`.
    Extending only `endTime` gave the fairness compensation to trading and silently
    withheld it from every provider game.

    `playWindowStart` moves only while it is still in the future.
  */
  if (competition.playWindowEnd) {
    competition.playWindowEnd = new Date(
      new Date(competition.playWindowEnd).getTime() + pauseDuration,
    );
  }
  if (
    competition.playWindowStart &&
    new Date(competition.playWindowStart) > now
  ) {
    competition.playWindowStart = new Date(
      new Date(competition.playWindowStart).getTime() + pauseDuration,
    );
  }

  if (competition.pauseHistory && competition.pauseHistory.length > 0) {
    const lastPause =
      competition.pauseHistory[competition.pauseHistory.length - 1];
    if (!lastPause.resumedAt) {
      lastPause.resumedAt = now;
      lastPause.duration = pauseDuration;
      lastPause.resumedBy = input.resumedBy;
    }
  }

  await competition.save();

  if (input.notify !== false) {
    const noun = input.activityNoun ?? activityNounFor(competition);
    const minutes = Math.round(pauseDuration / 60000);
    await notifyParticipants(input.competitionId, {
      type: "competition_resumed",
      title: "▶️ Competition Resumed",
      message: `${competition.name} has been resumed. ${noun} is now active again. End time extended by ${minutes} minutes.`,
      icon: "play-circle",
      priority: "high",
      color: "green",
    });
  }

  return {
    success: true,
    competitionId: String(competition._id),
    name: competition.name,
    isPaused: false,
    pauseDurationMs: pauseDuration,
    endTime: competition.endTime,
    playWindowEnd: competition.playWindowEnd,
    playWindowStart: competition.playWindowStart,
    totalPauseDuration: competition.totalPauseDuration || 0,
  };
}

/** True when the open (unresumed) pause entry was written by the outage worker. */
export function isSystemOutagePause(competition: {
  isPaused?: boolean;
  pauseHistory?: { pausedBy?: string; resumedAt?: Date }[];
}): boolean {
  if (!competition.isPaused) return false;
  const history = competition.pauseHistory;
  if (!history?.length) return false;
  const last = history[history.length - 1];
  return last.pausedBy === SYSTEM_OUTAGE_PAUSED_BY && !last.resumedAt;
}
