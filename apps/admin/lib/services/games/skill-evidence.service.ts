import { connectToDatabase } from "@/database/mongoose";
import Competition from "@/database/models/trading/competition.model";
import ProviderGame from "@/database/models/games/provider-game.model";
import {
  computeSkillEvidence,
  type SettledContest,
  type SkillEvidence,
} from "./skill-evidence-stats";
import type { EvidenceRange } from "../../admin/skill-evidence-range";

/**
 * Skill evidence per game title, read from SETTLED results only.
 *
 * The source is `Competition.finalLeaderboard`, the ranking settlement actually paid on.
 * It is never recomputed from live scores. A live board can still move and can disagree
 * with what was paid, and evidence handed to a regulator has to describe the contests
 * that really happened.
 *
 * Disqualified rows are dropped before ranking positions are normalised. A player with
 * no result was not beaten on skill, so counting them as last would make a title look
 * more skill-driven than it is.
 *
 * Every title with settled contests is reported, and nothing here enumerates games. The
 * opinion's Category A (identical-content skill titles) is a legal classification, not
 * a stored field, so the operator reads the rows for the titles counsel has classified.
 * Trading is excluded because it is Category C, assessed separately.
 *
 * Admin-only and not mirrored.
 */

export interface TitleSkillEvidence extends SkillEvidence {
  gameKey: string;
  displayName: string;
}

/** Bounds the read. Beyond this many recent contests the figures stop moving anyway. */
export const MAX_CONTESTS_READ = 5000;

interface LeaderboardRow {
  userId?: string;
  rank?: number;
  qualificationStatus?: string;
}

export function toSettledContest(doc: {
  _id: unknown;
  endTime?: Date;
  updatedAt?: Date;
  finalLeaderboard?: LeaderboardRow[];
}): SettledContest {
  const entries = (doc.finalLeaderboard ?? [])
    .filter(
      (row): row is { userId: string; rank: number; qualificationStatus?: string } =>
        typeof row.userId === "string" &&
        row.userId.length > 0 &&
        Number.isFinite(row.rank) &&
        (row.rank as number) >= 1 &&
        row.qualificationStatus !== "disqualified",
    )
    .map((row) => ({ userId: row.userId, rank: row.rank }));
  return {
    contestId: String(doc._id),
    endedAt: new Date(doc.endTime ?? doc.updatedAt ?? 0),
    entries,
  };
}

/**
 * Filter on the day each contest ENDED, the date a regulator would cite for it. A contest
 * straddling the start of the period belongs to the period it finished in.
 */
export function rangeFilter(range: EvidenceRange): Record<string, unknown> {
  if (!range.from && !range.to) return {};
  const endTime: Record<string, Date> = {};
  if (range.from) endTime.$gte = range.from;
  if (range.to) endTime.$lte = range.to;
  return { endTime };
}

export async function getSkillEvidence(range: EvidenceRange = {}): Promise<TitleSkillEvidence[]> {
  await connectToDatabase();

  const docs = await Competition.find({
    status: "completed",
    gameType: "provider",
    "finalLeaderboard.0": { $exists: true },
    ...rangeFilter(range),
  })
    .sort({ endTime: -1 })
    .limit(MAX_CONTESTS_READ)
    .select("gameKey endTime updatedAt finalLeaderboard.userId finalLeaderboard.rank finalLeaderboard.qualificationStatus")
    .lean<
      {
        _id: unknown;
        gameKey?: string;
        endTime?: Date;
        updatedAt?: Date;
        finalLeaderboard?: LeaderboardRow[];
      }[]
    >();

  const byGame = new Map<string, SettledContest[]>();
  for (const doc of docs) {
    if (!doc.gameKey) continue;
    const list = byGame.get(doc.gameKey) ?? [];
    list.push(toSettledContest(doc));
    byGame.set(doc.gameKey, list);
  }
  if (byGame.size === 0) return [];

  const titles = await ProviderGame.find({ gameKey: { $in: [...byGame.keys()] } })
    .select("gameKey displayName gameCode")
    .lean<{ gameKey: string; displayName?: string; gameCode?: string }[]>();
  const names = new Map(titles.map((t) => [t.gameKey, t.displayName || t.gameCode || t.gameKey]));

  return [...byGame.entries()]
    .map(([gameKey, contests]) => ({
      gameKey,
      displayName: names.get(gameKey) ?? gameKey,
      ...computeSkillEvidence(contests),
    }))
    .sort((a, b) => b.contests - a.contests);
}
