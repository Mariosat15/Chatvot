import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import TestRun from "@/database/models/test-run.model";

/**
 * GET /api/tests/runs/[runId]
 * Get detailed results for a specific test run (including per-test results).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    await connectToDatabase();
    const { runId } = await params;

    const run = await TestRun.findById(runId).lean();
    if (!run) {
      return NextResponse.json(
        { success: false, error: "Test run not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, run });
  } catch (error) {
    console.error("Error fetching test run:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch test run" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/tests/runs/[runId]
 * Delete a specific test run.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    await connectToDatabase();
    const { runId } = await params;

    const result = await TestRun.findByIdAndDelete(runId);
    if (!result) {
      return NextResponse.json(
        { success: false, error: "Test run not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, message: "Test run deleted" });
  } catch (error) {
    console.error("Error deleting test run:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete test run" },
      { status: 500 },
    );
  }
}
