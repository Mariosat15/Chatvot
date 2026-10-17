import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import SystemAnnouncement from "@/database/models/system-announcement.model";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await connectToDatabase();
    const announcements =
      await SystemAnnouncement.getActiveAnnouncements();

    return NextResponse.json(
      { success: true, announcements },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      },
    );
  } catch (error) {
    console.error("Error fetching active announcements:", error);
    return NextResponse.json(
      { success: true, announcements: [] },
      { status: 200 },
    );
  }
}
