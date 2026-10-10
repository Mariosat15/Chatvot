import { NextRequest, NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import { auditLogService } from "@/lib/services/audit-log.service";
import {
  VELOCITY_RESTART_COMMAND,
  VELOCITY_ROTATE_CONFIRMATION,
  getVelocitySecretStatus,
  writeVelocitySecrets,
} from "@/lib/services/games/velocity-secrets.service";

/**
 * GET  /api/games/velocity-secrets - whether the two Volt Velocity secrets are set
 * POST /api/games/velocity-secrets - generate both and write them into games-service/.env
 *
 * Neither handler ever returns a secret value: the status says "set" or "not set", and the
 * generate response says where it wrote and what to restart. See the service for why.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await guardSection("game-providers");
  if (!guard.ok) return guard.response;

  try {
    return NextResponse.json({
      success: true,
      ...getVelocitySecretStatus(),
      restartCommand: VELOCITY_RESTART_COMMAND,
    });
  } catch (error) {
    console.error("❌ Failed to read Volt Velocity secret status:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please contact support." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const guard = await guardSection("game-providers");
  if (!guard.ok) return guard.response;

  try {
    const body = (await request.json().catch(() => ({}))) as { confirm?: unknown };
    // Reason: a rotation ends every live race, so it takes the typed phrase and nothing else -
    // a boolean `rotate: true` is one stray click in a script away.
    const rotate = body.confirm === VELOCITY_ROTATE_CONFIRMATION;

    const result = writeVelocitySecrets({ rotate });
    if (!result.success) {
      const status = result.code === "already_configured" ? 409 : result.code === "env_missing" ? 400 : 500;
      return NextResponse.json({ error: result.error, code: result.code }, { status });
    }

    await auditLogService.log({
      admin: guard.admin,
      action: "settings_updated",
      category: "settings",
      description: result.rotated
        ? "Volt Velocity secrets ROTATED in games-service/.env (values not recorded)"
        : "Volt Velocity secrets generated in games-service/.env (values not recorded)",
      targetType: "settings",
      targetId: "games-service/.env",
    });

    return NextResponse.json({
      success: true,
      rotated: result.rotated,
      envPath: result.envPath,
      restartCommand: VELOCITY_RESTART_COMMAND,
    });
  } catch (error) {
    console.error("❌ Failed to generate Volt Velocity secrets:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please contact support." },
      { status: 500 },
    );
  }
}
