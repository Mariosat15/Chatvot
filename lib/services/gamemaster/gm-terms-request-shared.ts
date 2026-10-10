/**
 * Helpers shared by every Game Master terms flow - the "Send T&C" request
 * (`gm-terms-request.service.ts`), the claim reminder (`referral-claim-reminder.service.ts`) and
 * the one consent answer (`affiliate-consent.service.ts`). Extracted rather than copied, so an
 * audit row or an account-manager alert has one shape whichever door the player came through.
 */

import mongoose from "mongoose";
import Notification from "@/database/models/notification.model";
import { AFFILIATE_TERMS_TEMPLATE_IDS } from "@/lib/utils/notification-events";

export const GENERIC_ERROR = "Something went wrong. Please contact support.";

export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

export interface Actor {
  id: string;
  email?: string;
  name?: string;
}

export function isObjectIdString(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{24}$/i.test(value);
}

/** Best-effort - an audit write must never undo or block the action it describes. */
export async function writeAudit(input: {
  customer: Actor;
  performer: Actor & { type: "user" | "admin" };
  action: string;
  description: string;
  metadata: Record<string, unknown>;
  meta?: RequestMeta;
}): Promise<void> {
  try {
    const db = mongoose.connection.db;
    if (!db) return;
    const now = new Date();
    await db.collection("customer_audit_trail").insertOne({
      customerId: input.customer.id,
      customerEmail: input.customer.email ?? "",
      customerName: input.customer.name ?? "",
      action: input.action,
      actionCategory: "assignment",
      description: input.description,
      performedBy: {
        type: input.performer.type,
        id: input.performer.id,
        email: input.performer.email ?? "",
        name: input.performer.name ?? "",
      },
      metadata: input.metadata,
      timestamp: now,
      ipAddress: input.meta?.ipAddress ?? "",
      userAgent: input.meta?.userAgent ?? "",
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    console.warn("⚠️ gm-terms: audit write failed", error);
  }
}

/**
 * The player's account manager, if they have one, hears about the answer in the admin bell.
 * Best-effort, raw insert in the shape `customer-assignment/auto-assign` already writes.
 */
export async function notifyAccountManager(input: {
  userId: string;
  playerName: string;
  playerEmail: string;
  gameMasterName: string;
  status: "accepted" | "declined";
}): Promise<void> {
  try {
    const db = mongoose.connection.db;
    if (!db) return;
    const assignment = await db
      .collection("customer_assignments")
      .findOne({ customerId: input.userId, isActive: true }, { projection: { employeeId: 1 } });
    const employeeId = assignment?.employeeId;
    if (!isObjectIdString(String(employeeId ?? ""))) return;
    const now = new Date();
    await db.collection("employee_notifications").insertOne({
      employeeId: new mongoose.Types.ObjectId(String(employeeId)),
      type: "system_message",
      title: `📜 Game Master terms ${input.status}`,
      message: `${input.playerName || input.playerEmail} ${input.status} the Game Master terms sent by ${input.gameMasterName}.`,
      metadata: {
        customerId: input.userId,
        customerEmail: input.playerEmail,
        customerName: input.playerName,
        gameMasterName: input.gameMasterName,
        termsRequestStatus: input.status,
      },
      isRead: false,
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    console.warn("⚠️ gm-terms: account manager notification failed", error);
  }
}

/** Best-effort: the answer is already recorded, a stale bell row must not turn it into an error. */
export async function resolveTermsReminderNotifications(userId: string): Promise<void> {
  try {
    await Notification.updateMany(
      // Reason: answering marks every reminder read, so the bell never keeps a CTA for a
      // question already answered.
      { userId, templateId: { $in: AFFILIATE_TERMS_TEMPLATE_IDS }, isRead: false },
      { $set: { isRead: true, readAt: new Date() } },
    );
  } catch (error) {
    console.warn("⚠️ gm-terms: could not resolve the terms reminder notifications", error);
  }
}

/** MongoDB's duplicate-key error - the unique index decided a race. */
export function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === 11000;
}
