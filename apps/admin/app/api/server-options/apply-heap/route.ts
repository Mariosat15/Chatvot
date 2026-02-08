import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { verifyAdminAuth } from "@/lib/admin/auth";

const execAsync = promisify(exec);

const PM2_APP_NAME = process.env.PM2_ADMIN_APP_NAME || "chartvolt-admin";

/**
 * POST /api/server-options/apply-heap
 * Restarts the admin PM2 process so it picks up the 4 GB heap from ecosystem.config.js and package.json.
 * Does NOT run "pm2 set" from inside this process (that process gets killed on restart and would fail with SIGINT).
 * Requires admin auth with server-options access or super admin.
 */
export async function POST() {
  try {
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const canAccess =
      auth.isSuperAdmin ||
      (auth.allowedSections && auth.allowedSections.includes("server-options"));
    if (!canAccess) {
      return NextResponse.json(
        { error: "Access denied. Server Options section required." },
        { status: 403 }
      );
    }

    const restart = `pm2 restart ${PM2_APP_NAME}`;

    try {
      await execAsync(restart, { timeout: 15000 });
    } catch (err) {
      console.error("[apply-heap] pm2 restart failed:", err);
      return NextResponse.json(
        {
          success: false,
          message:
            "PM2 restart failed. Is the app running under PM2 with this name? Check PM2_ADMIN_APP_NAME env.",
          detail: err instanceof Error ? err.message : String(err),
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${PM2_APP_NAME} restarted (4 GB heap from ecosystem/package.json). This tab may disconnect briefly.`,
    });
  } catch (error) {
    console.error("[apply-heap] error:", error);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}
