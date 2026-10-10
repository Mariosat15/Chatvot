import { NextRequest, NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import { employeeNotificationService } from "@/lib/services/employee-notification.service";

/**
 * GET /api/employee/notifications
 * Get notifications for the current employee
 */
export async function GET(request: NextRequest) {
  try {
    const guard = await guardSection("profile");
    if (!guard.ok) return guard.response;
    const auth = { adminId: guard.admin.id, isAuthenticated: true as const };

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const skip = parseInt(searchParams.get("skip") || "0", 10);
    const unreadOnly = searchParams.get("unreadOnly") === "true";

    const result = await employeeNotificationService.getNotifications(
      auth.adminId!,
      { limit, skip, unreadOnly },
    );

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/employee/notifications
 * Mark notifications as read
 */
export async function PUT(request: NextRequest) {
  try {
    const guard = await guardSection("profile");
    if (!guard.ok) return guard.response;
    const auth = { adminId: guard.admin.id, isAuthenticated: true as const };

    const body = await request.json();
    const { notificationId, markAllRead } = body;

    if (markAllRead) {
      await employeeNotificationService.markAllAsRead(auth.adminId!);
      return NextResponse.json({
        success: true,
        message: "All notifications marked as read",
      });
    }

    if (notificationId) {
      await employeeNotificationService.markAsRead(notificationId);
      return NextResponse.json({
        success: true,
        message: "Notification marked as read",
      });
    }

    return NextResponse.json(
      { error: "Either notificationId or markAllRead is required" },
      { status: 400 },
    );
  } catch (error) {
    console.error("Error updating notifications:", error);
    return NextResponse.json(
      { error: "Failed to update notifications" },
      { status: 500 },
    );
  }
}
