import { NextRequest } from "next/server";
import { streamTutorialAsset } from "@/lib/tutorials/stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ filename: string }> },
) {
  const { filename } = await ctx.params;
  return streamTutorialAsset(req, filename, false);
}
