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
// Reason: relative import for dual-app (main + admin) resolution.
import PaymentProvider from "../../../../database/models/payment-provider.model";

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
  // "Sale" (default), "Chargeback", "Reversal", etc. Enables the chargeback
  // scenario to exercise the chargeback branch of the Nuvei webhook.
  transactionType?: string;
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
    transactionType: opts.transactionType ?? "Sale",
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

// ─── Atlas callback crafting ─────────────────────────────────────────────────
//
// Atlas posts JSON status-change callbacks with header:
//   X-Signature = SHA-512(ClientId + rawBody + ClientSecret)
// (see app/api/atlas/webhook/route.ts + payment.md §6). These helpers craft
// callbacks the real Atlas webhook handler parses identically to genuine ones.

export interface CraftedAtlasCallback {
  body: string; // application/json body
  signature?: string; // omitted entirely when signatureMode === "missing"
  signatureMode: SignatureMode;
  expectedComplete: boolean;
}

export interface CraftAtlasOptions {
  paymentId: string;
  /** Echoed correlation token — must equal `txn_<WalletTransaction._id>`. */
  additionalData: string;
  userId: string;
  amount: number;
  currency?: string;
  /** -1 DECLINED, 0 NEW, 1 PROCESSING, 2 COMPLETED. */
  statusCode: number;
  signatureMode: SignatureMode;
  /** Optional overrides; normally resolved from DB/env at runtime. */
  clientIdOverride?: string;
  clientSecretOverride?: string;
}

/**
 * Locate the Atlas ClientId + ClientSecret the webhook handler verifies with.
 * Mirrors atlas.service.ts::getCredentials lookup order (DB → env).
 */
export async function resolveAtlasCredentials(): Promise<{
  clientId: string;
  clientSecret: string;
} | null> {
  try {
    const provider = await PaymentProvider.findOne({
      slug: "atlas",
      isActive: true,
    }).lean();
    const raw = provider as unknown as
      | { credentials?: Array<{ key?: unknown; value?: unknown }> }
      | null;
    if (raw && Array.isArray(raw.credentials)) {
      const get = (key: string): string | undefined => {
        const match = raw.credentials!.find((c) => c?.key === key);
        return match && typeof match.value === "string" ? match.value : undefined;
      };
      const clientId = get("client_id");
      const clientSecret = get("client_secret");
      if (clientId && clientSecret) return { clientId, clientSecret };
    }
  } catch {
    // Fall through to env lookup
  }
  const clientId = process.env.ATLAS_CLIENT_ID;
  const clientSecret = process.env.ATLAS_CLIENT_SECRET;
  if (clientId && clientSecret) return { clientId, clientSecret };
  return null;
}

function computeAtlasSignature(
  clientId: string,
  rawBody: string,
  clientSecret: string,
): string {
  return crypto
    .createHash("sha512")
    .update(`${clientId}${rawBody}${clientSecret}`)
    .digest("hex");
}

/**
 * Build an Atlas callback payload. For "valid" mode the secret must be
 * resolvable — we throw otherwise so the suite never silently skips the check.
 */
export async function craftAtlasCallback(
  opts: CraftAtlasOptions,
): Promise<CraftedAtlasCallback> {
  const data = {
    user_id: opts.userId,
    sender: "sim-attack",
    payment_id: opts.paymentId,
    amount: opts.amount,
    currency: opts.currency ?? "EUR",
    message: "Attack-suite synthetic callback",
    date: new Date().toISOString(),
    recurring: false,
    commission_included: true,
    additional_data: opts.additionalData,
    transaction_id: `sim-atlas-tx-${opts.paymentId}`,
    transaction_status_code: opts.statusCode,
    transaction_status_text:
      opts.statusCode === 2
        ? "COMPLETED"
        : opts.statusCode === -1
          ? "DECLINED"
          : "PROCESSING",
    transaction_status_data: opts.statusCode === -1 ? "simulated decline" : "",
    payment_method_id: "sim-method",
    payment_method_name: "VISA",
    payment_method_data: "411111******1111",
    payer_ip: "127.0.0.1",
    payer_country: "GB",
    payer_email: `${opts.userId}@test.simulator`,
  };

  const body = JSON.stringify({ data });

  let signature: string | undefined;
  if (opts.signatureMode === "valid") {
    let clientId = opts.clientIdOverride;
    let clientSecret = opts.clientSecretOverride;
    if (!clientId || !clientSecret) {
      const creds = await resolveAtlasCredentials();
      if (!creds) {
        throw new Error(
          "Cannot craft valid-signature Atlas callback: credentials not configured",
        );
      }
      clientId = creds.clientId;
      clientSecret = creds.clientSecret;
    }
    signature = computeAtlasSignature(clientId, body, clientSecret);
  } else if (opts.signatureMode === "invalid") {
    signature = crypto.randomBytes(64).toString("hex");
  }
  // "missing" → leave signature undefined

  return {
    body,
    signature,
    signatureMode: opts.signatureMode,
    expectedComplete:
      opts.statusCode === 2 && opts.signatureMode === "valid",
  };
}

/**
 * Post a crafted Atlas callback to the real Atlas webhook. Returns the
 * webhook's response so scenarios can assert how the handler reacted.
 */
export async function postCraftedAtlasCallback(
  baseUrl: string,
  crafted: CraftedAtlasCallback,
): Promise<{ status: number; body: unknown; text: string }> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-forwarded-for": "127.0.0.1",
  };
  if (crafted.signature) headers["x-signature"] = crafted.signature;

  const res = await fetch(`${baseUrl}/api/atlas/webhook`, {
    method: "POST",
    headers,
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
