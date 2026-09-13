import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import TestRun from "@/database/models/test-run.model";

/**
 * GET /api/tests/runs
 * List recent test runs with pagination.
 * Query params: ?limit=20&offset=0&status=passed|failed|error
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const status = searchParams.get("status");

    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;

    const [runs, total] = await Promise.all([
      TestRun.find(filter)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .select("-rawOutput -testResults")
        .lean(),
      TestRun.countDocuments(filter),
    ]);

    return NextResponse.json({ success: true, runs, total, limit, offset });
  } catch (error) {
    console.error("Error fetching test runs:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch test runs" },
      { status: 500 },
    );
  }
}
