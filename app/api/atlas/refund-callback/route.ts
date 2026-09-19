/**
 * Atlas Refund Callback (Postback) Webhook
 * Receives refund status-change notifications from Atlas.
 *
 * POST /api/atlas/refund-callback  (register this as RefundCallbackUrl with Atlas)
 *
 * Policy (option A): on a COMPLETED refund we annotate the original deposit
 * transaction with the refund details and raise an admin SecurityAlert for
 * review. We do NOT auto-deduct wallet credits here — refunding money the user
 * may have already traded is a balance/risk decision left to an admin (mirrors
 * how Paddle refunds are handled today).
 *
 * The reconciliation itself lives in the shared `applyAtlasRefundRecord` service
 * so the scheduled worker reconciler (fallback for missed callbacks) runs the
 * exact same, idempotent code path.
 *
 * Security: verify X-Signature = SHA-512(ClientId + rawBody + ClientSecret)
 * before trusting any field. Returns 200 on handled events (Atlas only marks a
 * callback delivered on 200) and 401 only on a forged signature.
 */

import { NextRequest, NextResponse } from "next/server";
import { reportWebhookSignatureFailure } from "@/lib/services/security/webhook-signature-failure";
import { atlasService, type AtlasRefundRecord } from "@/lib/services/atlas.service";
import { applyAtlasRefundRecord } from "@/lib/services/atlas-refund-reconcile.service";

interface AtlasRefundCallbackBody {
  data?: AtlasRefundRecord;
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const receivedSignature =
      req.headers.get("x-signature") || req.headers.get("X-Signature") || "";

    const credentials = await atlasService.getCredentials();
    if (!credentials) {
      console.error("❌ Atlas refund callback received but Atlas not configured");
      return NextResponse.json({ received: true });
    }

    // STEP 1: signature verification (before trusting any field).
    const valid = atlasService.verifyCallbackSignature(
      credentials.clientId,
      rawBody,
      credentials.clientSecret,
      receivedSignature,
    );
    if (!valid) {
      console.error(
        "🚨 SECURITY: Atlas refund callback signature verification failed",
      );
      return reportWebhookSignatureFailure({
        provider: "atlas",
        request: req,
        reason: "Invalid X-Signature on Atlas refund callback",
        source: "/api/atlas/refund-callback",
      });
    }

    let parsed: AtlasRefundCallbackBody;
    try {
      parsed = JSON.parse(rawBody) as AtlasRefundCallbackBody;
    } catch {
      console.error("❌ Atlas refund callback: invalid JSON body");
      return NextResponse.json({ received: true });
    }

    const record = parsed.data;
    if (!record || record.refund_id === undefined) {
      console.error("❌ Atlas refund callback missing data/refund_id");
      return NextResponse.json({ received: true });
    }

    console.log("📨 Atlas refund callback:", {
      refundId: String(record.refund_id),
      paymentId: record.payment_id,
      statusCode: Number(record.transaction_status_code),
      statusText: record.transaction_status_text,
    });

    // STEP 2: apply via the shared, idempotent reconciliation path.
    const result = await applyAtlasRefundRecord(
      record,
      "/api/atlas/refund-callback",
    );

    if (result.outcome === "not_found") {
      console.error(
        `❌ Atlas refund callback: no deposit found for refund ${result.refundId}`,
      );
      // 200 so Atlas stops retrying — nothing for us to attach the refund to.
      return NextResponse.json({
        received: true,
        message: "Transaction not found",
      });
    }

    return NextResponse.json({ received: true, outcome: result.outcome });
  } catch (error) {
    console.error("❌ Atlas refund callback error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
