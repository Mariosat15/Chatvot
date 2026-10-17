import { NextRequest, NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/database/mongoose";
import { Admin } from "@/database/models/admin.model";
import { WhiteLabel } from "@/database/models/whitelabel.model";

import { auditLogService } from "@/lib/services/audit-log.service";
import { isOriginalAdmin } from "@/lib/admin/employee-management-access";

export async function PUT(request: NextRequest) {
  try {
    const guard = await guardSection("credentials");
    if (!guard.ok) return guard.response;
    await connectToDatabase();

    const { email, currentPassword, newPassword, name } = await request.json();

    if (!email || !currentPassword) {
      return NextResponse.json(
        { error: "Email and current password are required" },
        { status: 400 },
      );
    }

    // Reason: this used an undeclared `auth`, so every save threw and returned 500 -
    // the first-login "set your credentials" screen could never be completed.
    const adminId = guard.admin.id;
    const admin = await Admin.findById(adminId);
    if (!admin) {
      return NextResponse.json({ error: "Admin not found" }, { status: 404 });
    }

    // Verify current password
    const isValidPassword = await admin.comparePassword(currentPassword);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 401 },
      );
    }

    // Update email
    admin.email = email.toLowerCase();

    // Update name if provided
    if (name && name.trim()) {
      admin.name = name.trim();
    }

    // Update password if provided
    if (newPassword) {
      if (newPassword.length < 8) {
        return NextResponse.json(
          { error: "Password must be at least 8 characters" },
          { status: 400 },
        );
      }
      admin.password = newPassword;
    }

    // Mark as not first login anymore
    admin.isFirstLogin = false;
    if (newPassword) {
      admin.mustChangePassword = false;
      admin.tempPasswordExpiresAt = undefined;
    }

    await admin.save();

    console.log("✅ Admin model updated in database");

    // Reason: WhiteLabel holds the OWNER's login only. An employee finishing first-login
    // setup used to overwrite it with their own email and password.
    if (await isOriginalAdmin(admin)) {
      let settings = await WhiteLabel.findOne();
      if (!settings) {
        settings = new WhiteLabel();
      }

      settings.adminEmail = email.toLowerCase();
      if (newPassword) {
        settings.adminPassword = newPassword;
      }

      await settings.save();
      console.log("✅ WhiteLabel model updated in database");
    }

    // Credentials are stored in MongoDB (Admin + WhiteLabel models) and shared across all servers.
    // No .env file write needed.

    // Revalidate admin pages
    revalidatePath("/dashboard");

    // Log audit action
    try {
      await auditLogService.logSettingsUpdated(
        {
          id: adminId,
          email: admin.email,
          name: admin.email.split("@")[0],
          role: "admin",
        },
        "Admin Credentials",
        undefined,
        { emailChanged: true, passwordChanged: !!newPassword },
      );
    } catch (auditError) {
      console.error("Failed to log audit action:", auditError);
    }

    return NextResponse.json({
      success: true,
      email: admin.email,
      name: admin.name || "Admin",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Update credentials error:", error);
    return NextResponse.json(
      { error: "Failed to update credentials" },
      { status: 500 },
    );
  }
}
