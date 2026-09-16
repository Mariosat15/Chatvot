import { NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import v8 from "v8";


/**
 * GET /api/server-options/heap-info
 * Returns the current Node.js heap limit and usage for this process (admin app).
 * Use this to verify that --max-old-space-size=4096 is applied.
 */
export async function GET() {
  try {
    const guard = await guardSection("server-options");
    if (!guard.ok) return guard.response;
    const canAccess =
      auth.isSuperAdmin ||
      (auth.allowedSections && auth.allowedSections.includes("server-options"));
    if (!canAccess) {
      return NextResponse.json(
        { error: "Access denied. Server Options section required." },
        { status: 403 }
      );
    }

    const heap = v8.getHeapStatistics();
    const limitBytes = heap.heap_size_limit;
    const limitMB = Math.round(limitBytes / 1024 / 1024);
    const usedBytes = heap.used_heap_size;
    const usedMB = Math.round(usedBytes / 1024 / 1024);

    const configuredMB = process.env.ADMIN_HEAP_MB
      ? parseInt(process.env.ADMIN_HEAP_MB, 10)
      : 4096;

    return NextResponse.json({
      heapLimitMB: limitMB,
      heapUsedMB: usedMB,
      heapLimitBytes: limitBytes,
      nodeOptions: process.env.NODE_OPTIONS || null,
      configuredHeapMB: configuredMB,
    });
  } catch (error) {
    console.error("[heap-info] error:", error);
    return NextResponse.json(
      { error: "Failed to get heap info" },
      { status: 500 }
    );
  }
}
