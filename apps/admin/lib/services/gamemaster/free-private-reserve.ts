/**
 * Free Private Competition money movements (owner, 2 Oct 2026). Mirrored into
 * apps/admin, byte-identical (pinned by a test).
 *
 * Every write here is raw-driver so the same file runs in both apps without importing
 * either app's Mongoose models, and every function takes the caller's session so it joins
 * the caller's transaction. Nothing here opens a transaction of its own.
 *
 * The escrow shape (see `reservedBalance` on credit-wallet.model.ts):
 *   create  -> creditBalance -= reserve, reservedBalance += reserve, contest.reserveRemaining = reserve
 *   seat    -> contest.reserveRemaining -= fee (atomic, guarded), reservedBalance -= fee
 *   release -> creditBalance += remaining, reservedBalance -= remaining, remaining = 0
 *   refund  -> creditBalance += amount (seats already consumed, returned to the GM)
 *
 * The player never receives a spendable credit. Their wallet is never touched; the two
 * ledger rows written per seat (`free_private_entry_sponsor` +fee then
 * `free_private_entry_payment` -fee) record who paid without moving a balance.
 */
import mongoose from "mongoose";

// Reason: driver types come from mongoose's own copy of the driver, which is the one
// `mongoose.connection.db` and `mongoose.startSession()` hand every caller - the top-level
// `mongodb` package is a second, type-incompatible copy.
type Db = mongoose.mongo.Db;
type ClientSession = mongoose.mongo.ClientSession;
type ObjectId = mongoose.mongo.ObjectId;
const ObjectId = mongoose.mongo.ObjectId;
import {
  computeFreePrivateReserve,
  roundCredits,
} from "./free-private-competition";

export type FreePrivateOutcome =
  | "settled"
  | "all_disqualified"
  | "cancelled"
  | "technical_fault";

/** Why a refund row was written - one row per (contest, kind, seat) at most. */
export type FreePrivateRefundKind =
  | "unclaimed_remainder"
  | "seat_refund"
  | "excluded_seat";

function toObjectId(id: string | ObjectId): ObjectId {
  return typeof id === "string" ? new ObjectId(id) : id;
}

function ledgerRow(fields: {
  userId: string;
  transactionType: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  competitionId: string;
  description: string;
  metadata?: Record<string, unknown>;
}) {
  const now = new Date();
  // Reason: raw driver - no schema defaults apply, so every required field is explicit.
  return {
    ...fields,
    currency: "EUR",
    exchangeRate: 1,
    status: "completed",
    processedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

export type ReserveResult =
  | { ok: true; reserve: number; balanceAfter: number }
  | {
      ok: false;
      reason: "invalid_reserve" | "insufficient_balance" | "contest_not_funded";
      message: string;
      required?: number;
      available?: number;
    };

/**
 * Move `entryFee x maxParticipants` out of the Game Master's spendable balance and stamp
 * it on the contest. Refuses with no write when the balance is short.
 *
 * Reason the balance guard is inside the update filter: a read-then-debit would let two
 * creates race past a balance that covers only one of them.
 */
export async function reserveFreePrivateFunds(
  db: Db,
  args: {
    competitionId: string;
    competitionName: string;
    gameMasterUserId: string;
    entryFee: number;
    maxParticipants: number;
  },
  session?: ClientSession,
): Promise<ReserveResult> {
  const reserve = computeFreePrivateReserve(args.entryFee, args.maxParticipants);
  if (reserve === null) {
    return {
      ok: false,
      reason: "invalid_reserve",
      message: "A funded competition needs an entry fee above 0 and at least 2 places.",
    };
  }

  const wallets = db.collection("creditwallets");
  const debited = await wallets.findOneAndUpdate(
    { userId: args.gameMasterUserId, creditBalance: { $gte: reserve } },
    {
      $inc: { creditBalance: -reserve, reservedBalance: reserve },
      $set: { updatedAt: new Date() },
    },
    { session, returnDocument: "after" },
  );
  if (!debited) {
    const current = await wallets.findOne(
      { userId: args.gameMasterUserId },
      { session, projection: { creditBalance: 1 } },
    );
    const available = roundCredits(Number(current?.creditBalance ?? 0));
    return {
      ok: false,
      reason: "insufficient_balance",
      message: `Funding every place needs ${reserve} credits and your wallet holds ${available}.`,
      required: reserve,
      available,
    };
  }

  const balanceAfter = roundCredits(Number(debited.creditBalance));
  await db.collection("wallettransactions").insertOne(
    ledgerRow({
      userId: args.gameMasterUserId,
      transactionType: "free_private_reserve",
      amount: -reserve,
      balanceBefore: roundCredits(balanceAfter + reserve),
      balanceAfter,
      competitionId: args.competitionId,
      description: `Reserved to fund every place in ${args.competitionName}`,
      metadata: { entryFee: args.entryFee, maxParticipants: args.maxParticipants },
    }),
    { session },
  );

  // Reason `freePrivate: {$exists:false}`: a second reserve on one contest would double
  // the escrow. The caller's transaction aborts on the throw, undoing the debit above.
  const stamped = await db.collection("competitions").updateOne(
    {
      _id: toObjectId(args.competitionId),
      fundingMode: "gm_funded",
      freePrivate: { $exists: false },
    },
    {
      $set: {
        freePrivate: {
          gameMasterUserId: args.gameMasterUserId,
          reserveTotal: reserve,
          reserveRemaining: reserve,
          sponsoredCount: 0,
          refundedToGameMaster: 0,
          reservedAt: new Date(),
        },
        updatedAt: new Date(),
      },
    },
    { session },
  );
  if (stamped.matchedCount !== 1) {
    throw new Error(
      `Free private reserve: contest ${args.competitionId} is not a funded contest awaiting a reserve`,
    );
  }

  return { ok: true, reserve, balanceAfter };
}

export type SponsorResult =
  | { ok: true; gameMasterUserId: string }
  | { ok: false; reason: "reserve_exhausted"; message: string };

/**
 * Take one seat out of the reserve for `userId`. The guarded `$inc` is the authority:
 * the reserve can never go below zero, so the GM can never sponsor more than was reserved.
 */
export async function sponsorFreePrivateSeat(
  db: Db,
  args: {
    competitionId: string;
    competitionName: string;
    userId: string;
    entryFee: number;
  },
  session?: ClientSession,
): Promise<SponsorResult> {
  const fee = roundCredits(args.entryFee);
  const claimed = await db.collection("competitions").findOneAndUpdate(
    {
      _id: toObjectId(args.competitionId),
      fundingMode: "gm_funded",
      "freePrivate.reserveRemaining": { $gte: fee },
      "freePrivate.releasedAt": { $exists: false },
    },
    {
      $inc: {
        "freePrivate.reserveRemaining": -fee,
        "freePrivate.sponsoredCount": 1,
      },
      $set: { updatedAt: new Date() },
    },
    { session, returnDocument: "after", projection: { freePrivate: 1 } },
  );
  if (!claimed) {
    return {
      ok: false,
      reason: "reserve_exhausted",
      message: "This free competition has no funded places left.",
    };
  }

  const gameMasterUserId = String(claimed.freePrivate?.gameMasterUserId ?? "");
  await db.collection("creditwallets").updateOne(
    { userId: gameMasterUserId },
    { $inc: { reservedBalance: -fee }, $set: { updatedAt: new Date() } },
    { session },
  );

  // Reason the player's balance is read and not changed: both rows must carry a real
  // balanceBefore/After, and a sponsored entry must never create spendable credit.
  const wallet = await db
    .collection("creditwallets")
    .findOne({ userId: args.userId }, { session, projection: { creditBalance: 1 } });
  const balance = roundCredits(Number(wallet?.creditBalance ?? 0));
  const meta = { gameMasterUserId, sponsored: true };
  await db.collection("wallettransactions").insertMany(
    [
      ledgerRow({
        userId: args.userId,
        transactionType: "free_private_entry_sponsor",
        amount: fee,
        balanceBefore: balance,
        balanceAfter: balance,
        competitionId: args.competitionId,
        description: `Entry to ${args.competitionName} paid by the Game Master`,
        metadata: meta,
      }),
      ledgerRow({
        userId: args.userId,
        transactionType: "free_private_entry_payment",
        amount: -fee,
        balanceBefore: balance,
        balanceAfter: balance,
        competitionId: args.competitionId,
        description: `Entry fee for ${args.competitionName} (sponsored)`,
        metadata: meta,
      }),
    ],
    { session },
  );

  return { ok: true, gameMasterUserId };
}

async function creditGameMaster(
  db: Db,
  gameMasterUserId: string,
  amount: number,
  reservedDelta: number,
  session?: ClientSession,
): Promise<{ before: number; after: number }> {
  const updated = await db.collection("creditwallets").findOneAndUpdate(
    { userId: gameMasterUserId },
    {
      $inc: {
        creditBalance: amount,
        ...(reservedDelta ? { reservedBalance: reservedDelta } : {}),
      },
      $set: { updatedAt: new Date() },
    },
    { session, returnDocument: "after" },
  );
  // Reason to throw: the reserve came out of this wallet, so a missing wallet means the
  // money has nowhere to go. Aborting keeps the contest's reserve intact for a retry.
  if (!updated) {
    throw new Error(`Free private: Game Master wallet ${gameMasterUserId} not found`);
  }
  const after = roundCredits(Number(updated.creditBalance));
  return { before: roundCredits(after - amount), after };
}

/**
 * Return whatever is still in the reserve. Claimed by `releasedAt`, so a second call
 * (a retried cron, a cancel after settlement) returns 0 and moves nothing.
 */
export async function releaseUnusedFreePrivateReserve(
  db: Db,
  args: { competitionId: string; outcome: FreePrivateOutcome },
  session?: ClientSession,
): Promise<number> {
  const before = await db.collection("competitions").findOneAndUpdate(
    {
      _id: toObjectId(args.competitionId),
      fundingMode: "gm_funded",
      "freePrivate.reserveTotal": { $exists: true },
      "freePrivate.releasedAt": { $exists: false },
    },
    {
      $set: {
        "freePrivate.releasedAt": new Date(),
        "freePrivate.reserveRemaining": 0,
        "freePrivate.outcome": args.outcome,
        updatedAt: new Date(),
      },
    },
    { session, returnDocument: "before", projection: { freePrivate: 1, name: 1 } },
  );
  if (!before) return 0;

  const amount = roundCredits(Number(before.freePrivate?.reserveRemaining ?? 0));
  const gameMasterUserId = String(before.freePrivate?.gameMasterUserId ?? "");
  if (amount <= 0) return 0;

  const balances = await creditGameMaster(db, gameMasterUserId, amount, -amount, session);
  await db.collection("wallettransactions").insertOne(
    ledgerRow({
      userId: gameMasterUserId,
      transactionType: "free_private_reserve_release",
      amount,
      balanceBefore: balances.before,
      balanceAfter: balances.after,
      competitionId: args.competitionId,
      description: `Unused reserve returned from ${before.name ?? "a free competition"}`,
      metadata: { outcome: args.outcome },
    }),
    { session },
  );
  return amount;
}

/**
 * Return credits already spent on seats to the Game Master. Idempotent per
 * (contest, kind, seat): a second call with the same key writes nothing and returns 0.
 */
export async function refundFreePrivateGameMaster(
  db: Db,
  args: {
    competitionId: string;
    gameMasterUserId: string;
    amount: number;
    kind: FreePrivateRefundKind;
    description: string;
    sponsoredUserId?: string;
  },
  session?: ClientSession,
): Promise<number> {
  const amount = roundCredits(args.amount);
  if (!(amount > 0)) return 0;

  const existing = await db.collection("wallettransactions").findOne(
    {
      competitionId: args.competitionId,
      transactionType: "free_private_gm_refund",
      "metadata.kind": args.kind,
      "metadata.sponsoredUserId": args.sponsoredUserId ?? null,
    },
    { session, projection: { _id: 1 } },
  );
  if (existing) return 0;

  const balances = await creditGameMaster(db, args.gameMasterUserId, amount, 0, session);
  await db.collection("wallettransactions").insertOne(
    ledgerRow({
      userId: args.gameMasterUserId,
      transactionType: "free_private_gm_refund",
      amount,
      balanceBefore: balances.before,
      balanceAfter: balances.after,
      competitionId: args.competitionId,
      description: args.description,
      metadata: { kind: args.kind, sponsoredUserId: args.sponsoredUserId ?? null },
    }),
    { session },
  );
  await db.collection("competitions").updateOne(
    { _id: toObjectId(args.competitionId) },
    { $inc: { "freePrivate.refundedToGameMaster": amount } },
    { session },
  );
  return amount;
}
