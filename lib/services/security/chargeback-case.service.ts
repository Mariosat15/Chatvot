/**
 * Chargeback case orchestration.
 *
 * All state transitions go through this service so the Chargeback document,
 * the UserRestriction, the WalletTransaction status, the user wallet
 * balance and the PlatformTransaction ledger stay in sync.
 *
 * The heavier transactional writers live in sibling files to keep this one
 * focused and under the 500-line limit:
 *
 *   - chargeback-case.writers.ts  → completeChargeback, resolveWithoutClawback
 *   - chargeback-evidence.service.ts → buildDefensePacket
 *
 * Error-handling contract: this service THROWS on invalid input / unknown
 * case / illegal state transition. API routes catch and shape the response.
 */

// Reason: relative imports so the same service resolves correctly from both
// the main Next.js app and the `apps/admin` app (different `@/` aliases).
import { connectToDatabase } from "../../../database/mongoose";
import Chargeback, {
  IChargeback,
  IChargebackActor,
} from "../../../database/models/chargeback.model";
import UserRestriction from "../../../database/models/user-restriction.model";
import AuditLog from "../../../database/models/audit-log.model";
import { buildDefensePacket } from "./chargeback-evidence.service";
import {
  completeChargeback as _completeChargeback,
  resolveWithoutClawback,
  type CompleteChargebackInput,
  type ResolveNotesInput,
} from "./chargeback-case.writers";

export type { IChargeback } from "../../../database/models/chargeback.model";
export type {
  CompleteChargebackInput,
  ResolveNotesInput,
} from "./chargeback-case.writers";

// ---------- Inputs ----------

export interface EnsureChargebackCaseInput {
  provider: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  walletTransactionId?: string;
  providerTransactionId?: string;
  chargebackCaseId?: string;
  reasonCode?: string;
  amount: number;
  currency?: string;
  restrictionId?: string;
  securityAlertId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- free-form integration metadata
  metadata?: Record<string, any>;
}

// ---------- helpers ----------

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

// ---------- ensureChargebackCase ----------

/**
 * Create (or return existing) Chargeback case for a given PSP transaction.
 * Idempotent on (provider, providerTransactionId) / (walletTransactionId) /
 * (provider, chargebackCaseId). Used by the PSP webhook handler and by
 * the admin "manual create" API.
 */
export async function ensureChargebackCase(
  input: EnsureChargebackCaseInput,
): Promise<IChargeback> {
  await connectToDatabase();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic $or shape
  const orClauses: Record<string, any>[] = [];
  if (input.walletTransactionId) {
    orClauses.push({ walletTransactionId: input.walletTransactionId });
  }
  if (input.providerTransactionId) {
    orClauses.push({
      provider: input.provider,
      providerTransactionId: input.providerTransactionId,
    });
  }
  if (input.chargebackCaseId) {
    orClauses.push({
      provider: input.provider,
      chargebackCaseId: input.chargebackCaseId,
    });
  }

  let existing: IChargeback | null = null;
  if (orClauses.length > 0) {
    existing = await Chargeback.findOne({ $or: orClauses });
  }

  if (existing) {
    const patch: Partial<IChargeback> = {};
    if (!existing.providerTransactionId && input.providerTransactionId) {
      patch.providerTransactionId = input.providerTransactionId;
    }
    if (!existing.chargebackCaseId && input.chargebackCaseId) {
      patch.chargebackCaseId = input.chargebackCaseId;
    }
    if (!existing.restrictionId && input.restrictionId) {
      patch.restrictionId = input.restrictionId;
    }
    if (!existing.securityAlertId && input.securityAlertId) {
      patch.securityAlertId = input.securityAlertId;
    }
    if (Object.keys(patch).length > 0) {
      Object.assign(existing, patch);
      await existing.save();
    }
    return existing;
  }

  const created = await Chargeback.create({
    userId: input.userId,
    userEmail: input.userEmail,
    userName: input.userName,
    walletTransactionId: input.walletTransactionId,
    providerTransactionId: input.providerTransactionId,
    provider: input.provider,
    chargebackCaseId: input.chargebackCaseId,
    reasonCode: input.reasonCode,
    amount: input.amount,
    currency: input.currency || "EUR",
    status: "pending_review",
    receivedAt: new Date(),
    restrictionId: input.restrictionId,
    securityAlertId: input.securityAlertId,
    clawback: {
      userWallet: { applied: false },
      platformBank: { applied: false },
    },
    timeline: [
      {
        at: new Date(),
        actorName: "system",
        action: "case_received",
        notes: input.reasonCode
          ? `Provider reason: ${input.reasonCode}`
          : undefined,
      },
    ],
    metadata: input.metadata,
  });

  await safeAudit({
    userId: "system",
    userName: "system",
    userEmail: "system@chartvolt",
    userRole: "system",
    action: "chargeback_received",
    actionCategory: "security",
    description: `Chargeback case opened for user ${input.userId} (${input.provider}, ${input.amount} ${input.currency || "EUR"})`,
    targetType: "user",
    targetId: input.userId,
    metadata: {
      chargebackId: String(created._id),
      provider: input.provider,
      reasonCode: input.reasonCode,
      amount: input.amount,
    },
    status: "success",
  });

  return created;
}

// ---------- initiateChargeback ----------

/**
 * Admin starts the defense process:
 *  - ensure payment_fraud UserRestriction (idempotent, all actions blocked)
 *  - freeze the defense packet (evidenceSnapshot)
 *  - status: pending_review -> initiated
 */
export async function initiateChargeback(
  caseId: string,
  admin: IChargebackActor,
): Promise<IChargeback> {
  await connectToDatabase();

  const c = await Chargeback.findById(caseId);
  if (!c) throw new Error(`Chargeback ${caseId} not found`);
  if (c.status !== "pending_review") {
    throw new Error(
      `Chargeback ${caseId} cannot be initiated from status "${c.status}"`,
    );
  }

  const existingR = await UserRestriction.findOne({
    userId: c.userId,
    isActive: true,
    reason: "payment_fraud",
  }).lean<{ _id: unknown } | null>();

  let restrictionId: string | undefined;
  if (existingR && existingR._id) {
    await UserRestriction.updateOne(
      { _id: existingR._id },
      {
        $set: {
          restrictionType: "banned",
          canTrade: false,
          canEnterCompetitions: false,
          canDeposit: false,
          canWithdraw: false,
          hideFromPublic: true,
          customReason:
            `Chargeback defense in progress (case ${c._id})` +
            (c.reasonCode ? ` — code=${c.reasonCode}` : ""),
        },
      },
    );
    restrictionId = String(existingR._id);
  } else {
    const created = await UserRestriction.create({
      userId: c.userId,
      restrictionType: "banned",
      reason: "payment_fraud",
      customReason:
        `Chargeback defense in progress (case ${c._id})` +
        (c.reasonCode ? ` — code=${c.reasonCode}` : ""),
      canTrade: false,
      canEnterCompetitions: false,
      canDeposit: false,
      canWithdraw: false,
      hideFromPublic: true,
      restrictedBy: admin.id || "admin:chargeback-initiate",
      isActive: true,
    });
    restrictionId = String(created._id);
  }

  // Reason: evidence must not block the state transition — an admin can
  // still initiate and act even if upstream sources (KYC, UserPresence)
  // are degraded. The packet builder is internally resilient.
  let evidence: Awaited<ReturnType<typeof buildDefensePacket>> | undefined;
  try {
    evidence = await buildDefensePacket({
      userId: c.userId,
      walletTransactionId: c.walletTransactionId,
      chargeback: {
        id: String(c._id),
        provider: c.provider,
        providerTransactionId: c.providerTransactionId,
        chargebackCaseId: c.chargebackCaseId,
        reasonCode: c.reasonCode,
        amount: c.amount,
        currency: c.currency,
        receivedAt: c.receivedAt,
      },
    });
  } catch (err) {
    console.error("⚠️ [chargeback] buildDefensePacket failed:", err);
  }

  c.status = "initiated";
  c.initiatedAt = new Date();
  c.initiatedBy = toActor(admin);
  c.restrictionId = c.restrictionId || restrictionId;
  if (evidence) {
    c.evidenceSnapshot = evidence.snapshot;
    if (!c.narrative) c.narrative = evidence.rebuttalLetter;
  }
  c.timeline.push({
    at: new Date(),
    actorId: admin.id,
    actorName: admin.name || admin.email,
    action: "initiated",
    notes: `Admin initiated chargeback defense; user restricted (all actions)`,
  });
  await c.save();

  await safeAudit({
    userId: admin.id || "admin",
    userName: admin.name || "Admin",
    userEmail: admin.email || "admin@chartvolt",
    userRole: "admin",
    action: "chargeback_initiated",
    actionCategory: "security",
    description: `Initiated chargeback defense for user ${c.userId} (case ${String(c._id)})`,
    targetType: "user",
    targetId: c.userId,
    metadata: {
      chargebackId: String(c._id),
      provider: c.provider,
      reasonCode: c.reasonCode,
      amount: c.amount,
    },
    status: "success",
  });

  return c;
}

// ---------- markRepresented ----------

export async function markRepresented(
  caseId: string,
  admin: IChargebackActor,
  input: ResolveNotesInput = {},
): Promise<IChargeback> {
  await connectToDatabase();

  const c = await Chargeback.findById(caseId);
  if (!c) throw new Error(`Chargeback ${caseId} not found`);
  if (c.status !== "initiated") {
    throw new Error(
      `Chargeback ${caseId} cannot be marked represented from status "${c.status}"`,
    );
  }

  c.status = "represented";
  c.representedAt = new Date();
  c.timeline.push({
    at: new Date(),
    actorId: admin.id,
    actorName: admin.name || admin.email,
    action: "represented",
    notes: input.notes,
  });
  await c.save();

  await safeAudit({
    userId: admin.id || "admin",
    userName: admin.name || "Admin",
    userEmail: admin.email || "admin@chartvolt",
    userRole: "admin",
    action: "chargeback_represented",
    actionCategory: "security",
    description: `Chargeback evidence submitted (case ${String(c._id)})`,
    targetType: "user",
    targetId: c.userId,
    metadata: { chargebackId: String(c._id), notes: input.notes },
    status: "success",
  });

  return c;
}

// ---------- terminal transitions ----------

export function completeChargeback(
  caseId: string,
  admin: IChargebackActor,
  input: CompleteChargebackInput,
): Promise<IChargeback> {
  return _completeChargeback(caseId, admin, input);
}

export function markWon(
  caseId: string,
  admin: IChargebackActor,
  input: ResolveNotesInput = {},
): Promise<IChargeback> {
  return resolveWithoutClawback(caseId, admin, "won", input);
}

export function markWithdrawn(
  caseId: string,
  admin: IChargebackActor,
  input: ResolveNotesInput = {},
): Promise<IChargeback> {
  return resolveWithoutClawback(caseId, admin, "withdrawn", input);
}

// ---------- narrative + read helpers ----------

export async function updateNarrative(
  caseId: string,
  admin: IChargebackActor,
  narrative: string,
): Promise<IChargeback> {
  await connectToDatabase();
  const c = await Chargeback.findById(caseId);
  if (!c) throw new Error(`Chargeback ${caseId} not found`);
  c.narrative = narrative;
  c.timeline.push({
    at: new Date(),
    actorId: admin.id,
    actorName: admin.name || admin.email,
    action: "narrative_updated",
  });
  await c.save();

  await safeAudit({
    userId: admin.id || "admin",
    userName: admin.name || "Admin",
    userEmail: admin.email || "admin@chartvolt",
    userRole: "admin",
    action: "chargeback_narrative_updated",
    actionCategory: "security",
    description: `Chargeback rebuttal narrative updated (case ${String(c._id)})`,
    targetType: "user",
    targetId: c.userId,
    metadata: { chargebackId: String(c._id) },
    status: "success",
  });

  return c;
}

export async function getChargebackById(
  id: string,
): Promise<IChargeback | null> {
  await connectToDatabase();
  return Chargeback.findById(id);
}

export async function listChargebacksForUser(
  userId: string,
): Promise<IChargeback[]> {
  await connectToDatabase();
  return Chargeback.find({ userId }).sort({ createdAt: -1 });
}

export interface ChargebackQueueFilters {
  status?: IChargeback["status"];
  limit?: number;
  offset?: number;
}

export async function listChargebackQueue(
  filters: ChargebackQueueFilters = {},
): Promise<{ items: IChargeback[]; total: number }> {
  await connectToDatabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic mongoose filter
  const q: Record<string, any> = {};
  if (filters.status) q.status = filters.status;
  const total = await Chargeback.countDocuments(q);
  const items = await Chargeback.find(q)
    .sort({ createdAt: -1 })
    .skip(filters.offset || 0)
    .limit(Math.min(filters.limit || 50, 200));
  return { items, total };
}

export async function hasOpenChargebackCase(
  userId: string,
): Promise<string | null> {
  await connectToDatabase();
  const c = await Chargeback.findOne({
    userId,
    status: { $nin: ["won", "lost", "withdrawn"] },
  })
    .sort({ createdAt: -1 })
    .lean<{ _id: unknown } | null>();
  return c && c._id ? String(c._id) : null;
}
