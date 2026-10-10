import { NextRequest, NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import { testRedisConnection } from "@/lib/services/redis.service";

export async function POST(request: NextRequest) {
  const guard = await guardSection("redis");
  if (!guard.ok) return guard.response;

  try {
    
    const { host, port, password } = await request.json();

    if (!host) {
      return NextResponse.json(
        { success: false, message: "Redis host is required" },
        { status: 400 },
      );
    }

    const result = await testRedisConnection(
      host,
      port || 6379,
      password || undefined,
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Redis connection test failed:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Test failed",
      },
      { status: 500 },
    );
  }
}
