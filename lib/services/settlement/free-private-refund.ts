/**
 * Where a Free Private (Game Master funded) contest's money goes when it does not settle
 * normally. Mirrored into apps/admin, byte-identical (pinned by a test).
 *
 * The owner's table (2 Oct 2026):
 *
 *   | Outcome                      | Game Master gets                         | Platform fee |
 *   | Normal finish                | unused reserve back                      | normal       |
 *   | All DQ / nobody scored       | unused reserve + the pot after the fee   | kept         |
 *   | Too few players / cancelled  | unused reserve + every seat at full fee  | 0            |
 *   | Platform / Technical Fault   | unused reserve + every seat at full fee  | 0            |
 *
 * The players paid nothing, so nothing here is ever returned to a player. A refund that
 * reached a player's wallet would be a spendable, withdrawable credit the Game Master paid
 * for - the exact thing the funded entry path exists to prevent.
 *
 * Every function takes the caller's session and joins its transaction; the per-seat and
 * per-kind idempotency lives in `free-private-reserve.ts`, so a retried cron moves nothing.
 */
import mongoose from "mongoose";
import {
  refundFreePrivateGameMaster,
  releaseUnusedFreePrivateReserve,
  type FreePrivateOutcome,
} from "../gamemaster/free-private-reserve";
import { isGmFundedContest, roundCredits } from "../gamemaster/free-private-competition";

type ClientSession = mongoose.mongo.ClientSession;

export interface FundedContestFacts {
  _id: { toString(): string };
  name?: string;
  entryFee?: number;
  fundingMode?: unknown;
  freePrivate?: { gameMasterUserId?: unknown } | null;
}

/** The funding Game Master's user id, or null for every player-paid contest. */
export function fundedGameMasterOf(contest: FundedContestFacts | null | undefined): string | null {
  if (!isGmFundedContest(contest)) return null;
  const id = contest?.freePrivate?.gameMasterUserId;
  return id ? String(id) : null;
}

function requireDb(): mongoose.mongo.Db {
  const db = mongoose.connection.db;
  // Reason to throw: this runs inside a money transaction, and returning quietly would
  // commit a cancellation that returned nothing to the Game Master.
  if (!db) throw new Error("Free private refund: database not connected");
  return db;
}

async function seatsAlreadyRefunded(
  db: mongoose.mongo.Db,
  competitionId: string,
  session: ClientSession,
): Promise<Set<string>> {
  const rows = await db
    .collection("wallettransactions")
    .find(
      {
        competitionId,
        transactionType: "free_private_gm_refund",
        "metadata.kind": { $in: ["seat_refund", "excluded_seat"] },
      },
      { session, projection: { "metadata.sponsoredUserId": 1 } },
    )
    .toArray();
  return new Set(rows.map((r) => String(r.metadata?.sponsoredUserId ?? "")));
}

export interface FundedRefundResult {
  gameMasterUserId: string;
  refundedSeatUserIds: string[];
  seatsRefunded: number;
  reserveReleased: number;
}

/**
 * Cancellation, too few players, or a platform fault: every consumed seat goes back to the
 * Game Master at the FULL entry fee and the unused reserve is released. Platform fee 0.
 *
 * Reason for skipping seats refunded under either kind: a seat excluded mid-settlement and
 * then cancelled would otherwise be returned twice, once per kind, because the per-call
 * idempotency key includes the kind.
 */
export async function refundFundedContestToGameMaster(args: {
  session: ClientSession;
  contest: FundedContestFacts;
  sponsoredUserIds: string[];
  outcome: Extract<FreePrivateOutcome, "cancelled" | "technical_fault">;
  reason: string;
}): Promise<FundedRefundResult | null> {
  const gameMasterUserId = fundedGameMasterOf(args.contest);
  if (!gameMasterUserId) return null;

  const db = requireDb();
  const competitionId = args.contest._id.toString();
  const fee = roundCredits(Number(args.contest.entryFee) || 0);
  const already = await seatsAlreadyRefunded(db, competitionId, args.session);

  const result: FundedRefundResult = {
    gameMasterUserId,
    refundedSeatUserIds: [],
    seatsRefunded: 0,
    reserveReleased: 0,
  };

  for (const userId of args.sponsoredUserIds) {
    if (already.has(userId)) continue;
    const moved = await refundFreePrivateGameMaster(
      db,
      {
        competitionId,
        gameMasterUserId,
        amount: fee,
        kind: "seat_refund",
        sponsoredUserId: userId,
        description: `Seat returned (${args.reason}) from ${args.contest.name ?? "a free competition"}`,
      },
      args.session,
    );
    if (moved > 0) {
      result.refundedSeatUserIds.push(userId);
      result.seatsRefunded = roundCredits(result.seatsRefunded + moved);
    }
  }

  result.reserveReleased = await releaseUnusedFreePrivateReserve(
    db,
    { competitionId, outcome: args.outcome },
    args.session,
  );
  return result;
}

/**
 * An excluded seat (unresolved-round `exclude` policy) is returned to the Game Master at the
 * full fee, exactly as a player-paid seat is returned to its player. Returns the total moved,
 * which the caller subtracts from the pool just as it does for a player refund.
 */
export async function refundFundedExcludedSeats(args: {
  session: ClientSession;
  contest: FundedContestFacts;
  userIds: string[];
}): Promise<{ refundedUserIds: string[]; totalRefunded: number }> {
  const out = { refundedUserIds: [] as string[], totalRefunded: 0 };
  const gameMasterUserId = fundedGameMasterOf(args.contest);
  if (!gameMasterUserId) return out;

  const db = requireDb();
  const competitionId = args.contest._id.toString();
  const fee = roundCredits(Number(args.contest.entryFee) || 0);

  for (const userId of args.userIds) {
    const moved = await refundFreePrivateGameMaster(
      db,
      {
        competitionId,
        gameMasterUserId,
        amount: fee,
        kind: "excluded_seat",
        sponsoredUserId: userId,
        description: `Seat returned (no game result received) from ${args.contest.name ?? "a free competition"}`,
      },
      args.session,
    );
    if (moved > 0) {
      out.refundedUserIds.push(userId);
      out.totalRefunded = roundCredits(out.totalRefunded + moved);
    }
  }
  return out;
}

/**
 * All disqualified / nobody scored: the pot after the platform fee goes to the Game Master
 * instead of the unclaimed pool. Returns the amount moved (0 when already paid).
 */
export async function creditFundedRemainderToGameMaster(args: {
  session: ClientSession;
  contest: FundedContestFacts;
  amount: number;
  reason: string;
}): Promise<number> {
  const gameMasterUserId = fundedGameMasterOf(args.contest);
  if (!gameMasterUserId) return 0;
  return refundFreePrivateGameMaster(
    requireDb(),
    {
      competitionId: args.contest._id.toString(),
      gameMasterUserId,
      amount: args.amount,
      kind: "unclaimed_remainder",
      description: `Unawarded prize pool (${args.reason}) returned from ${args.contest.name ?? "a free competition"}`,
    },
    args.session,
  );
}

/** Settlement finished: hand back whatever the reserve still holds. */
export async function releaseFundedReserveAtSettlement(args: {
  session: ClientSession;
  contest: FundedContestFacts;
  noWinners: boolean;
}): Promise<number> {
  if (!fundedGameMasterOf(args.contest)) return 0;
  return releaseUnusedFreePrivateReserve(
    requireDb(),
    {
      competitionId: args.contest._id.toString(),
      outcome: args.noWinners ? "all_disqualified" : "settled",
    },
    args.session,
  );
}
