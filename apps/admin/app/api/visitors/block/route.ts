import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import BlockedVisitor from "@/database/models/blocked-visitor.model";

/**
 * GET /api/visitors/block — List all blocked visitors
 */
export async function GET() {
  try {
    await connectToDatabase();

    const blocked = await BlockedVisitor.find()
      .sort({ blockedAt: -1 })
      .limit(500)
      .lean();

    return NextResponse.json({ blocked });
  } catch (error) {
    console.error("❌ Error fetching blocked visitors:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

/**
 * POST /api/visitors/block — Block a visitor (IP, country, user agent, etc.)
 */
export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();
    const { type, value, reason, blockedBy, expiresAt } = body;

    if (!type || !value) {
      return NextResponse.json(
        { error: "Type and value are required" },
        { status: 400 },
      );
    }

    const validTypes = ["ip", "ip_range", "user_agent", "user", "country"];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(", ")}` },
        { status: 400 },
      );
    }

    // Check if already blocked
    const existing = await BlockedVisitor.findOne({
      type,
      value,
      isActive: true,
    });

    if (existing) {
      return NextResponse.json(
        { error: "This value is already blocked" },
        { status: 409 },
      );
    }

    const blocked = await BlockedVisitor.create({
      type,
      value: value.trim(),
      reason: reason || "",
      blockedBy: blockedBy || "admin",
      blockedAt: new Date(),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      isActive: true,
    });

    return NextResponse.json({ success: true, blocked });
  } catch (error) {
    console.error("❌ Error blocking visitor:", error);
    return NextResponse.json({ error: "Failed to block" }, { status: 500 });
  }
}

/**
 * DELETE /api/visitors/block — Unblock a visitor by ID
 */
export async function DELETE(req: NextRequest) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Block ID is required" },
        { status: 400 },
      );
    }

    const result = await BlockedVisitor.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true },
    );

    if (!result) {
      return NextResponse.json(
        { error: "Block rule not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ Error unblocking visitor:", error);
    return NextResponse.json({ error: "Failed to unblock" }, { status: 500 });
  }
}
