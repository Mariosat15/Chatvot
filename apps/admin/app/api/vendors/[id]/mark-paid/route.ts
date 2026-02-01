import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import { verifyAdminAuth } from "@/lib/admin/auth";
import VendorSubscription from "@/database/models/vendor-subscription.model";

/**
 * POST /api/vendors/[id]/mark-paid
 * Mark a vendor payment as paid and advance to next billing cycle
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await verifyAdminAuth();
    if (!admin.isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { reference } = body;

    const vendor = await VendorSubscription.findById(id);

    if (!vendor) {
      return NextResponse.json(
        { success: false, error: "Vendor not found" },
        { status: 404 },
      );
    }

    // Add to payment history
    const paymentRecord = {
      date: new Date(),
      amount: vendor.amount,
      status: "paid" as const,
      reference: reference || undefined,
    };

    if (!vendor.paymentHistory) {
      vendor.paymentHistory = [];
    }
    vendor.paymentHistory.push(paymentRecord);

    // Update last payment date
    vendor.lastPaymentDate = new Date();

    // Advance to next payment date based on billing cycle
    const currentDue = new Date(vendor.nextPaymentDate);

    switch (vendor.billingCycle) {
      case "monthly":
        currentDue.setMonth(currentDue.getMonth() + 1);
        break;
      case "quarterly":
        currentDue.setMonth(currentDue.getMonth() + 3);
        break;
      case "yearly":
        currentDue.setFullYear(currentDue.getFullYear() + 1);
        break;
      case "one-time":
        // For one-time payments, mark as inactive
        vendor.isActive = false;
        break;
    }

    if (vendor.billingCycle !== "one-time") {
      vendor.nextPaymentDate = currentDue;
    }

    // Reset reminder flag for next cycle
    vendor.reminderSent = false;

    await vendor.save();

    return NextResponse.json({
      success: true,
      vendor,
      message: `Payment marked as paid. Next payment due: ${vendor.nextPaymentDate.toLocaleDateString()}`,
    });
  } catch (error) {
    console.error("Error marking payment:", error);
    return NextResponse.json(
      { success: false, error: "Failed to mark payment" },
      { status: 500 },
    );
  }
}
