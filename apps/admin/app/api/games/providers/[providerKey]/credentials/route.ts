import { NextRequest, NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import { auditLogService } from "@/lib/services/audit-log.service";
import {
  completeRotation,
  saveCredentials,
} from "@/lib/services/game-providers/provider-admin.service";

/**
 * PUT  /api/games/providers/[providerKey]/credentials - store secrets, write-only
 * POST /api/games/providers/[providerKey]/credentials - end a rotation window
 *
 * THERE IS NO GET, AND THAT IS THE POINT. The payment-providers screen returns stored
 * credential values to the browser behind an eye toggle; chapter 04 section 2.3 says game
 * provider credentials are never returned to the client, so the read endpoint that would
 * make that possible does not exist. Presence booleans come back on the provider list
 * instead.
 *
 * THE AUDIT ENTRY RECORDS THAT SECRETS CHANGED, NEVER WHICH VALUES. `newValue` carries
 * booleans. An audit log is read by more people than the settings screen, so writing a
 * secret into it would widen exposure while looking like diligence.
 */

export const dynamic = "force-dynamic";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ providerKey: string }> },
) {
  const guard = await guardSection("game-providers");
  if (!guard.ok) return guard.response;

  try {
    const { providerKey } = await params;
    const body = (await request.json()) as {
      environment?: "sandbox" | "production";
      apiKey?: string;
      apiSecret?: string;
      callbackSecret?: string;
    };

    if (body.environment !== "sandbox" && body.environment !== "production") {
      return NextResponse.json(
        { error: "Choose either the sandbox or the production environment." },
        { status: 400 },
      );
    }

    const result = await saveCredentials(providerKey, {
      environment: body.environment,
      apiKey: body.apiKey,
      apiSecret: body.apiSecret,
      callbackSecret: body.callbackSecret,
    });
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    await auditLogService.log({
      admin: guard.admin,
      action: "settings_updated",
      category: "security",
      description: `Credentials updated for game provider "${providerKey}" (${body.environment})`,
      targetType: "settings",
      targetId: providerKey,
      // Booleans only. Never the values.
      newValue: {
        environment: body.environment,
        apiKeyChanged: Boolean(body.apiKey?.trim()),
        apiSecretChanged: Boolean(body.apiSecret?.trim()),
        callbackSecretChanged: Boolean(body.callbackSecret?.trim()),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ Failed to save game provider credentials:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please contact support." },
      { status: 500 },
    );
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ providerKey: string }> },
) {
  const guard = await guardSection("game-providers");
  if (!guard.ok) return guard.response;

  try {
    const { providerKey } = await params;
    const result = await completeRotation(providerKey);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    await auditLogService.log({
      admin: guard.admin,
      action: "settings_updated",
      category: "security",
      description: `Rotation window closed for game provider "${providerKey}" - the previous callback secret is no longer accepted`,
      targetType: "settings",
      targetId: providerKey,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ Failed to close rotation window:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please contact support." },
      { status: 500 },
    );
  }
}
