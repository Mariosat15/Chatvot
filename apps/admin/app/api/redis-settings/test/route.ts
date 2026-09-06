import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin/auth";
import { testRedisConnection } from "@/lib/services/redis.service";

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
