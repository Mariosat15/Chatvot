import { NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import { clearPriceCache } from "@/lib/services/redis.service";

export async function POST() {
  const guard = await guardSection("redis");
  if (!guard.ok) return guard.response;

  try {
    
    const success = await clearPriceCache();

    if (success) {
      return NextResponse.json({
        success: true,
        message: "Cache cleared successfully",
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          message: "Failed to clear cache or Redis not connected",
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("Failed to clear cache:", error);
    return NextResponse.json(
      { success: false, message: "Failed to clear cache" },
      { status: 500 },
    );
  }
}
