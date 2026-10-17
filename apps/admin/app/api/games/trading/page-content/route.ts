import { NextRequest, NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import { auditLogService } from "@/lib/services/audit-log.service";
import {
  getTradingPageContent,
  updateTradingPageContent,
} from "@/lib/services/games/trading-page-content.service";

/**
 * GET/PATCH /api/games/trading/page-content — Trading player page copy, assets, theme.
 *
 * Guarded by `trading-page`, never `game-providers`: this is the Trading destination's
 * page editor, and folding it into the games grant would widen who can rewrite the
 * trading catalogue card. Settings (symbols, risk, market hours) stay on their own
 * sections — this route never touches them.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await guardSection("trading-page");
  if (!guard.ok) return guard.response;

  try {
    const content = await getTradingPageContent();
    return NextResponse.json({ success: true, content });
  } catch (error) {
    console.error("❌ Failed to load trading page content:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please contact support." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const guard = await guardSection("trading-page");
  if (!guard.ok) return guard.response;

  try {
    const body = (await request.json()) as { content?: unknown };
    const result = await updateTradingPageContent(body.content);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    await auditLogService.log({
      admin: guard.admin,
      action: "settings_updated",
      category: "settings",
      description: `Trading page content updated: ${Object.keys(result.content).join(", ")}`,
      targetType: "settings",
      targetId: "trading",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ Failed to update trading page content:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please contact support." },
      { status: 500 },
    );
  }
}
