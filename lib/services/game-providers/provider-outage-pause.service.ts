/**
 * X9 / E7 — outage-driven pause and extend (chapter 07 section 3.2).
 *
 * When a provider is `down`, pause every active provider contest for that key
 * so players cannot start or resume rounds. When evidence recovers to `ok`,
 * resume those contests and extend `playWindowEnd` / `endTime` by the pause
 * duration — same math as the admin resume control.
 *
 * Reuses `contest-pause.service.ts`. Does NOT re-enable a kill-switched
 * provider (that stays an operator action). Recovery probing works even when
 * `enabled: false`, because kill-switch stops updating health for disabled
 * providers.
 *
 * MAIN APP ONLY (worker). Manual pauses (`pausedBy` ≠ system marker) are never
 * auto-resumed.
 */

import Competition from "@/database/models/trading/competition.model";
import GameProvider from "@/database/models/games/game-provider.model";
import {
  pauseContest,
  resumeContest,
  isSystemOutagePause,
  SYSTEM_OUTAGE_PAUSED_BY,
  SYSTEM_OUTAGE_PAUSE_REASON,
} from "@/lib/services/games/contest-pause.service";
import {
  classifyProviderEvidence,
  loadProviderEvidence,
  KILL_SWITCH_OBSERVATION_MS,
} from "@/lib/services/game-providers/provider-kill-switch.service";

export interface OutagePauseSummary {
  examinedDown: number;
  paused: number;
  resumed: number;
  skippedAlreadyPaused: number;
  skippedManualPause: number;
  errors: string[];
}

async function activeProviderContests(providerKey: string) {
  return Competition.find({
    status: "active",
    gameType: "provider",
    "gameConfig.providerKey": providerKey,
  }).select(
    "_id name isPaused pauseHistory gameType gameConfig",
  );
}

/**
 * One Agenda pass: pause contests for down providers; resume system-paused
 * contests whose provider evidence has recovered.
 */
export async function runProviderOutagePause(
  now: Date = new Date(),
): Promise<OutagePauseSummary> {
  const summary: OutagePauseSummary = {
    examinedDown: 0,
    paused: 0,
    resumed: 0,
    skippedAlreadyPaused: 0,
    skippedManualPause: 0,
    errors: [],
  };

  const since = new Date(now.getTime() - KILL_SWITCH_OBSERVATION_MS);

  // --- Pause: every provider currently marked down ---
  const downProviders = await GameProvider.find({
    healthStatus: "down",
  }).lean<{ providerKey: string }[]>();

  for (const provider of downProviders) {
    summary.examinedDown += 1;
    const key = provider.providerKey;
    try {
      const contests = await activeProviderContests(key);
      for (const contest of contests) {
        if (contest.isPaused) {
          summary.skippedAlreadyPaused += 1;
          continue;
        }
        const result = await pauseContest({
          competitionId: String(contest._id),
          reason: SYSTEM_OUTAGE_PAUSE_REASON,
          pausedBy: SYSTEM_OUTAGE_PAUSED_BY,
          activityNoun: "Play",
          now,
        });
        if (result.success) {
          summary.paused += 1;
        } else if (result.code === "already_paused") {
          summary.skippedAlreadyPaused += 1;
        } else {
          summary.errors.push(
            `${key}/${contest._id}: pause ${result.error}`,
          );
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      summary.errors.push(`${key}: ${message}`);
    }
  }

  // --- Resume: system-outage pauses whose provider evidence is ok again ---
  const pausedContests = await Competition.find({
    status: "active",
    isPaused: true,
    gameType: "provider",
  }).select("_id name isPaused pauseHistory gameConfig");

  const byProvider = new Map<string, typeof pausedContests>();
  for (const contest of pausedContests) {
    if (!isSystemOutagePause(contest)) {
      summary.skippedManualPause += 1;
      continue;
    }
    const key = contest.gameConfig?.providerKey;
    if (!key) continue;
    const list = byProvider.get(key) ?? [];
    list.push(contest);
    byProvider.set(key, list);
  }

  for (const [key, contests] of byProvider) {
    try {
      const counts = await loadProviderEvidence(key, since);
      const evidence = classifyProviderEvidence(counts);
      if (evidence !== "ok") continue;

      // Clear stored down state so the next kill-switch pass starts fresh
      // even when the provider is still manually disabled.
      await GameProvider.updateOne(
        { providerKey: key },
        {
          $set: {
            healthStatus: "healthy",
            healthFailureStreak: 0,
            lastHealthCheckAt: now,
          },
          $unset: { healthDownSince: 1 },
        },
      );

      for (const contest of contests) {
        const result = await resumeContest({
          competitionId: String(contest._id),
          resumedBy: SYSTEM_OUTAGE_PAUSED_BY,
          activityNoun: "Play",
          now,
        });
        if (result.success) {
          summary.resumed += 1;
        } else {
          summary.errors.push(
            `${key}/${contest._id}: resume ${result.error}`,
          );
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      summary.errors.push(`${key}: ${message}`);
    }
  }

  return summary;
}
