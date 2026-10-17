import { NextRequest, NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import { auditLogService } from "@/lib/services/audit-log.service";
import {
  getMasterSwitch,
  listProviders,
  registerProvider,
  setMasterSwitch,
} from "@/lib/services/game-providers/provider-admin.service";

/**
 * GET  /api/games/providers - list providers plus the master switch
 * POST /api/games/providers - register a provider, or set the master switch
 *
 * AUTHORISATION IS THE SECTION GRANT, NOT MERELY "IS AN ADMIN". `requireAdminAuth` only
 * asks whether the caller is an admin at all, so an employee granted one unrelated section
 * would pass it. These routes reach provider credentials, so the check has to be the
 * specific grant.
 *
 * Worth stating because it has gone wrong here before: three times in this codebase a
 * comment has claimed an authorization check the code never performed. A route nothing
 * links to is still reachable over HTTP.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await guardSection("game-providers");
  if (!guard.ok) return guard.response;

  try {
    const [providers, master] = await Promise.all([
      listProviders(),
      getMasterSwitch(),
    ]);

    // `providers` carries presence booleans only - see the service. No secret reaches here.
    return NextResponse.json({ success: true, providers, ...master });
  } catch (error) {
    console.error("❌ Failed to list game providers:", error);
    return NextResponse.json(
      { error: "Failed to load game providers." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const guard = await guardSection("game-providers");
  if (!guard.ok) return guard.response;

  try {
    const body = (await request.json()) as {
      action?: "register" | "set-master-switch";
      providerKey?: string;
      displayName?: string;
      baseUrl?: string;
      logoUrl?: string;
      enabled?: boolean;
    };

    if (body.action === "set-master-switch") {
      const enabled = Boolean(body.enabled);
      const result = await setMasterSwitch(enabled);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      await auditLogService.log({
        admin: guard.admin,
        action: "settings_updated",
        category: "settings",
        description: `External games master switch turned ${enabled ? "ON" : "OFF"}`,
        targetType: "settings",
        targetName: "externalGamesEnabled",
        newValue: enabled,
      });

      return NextResponse.json({ success: true });
    }

    const result = await registerProvider({
      providerKey: body.providerKey ?? "",
      displayName: body.displayName ?? "",
      baseUrl: body.baseUrl ?? "",
      logoUrl: body.logoUrl,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    await auditLogService.log({
      admin: guard.admin,
      action: "settings_updated",
      category: "settings",
      description: `Game provider "${result.data?.providerKey}" registered (disabled until credentials are added)`,
      targetType: "settings",
      targetId: result.data?.providerKey,
      targetName: body.displayName,
    });

    return NextResponse.json({ success: true, ...result.data });
  } catch (error) {
    console.error("❌ Failed to register game provider:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please contact support." },
      { status: 500 },
    );
  }
}
