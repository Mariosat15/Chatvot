/**
 * Internal writers for chargeback-case.service.
 *
 * - completeChargeback (status: lost; transactional clawback across
 *   WalletTransaction + CreditWallet + PlatformTransaction + Chargeback)
 * - resolveWithoutClawback (status: won | withdrawn; reverses side-effects)
 *
 * Kept in a sibling file so the main service stays under the 500-line cap.
 */

import mongoose from "mongoose";
import { connectToDatabase } from "../../../database/mongoose";
import Chargeback, {
  IChargeback,
  IChargebackActor,
} from "../../../database/models/chargeback.model";
import UserRestriction from "../../../database/models/user-restriction.model";
import WalletTransaction from "../../../database/models/trading/wallet-transaction.model";
import CreditWallet from "../../../database/models/trading/credit-wallet.model";
import { PlatformTransaction } from "../../../database/models/platform-financials.model";
import AuditLog from "../../../database/models/audit-log.model";
import { invalidateLeaderboardCache } from "../leaderboard-cache.invalidator";

export interface CompleteChargebackInput {
  userWallet?: { amount: number };
  platformBank?: { amount: number };
  notes?: string;
}

export interface ResolveNotesInput {
  notes?: string;
}

const TERMINAL_STATUSES: ReadonlySet<IChargeback["status"]> = new Set([
  "won",
  "lost",
  "withdrawn",
]);

function assertNonTerminal(c: IChargeback): void {
  if (TERMINAL_STATUSES.has(c.status)) {
    throw new Error(
      `Chargeback ${c._id} is already resolved (${c.status}); further actions are not allowed.`,
    );
  }
}

function toActor(admin: IChargebackActor | undefined): IChargebackActor {
  return { id: admin?.id, name: admin?.name, email: admin?.email };
}

async function safeAudit(
  args: Parameters<typeof AuditLog.logAction>[0],
): Promise<void> {
  try {
    await AuditLog.logAction(args);
  } catch (err) {
    console.error("⚠️ [chargeback] AuditLog.logAction failed:", err);
  }
}

/**
 * Apply clawback(s) and close the case as "lost".
 * At least one of userWallet or platformBank must be present.
 * Writes are wrapped in a Mongo session where available.
 */
export async function completeChargeback(
  caseId: string,
  admin: IChargebackActor,
  input: CompleteChargebackInput,
): Promise<IChargeback> {
  await connectToDatabase();

  if (!input.userWallet && !input.platformBank) {
    throw new Error(
      "completeChargeback requires at least one of userWallet or platformBank",
    );
  }
  if (input.userWallet && !(input.userWallet.amount > 0)) {
    throw new Error("userWallet.amount must be positive");
  }
  if (input.platformBank && !(input.platformBank.amount > 0)) {
    throw new Error("platformBank.amount must be positive");
  }

  const c = await Chargeback.findById(caseId);
  if (!c) throw new Error(`Chargeback ${caseId} not found`);
  assertNonTerminal(c);
  if (c.status !== "initiated" && c.status !== "represented") {
    throw new Error(
      `Chargeback ${caseId} cannot be completed from status "${c.status}"`,
    );
  }

  const now = new Date();
  const actorId = admin.id || "admin";
  const actorName = admin.name || admin.email || "Admin";

  let session: mongoose.ClientSession | null = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
  } catch {
    session = null;
  }

  const run = async () => {
    if (input.userWallet) {
      const wallet = await CreditWallet.findOne({ userId: c.userId }).session(
        session,
      );
      if (!wallet) {
        throw new Error(
          `CreditWallet not found for user ${c.userId} — cannot apply clawback`,
        );
      }

      const amount = input.userWallet.amount;
      const balanceBefore = wallet.creditBalance;
      // Reason: allow wallet to go negative in accounting, clamp to 0 on
      // the user-visible balance — admin can true-up via admin_adjustment.
      const balanceAfter = balanceBefore - amount;

      const [tx] = await WalletTransaction.create(
        [
          {
            userId: c.userId,
            transactionType: "chargeback_clawback",
            amount: -amount,
            balanceBefore,
            balanceAfter: Math.max(0, balanceAfter),
            currency: c.currency,
            exchangeRate: 1,
            status: "completed",
            provider: c.provider,
            providerTransactionId: c.providerTransactionId,
            description: `Chargeback clawback (case ${String(c._id)})`,
            metadata: {
              chargebackId: String(c._id),
              chargebackCaseId: c.chargebackCaseId,
              reasonCode: c.reasonCode,
              originalWalletTransactionId: c.walletTransactionId,
            },
            processedAt: now,
          },
        ],
        { session: session || undefined },
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mongoose doc shape
      (wallet as any).creditBalance = Math.max(0, balanceAfter);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (wallet as any).totalRefunded = (wallet.totalRefunded || 0) + amount;
      await wallet.save({ session: session || undefined });

      c.clawback.userWallet = {
        applied: true,
        amount,
        transactionId: String(tx._id),
        appliedAt: now,
        appliedBy: actorId,
        appliedByName: actorName,
      };
    }

    if (input.platformBank) {
      const amount = input.platformBank.amount;
      const [pt] = await PlatformTransaction.create(
        [
          {
            transactionType: "chargeback_loss",
            amount: -amount,
            amountEUR: -amount,
            sourceType: "user_deposit",
            sourceId: c.walletTransactionId || String(c._id),
            sourceName:
              c.userEmail || c.userName || `user:${c.userId}`,
            userId: c.userId,
            description: `Chargeback loss — ${c.provider} case ${c.chargebackCaseId || String(c._id)}${c.reasonCode ? ` (${c.reasonCode})` : ""}`,
            notes: input.notes,
            processedBy: actorId,
            processedByEmail: admin.email,
          },
        ],
        { session: session || undefined },
      );

      c.clawback.platformBank = {
        applied: true,
        amount,
        transactionId: String(pt._id),
        appliedAt: now,
        appliedBy: actorId,
        appliedByName: actorName,
      };
    }

    c.status = "lost";
    c.outcome = "lost";
    c.resolvedAt = now;
    c.resolvedBy = toActor(admin);
    c.timeline.push({
      at: now,
      actorId: admin.id,
      actorName: actorName,
      action: "completed_lost",
      notes: [
        input.userWallet
          ? `wallet clawback: ${input.userWallet.amount}`
          : undefined,
        input.platformBank
          ? `bank loss: ${input.platformBank.amount}`
          : undefined,
        input.notes,
      ]
        .filter(Boolean)
        .join(" | "),
    });
    await c.save({ session: session || undefined });
  };

  try {
    await run();
    if (session) await session.commitTransaction();
  } catch (err) {
    if (session) {
      try {
        await session.abortTransaction();
      } catch {
        // ignore
      }
    }
    throw err;
  } finally {
    if (session) session.endSession();
  }

  await safeAudit({
    userId: admin.id || "admin",
    userName: admin.name || "Admin",
    userEmail: admin.email || "admin@chartvolt",
    userRole: "admin",
    action: "chargeback_completed",
    actionCategory: "financial",
    description: `Chargeback marked LOST (case ${String(c._id)}); wallet=${input.userWallet?.amount || 0}, bank=${input.platformBank?.amount || 0}`,
    targetType: "user",
    targetId: c.userId,
    metadata: {
      chargebackId: String(c._id),
      userWalletAmount: input.userWallet?.amount,
      platformBankAmount: input.platformBank?.amount,
      notes: input.notes,
    },
    status: "success",
  });

  return c;
}

/**
 * Close the case as "won" or "withdrawn":
 *  - flip disputed WalletTransaction back to completed
 *  - lift payment_fraud restriction that was created for this case
 *  - record outcome + timeline + audit log
 */
export async function resolveWithoutClawback(
  caseId: string,
  admin: IChargebackActor,
  outcome: "won" | "withdrawn",
  input: ResolveNotesInput,
): Promise<IChargeback> {
  await connectToDatabase();

  const c = await Chargeback.findById(caseId);
  if (!c) throw new Error(`Chargeback ${caseId} not found`);
  assertNonTerminal(c);
  if (c.status === "pending_review") {
    throw new Error(
      `Chargeback ${caseId} must be initiated before it can be marked ${outcome}`,
    );
  }

  const now = new Date();

  if (c.walletTransactionId) {
    try {
      await WalletTransaction.updateOne(
        { _id: c.walletTransactionId, status: "disputed" },
        {
          $set: {
            status: "completed",
            "metadata.chargebackResolvedAs": outcome,
            "metadata.chargebackResolvedAt": now,
          },
        },
      );
    } catch (err) {
      console.error(
        "⚠️ [chargeback] failed to restore WalletTransaction status:",
        err,
      );
    }
  }

  // Reason: only auto-lift the restriction that we set (tracked via
  // c.restrictionId). Admin-created restrictions unrelated to this case
  // are left untouched.
  let liftedHiddenRestriction = false;
  if (c.restrictionId) {
    try {
      const lifted = await UserRestriction.findOneAndUpdate(
        { _id: c.restrictionId, isActive: true },
        {
          $set: {
            isActive: false,
            unrestrictedAt: now,
            unrestrictedBy: admin.id || "admin:chargeback-resolve",
          },
        },
        { new: false },
      );
      // Reason: if the lifted restriction had hideFromPublic=true, we need
      // to bust the leaderboard cache so the user reappears immediately;
      // otherwise they linger hidden for up to 5 minutes.
      if (lifted && lifted.hideFromPublic) {
        liftedHiddenRestriction = true;
      }
    } catch (err) {
      console.error("⚠️ [chargeback] failed to lift UserRestriction:", err);
    }
  }

  c.status = outcome;
  c.outcome = outcome;
  c.resolvedAt = now;
  c.resolvedBy = toActor(admin);
  c.timeline.push({
    at: now,
    actorId: admin.id,
    actorName: admin.name || admin.email,
    action: outcome === "won" ? "marked_won" : "marked_withdrawn",
    notes: input.notes,
  });
  await c.save();

  await safeAudit({
    userId: admin.id || "admin",
    userName: admin.name || "Admin",
    userEmail: admin.email || "admin@chartvolt",
    userRole: "admin",
    action: outcome === "won" ? "chargeback_won" : "chargeback_withdrawn",
    actionCategory: "security",
    description: `Chargeback marked ${outcome.toUpperCase()} (case ${String(c._id)})`,
    targetType: "user",
    targetId: c.userId,
    metadata: { chargebackId: String(c._id), notes: input.notes },
    status: "success",
  });

  if (liftedHiddenRestriction) {
    void invalidateLeaderboardCache();
  }

  return c;
}
