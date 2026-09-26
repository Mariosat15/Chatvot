/**
 * POST /api/simulator/attack/send-webhook
 *
 * Builds a synthetic Nuvei DMN payload and returns it. The scenario runner
 * actually posts it to the real webhook via `postCraftedDmn` so this endpoint
 * exists mainly as an ops debug-hook (manual craft + view).
 *
 * NOTE: the scenarios call `craftNuveiDmn` + `postCraftedDmn` directly from
 * in-process code. This HTTP surface is kept so the suite remains probeable
 * from the outside (loopback only) for manual testing, and future scenarios
 * that need a pure HTTP-only path.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  guardAttackRoute,
  isAttackTestUserId,
} from "@/lib/services/simulator/attack-tests/guards";
import {
  craftNuveiDmn,
  postCraftedDmn,
  type SignatureMode,
} from "@/lib/services/simulator/attack-tests/webhook-crafter";

export const dynamic = "force-dynamic";

interface WebhookBody {
  userId?: string;
  amount?: number;
  status?: "APPROVED" | "DECLINED" | "ERROR";
  signatureMode?: SignatureMode;
  pppTransactionId?: string;
  clientUniqueId?: string;
  // If true, actually POST to /api/nuvei/webhook; otherwise just return the
  // crafted payload for inspection.
  send?: boolean;
}

export async function POST(req: NextRequest) {
  const guard = await guardAttackRoute(req);
  if ("response" in guard) return guard.response;

  let body: WebhookBody;
  try {
    body = (await req.json()) as WebhookBody;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON" },
      { status: 400 },
    );
  }

  if (!body.userId || !isAttackTestUserId(body.userId)) {
    return NextResponse.json(
      { success: false, error: "userId must be a sim-attack-* id" },
      { status: 400 },
    );
  }

  const amount = typeof body.amount === "number" ? body.amount : 25;
  const status = body.status ?? "APPROVED";
  const signatureMode: SignatureMode = body.signatureMode ?? "invalid";

  const pppTransactionId =
    body.pppTransactionId ?? `sim-ppp-${Date.now()}`;
  const clientUniqueId =
    body.clientUniqueId ?? `txn_sim_${Date.now()}`;

  try {
    const crafted = await craftNuveiDmn({
      pppTransactionId,
      clientUniqueId,
      userId: body.userId,
      amount,
      status,
      signatureMode,
    });

    if (!body.send) {
      return NextResponse.json({ success: true, crafted });
    }

    // Use the same origin we were called on so the POST stays on loopback.
    const origin = new URL(req.url).origin;
    const response = await postCraftedDmn(origin, crafted);
    return NextResponse.json({
      success: true,
      webhookStatus: response.status,
      webhookBody: response.body,
      webhookText: response.text.slice(0, 500),
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "send-webhook failed",
      },
      { status: 500 },
    );
  }
}
