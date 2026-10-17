/**
 * Tells a Game Master what happened to the competitions they run (owner, 2 Oct 2026):
 * created (and of which kind), started (with how many players), finished (with what they
 * earned from it in total).
 *
 * Mirrored byte-identical into `apps/admin`, because both apps create Game Master
 * contests, both run the start cron and both can settle a contest - a notice that only one
 * app sends would arrive or not depending on which cron got there first (R26's shape).
 *
 * Every function here is fire-and-forget and NEVER throws: each is called after a contest
 * was written, started or paid, and a notification failure must not turn that into a
 * reported failure.
 */
import mongoose from "mongoose";
import { connectToDatabase } from "@/database/mongoose";
import { notificationService } from "@/lib/services/notification.service";
import { formatVolts } from "@/lib/utils/format-volts";
import { GM_CONTEST_KIND_LABELS, gmContestKind } from "@/lib/utils/gm-contest-kind";
import type { GmContestKind } from "@/lib/utils/gm-contest-kind";

export const GM_CONTEST_TEMPLATES = {
  created: "gm_competition_created",
  started: "gm_competition_started",
  finished: "gm_competition_finished",
} as const;

export interface GmContestFacts {
  _id?: unknown;
  name?: unknown;
  gameMasterId?: unknown;
  visibility?: unknown;
  fundingMode?: unknown;
  entryFee?: unknown;
  startTime?: unknown;
  currentParticipants?: unknown;
  participants?: unknown;
  [key: string]: unknown;
}

function asId(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (value && typeof (value as { toString?: unknown }).toString === "function") {
    const text = String(value);
    return text && text !== "[object Object]" ? text : null;
  }
  return null;
}

function kindLabel(kind: GmContestKind): string {
  return GM_CONTEST_KIND_LABELS.get(kind) ?? "Normal";
}

function formatStart(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value ?? ""));
  if (Number.isNaN(date.getTime())) return "at the scheduled time";
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

/** Reason: an absent count is unknown, never zero - `currentParticipants` first, then the array. */
export function participantCountOf(contest: GmContestFacts): number {
  if (typeof contest.currentParticipants === "number" && contest.currentParticipants >= 0) {
    return contest.currentParticipants;
  }
  return Array.isArray(contest.participants) ? contest.participants.length : 0;
}

/** The variables of the created notice. Exported so the wording can be tested without a database. */
export function createdNoticeVariables(
  contest: GmContestFacts,
  reserve?: number,
): Record<string, string> {
  const kind = gmContestKind(contest);
  const entryFee = typeof contest.entryFee === "number" ? contest.entryFee : 0;
  // Reason: in a funded contest the players pay nothing - the stored fee is what the Game
  // Master pays per seat, so quoting it as "Entry" would tell them players are charged.
  const entryFeeText =
    kind === "funded"
      ? `free for players (you pay ${formatVolts(entryFee)} per seat)`
      : entryFee > 0
        ? formatVolts(entryFee)
        : "free";
  const kindLine =
    kind === "funded"
      ? typeof reserve === "number" && Number.isFinite(reserve)
        ? `You pay every seat: ${formatVolts(reserve)} is reserved from your balance.`
        : "You pay every seat; players enter free."
      : kind === "private"
        ? "Only players affiliated with you can see and join it."
        : "It is open to every player.";
  return {
    competitionName: String(contest.name ?? "Your competition"),
    contestKind: kindLabel(kind),
    entryFee: entryFeeText,
    startTime: formatStart(contest.startTime),
    kindLine,
  };
}

export async function notifyGmContestCreated(
  contest: GmContestFacts,
  options: { reserve?: number } = {},
): Promise<void> {
  try {
    const userId = asId(contest.gameMasterId);
    if (!userId) return;
    await notificationService.send({
      userId,
      templateId: GM_CONTEST_TEMPLATES.created,
      variables: createdNoticeVariables(contest, options.reserve),
    });
  } catch (error) {
    console.warn("⚠️ [GM NOTIFY] created notice failed:", error);
  }
}

export async function notifyGmContestStarted(contest: GmContestFacts): Promise<void> {
  try {
    const userId = asId(contest.gameMasterId);
    if (!userId) return;
    await notificationService.send({
      userId,
      templateId: GM_CONTEST_TEMPLATES.started,
      variables: {
        competitionName: String(contest.name ?? "Your competition"),
        contestKind: kindLabel(gmContestKind(contest)),
        participantCount: String(participantCountOf(contest)),
      },
    });
  } catch (error) {
    console.warn("⚠️ [GM NOTIFY] started notice failed:", error);
  }
}

/**
 * Who hears about a finished competition, and what each earned. The creator always hears
 * (even at zero earned - "you earned nothing" is an answer); every other Game Master who
 * earned a referral share from it hears too, since they also made money from it.
 * Exported pure so the recipient rule is testable without a database.
 */
export function finishedRecipients(
  creatorId: string | null,
  earnedByGm: ReadonlyMap<string, number>,
): Map<string, number> {
  const recipients = new Map<string, number>(earnedByGm);
  if (creatorId && !recipients.has(creatorId)) recipients.set(creatorId, 0);
  return recipients;
}

export async function notifyGmContestFinished(competitionId: string): Promise<void> {
  try {
    if (!mongoose.Types.ObjectId.isValid(competitionId)) return;
    await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) return;

    const contest = (await db
      .collection("competitions")
      .findOne(
        { _id: new mongoose.Types.ObjectId(competitionId) },
        {
          projection: {
            name: 1,
            gameMasterId: 1,
            currentParticipants: 1,
            participants: 1,
          },
        },
      )) as GmContestFacts | null;
    if (!contest) return;

    // Reason: earnings are written inside the settlement transaction, and this runs after
    // it commits, so the rows are already there. Keyed on a Map, the key being a stored id.
    const rows = await db
      .collection("gamemasterearnings")
      .aggregate<{ _id: unknown; total: number }>([
        { $match: { sourceType: "competition", sourceId: competitionId } },
        { $group: { _id: "$gameMasterId", total: { $sum: "$netEarning" } } },
      ])
      .toArray();
    const earnedByGm = new Map<string, number>();
    for (const row of rows) {
      const id = asId(row._id);
      if (id) earnedByGm.set(id, Number.isFinite(row.total) ? row.total : 0);
    }

    const recipients = finishedRecipients(asId(contest.gameMasterId), earnedByGm);
    const participantCount = String(participantCountOf(contest));
    const competitionName = String(contest.name ?? "Your competition");
    for (const [userId, total] of recipients) {
      await notificationService.send({
        userId,
        templateId: GM_CONTEST_TEMPLATES.finished,
        variables: {
          competitionName,
          participantCount,
          totalEarned: formatVolts(total),
        },
      });
    }
  } catch (error) {
    console.warn("⚠️ [GM NOTIFY] finished notice failed:", error);
  }
}
