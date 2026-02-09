import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import Invoice from "@/database/models/invoice.model";

/**
 * POST /api/user/invoices/batch
 * Check multiple transaction IDs for invoices in a single query.
 * Returns a map of transactionId -> invoiceId for invoices that exist.
 *
 * Body: { transactionIds: string[] }
 * Response: { invoiceMap: Record<string, string> }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { transactionIds } = body;

    if (
      !Array.isArray(transactionIds) ||
      transactionIds.length === 0
    ) {
      return NextResponse.json({ invoiceMap: {} });
    }

    // Cap at 100 to prevent abuse
    const ids = transactionIds.slice(0, 100);

    await connectToDatabase();

    const invoices = await Invoice.find({
      transactionId: { $in: ids },
      userId: session.user.id,
    })
      .select("transactionId _id")
      .lean();

    // Build map: transactionId -> invoiceId
    const invoiceMap: Record<string, string> = {};
    for (const inv of invoices) {
      if (inv.transactionId) {
        invoiceMap[inv.transactionId] = inv._id.toString();
      }
    }

    return NextResponse.json({ invoiceMap });
  } catch (error) {
    console.error("Error batch-checking invoices:", error);
    return NextResponse.json(
      { error: "Failed to check invoices" },
      { status: 500 },
    );
  }
}
