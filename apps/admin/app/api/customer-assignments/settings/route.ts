import { NextRequest, NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import { customerAssignmentService } from "@/lib/services/customer-assignment.service";
import { connectToDatabase } from "@/database/mongoose";
import { AdminRoleTemplate } from "@/database/models/admin-role-template.model";

/**
 * GET /api/customer-assignments/settings
 * Get assignment settings and available roles from templates
 */
export async function GET(request: NextRequest) {
  try {
    const guard = await guardSection("customer-assignment");
    if (!guard.ok) return guard.response;
    const auth = {
      adminId: guard.admin.id,
      email: guard.admin.email,
      name: guard.admin.name,
      role: guard.admin.role,
      isSuperAdmin: guard.admin.role === "super_admin",
    };

    await connectToDatabase();
    const settings = await customerAssignmentService.getSettings();

    // Fetch all active role templates to get available roles
    const roleTemplates = await AdminRoleTemplate.find({ isActive: true })
      .select("name description")
      .sort({ name: 1 })
      .lean();

    // Extract unique role names
    const availableRoles = roleTemplates.map((template) => ({
      name: template.name,
      description: template.description,
    }));

    return NextResponse.json({
      success: true,
      settings,
      availableRoles,
    });
  } catch (error) {
    console.error("Error fetching assignment settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch assignment settings" },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/customer-assignments/settings
 * Update assignment settings (Super Admin only)
 */
export async function PUT(request: NextRequest) {
  try {
    const guard = await guardSection("customer-assignment");
    if (!guard.ok) return guard.response;
    const auth = {
      adminId: guard.admin.id,
      email: guard.admin.email,
      name: guard.admin.name,
      role: guard.admin.role,
      isSuperAdmin: guard.admin.role === "super_admin",
    };

    // Only super admin can update settings
    if (!auth.isSuperAdmin) {
      return NextResponse.json(
        { error: "Only super admin can update assignment settings" },
        { status: 403 },
      );
    }

    const body = await request.json();

    // Validate assignable roles if provided
    if (body.assignableRoles && !Array.isArray(body.assignableRoles)) {
      return NextResponse.json(
        { error: "assignableRoles must be an array" },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const settings = await customerAssignmentService.updateSettings(body, {
      adminId: auth.adminId!,
      adminEmail: auth.email!,
      adminName: auth.name || "Admin",
    });

    // Also return updated available roles
    const roleTemplates = await AdminRoleTemplate.find({ isActive: true })
      .select("name description")
      .sort({ name: 1 })
      .lean();

    const availableRoles = roleTemplates.map((template) => ({
      name: template.name,
      description: template.description,
    }));

    console.log(`✅ [Settings] Assignment settings updated by ${auth.email}`);

    return NextResponse.json({
      success: true,
      message: "Assignment settings updated successfully",
      settings,
      availableRoles,
    });
  } catch (error) {
    console.error("Error updating assignment settings:", error);
    return NextResponse.json(
      { error: "Failed to update assignment settings" },
      { status: 500 },
    );
  }
}
