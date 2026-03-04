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
    const perPage = Math.min(
      parseInt(searchParams.get("per_page") || "15", 10),
      40,
    );
    const orientation = searchParams.get("orientation"); // landscape | portrait | square

    // Get API key from database first, then env fallback
    await connectToDatabase();
    const wl = await WhiteLabel.findOne().select("pexelsApiKey").lean();
    const apiKey =
      (wl as Record<string, string> | null)?.pexelsApiKey ||
      process.env.PEXELS_API_KEY ||
      "";

    if (!apiKey) {
      console.warn("⚠️ Pexels API key not configured — check Environment settings");
      return NextResponse.json(
        {
          error: "Pexels API key not configured. Go to Settings → Environment → Pexels to add your API key.",
          code: "NO_API_KEY",
        },
        { status: 400 },
      );
    }

    // Build Pexels API URL with all supported params
    const pexelsUrl = new URL("https://api.pexels.com/v1/search");
    pexelsUrl.searchParams.set("query", query);
    pexelsUrl.searchParams.set("page", String(page));
    pexelsUrl.searchParams.set("per_page", String(perPage));
    if (orientation) {
      pexelsUrl.searchParams.set("orientation", orientation);
    }

    // Reason: Do NOT use next.revalidate — failed responses would be cached,
    // causing persistent "no results" even after fixing the API key.
    const response = await fetch(pexelsUrl.toString(), {
      headers: { Authorization: apiKey },
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("❌ Pexels API error:", response.status, text);

      if (response.status === 401) {
        return NextResponse.json(
          {
            error: "Invalid Pexels API key. Please check your key in Settings → Environment → Pexels.",
            code: "INVALID_API_KEY",
          },
          { status: 401 },
        );
      }

      return NextResponse.json(
        { error: `Pexels API error (${response.status})`, code: "API_ERROR" },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("❌ Pexels proxy error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "SERVER_ERROR" },
      { status: 500 },
    );
  }
}
