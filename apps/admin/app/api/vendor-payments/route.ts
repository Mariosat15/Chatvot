import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin/auth";
import { connectToDatabase } from "@/database/mongoose";
import VendorPayment from "@/database/models/vendor-payment.model";
import VendorSubscription from "@/database/models/vendor-subscription.model";
import { auditLogService } from "@/lib/services/audit-log.service";

/**
 * GET /api/vendor-payments
 * Get vendor payment history and summary
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const vendorId = searchParams.get("vendorId");
    const status = searchParams.get("status");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Build query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: any = {};

    if (vendorId) {
      query.vendorId = vendorId;
    }

    if (status && status !== "all") {
      query.status = status;
    }

    if (startDate || endDate) {
      query.paidAt = {};
      if (startDate) query.paidAt.$gte = new Date(startDate);
      if (endDate) query.paidAt.$lte = new Date(endDate);
    }

    // Get payment history
    const payments = await VendorPayment.find(query)
      .sort({ paidAt: -1, createdAt: -1 })
      .limit(100)
      .lean();

    // Calculate totals
    const totalPaid = await VendorPayment.aggregate([
      { $match: { status: "paid" } },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    // Get breakdown by service type
    const byServiceType = await VendorPayment.aggregate([
      { $match: { status: "paid" } },
      {
        $group: {
          _id: "$serviceType",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]);

    // Get breakdown by vendor
    const byVendor = await VendorPayment.aggregate([
      { $match: { status: "paid" } },
      {
        $group: {
          _id: "$vendorName",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
      { $limit: 10 },
    ]);

    // Get monthly totals for the current year
    const currentYear = new Date().getFullYear();
    const monthlyTotals = await VendorPayment.aggregate([
      {
        $match: {
          status: "paid",
          paidAt: {
            $gte: new Date(currentYear, 0, 1),
            $lte: new Date(currentYear, 11, 31),
          },
        },
      },
      {
        $group: {
          _id: { $month: "$paidAt" },
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Get upcoming payments (vendors that need payment soon)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const upcomingVendors = await VendorSubscription.find({
      isActive: true,
      nextPaymentDate: { $lte: thirtyDaysFromNow },
    })
      .sort({ nextPaymentDate: 1 })
      .lean();

    const upcomingTotal = upcomingVendors.reduce((sum, v) => sum + v.amount, 0);

    return NextResponse.json({
      success: true,
      data: {
        payments,
        summary: {
          totalPaid: totalPaid[0]?.total || 0,
          paymentCount: totalPaid[0]?.count || 0,
          byServiceType,
          byVendor,
          monthlyTotals,
        },
        upcoming: {
          vendors: upcomingVendors,
          total: upcomingTotal,
          count: upcomingVendors.length,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching vendor payments:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch vendor payments" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/vendor-payments
 * Record a vendor payment (deducts from platform earnings)
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminAuth();
    await connectToDatabase();

    const body = await request.json();
    const {
      vendorId,
      amount,
      reference,
      invoiceNumber,
      notes,
      periodStart,
      periodEnd,
    } = body;

    if (!vendorId || !amount) {
      return NextResponse.json(
        { success: false, error: "Vendor ID and amount are required" },
        { status: 400 },
      );
    }

    // Get vendor details
    const vendor = await VendorSubscription.findById(vendorId);
    if (!vendor) {
      return NextResponse.json(
        { success: false, error: "Vendor not found" },
        { status: 404 },
      );
    }

    // Create the payment record
    const payment = await VendorPayment.create({
      vendorId: vendor._id,
      vendorName: vendor.name,
      serviceType: vendor.serviceType,
      amount,
      currency: vendor.currency || "EUR",
      periodStart: periodStart ? new Date(periodStart) : undefined,
      periodEnd: periodEnd ? new Date(periodEnd) : undefined,
      billingCycle: vendor.billingCycle,
      status: "paid",
      paidAt: new Date(),
      paidBy: admin.adminId || "admin",
      paidByEmail: admin.email || "admin",
      reference,
      invoiceNumber,
      notes,
      deductedFromEarnings: true,
    });

    // Update the vendor's next payment date if it's a recurring subscription
    if (vendor.billingCycle !== "one-time") {
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
      }

      vendor.nextPaymentDate = currentDue;
      vendor.lastPaymentDate = new Date();
      vendor.reminderSent = false;

      // Add to vendor's payment history
      if (!vendor.paymentHistory) {
        vendor.paymentHistory = [];
      }
      vendor.paymentHistory.push({
        date: new Date(),
        amount,
        status: "paid",
        reference: reference || undefined,
      });

      await vendor.save();
    }

    console.log(
      `💳 Vendor Payment recorded: €${amount} to ${vendor.name} by ${admin.email}`,
    );

    // Log audit action
    try {
      await auditLogService.logVendorPayment(
        {
          id: admin.adminId || "admin",
          email: admin.email || "admin",
          name: (admin.email || "admin").split("@")[0],
          role: "admin",
        },
        vendor.name,
        amount,
        reference || `VENDOR-${payment._id}`,
      );
    } catch (auditError) {
      console.error("Failed to log audit action:", auditError);
    }

    return NextResponse.json({
      success: true,
      payment,
      message: `Payment of €${amount.toFixed(2)} to ${vendor.name} recorded successfully`,
    });
  } catch (error) {
    console.error("Error recording vendor payment:", error);
    return NextResponse.json(
      { success: false, error: "Failed to record vendor payment" },
      { status: 500 },
    );
  }
}
