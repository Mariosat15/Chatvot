/**
 * The Gamemaster leaderboard's figures, computed as an aggregate and cached
 * (`External game plans/24` s6.1: "a cached aggregate, never computed per request").
 *
 * Every figure is a count or a sum over data the platform already stores; nothing here
 * writes. The cache is in-process, so each app server keeps its own copy for at most
 * `GM_LEADERBOARD_CACHE_MS` - the board may lag a join by a few minutes, which is fine for
 * a standing and never unsafe, because the join route re-checks everything live.
 *
 * Deliberately absent: `totalEarnings`, `pendingEarnings` and anything else about money a
 * Game Master has been paid (owner decision: earnings are admin-only). The projection below
 * never selects them, so they cannot leak by being spread into a row later.
 */

import { connectToDatabase } from "@/database/mongoose";
import GameMasterSubscription from "@/database/models/gamemaster/gamemaster-subscription.model";
import UserReferral from "@/database/models/user-referral.model";
import Competition from "@/database/models/trading/competition.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import { rankGmMetrics, type GmLeaderboardMetrics } from "./gm-leaderboard-rules";
import { getUsersByIds } from "@/lib/utils/user-lookup";
import { resolvePublicName } from "@/lib/utils/username";

export const GM_LEADERBOARD_CACHE_MS = 5 * 60 * 1000;
export const ACTIVE_AFFILIATE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

// Reason: `draft` was never offered to anybody and `cancelled` refunded its entrants, so
// neither contributes players or Volts. `emergency_ended` is declared and written by
// nothing (s3.2a), and is excluded with them so a future writer does not count by accident.
const COUNTED_STATUSES = ["upcoming", "active", "finalizing", "completed"];

export interface GmLeaderboardSnapshot {
  rows: GmLeaderboardMetrics[];
  asOf: Date;
}

let cached: { value: GmLeaderboardSnapshot; expiresAt: number } | null = null;
let inflight: Promise<GmLeaderboardSnapshot> | null = null;

/** Tests only: forget the cached snapshot. */
export function clearGmLeaderboardCache(): void {
  cached = null;
  inflight = null;
}

/**
 * Listed Game Masters only - active, not paused, not scheduled for deletion (D7). The same
 * three facts `isGameMasterJoinable` checks for the Join GM channel, so nothing is listed
 * that the join would refuse on joinability.
 */
async function eligibleGameMasters() {
  return GameMasterSubscription.find({
    status: "active",
    isPaused: { $ne: true },
    scheduledForDeletion: { $ne: true },
  })
    .select({ _id: 1, userId: 1, userName: 1 })
    .lean<Array<{ _id: unknown; userId: string; userName?: string }>>();
}

async function compute(): Promise<GmLeaderboardSnapshot> {
  await connectToDatabase();
  const gms = await eligibleGameMasters();
  const gmIds = gms.map((g) => String(g.userId));
  const asOf = new Date();
  if (gmIds.length === 0) return { rows: [], asOf };

  const affiliateCounts = await UserReferral.aggregate<{ _id: string; n: number }>(
    [
      { $match: { gameMasterId: { $in: gmIds }, isActive: true } },
      { $group: { _id: "$gameMasterId", n: { $sum: 1 } } },
    ],
  );

  const contestTotals = await Competition.aggregate<{
    _id: string;
    created: number;
    completed: number;
    participants: number;
    entryVolts: number;
  }>(
    [
      { $match: { gameMasterId: { $in: gmIds }, status: { $ne: "draft" } } },
      {
        $group: {
          _id: "$gameMasterId",
          created: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
          participants: {
            $sum: {
              $cond: [{ $in: ["$status", COUNTED_STATUSES] }, { $ifNull: ["$currentParticipants", 0] }, 0],
            },
          },
          entryVolts: {
            $sum: {
              $cond: [
                { $in: ["$status", COUNTED_STATUSES] },
                {
                  $multiply: [
                    { $ifNull: ["$entryFee", 0] },
                    { $ifNull: ["$currentParticipants", 0] },
                  ],
                },
                0,
              ],
            },
          },
        },
      },
    ],
  );

  // Active affiliate = affiliated AND entered a PAID contest in the last 30 days. Starting
  // from recent seats bounds the work by recent activity rather than by every affiliation.
  // Reason: `competition_participant.competitionId` is declared String while the
  // competition's `_id` is an ObjectId, and an aggregation does no casting - so the join
  // converts explicitly, or every seat looks like a seat in no contest at all (the third
  // time this boundary has cost a silent zero, after the R42 fixture and the funnel).
  const since = new Date(asOf.getTime() - ACTIVE_AFFILIATE_WINDOW_MS);
  const recentPaid = await CompetitionParticipant.aggregate<{ _id: string }>(
    [
      { $match: { enteredAt: { $gte: since } } },
      {
        $addFields: {
          cid: { $convert: { input: "$competitionId", to: "objectId", onError: null, onNull: null } },
        },
      },
      {
        $lookup: {
          from: Competition.collection.name,
          let: { cid: "$cid" },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ["$_id", "$$cid"] }, { $gt: ["$entryFee", 0] }] } } },
            { $project: { _id: 1 } },
          ],
          as: "paid",
        },
      },
      { $match: { "paid.0": { $exists: true } } },
      { $group: { _id: "$userId" } },
    ],
  );

  const activeCounts =
    recentPaid.length === 0
      ? []
      : await UserReferral.aggregate<{ _id: string; n: number }>(
          [
            {
              $match: {
                gameMasterId: { $in: gmIds },
                isActive: true,
                userId: { $in: recentPaid.map((r) => String(r._id)) },
              },
            },
            { $group: { _id: "$gameMasterId", n: { $sum: 1 } } },
          ],
        );

  // Reason: Maps keyed by stored ids, never object lookups (prototype-chain rule).
  const affiliates = new Map(affiliateCounts.map((r) => [String(r._id), r.n]));
  const active = new Map(activeCounts.map((r) => [String(r._id), r.n]));
  const contests = new Map(contestTotals.map((r) => [String(r._id), r]));

  // Reason: this board is public, so a Game Master is shown by username like every player.
  const users = await getUsersByIds(gms.map((g) => String(g.userId)));

  const unranked = gms.map((g) => {
    const id = String(g.userId);
    const c = contests.get(id);
    return {
      subscriptionId: String(g._id),
      gameMasterUserId: id,
      gameMasterName: users.get(id)?.publicName ?? resolvePublicName({ id }),
      affiliates: affiliates.get(id) ?? 0,
      activeAffiliates: active.get(id) ?? 0,
      competitionsCreated: c?.created ?? 0,
      competitionsCompleted: c?.completed ?? 0,
      participants: c?.participants ?? 0,
      entryVolts: c?.entryVolts ?? 0,
    };
  });

  return { rows: rankGmMetrics(unranked), asOf };
}

/**
 * The cached snapshot. Concurrent callers during a refresh share one computation rather
 * than each starting the aggregate, which is the point of caching it at all.
 */
export async function getGmLeaderboardMetrics(): Promise<GmLeaderboardSnapshot> {
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (inflight) return inflight;
  inflight = compute()
    .then((value) => {
      cached = { value, expiresAt: Date.now() + GM_LEADERBOARD_CACHE_MS };
      return value;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
