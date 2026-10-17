import { NextRequest, NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import { customerAuditService } from "@/lib/services/customer-audit.service";
import {
  AuditActionCategory,
  AUDIT_CATEGORY_CONFIG,
} from "@/database/models/customer-audit-trail.model";
import { connectToDatabase } from "@/database/mongoose";

/**
 * GET /api/customer-audit
 * Get audit trail for a customer or employee
 */
export async function GET(request: NextRequest) {
  try {
    const guard = await guardSection("users");
    if (!guard.ok) return guard.response;
    const auth = {
      adminId: guard.admin.id,
      email: guard.admin.email,
      name: guard.admin.name,
      role: guard.admin.role,
      isSuperAdmin: guard.admin.role === "super_admin",
    };

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");
    const employeeId = searchParams.get("employeeId");
    const category = searchParams.get("category") as AuditActionCategory | null;
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = parseInt(searchParams.get("skip") || "0");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!customerId && !employeeId) {
      return NextResponse.json(
        { error: "Either customerId or employeeId is required" },
        { status: 400 },
      );
    }

    await connectToDatabase();

    let result;

    if (customerId) {
      result = await customerAuditService.getCustomerAuditTrail(customerId, {
        category: category || undefined,
        limit,
        skip,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      });
    } else if (employeeId) {
      result = await customerAuditService.getEmployeeAuditTrail(employeeId, {
        limit,
        skip,
      });
    }

    return NextResponse.json({
      success: true,
      ...result,
      categories: Object.entries(AUDIT_CATEGORY_CONFIG).map(([key, value]) => ({
        id: key,
        ...value,
      })),
    });
  } catch (error) {
    console.error("Error fetching audit trail:", error);
    return NextResponse.json(
      { error: "Failed to fetch audit trail" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/customer-audit
 * Log a custom audit entry (for manual notes, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await guardSection("users");
    if (!guard.ok) return guard.response;
    const auth = {
      adminId: guard.admin.id,
      email: guard.admin.email,
      name: guard.admin.name,
      role: guard.admin.role,
      isSuperAdmin: guard.admin.role === "super_admin",
    };

    const body = await request.json();
    const { customerId, customerEmail, customerName, note } = body;

    if (!customerId || !note) {
      return NextResponse.json(
        { error: "customerId and note are required" },
        { status: 400 },
      );
    }

    await connectToDatabase();

    await customerAuditService.logNoteAdded(
      { customerId, customerEmail, customerName },
      {
        employeeId: auth.adminId!,
        employeeName: auth.name || "Admin",
        employeeEmail: auth.email!,
        employeeRole: auth.role || "Super Admin",
        isSuperAdmin: auth.isSuperAdmin,
      },
      note,
    );

    return NextResponse.json({
      success: true,
      message: "Note added to customer audit trail",
    });
  } catch (error) {
    console.error("Error adding audit note:", error);
    return NextResponse.json(
      { error: "Failed to add audit note" },
      { status: 500 },
    );
  }
}
