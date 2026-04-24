/**
 * Synthetic Nuvei DMN payload builder for the attack-test suite.
 *
 * Why: the suite proves our Nuvei webhook rejects forged payloads and is
 * idempotent on replay. We can't use the real Nuvei sandbox for this
 * deterministically, so we craft payloads that the real webhook handler
 * parses exactly like genuine DMNs — same field names, same checksum formula,
 * same form-urlencoded format.
 *
 * Checksum format (from app/api/nuvei/webhook/route.ts::verifyDmnSignature):
 *   SHA256(secret_key + totalAmount + currency + responseTimeStamp
 *          + PPP_TransactionID + Status + productId)
 *
 * The `signatureMode` selector lets scenarios pick:
 *   - "valid"   → checksum computed with the real secret
 *   - "invalid" → random 64-hex string (guaranteed NOT to match)
 *   - "missing" → omit advanceResponseChecksum entirely
 */

import crypto from "crypto";
import PaymentProvider from "@/database/models/payment-provider.model";

export type SignatureMode = "valid" | "invalid" | "missing";

export interface CraftedDmn {
  body: string; // application/x-www-form-urlencoded body
  params: Record<string, string>;
  signatureMode: SignatureMode;
  expectedApprove: boolean;
}

export interface CraftDmnOptions {
  pppTransactionId: string;
  clientUniqueId: string; // must match WalletTransaction.metadata.clientUniqueId
  userId: string;
  amount: number;
  currency?: string;
  status: "APPROVED" | "DECLINED" | "ERROR";
  errCode?: number;
  signatureMode: SignatureMode;
  // Optional override; normally resolved from DB/env at runtime.
  secretKeyOverride?: string;
}

/**
 * Locate the Nuvei secret the webhook handler will use to verify signatures.
 * Mirrors the lookup order in app/api/nuvei/webhook/route.ts so our crafted
 * payloads sign with the exact same key the verifier uses.
 */
export async function resolveNuveiSecret(): Promise<string | null> {
  try {
    const provider = await PaymentProvider.findOne({
      slug: "nuvei",
      isActive: true,
    }).lean();
    const raw = provider as unknown as
      | { credentials?: Array<{ key?: unknown; value?: unknown }> }
      | null;
    if (raw && Array.isArray(raw.credentials)) {
      const match = raw.credentials.find((c) => c?.key === "secret_key");
      if (match && typeof match.value === "string" && match.value.length > 0) {
        return match.value;
      }
    }
  } catch {
    // Fall through to env lookup
  }
  return process.env.NUVEI_SECRET_KEY || null;
}

function computeAdvanceChecksum(
  secret: string,
  params: Record<string, string>,
): string {
  const totalAmount = params.totalAmount || params.amount || "";
  const currency = params.currency || "";
  const responseTimeStamp = params.responseTimeStamp || "";
  const pppTransactionId = params.PPP_TransactionID || "";
  const status = params.Status || params.ppp_status || "";
  const productId = params.productId || "";
  const data = `${secret}${totalAmount}${currency}${responseTimeStamp}${pppTransactionId}${status}${productId}`;
  return crypto.createHash("sha256").update(data).digest("hex");
}

function randomInvalidChecksum(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Build a DMN payload. If `signatureMode` is "valid" and the secret cannot be
 * located, throws — we never want the suite to accidentally skip HMAC checks.
 */
export async function craftNuveiDmn(
  opts: CraftDmnOptions,
): Promise<CraftedDmn> {
  const responseTimeStamp = new Date()
    .toISOString()
    .replace(/[^0-9]/g, "")
    .slice(0, 14); // YYYYMMDDHHMMSS, matches Nuvei format

  const base: Record<string, string> = {
    ppp_status: opts.status,
    Status: opts.status,
    ErrCode: String(opts.errCode ?? (opts.status === "APPROVED" ? 0 : 1001)),
    ExErrCode: "0",
    PPP_TransactionID: opts.pppTransactionId,
    TransactionID: opts.pppTransactionId,
    transactionId: opts.pppTransactionId,
    clientUniqueId: opts.clientUniqueId,
    merchant_unique_id: opts.clientUniqueId,
    userid: opts.userId,
    currency: opts.currency ?? "EUR",
    totalAmount: opts.amount.toFixed(2),
    amount: opts.amount.toFixed(2),
    transactionType: "Sale",
    responseTimeStamp,
    productId: "",
    // Synthetic card fields so the fraud-fingerprint branch is exercised.
    cardCompany: "VISA",
    cardNumber: "****4242",
    expMonth: "12",
    expYear: "2030",
    uniqueCC: `sim-uniqueCC-${opts.userId}`,
  };

  if (opts.signatureMode === "valid") {
    const secret =
      opts.secretKeyOverride ?? (await resolveNuveiSecret());
    if (!secret) {
      throw new Error(
        "Cannot craft valid-signature DMN: Nuvei secret not configured",
      );
    }
    base.advanceResponseChecksum = computeAdvanceChecksum(secret, base);
  } else if (opts.signatureMode === "invalid") {
    base.advanceResponseChecksum = randomInvalidChecksum();
  }
  // "missing" => leave advanceResponseChecksum undefined

  const body = new URLSearchParams(base).toString();

  return {
    body,
    params: base,
    signatureMode: opts.signatureMode,
    expectedApprove:
      opts.status === "APPROVED" && opts.signatureMode === "valid",
  };
}

/**
 * Post a crafted DMN to the real Nuvei webhook. Returns the webhook's response
 * body so the scenario can assert how the handler reacted (e.g., "Signature
 * verification failed" vs "Already processed").
 */
export async function postCraftedDmn(
  baseUrl: string,
  crafted: CraftedDmn,
): Promise<{
  status: number;
  body: unknown;
  text: string;
}> {
  const res = await fetch(`${baseUrl}/api/nuvei/webhook`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      // Mark as internal loopback for any upstream IP-gated middleware; the
      // Nuvei webhook itself doesn't gate on IP but keeping this consistent
      // with the attack-suite posture makes tracing obvious in logs.
      "x-forwarded-for": "127.0.0.1",
    },
    body: crafted.body,
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // Non-JSON response is fine
  }
  return { status: res.status, body, text };
}
