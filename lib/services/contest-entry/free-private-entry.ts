/**
 * The Game Master-funded branch of contest entry (Free Private Competitions, 2 Oct 2026).
 *
 * Called inside `enterContest`'s transaction, after every contest-level guard and in place
 * of the player's wallet debit. Main app only, like the entry service it belongs to.
 *
 * The player's wallet is never debited and never credited: the seat is paid out of the
 * contest's reserve by `sponsorFreePrivateSeat`, whose guarded `$inc` is the authority on
 * whether a funded place is left. The prize pool still grows by the full fee in the
 * caller, so settlement sees exactly what a paid contest would.
 */
import mongoose from "mongoose";
import { sponsorFreePrivateSeat } from "../gamemaster/free-private-reserve";
import { verifyFreePrivateTermsAcceptance } from "../gamemaster/free-private-terms.service";
import { fail, type ContestEntryActor, type ContestEntryFailure } from "./types";
import { WhiteLabel } from "@/database/models/whitelabel.model";
import CreditWallet from "@/database/models/trading/credit-wallet.model";
import {
  freePrivateEntryRefusal,
  resolveFreePrivateEntryRule,
} from "@/lib/utils/free-private-entry-rule";

type ClientSession = mongoose.mongo.ClientSession;

export interface FundedContestFacts {
  _id: unknown;
  name: string;
  entryFee?: number;
  visibility?: string;
  gameMasterId?: string;
  fundingMode?: string;
  freePrivate?: { reserveTotal?: number } | null;
}

/** True when the contest is Game Master-funded, whatever state its reserve is in. */
export function isFundedContest(competition: { fundingMode?: string }): boolean {
  return competition.fundingMode === "gm_funded";
}

/**
 * Pay one funded seat. Returns a refusal (the caller aborts) or `null` when the seat is
 * paid. Order matters: every refusal comes before `sponsorFreePrivateSeat`, the only write.
 */
export async function payFundedEntry(
  competition: FundedContestFacts,
  actor: ContestEntryActor,
  session: ClientSession,
): Promise<ContestEntryFailure | null> {
  const competitionId = String(competition._id);
  const gameMasterId = competition.gameMasterId;

  // Reason: a funded contest without its reserve, outside private visibility or without an
  // owning Game Master is a broken document, not a free entry. Refusing is the only answer
  // that cannot hand out seats nobody paid for.
  if (
    competition.visibility !== "gm_private" ||
    typeof gameMasterId !== "string" ||
    gameMasterId.length === 0 ||
    !(Number(competition.freePrivate?.reserveTotal) > 0) ||
    !(Number(competition.entryFee) > 0)
  ) {
    return fail(
      "free_private_unfunded",
      "This free competition is not funded right now. Please contact support.",
    );
  }

  // Reason: simulator actors are synthetic users. Seating them would spend a real Game
  // Master's money on players who do not exist.
  if (actor.trusted) {
    return fail(
      "free_private_unfunded",
      "Simulated players cannot enter a Game Master-funded competition.",
    );
  }

  // Reason: a funded seat costs the player nothing, so without this an empty wallet joins.
  // Checked inside the transaction, before the only write, and never debited.
  const rule = resolveFreePrivateEntryRule(
    await WhiteLabel.findOne()
      .select({ freePrivateEntryPolicy: 1, freePrivateMinEntryBalance: 1 })
      .session(session)
      .lean<{ freePrivateEntryPolicy?: unknown; freePrivateMinEntryBalance?: unknown }>(),
  );
  if (rule.policy !== "open") {
    const wallet = await CreditWallet.findOne({ userId: actor.userId })
      .select({ creditBalance: 1 })
      .session(session)
      .lean<{ creditBalance?: number }>();
    const refusal = freePrivateEntryRefusal(rule, Number(wallet?.creditBalance ?? 0));
    if (refusal) return fail("free_private_min_balance", refusal);
  }

  const terms = await verifyFreePrivateTermsAcceptance(
    { userId: actor.userId, competitionId, gameMasterId },
    session,
  );
  if (!terms.ok) return fail(terms.code, terms.message);

  const db = mongoose.connection.db;
  if (!db) throw new Error("Free private entry: database not connected");
  const sponsored = await sponsorFreePrivateSeat(
    db,
    {
      competitionId,
      competitionName: competition.name,
      userId: actor.userId,
      entryFee: Number(competition.entryFee),
    },
    session,
  );
  if (!sponsored.ok) return fail("free_private_exhausted", sponsored.message);
  return null;
}
