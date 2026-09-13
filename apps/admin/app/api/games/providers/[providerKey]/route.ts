import { NextRequest, NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import { auditLogService } from "@/lib/services/audit-log.service";
import {
  setProviderEnabled,
  updateProvider,
} from "@/lib/services/game-providers/provider-admin.service";

/**
 * PATCH /api/games/providers/[providerKey]
 *
 * Edits display fields, or flips the provider's enable switch.
 *
 * THERE IS DELIBERATELY NO DELETE. A provider that has ever run a contest is joined to
 * historical rounds and stats by `providerKey`, and `gameKey` is immutable, so deleting the
 * row would orphan that history while every screen still renders a key it can no longer
 * resolve. Disabling is the reversible operation, and it is the one we offer. Same reasoning
 * as the catalogue sync reporting missing titles rather than removing them.
 */

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ providerKey: string }> },
) {
  const guard = await guardSection("game-providers");
  if (!guard.ok) return guard.response;

  try {
    const { providerKey } = await params;
    const body = (await request.json()) as {
      enabled?: boolean;
      displayName?: string;
      baseUrl?: string;
      logoUrl?: string;
    };

    if (typeof body.enabled === "boolean") {
      const result = await setProviderEnabled(providerKey, body.enabled);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      await auditLogService.log({
        admin: guard.admin,
        action: "settings_updated",
        category: "settings",
        description: `Game provider "${providerKey}" ${body.enabled ? "enabled" : "disabled"}${
          body.enabled ? "" : " (contests already running will still finish)"
        }`,
        targetType: "settings",
        targetId: providerKey,
        newValue: body.enabled,
      });

      return NextResponse.json({ success: true });
    }

    const result = await updateProvider(providerKey, {
      displayName: body.displayName,
      baseUrl: body.baseUrl,
      logoUrl: body.logoUrl,
    });
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    await auditLogService.log({
      admin: guard.admin,
      action: "settings_updated",
      category: "settings",
      description: `Game provider "${providerKey}" details updated`,
      targetType: "settings",
      targetId: providerKey,
      newValue: {
        displayName: body.displayName,
        baseUrl: body.baseUrl,
        logoUrl: body.logoUrl,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ Failed to update game provider:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please contact support." },
      { status: 500 },
    );
  }
}
