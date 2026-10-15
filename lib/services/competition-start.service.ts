/**
 * Start or cancel every competition whose start time has passed.
 *
 * A contest that reaches its start with fewer than `minParticipants` players (default 2),
 * or a provider contest whose provider is still down, is cancelled and every entry fee is
 * refunded. Every other due contest goes `active`.
 *
 * Reason: this used to live only inside the Inngest every-minute cron. When Inngest was not
 * firing on the server, an undersubscribed contest sat at `upcoming` past its start - nobody
 * could join, nobody was refunded and the screens said "Starting...". The Agenda worker
 * (which already finalizes ended contests every minute) now calls this too, so either
 * scheduler alone is enough. Running both at once is safe:
 * - start is a conditional update on `status: "upcoming"`, so only one caller starts a
 *   contest and only that caller sends the "started" notifications;
 * - the refund is idempotent per player (ledger rows), see `cancelCompetitionAndRefund`.
 *
 * R43: never write `status: "cancelled"` here before calling the refund - the refund's own
 * claim is the lock, and pre-setting it made every player lose their entry fee.
 */

import { connectToDatabase } from "@/database/mongoose";
import Competition from "@/database/models/trading/competition.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";

export interface CompetitionStartResult {
  started: number;
  cancelled: number;
  /** One line per contest whose start or cancel failed, naming the contest and the error. */
  failed: string[];
}

type DueCompetition = {
  _id: { toString(): string };
  name: string;
  participants?: unknown[];
  minParticipants?: number;
  currentParticipants?: number;
  gameType?: string | null;
  gameConfig?: { providerKey?: string | null } | null;
  gameMasterId?: unknown;
};

function participantUserId(participant: unknown): string {
  if (typeof participant === "string") return participant;
  const p = participant as { userId?: { toString(): string }; toString(): string };
  return p.userId?.toString() || p.toString();
}

async function cancelReasonFor(comp: DueCompetition): Promise<string | null> {
  // Reason: the seats are the fact, the `currentParticipants` counter is a cache of it. A
  // stale-high counter would start a one-player paid contest; a stale-low one would cancel a
  // full one. `competitionId` is declared String on the participant model.
  const participantCount = await CompetitionParticipant.countDocuments({
    competitionId: comp._id.toString(),
    status: { $ne: "refunded" },
  });
  const minRequired = comp.minParticipants || 2;

  if (comp.gameType === "provider") {
    const gate = await import("@/lib/services/game-providers/provider-entry-gate");
    const key = gate.providerKeyFromContest(comp);
    if (key && (await gate.providerBlocksContestEntry(key))) {
      return gate.PROVIDER_OUTAGE_CANCEL_REASON;
    }
  }

  if (participantCount < minRequired) {
    return `Competition cancelled - did not meet minimum ${minRequired} participants (${participantCount}/${minRequired})`;
  }
  return null;
}

async function notifyStarted(comp: DueCompetition): Promise<void> {
  try {
    const { notificationService } = await import("@/lib/services/notification.service");
    for (const participant of comp.participants || []) {
      await notificationService.notifyCompetitionStarted(
        participantUserId(participant),
        comp.name,
      );
    }
    if (comp.gameMasterId) {
      const { notifyGmContestStarted } = await import(
        "@/lib/services/gamemaster/gm-contest-notifications"
      );
      await notifyGmContestStarted(comp as Parameters<typeof notifyGmContestStarted>[0]);
    }
  } catch (error) {
    console.error(`❌ Error sending started notifications for "${comp.name}":`, error);
  }
}

export async function startOrCancelDueCompetitions(
  options: { revalidate?: boolean } = {},
): Promise<CompetitionStartResult> {
  const result: CompetitionStartResult = { started: 0, cancelled: 0, failed: [] };
  await connectToDatabase();

  const due = await Competition.find({
    status: "upcoming",
    startTime: { $lte: new Date() },
  })
    .select(
      "_id name participants minParticipants currentParticipants entryFee prizePool gameType gameConfig gameMasterId",
    )
    .lean<DueCompetition[]>();

  for (const comp of due) {
    const id = comp._id.toString();
    try {
      const reason = await cancelReasonFor(comp);

      if (reason) {
        const { cancelCompetitionAndRefund } = await import(
          "@/lib/actions/trading/competition-cancel.actions"
        );
        const refund = await cancelCompetitionAndRefund(
          id,
          reason,
          // Reason: the worker has no Next.js request, so revalidatePath cannot run there.
          !options.revalidate,
        );
        result.cancelled++;
        console.log(
          `🚫 Cancelled "${comp.name}" - ${reason}. Refunded ${refund.refundedCount} (${refund.totalRefunded} credits)`,
        );
        continue;
      }

      const claimed = await Competition.findOneAndUpdate(
        { _id: id, status: "upcoming" },
        { $set: { status: "active" } },
      );
      if (!claimed) continue; // Another scheduler started or cancelled it first.

      result.started++;
      console.log(`✅ Started "${comp.name}"`);
      await notifyStarted(comp);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.failed.push(`${id} "${comp.name}": ${message}`);
      console.error(`❌ Could not start or cancel "${comp.name}" (${id}):`, error);
    }
  }

  return result;
}
