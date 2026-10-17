import { NextResponse } from "next/server";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { getUserDashboardDataForApi } from "@/lib/actions/dashboard.actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Legacy trading live-stats endpoint.
 * Prefer ContestsSidebar dashboard-live routes + `/api/dashboard/overview-live`
 * for the Overview tab — this path is heavier and trading-shaped.
 */
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dashboardData = await getUserDashboardDataForApi(session.user.id);

    if (!dashboardData) {
      return NextResponse.json(
        { error: "Failed to fetch dashboard data" },
        { status: 500 },
      );
    }

    return NextResponse.json(dashboardData, {
      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    console.error("Error fetching live dashboard stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard stats" },
      { status: 500 },
    );
  }
}
