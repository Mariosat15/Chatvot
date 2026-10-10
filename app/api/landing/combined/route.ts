import { NextResponse } from "next/server";

/**
 * GET /api/landing/combined
 * Combines stats + activity + competitions + challenges into a single response.
 * Reduces landing page from 4 HTTP polls to 1.
 *
 * At 5000 visitors polling every 30s, this saves ~10,000 requests/minute.
 *
 * Each sub-endpoint already has its own Cache-Control headers;
 * this combined endpoint re-uses the same data-fetching logic via internal imports.
 */
export async function GET() {
  try {
    // Dynamically import each route handler and invoke them in parallel
    const [statsModule, activityModule, competitionsModule, challengesModule] =
      await Promise.all([
        import("@/app/api/landing/stats/route"),
        import("@/app/api/landing/live-activity/route"),
        import("@/app/api/landing/competitions/route"),
        import("@/app/api/landing/challenges/route"),
      ]);

    // Call all 4 handlers in parallel
    const [statsRes, activityRes, competitionsRes, challengesRes] =
      await Promise.all([
        statsModule.GET(),
        activityModule.GET(),
        competitionsModule.GET(),
        challengesModule.GET(),
      ]);

    // Parse JSON responses
    const [stats, activity, competitions, challenges] = await Promise.all([
      statsRes.json().catch(() => null),
      activityRes.json().catch(() => null),
      competitionsRes.json().catch(() => null),
      challengesRes.json().catch(() => null),
    ]);

    return NextResponse.json(
      {
        stats,
        activity,
        competitions,
        challenges,
        updatedAt: new Date().toISOString(),
      },
      {
        headers: {
          // Cache for 30s, serve stale for 60s while revalidating
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      },
    );
  } catch (error) {
    console.error("Error fetching combined landing data:", error);
    return NextResponse.json(
      { error: "Failed to fetch landing data" },
      { status: 500 },
    );
  }
}
