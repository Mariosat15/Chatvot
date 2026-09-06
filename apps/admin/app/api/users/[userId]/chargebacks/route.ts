import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/auth";
// Reason: services live at repo root to stay shared with the main app.
import {
  ensureChargebackCase,
  listChargebacksForUser,
} from "../../../../../../../lib/services/security/chargeback-case.service";
import { lookupDepositForChargeback } from "../../../../../../../lib/services/security/chargeback-lookup.service";
import { logChargebackAction } from "../../../chargebacks/_audit";

/** GET — list chargeback cases for a user. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { userId } = await params;
    const cases = await listChargebacksForUser(userId);
    return NextResponse.json({ cases });
  } catch (err) {
    console.error("❌ [chargebacks] list failed:", err);
    return NextResponse.json(
      { error: "Failed to list chargebacks" },
      { status: 500 },
    );
  }
}

/** POST — manually create a chargeback case (status pending_review). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { userId } = await params;
    const body = await req.json();

    // Reason: providerTransactionId is the single source of truth — when the
    // admin provides it we auto-derive everything else (amount, currency,
    // walletTransactionId, provider) from the matched deposit. The admin
    // then only has to type the reason code.
    const providerTransactionId =
      typeof body?.providerTransactionId === "string"
        ? body.providerTransactionId.trim()
        : undefined;

    let resolvedProvider: string | undefined =
      typeof body?.provider === "string" && body.provider.trim()
        ? body.provider.trim()
        : undefined;
    let resolvedAmount: number | undefined =
      typeof body?.amount === "number" && body.amount > 0
        ? body.amount
        : undefined;
    let resolvedCurrency: string | undefined =
      typeof body?.currency === "string" && body.currency.trim()
        ? body.currency.trim()
        : undefined;
    let resolvedUserEmail: string | undefined =
      typeof body?.userEmail === "string" ? body.userEmail : undefined;
    let resolvedUserName: string | undefined =
      typeof body?.userName === "string" ? body.userName : undefined;
    let resolvedWalletTransactionId: string | undefined =
      typeof body?.walletTransactionId === "string"
        ? body.walletTransactionId
        : undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- forwarded to Chargeback.metadata
    const extraMetadata: Record<string, any> = {
      createdByAdmin: session.id,
      manualEntry: true,
    };

    if (providerTransactionId) {
      const preview = await lookupDepositForChargeback(
        providerTransactionId,
        resolvedProvider,
      );
      if (preview.found) {
        resolvedProvider = resolvedProvider || preview.provider;
        resolvedAmount = resolvedAmount ?? preview.amount;
        resolvedCurrency = resolvedCurrency || preview.currency;
        resolvedUserEmail = resolvedUserEmail || preview.userEmail;
        resolvedUserName = resolvedUserName || preview.userName;
        resolvedWalletTransactionId =
          resolvedWalletTransactionId || preview.walletTransactionId;
        extraMetadata.lookupMatched = true;
        extraMetadata.depositStatusAtLookup = preview.status;
        if (preview.cardBrand) extraMetadata.cardBrand = preview.cardBrand;
        if (preview.cardLast4) extraMetadata.cardLast4 = preview.cardLast4;
        if (preview.uniqueCC) extraMetadata.uniqueCC = preview.uniqueCC;
        if (preview.userPaymentOptionId) {
          extraMetadata.userPaymentOptionId = preview.userPaymentOptionId;
        }
        if (preview.clientIp) extraMetadata.clientIp = preview.clientIp;
        if (preview.clientCountry) {
          extraMetadata.clientCountry = preview.clientCountry;
        }
        if (preview.clientCity) extraMetadata.clientCity = preview.clientCity;
        if (preview.clientRegion) {
          extraMetadata.clientRegion = preview.clientRegion;
        }
        // Reason: when the admin creates the case under a specific user but
        // the deposit record belongs to a different userId, we still honor
        // the route userId — do not silently hijack attribution. Just flag
        // for audit.
        if (preview.userId && preview.userId !== userId) {
          extraMetadata.lookupUserMismatch = {
            depositUserId: preview.userId,
            routeUserId: userId,
          };
        }
      } else {
        extraMetadata.lookupMatched = false;
      }
    }

    if (!resolvedProvider) {
      return NextResponse.json(
        {
          error:
            "provider is required (or give providerTransactionId of a known deposit)",
        },
        { status: 400 },
      );
    }
    if (!(typeof resolvedAmount === "number" && resolvedAmount > 0)) {
      return NextResponse.json(
        {
          error:
            "amount is required and must be > 0 (lookup did not match — provide providerTransactionId or amount)",
        },
        { status: 400 },
      );
    }

    const created = await ensureChargebackCase({
      provider: resolvedProvider,
      userId,
      userEmail: resolvedUserEmail,
      userName: resolvedUserName,
      walletTransactionId: resolvedWalletTransactionId,
      providerTransactionId,
      chargebackCaseId: body.chargebackCaseId,
      reasonCode: body.reasonCode,
      amount: resolvedAmount,
      currency: resolvedCurrency || "EUR",
      metadata: extraMetadata,
    });

    await logChargebackAction(
      session,
      "chargeback_created",
      String(created._id),
      `Manually created chargeback case for user ${userId}`,
      {
        userId,
        amount: resolvedAmount,
        provider: resolvedProvider,
        reasonCode: body.reasonCode,
        providerTransactionId,
        lookupMatched: extraMetadata.lookupMatched,
      },
    );

    return NextResponse.json({ case: created });
  } catch (err) {
    console.error("❌ [chargebacks] create failed:", err);
    return NextResponse.json(
      { error: "Failed to create chargeback case" },
      { status: 500 },
    );
  }
}
