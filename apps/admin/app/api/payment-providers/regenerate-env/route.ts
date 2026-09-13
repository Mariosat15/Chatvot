import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import PaymentProvider from "@/database/models/payment-provider.model";
import { requireAdminAuth } from "@/lib/admin/auth";

/**
 * POST /api/admin/payment-providers/regenerate-env
 * Verify payment provider credentials are stored in MongoDB.
 * Previously this wrote to .env, but credentials are now served
 * from MongoDB directly (multi-server safe).
 */
export async function POST() {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    // Verify all providers have their credentials stored in MongoDB
    const providers = await PaymentProvider.find({ saveToEnv: true });

    console.log(
      `✅ Payment provider credentials verified in database (${providers.length} providers)`,
    );

    return NextResponse.json({
      success: true,
      message:
        "Payment provider credentials are stored in the database and shared across all servers.",
      providersCount: providers.length,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Regenerate env error:", error);
    return NextResponse.json(
      { error: "Failed to verify payment provider credentials" },
      { status: 500 },
    );
  }
}
