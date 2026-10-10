import { NextRequest } from "next/server";
import { streamTutorialAsset } from "@/lib/tutorials/stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/tutorials/videos/[filename]
 * Streams a tutorial video from <repo-root>/Videos/ with Range support.
 * Public — no auth — so the <video> element can use the URL directly.
 * (Filename access is the access-control gate: only tutorials emitted
 * by /api/tutorials are reachable.)
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ filename: string }> },
) {
  const { filename } = await ctx.params;
  return streamTutorialAsset(req, filename, false);
}
