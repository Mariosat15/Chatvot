import { NextRequest, NextResponse } from "next/server";
import { clearSymbolConfigCache } from "@/lib/services/symbol-config.service";
import { verifyInternalSecret } from "@/lib/utils/internal-auth";

export async function POST(request: NextRequest) {
  const key = request.headers.get("x-internal-key");

  if (
    !verifyInternalSecret(
      key,
      [process.env.INTERNAL_API_KEY, process.env.INTERNAL_API_SECRET],
      "symbol-config-refresh",
    )
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  clearSymbolConfigCache();

  return NextResponse.json({
    success: true,
    message: "Symbol config cache cleared",
  });
}
