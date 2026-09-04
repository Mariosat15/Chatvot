import { NextRequest, NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import { auditLogService } from "@/lib/services/audit-log.service";
import { getProviderAdapter } from "@/lib/services/game-providers/registry";
import { syncProviderCatalogue } from "@/lib/services/game-providers/catalogue.service";

/**
 * POST /api/games/providers/[providerKey]/sync - pull the provider's game catalogue
 *
 * THIS USES `getProviderAdapter`, NOT `resolveEnabledProvider`, AND THE DIFFERENCE IS
 * DELIBERATE. `resolveEnabledProvider` refuses when the master switch is off or the
 * provider is disabled, which is correct for gameplay and wrong here: an operator has to
 * be able to see what a provider offers *before* deciding to enable anything. Gating the
 * sync behind the switch would make the first sync impossible - you would have to enable a
 * provider blind in order to discover what enabling it meant.
 *
 * The sync itself never enables a title. `chartvoltEnabled` defaults false and the service
 * treats it as ours, so pulling a catalogue is always a read-only act as far as players
 * are concerned.
 */

export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ providerKey: string }> },
) {
  const guard = await guardSection("game-providers");
  if (!guard.ok) return guard.response;

  try {
    const { providerKey } = await params;
    const adapter = getProviderAdapter(providerKey);

    if (!adapter) {
      return NextResponse.json(
        {
          error: `No code adapter is installed for "${providerKey}", so there is nothing to sync from yet.`,
        },
        { status: 400 },
      );
    }

    const result = await syncProviderCatalogue(adapter);

    if (!result.success) {
      // A provider being down is not our fault and not a server error. Reporting it as 502
      // keeps a provider outage distinguishable from a bug in this route.
      return NextResponse.json(
        {
          error: `The provider did not return a catalogue. Nothing was changed.`,
          result,
        },
        { status: 502 },
      );
    }

    await auditLogService.log({
      admin: guard.admin,
      action: "settings_updated",
      category: "settings",
      description: `Catalogue synced for game provider "${providerKey}": ${result.created} added, ${result.updated} updated, ${result.unchanged} unchanged${
        result.missingFromProvider.length > 0
          ? `, ${result.missingFromProvider.length} no longer listed (kept)`
          : ""
      }`,
      targetType: "settings",
      targetId: providerKey,
      newValue: {
        received: result.received,
        created: result.created,
        updated: result.updated,
        unchanged: result.unchanged,
        missingFromProvider: result.missingFromProvider,
      },
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("❌ Catalogue sync failed:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please contact support." },
      { status: 500 },
    );
  }
}
