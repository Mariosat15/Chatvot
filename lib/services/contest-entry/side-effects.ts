/**
 * Fire-and-forget work that runs after a contest entry commits.
 *
 * Nothing in here may fail an entry that is already paid for and seated, so every step
 * swallows its own errors. Each step was previously attached to only one gate; they are
 * here so that a player gets the same treatment whichever entrance they used. Coordination
 * detection is the one that matters most - it is a fraud control, and Gate B skipped it.
 */

import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import type { ContestEntryActor } from "./types";

/** Window the coordination detector compares entries within. */
const COORDINATION_WINDOW_MS = 5 * 60 * 1000;

export function runPostEntrySideEffects(
  competitionId: string,
  competitionName: string,
  actor: ContestEntryActor,
): void {
  void (async () => {
    try {
      const { evaluateUserBadges } = await import(
        "@/lib/services/badge-evaluation.service"
      );
      await evaluateUserBadges(actor.userId);
    } catch (error) {
      console.error("⚠️ Badge evaluation after competition entry failed:", error);
    }

    try {
      const { clearLeaderboardCache } = await import(
        "@/lib/actions/leaderboard/global-leaderboard.actions"
      );
      await clearLeaderboardCache();
    } catch {
      // Best effort - a stale leaderboard is not worth surfacing to the player.
    }

    // Reason: synthetic simulator users have no notification preferences and would
    // otherwise flood the coordination detector with false positives - thousands of
    // accounts entering the same contest in the same second is exactly its trigger.
    if (actor.trusted) return;

    try {
      const { notificationService } = await import(
        "@/lib/services/notification.service"
      );
      await notificationService.notifyCompetitionJoined(
        actor.userId,
        competitionName,
      );
    } catch (error) {
      console.error("⚠️ Competition joined notification failed:", error);
    }

    try {
      const { CoordinationDetectionService } = await import(
        "@/lib/services/fraud/coordination-detection.service"
      );
      const { BehavioralAnalysisService } = await import(
        "@/lib/services/fraud/behavioral-analysis.service"
      );

      const entryTime = new Date();
      await BehavioralAnalysisService.recordCompetitionEntry(
        actor.userId,
      ).catch((error) =>
        console.error("⚠️ Recording competition entry failed:", error),
      );

      // Reason: `createdAt`, not `enteredAt` - the window is about when the row was
      // written, and enteredAt is caller-supplied.
      const recent = await CompetitionParticipant.find({
        competitionId,
        createdAt: { $gte: new Date(Date.now() - COORDINATION_WINDOW_MS) },
      })
        .select("userId createdAt")
        .lean();

      const entries = recent.map((e) => ({
        userId: String(e.userId),
        entryTime: new Date(e.createdAt as Date),
      }));
      if (!entries.some((e) => e.userId === actor.userId)) {
        entries.push({ userId: actor.userId, entryTime });
      }

      // Coordination needs at least a pair to compare.
      if (entries.length >= 2) {
        await CoordinationDetectionService.detectCoordinatedEntry(
          competitionId,
          entries,
        );
      }
    } catch (error) {
      console.error("⚠️ Coordination detection after entry failed:", error);
    }
  })();
}
