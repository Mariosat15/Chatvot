import { NextRequest, NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import { getProviderHealth } from "@/lib/services/games/provider-health.service";

/**
 * GET /api/games/provider-health - is each game provider actually working.
 *
 * Read-only, and there is deliberately no write here. A health verdict is DERIVED from
 * rounds and deliveries every time it is asked for, so there is nothing to store and no
 * "acknowledge" to record. Adding a write would mean caching a judgement that goes stale.
 *
 * WHY THIS IS NOT `/api/games/providers/health`: that sits beside `[providerKey]`, and
 * although Next.js resolves a static segment before a dynamic one, it would make a provider
 * whose key happened to be "health" permanently unreachable for editing. A separate path
 * costs nothing and removes the collision rather than relying on precedence.
 */

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  // `guardSection`, never `requireAdminAuth` - the latter asks only whether the caller is an
  // admin at all, so an employee granted one unrelated section would pass it.
  const guard = await guardSection("provider-health");
  if (!guard.ok) return guard.response;

  try {
    const providers = await getProviderHealth();
    return NextResponse.json({ success: true, providers });
  } catch (error) {
    console.error("❌ Failed to read provider health:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please contact support." },
      { status: 500 },
    );
  }
}
