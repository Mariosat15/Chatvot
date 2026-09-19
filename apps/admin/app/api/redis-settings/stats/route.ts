import { NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import { getCacheStats } from "@/lib/services/redis.service";

export async function GET() {
  const guard = await guardSection("redis");
  if (!guard.ok) return guard.response;

  try {
    
    const stats = await getCacheStats();

    if (!stats) {
      return NextResponse.json({
        connected: false,
        pricesCached: 0,
        queuePending: 0,
        queueProcessing: 0,
      });
    }

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Failed to fetch cache stats:", error);
    return NextResponse.json(
      {
        connected: false,
        pricesCached: 0,
        queuePending: 0,
        queueProcessing: 0,
        error: "Failed to fetch stats",
      },
      { status: 500 },
    );
  }
}
