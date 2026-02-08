import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { verifyAdminAuth } from "@/lib/admin/auth";

const execAsync = promisify(exec);

const PM2_APP_NAME = process.env.PM2_ADMIN_APP_NAME || "chartvolt-admin";
const HEAP_MB = 4096;

/**
 * POST /api/server-options/apply-heap
 * Sets NODE_OPTIONS=--max-old-space-size=4096 for the admin PM2 process and restarts it.
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

    // Fixed commands only (no user input) for security
    const setEnv = `pm2 set ${PM2_APP_NAME}:env.NODE_OPTIONS --max-old-space-size=${HEAP_MB}`;
    const restart = `pm2 restart ${PM2_APP_NAME}`;

    try {
      await execAsync(setEnv, { timeout: 10000 });
    } catch (err) {
      console.error("[apply-heap] pm2 set failed:", err);
      return NextResponse.json(
        {
          success: false,
          message:
            "PM2 set failed. Is the app running under PM2 with this name? Check PM2_ADMIN_APP_NAME env.",
          detail: err instanceof Error ? err.message : String(err),
        },
        { status: 500 }
      );
    }

    try {
      await execAsync(restart, { timeout: 15000 });
    } catch (err) {
      console.error("[apply-heap] pm2 restart failed:", err);
      return NextResponse.json(
        {
          success: false,
          message: "PM2 restart failed. Admin app may be restarting.",
          detail: err instanceof Error ? err.message : String(err),
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Heap set to ${HEAP_MB} MB and ${PM2_APP_NAME} restarted. This tab may disconnect briefly.`,
    });
  } catch (error) {
    console.error("[apply-heap] error:", error);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}
