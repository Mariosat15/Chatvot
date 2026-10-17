import { NextRequest, NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import {
  getGamePerformance,
  resolveWindow,
  PERFORMANCE_WINDOWS,
} from "@/lib/services/games/game-performance.service";

/**
 * GET /api/games/performance - per-game operational metrics.
 *
 * Read-only and derived on every request, for the reason recorded in the service: there is no
 * verdict to store, and a stored one goes stale in exactly the way `game_provider.healthStatus`
 * did.
 *
 * NOT under `/api/games/providers/`, for the same reason `provider-health` is not: that path
 * sits beside `[providerKey]`, and a provider whose key happened to be `performance` would
 * become unreachable for editing. A separate path removes the collision rather than relying on
 * segment precedence.
 *
 * NO MONEY IN THE RESPONSE. The service explains why at length; the short form is that this
 * route is granted by a games section and revenue is granted by `analytics` and `financial`,
 * so returning revenue here would widen who can read it while looking like a convenience.
 */

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // `guardSection`, never `requireAdminAuth` - the latter asks only whether the caller is an
  // admin at all, so an employee granted one unrelated section would pass it.
  const guard = await guardSection("game-performance");
  if (!guard.ok) return guard.response;

  try {
    // The window comes from the query string and is matched against a fixed set rather than
    // parsed. An arbitrary `days` is a full-collection scan anybody holding the grant could
    // trigger by editing a URL.
    const windowDays = resolveWindow(request.nextUrl.searchParams.get("days"));
    const games = await getGamePerformance(windowDays);

    return NextResponse.json({
      success: true,
      games,
      windowDays,
      availableWindows: PERFORMANCE_WINDOWS,
    });
  } catch (error) {
    console.error("❌ Failed to read game performance:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please contact support." },
      { status: 500 },
    );
  }
}
