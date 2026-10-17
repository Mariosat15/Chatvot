/**
 * Attach the contest kind (Normal / Private / Funded) to Game Master earning rows, for the
 * badge beside Type on the dashboard and the Earnings page (owner, 2 Oct 2026).
 *
 * One batched read per page. A challenge earning has no competition, so it carries no kind,
 * rather than being labelled "Normal" for a contest it was never part of.
 */
import mongoose from "mongoose";
import Competition from "@/database/models/trading/competition.model";
import { gmContestKind, type GmContestKind } from "@/lib/utils/gm-contest-kind";

interface EarningRowLike {
  sourceType?: unknown;
  sourceId?: unknown;
  [key: string]: unknown;
}

export async function contestKindsForEarnings(
  rows: readonly EarningRowLike[],
): Promise<Map<string, GmContestKind>> {
  const ids = new Set<string>();
  for (const row of rows) {
    if ((row.sourceType ?? "competition") !== "competition") continue;
    if (typeof row.sourceId === "string" && mongoose.isValidObjectId(row.sourceId)) {
      ids.add(row.sourceId);
    }
  }
  const kinds = new Map<string, GmContestKind>();
  if (ids.size === 0) return kinds;
  const contests = await Competition.find({ _id: { $in: [...ids] } })
    .select("visibility fundingMode")
    .lean();
  for (const c of contests) kinds.set(String(c._id), gmContestKind(c));
  return kinds;
}

/** The kind for one row, or `null` when it is not a competition earning or the contest is gone. */
export function kindForEarning(
  row: EarningRowLike,
  kinds: ReadonlyMap<string, GmContestKind>,
): GmContestKind | null {
  if ((row.sourceType ?? "competition") !== "competition") return null;
  return typeof row.sourceId === "string" ? kinds.get(row.sourceId) ?? null : null;
}
