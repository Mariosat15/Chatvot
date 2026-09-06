import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import { verifyAdminAuth } from "@/lib/admin/auth";
import VendorSubscription from "@/database/models/vendor-subscription.model";

// Protect against prototype pollution
const FORBIDDEN_KEYS = ["__proto__", "constructor", "prototype"];
function isSafeKey(key: string): boolean {
  return !FORBIDDEN_KEYS.includes(key);
}

/**
 * GET /api/vendors
 * Get all vendor subscriptions with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdminAuth();
    if (!admin.isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const serviceType = searchParams.get("serviceType");
    const isActive = searchParams.get("isActive");
    const upcoming = searchParams.get("upcoming"); // days ahead

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: any = {};

    if (serviceType && serviceType !== "all") {
      query.serviceType = serviceType;
    }

    if (isActive !== null && isActive !== "all") {
      query.isActive = isActive === "true";
    }

    let vendors;

    if (upcoming) {
      const daysAhead = parseInt(upcoming) || 30;
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + daysAhead);

      query.nextPaymentDate = { $lte: futureDate };
      vendors = await VendorSubscription.find(query).sort({
        nextPaymentDate: 1,
      });
    } else {
      vendors = await VendorSubscription.find(query).sort({
        nextPaymentDate: 1,
      });
    }

    // Calculate totals
    const activeVendors = vendors.filter((v) => v.isActive);

    let totalMonthly = 0;
    let totalYearly = 0;

    for (const vendor of activeVendors) {
      switch (vendor.billingCycle) {
        case "monthly":
          totalMonthly += vendor.amount;
          totalYearly += vendor.amount * 12;
          break;
        case "quarterly":
          totalMonthly += vendor.amount / 3;
          totalYearly += vendor.amount * 4;
          break;
        case "yearly":
          totalMonthly += vendor.amount / 12;
          totalYearly += vendor.amount;
          break;
        // one-time payments don't count towards recurring costs
      }
    }

    // Group by service type for summary
    const byServiceType: Record<
      string,
      { count: number; monthlyTotal: number }
    > = {};
    for (const vendor of activeVendors) {
      // Protect against prototype pollution
      if (!isSafeKey(vendor.serviceType)) continue;

      // Guard against prototype pollution
      const serviceType = vendor.serviceType;
      if (serviceType === "__proto__" || serviceType === "constructor" || serviceType === "prototype") {
        continue;
      }
      
      if (!Object.prototype.hasOwnProperty.call(byServiceType, serviceType)) {
        byServiceType[serviceType] = { count: 0, monthlyTotal: 0 };
      }
      byServiceType[serviceType].count++;

      switch (vendor.billingCycle) {
        case "monthly":
          byServiceType[serviceType].monthlyTotal += vendor.amount;
          break;
        case "quarterly":
          byServiceType[serviceType].monthlyTotal += vendor.amount / 3;
          break;
        case "yearly":
          byServiceType[serviceType].monthlyTotal += vendor.amount / 12;
          break;
      }
    }

    // Find payments due soon (within reminder period)
    const today = new Date();
    const paymentsDueSoon = vendors.filter((v) => {
      if (!v.isActive) return false;
      const dueDate = new Date(v.nextPaymentDate);
      const daysUntilDue = Math.ceil(
        (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );
      return daysUntilDue <= v.reminderDaysBefore && daysUntilDue >= 0;
    });

    return NextResponse.json({
      success: true,
      vendors,
      summary: {
        total: vendors.length,
        active: activeVendors.length,
        totalMonthly: Math.round(totalMonthly * 100) / 100,
        totalYearly: Math.round(totalYearly * 100) / 100,
        byServiceType,
        paymentsDueSoon: paymentsDueSoon.length,
      },
    });
  } catch (error) {
    console.error("Error fetching vendors:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch vendors" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/vendors
 * Create a new vendor subscription
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await verifyAdminAuth();
    if (!admin.isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const body = await request.json();

    // Validate required fields
    if (!body.name || !body.amount || !body.nextPaymentDate) {
      return NextResponse.json(
        {
          success: false,
          error: "Name, amount, and next payment date are required",
        },
        { status: 400 },
      );
    }

    const vendor = await VendorSubscription.create({
      ...body,
      nextPaymentDate: new Date(body.nextPaymentDate),
      lastPaymentDate: body.lastPaymentDate
        ? new Date(body.lastPaymentDate)
        : undefined,
    });

    return NextResponse.json({
      success: true,
      vendor,
      message: "Vendor subscription created successfully",
    });
  } catch (error) {
    console.error("Error creating vendor:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create vendor subscription" },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/vendors
 * Update a vendor subscription
 */
export async function PUT(request: NextRequest) {
  try {
    const admin = await verifyAdminAuth();
    if (!admin.isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const body = await request.json();
    const { _id, ...updateData } = body;

    if (!_id) {
      return NextResponse.json(
        { success: false, error: "Vendor ID is required" },
        { status: 400 },
      );
    }

    // Convert date strings to Date objects
    if (updateData.nextPaymentDate) {
      updateData.nextPaymentDate = new Date(updateData.nextPaymentDate);
    }
    if (updateData.lastPaymentDate) {
      updateData.lastPaymentDate = new Date(updateData.lastPaymentDate);
    }

    const vendor = await VendorSubscription.findByIdAndUpdate(
      _id,
      { $set: updateData },
      { new: true },
    );

    if (!vendor) {
      return NextResponse.json(
        { success: false, error: "Vendor not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      vendor,
      message: "Vendor subscription updated successfully",
    });
  } catch (error) {
    console.error("Error updating vendor:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update vendor subscription" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/vendors
 * Delete a vendor subscription
 */
export async function DELETE(request: NextRequest) {
  try {
    const admin = await verifyAdminAuth();
    if (!admin.isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Vendor ID is required" },
        { status: 400 },
      );
    }

    const vendor = await VendorSubscription.findByIdAndDelete(id);

    if (!vendor) {
      return NextResponse.json(
        { success: false, error: "Vendor not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Vendor subscription deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting vendor:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete vendor subscription" },
      { status: 500 },
    );
  }
}
