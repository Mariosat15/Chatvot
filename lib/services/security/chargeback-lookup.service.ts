/**
 * Chargeback deposit lookup.
 *
 * Given a PSP provider transaction ID, resolve the original deposit record
 * and all identity / payment-method facts needed to both:
 *   - Pre-fill the admin "Create chargeback case" form (so the admin only
 *     has to enter the reason code)
 *   - Feed the defense packet with card details, client IP and geo
 *
 * All sources are wrapped so a missing upstream collection never throws.
 */

import mongoose from "mongoose";
import { connectToDatabase } from "../../../database/mongoose";
import WalletTransaction from "../../../database/models/trading/wallet-transaction.model";

export interface DepositLookupResult {
  found: boolean;
  walletTransactionId?: string;
  provider?: string;
  providerTransactionId?: string;
  status?: string;
  processedAt?: Date | null;
  createdAt?: Date;

  amount?: number;
  currency?: string;

  userId?: string;
  userEmail?: string;
  userName?: string;

  paymentMethod?: string;
  cardBrand?: string;
  cardLast4?: string;
  uniqueCC?: string;
  userPaymentOptionId?: string;

  clientIp?: string;
  clientCountry?: string;
  clientCity?: string;
  clientRegion?: string;
  userAgent?: string;

  // Reason: surfaced in the admin UI so reviewers can see at a glance
  // whether the deposit actually completed (disputed -> not yet marked
  // disputed; completed -> normal; failed -> chargeback against a failed
  // deposit which is suspicious).
  depositWasCompleted?: boolean;
}

function asString(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v);
  return s.length > 0 ? s : undefined;
}

/**
 * Look up a deposit by (provider, providerTransactionId). `provider` is
 * optional — if omitted we match on `providerTransactionId` alone and
 * return the first match.
 */
export async function lookupDepositForChargeback(
  providerTransactionId: string,
  provider?: string,
): Promise<DepositLookupResult> {
  await connectToDatabase();

  const trimmedTxId = providerTransactionId.trim();
  if (!trimmedTxId) return { found: false };

  const filter: { providerTransactionId: string; provider?: string } = {
    providerTransactionId: trimmedTxId,
  };
  if (provider && provider.trim()) {
    filter.provider = provider.trim();
  }

  // Reason: mongoose lean() returns an untyped shape; we cast to a narrow
  // subset of the WalletTransaction fields we actually read.
  type LeanTx = {
    _id: unknown;
    userId?: string;
    provider?: string;
    providerTransactionId?: string;
    status?: string;
    amount?: number;
    currency?: string;
    paymentMethod?: string;
    processedAt?: Date;
    createdAt?: Date;
    metadata?: Record<string, unknown>;
  };
  const tx = (await WalletTransaction.findOne(filter)
    .sort({ createdAt: -1 })
    .lean()) as LeanTx | null;

  if (!tx) return { found: false };

  const md: Record<string, unknown> = (tx.metadata || {}) as Record<
    string,
    unknown
  >;

  // Card details (Nuvei): UPO is linked back to the tx via
  // `createdFromTransactionId === String(tx._id)`.
  let cardBrand: string | undefined;
  let cardLast4: string | undefined;
  let uniqueCC: string | undefined;
  let userPaymentOptionId: string | undefined = asString(md.userPaymentOptionId);
  try {
    const { default: NuveiUserPaymentOption } = await import(
      "../../../database/models/nuvei-user-payment-option.model"
    );
    type LeanUpo = {
      cardBrand?: string;
      cardLast4?: string;
      uniqueCC?: string;
      userPaymentOptionId?: string;
    };
    const txIdStr = String(tx._id);
    const upo = (await NuveiUserPaymentOption.findOne({
      createdFromTransactionId: txIdStr,
    }).lean()) as LeanUpo | null;
    if (upo) {
      cardBrand = asString(upo.cardBrand);
      cardLast4 = asString(upo.cardLast4);
      uniqueCC = asString(upo.uniqueCC);
      userPaymentOptionId =
        userPaymentOptionId || asString(upo.userPaymentOptionId);
    }
    // Fallback: some UPOs are keyed by `userPaymentOptionId` stored in the
    // transaction metadata only.
    if (!cardBrand && userPaymentOptionId && tx.userId) {
      const upoByRef = (await NuveiUserPaymentOption.findOne({
        userId: tx.userId,
        userPaymentOptionId,
      }).lean()) as LeanUpo | null;
      if (upoByRef) {
        cardBrand = cardBrand || asString(upoByRef.cardBrand);
        cardLast4 = cardLast4 || asString(upoByRef.cardLast4);
        uniqueCC = uniqueCC || asString(upoByRef.uniqueCC);
      }
    }
  } catch (err) {
    console.warn("⚠️ [chargeback-lookup] UPO enrichment skipped:", err);
  }

  // User identity.
  let userEmail: string | undefined;
  let userName: string | undefined;
  try {
    const db = mongoose.connection.db;
    if (db && tx.userId) {
      const uid = String(tx.userId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const or: any[] = [{ id: uid }];
      if (/^[a-f0-9]{24}$/i.test(uid)) {
        or.push({ _id: new mongoose.Types.ObjectId(uid) });
      }
      const user = await db
        .collection("user")
        .findOne(
          { $or: or },
          { projection: { id: 1, name: 1, email: 1 } },
        );
      if (user) {
        userEmail = asString(user.email);
        userName = asString(user.name);
      }
    }
  } catch (err) {
    console.warn("⚠️ [chargeback-lookup] user enrichment skipped:", err);
  }

  return {
    found: true,
    walletTransactionId: String(tx._id),
    provider: asString(tx.provider),
    providerTransactionId: asString(tx.providerTransactionId) || trimmedTxId,
    status: asString(tx.status),
    processedAt: (tx.processedAt as Date | undefined) || null,
    createdAt: tx.createdAt as Date | undefined,

    amount: typeof tx.amount === "number" ? tx.amount : undefined,
    currency: asString(tx.currency) || "EUR",

    userId: asString(tx.userId),
    userEmail,
    userName,

    paymentMethod: asString(tx.paymentMethod),
    cardBrand,
    cardLast4,
    uniqueCC,
    userPaymentOptionId,

    clientIp: asString(md.clientIp),
    clientCountry: asString(md.clientCountry),
    clientCity: asString(md.clientCity),
    clientRegion: asString(md.clientRegion),
    userAgent: asString(md.userAgent),

    depositWasCompleted: tx.status === "completed",
  };
}
