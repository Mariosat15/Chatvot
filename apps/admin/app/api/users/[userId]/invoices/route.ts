import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import { guardSection } from "@/lib/admin/section-route-guard";
import Invoice from "@/database/models/invoice.model";

/**
 * GET /api/admin/users/[userId]/invoices
 * Fetch all invoices for a specific user
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    // Reason: R101b - `requireAdminAuth` asks whether the caller is an admin at all, not
    // whether they hold the `users` grant. Sixth instance of that class.
    const guard = await guardSection("users");
    if (!guard.ok) return guard.response;
    await connectToDatabase();

    const { userId } = await params;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 },
      );
    }

    const invoices = await Invoice.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      invoices,
      total: invoices.length,
    });
  } catch (error) {
    console.error("Error fetching user invoices:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to fetch invoices" },
      { status: 500 },
    );
  }
}
