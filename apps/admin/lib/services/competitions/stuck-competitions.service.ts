/**
 * Stuck-competition finder for the admin Competitions screen.
 *
 * A competition is "for sure stuck" in exactly two shapes, and nothing else is offered:
 *
 *   1. `upcoming`, its start time passed more than STUCK_GRACE_MS ago, and it holds fewer real
 *      seats than `minParticipants`. The start job runs every minute and would have cancelled
 *      it; a contest still here after the grace period was missed by every automatic path.
 *   2. `cancelled`, but at least one seat was never refunded (no `competition_refund` row for a
 *      player-paid seat, no `free_private_gm_refund` seat row for a funded one). That is R43's
 *      shape: a status flipped by something that did not also move the money.
 *
 * Reason the assessment is strict rather than helpful: `cancelCompetitionAndRefund` refunds
 * the contest's CURRENT `entryFee` to every unrefunded seat and silently skips a player with no
 * wallet. So before it is allowed to run, every seat's actual payment is read back from the
 * ledger and compared with what the refund would pay. Any disagreement, any missing wallet, or
 * any sign a prize was already paid makes the contest NOT refundable here - it is listed with
 * the reason so an operator can look, rather than refunded on a guess.
 */
import { connectToDatabase } from "@/database/mongoose";
import Competition from "@/database/models/trading/competition.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import CreditWallet from "@/database/models/trading/credit-wallet.model";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import { fundedGameMasterOf } from "../settlement/free-private-refund";

/** How long past its start an under-filled contest may sit before it counts as stuck. */
export const STUCK_GRACE_MS = 5 * 60 * 1000;
/** The schema default and floor for `minParticipants`. */
const DEFAULT_MIN_PARTICIPANTS = 2;
/** Cap on contests acted on in one request, so one click cannot open an unbounded loop. */
export const MAX_STUCK_BATCH = 50;

export type StuckReason = "under_minimum_past_start" | "cancelled_unrefunded";

export interface StuckSeat {
  userId: string;
  username: string;
  /** Credits this player actually paid, read from their `competition_entry` rows. */
  paid: number;
  /** Credits the cancel will return to THIS player (0 on a funded contest). */
  refundToPlayer: number;
  /** Credits the cancel will return to the funding Game Master for this seat. */
  refundToGameMaster: number;
  alreadyRefunded: boolean;
  /** Why this seat blocks the refund; absent when the seat checks out. */
  issue?: string;
}

export interface StuckCompetition {
  id: string;
  name: string;
  status: string;
  reason: StuckReason;
  startTime: string;
  entryFee: number;
  minParticipants: number;
  seatCount: number;
  funded: boolean;
  gameMasterUserId: string | null;
  seats: StuckSeat[];
  totalToPlayers: number;
  totalToGameMaster: number;
  /** Blocking problems. A contest with any is listed but cannot be refunded from here. */
  issues: string[];
  /** Non-blocking observations, e.g. a prize pool that does not match the fees collected. */
  warnings: string[];
  refundable: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

interface ContestDoc {
  _id: unknown;
  name?: string;
  status: string;
  startTime: Date;
  minParticipants?: number;
  entryFee?: number;
  prizePool?: number;
}

interface LedgerRow {
  userId: string;
  transactionType: string;
  amount: number;
  metadata?: { sponsoredUserId?: unknown; kind?: unknown } | null;
}

/** Why a contest is stuck, or null if it is not. */
function stuckReasonFor(
  contest: { status: string; startTime: Date; minParticipants?: number },
  seatCount: number,
  hasUnrefundedSeat: boolean,
  now: Date,
): StuckReason | null {
  if (contest.status === "upcoming") {
    const start = new Date(contest.startTime).getTime();
    const min = contest.minParticipants ?? DEFAULT_MIN_PARTICIPANTS;
    if (Number.isFinite(start) && start <= now.getTime() - STUCK_GRACE_MS && seatCount < min) {
      return "under_minimum_past_start";
    }
    return null;
  }
  if (contest.status === "cancelled" && hasUnrefundedSeat) return "cancelled_unrefunded";
  return null;
}

/**
 * Read one contest's seats and ledger and decide whether it is stuck and safely refundable.
 * Returns null when the contest is not stuck (including when it does not exist).
 */
export async function assessStuckCompetition(
  competitionId: string,
  now: Date = new Date(),
): Promise<StuckCompetition | null> {
  await connectToDatabase();
  const contest = await Competition.findById(competitionId).lean<ContestDoc>();
  if (!contest) return null;
  if (contest.status !== "upcoming" && contest.status !== "cancelled") return null;

  const id = String(contest._id);
  const participants = await CompetitionParticipant.find({ competitionId: id })
    .select("userId username status prizeWon")
    .lean<{ userId: string; username?: string; status?: string; prizeWon?: number }[]>();

  const ledger = await WalletTransaction.find({
    competitionId: id,
    transactionType: {
      $in: ["competition_entry", "competition_refund", "competition_win", "free_private_gm_refund"],
    },
  })
    .select("userId transactionType amount metadata")
    .lean<LedgerRow[]>();

  const gameMasterUserId = fundedGameMasterOf(contest as Parameters<typeof fundedGameMasterOf>[0]);
  const funded = gameMasterUserId !== null;
  const entryFee = round2(Number(contest.entryFee) || 0);

  const paidBy = new Map<string, number>();
  const refundedPlayers = new Set<string>();
  const refundedSeats = new Set<string>();
  let prizeRows = 0;
  for (const row of ledger) {
    const uid = String(row.userId);
    if (row.transactionType === "competition_entry") {
      paidBy.set(uid, round2((paidBy.get(uid) ?? 0) - Number(row.amount || 0)));
    } else if (row.transactionType === "competition_refund") {
      refundedPlayers.add(uid);
    } else if (row.transactionType === "competition_win") {
      prizeRows++;
    } else if (row.transactionType === "free_private_gm_refund") {
      const kind = row.metadata?.kind;
      if (kind === "seat_refund" || kind === "excluded_seat") {
        refundedSeats.add(String(row.metadata?.sponsoredUserId ?? ""));
      }
    }
  }

  const isRefunded = (uid: string) => (funded ? refundedSeats.has(uid) : refundedPlayers.has(uid));
  const hasUnrefundedSeat = participants.some((p) => !isRefunded(String(p.userId)));
  const reason = stuckReasonFor(contest, participants.length, hasUnrefundedSeat, now);
  if (!reason) return null;

  const issues: string[] = [];
  const warnings: string[] = [];
  if (prizeRows > 0 || participants.some((p) => (p.prizeWon ?? 0) > 0)) {
    issues.push("A prize has already been recorded for this competition - it must not be refunded as well.");
  }

  const walletOwners = new Set(
    (
      await CreditWallet.find({ userId: { $in: participants.map((p) => String(p.userId)) } })
        .select("userId")
        .lean<{ userId: string }[]>()
    ).map((w) => String(w.userId)),
  );

  const seats: StuckSeat[] = participants.map((p) => {
    const userId = String(p.userId);
    const paid = paidBy.get(userId) ?? 0;
    const alreadyRefunded = isRefunded(userId);
    const seat: StuckSeat = {
      userId,
      username: p.username || userId,
      paid,
      refundToPlayer: !funded && !alreadyRefunded ? entryFee : 0,
      refundToGameMaster: funded && !alreadyRefunded ? entryFee : 0,
      alreadyRefunded,
    };
    if (alreadyRefunded) return seat;
    if (funded) {
      // A sponsored seat costs the player nothing; a player debit here means the funding
      // record and the ledger disagree, and the cancel would refund the Game Master only.
      if (paid !== 0) seat.issue = `Player was charged ${paid} on a Game Master-funded contest.`;
    } else if (!walletOwners.has(userId)) {
      seat.issue = "Player has no wallet - the refund would be skipped silently.";
    } else if (paid !== entryFee) {
      seat.issue = `Ledger shows ${paid} paid, but the refund would pay ${entryFee}.`;
    }
    return seat;
  });

  const badSeats = seats.filter((s) => s.issue).length;
  if (badSeats > 0) issues.push(`${badSeats} seat(s) do not match the ledger - see the seat list.`);
  if (funded && !gameMasterUserId) issues.push("Funded contest has no Game Master on record.");

  const collected = round2([...paidBy.values()].reduce((a, b) => a + b, 0));
  const pool = round2(Number(contest.prizePool) || 0);
  if (reason === "under_minimum_past_start" && !funded && pool !== collected) {
    warnings.push(`Prize pool shows ${pool} but entry fees collected total ${collected}. The cancel sets the pool to 0.`);
  }

  return {
    id,
    name: String(contest.name ?? id),
    status: String(contest.status),
    reason,
    startTime: new Date(contest.startTime).toISOString(),
    entryFee,
    minParticipants: contest.minParticipants ?? DEFAULT_MIN_PARTICIPANTS,
    seatCount: participants.length,
    funded,
    gameMasterUserId,
    seats,
    totalToPlayers: round2(seats.reduce((a, s) => a + s.refundToPlayer, 0)),
    totalToGameMaster: round2(seats.reduce((a, s) => a + s.refundToGameMaster, 0)),
    issues,
    warnings,
    refundable: issues.length === 0,
  };
}

/** Every stuck competition, each fully assessed. Candidates are narrowed by query first. */
export async function findStuckCompetitions(now: Date = new Date()): Promise<StuckCompetition[]> {
  await connectToDatabase();
  const cutoff = new Date(now.getTime() - STUCK_GRACE_MS);
  const overdue = await Competition.find({ status: "upcoming", startTime: { $lte: cutoff } })
    .select("_id")
    .limit(500)
    .lean<{ _id: unknown }[]>();

  // Cancelled contests that still have a seat not marked refunded. The assessment then checks
  // the LEDGER, which is the real test; the status is only a cheap first filter.
  const unrefundedCancelled = await CompetitionParticipant.distinct("competitionId", {
    status: { $ne: "refunded" },
  });
  const cancelled = unrefundedCancelled.length
    ? await Competition.find({
        status: "cancelled",
        _id: { $in: unrefundedCancelled.filter((v) => /^[a-f0-9]{24}$/i.test(String(v))) },
      })
        .select("_id")
        .limit(500)
        .lean<{ _id: unknown }[]>()
    : [];

  const ids = [...new Set([...overdue, ...cancelled].map((c) => String(c._id)))];
  const results: StuckCompetition[] = [];
  for (const id of ids) {
    const assessed = await assessStuckCompetition(id, now);
    if (assessed) results.push(assessed);
  }
  return results.sort((a, b) => a.startTime.localeCompare(b.startTime));
}
