/**
 * Insert a Game Master trading contest, taking the Free Private reserve in the SAME
 * transaction when it is funded (2 Oct 2026). Mirrored into apps/admin, byte-identical.
 *
 * Reason one transaction: a funded contest that exists without its reserve can be joined
 * by nobody (the seat claim finds no reserve), and a reserve without its contest is credits
 * gone from the Game Master's wallet with nothing to show for them. Either half alone is a
 * support ticket; together they cannot be split.
 */
import mongoose from "mongoose";
type Db = mongoose.mongo.Db;
type Document = mongoose.mongo.Document;
import type { FundingMode } from "./free-private-competition";
import { reserveFreePrivateFunds, type ReserveResult } from "./free-private-reserve";

export type GmInsertResult =
  | { ok: true; reserve?: number }
  | { ok: false; message: string; required?: number; available?: number };

class ReserveRefused extends Error {
  constructor(readonly result: Extract<ReserveResult, { ok: false }>) {
    super(result.message);
  }
}

export async function insertGameMasterCompetition(
  db: Db,
  competition: Document & {
    _id: mongoose.mongo.ObjectId;
    name: string;
    entryFee: number;
    maxParticipants: number;
  },
  args: { fundingMode: FundingMode; gameMasterUserId: string },
): Promise<GmInsertResult> {
  // Reason it is always stamped: the raw driver applies no schema default (R7), and a
  // missing value must stay distinguishable from a deliberate player-paid contest only
  // for documents that predate the field.
  const doc = { ...competition, fundingMode: args.fundingMode };

  if (args.fundingMode !== "gm_funded") {
    await db.collection("competitions").insertOne(doc);
    return { ok: true };
  }

  const session = await mongoose.startSession();
  try {
    let reserve = 0;
    await session.withTransaction(async () => {
      await db.collection("competitions").insertOne(doc, { session });
      const result = await reserveFreePrivateFunds(
        db,
        {
          competitionId: String(competition._id),
          competitionName: competition.name,
          gameMasterUserId: args.gameMasterUserId,
          entryFee: competition.entryFee,
          maxParticipants: competition.maxParticipants,
        },
        session,
      );
      // Throwing aborts the transaction, so the contest insert is undone with it.
      if (!result.ok) throw new ReserveRefused(result);
      reserve = result.reserve;
    });
    return { ok: true, reserve };
  } catch (error) {
    if (error instanceof ReserveRefused) {
      return {
        ok: false,
        message: error.result.message,
        required: error.result.required,
        available: error.result.available,
      };
    }
    throw error;
  } finally {
    await session.endSession();
  }
}
