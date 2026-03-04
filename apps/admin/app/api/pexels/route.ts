import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import { WhiteLabel } from "@/database/models/whitelabel.model";

/**
 * Pexels API proxy — searches stock images.
 * Reason: Proxy through our backend to keep the API key server-side only.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query") || "trading finance";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const perPage = Math.min(parseInt(searchParams.get("per_page") || "15", 10), 40);

    // Get API key from database first, then env fallback
    await connectToDatabase();
    const wl = await WhiteLabel.findOne().select("pexelsApiKey").lean();
    const apiKey =
      (wl as Record<string, string> | null)?.pexelsApiKey ||
      process.env.PEXELS_API_KEY ||
      "";

    if (!apiKey) {
      return NextResponse.json(
        { error: "Pexels API key not configured" },
        { status: 400 },
      );
    }

    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}`;
    const response = await fetch(url, {
      headers: { Authorization: apiKey },
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("❌ Pexels API error:", response.status, text);
      return NextResponse.json(
        { error: "Pexels API error", status: response.status },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("❌ Pexels proxy error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
