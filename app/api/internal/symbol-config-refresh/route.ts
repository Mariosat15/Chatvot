import { NextRequest, NextResponse } from "next/server";
import { clearSymbolConfigCache } from "@/lib/services/symbol-config.service";

export async function POST(request: NextRequest) {
  const key = request.headers.get("x-internal-key");
  const expected =
    process.env.INTERNAL_API_KEY ||
    process.env.INTERNAL_API_SECRET ||
    "internal-key";

  if (key !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  clearSymbolConfigCache();

  return NextResponse.json({
    success: true,
    message: "Symbol config cache cleared",
  });
}
