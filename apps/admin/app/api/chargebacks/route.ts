import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { getAdminSession } from "@/lib/admin/auth";
import { listChargebackQueue } from "../../../../../lib/services/security/chargeback-case.service";

const ALLOWED_STATUSES = [
  "pending_review",
  "initiated",
  "represented",
  "won",
  "lost",
  "withdrawn",
] as const;

/** GET — cross-user chargeback queue for the Financial Dashboard. */
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const sp = req.nextUrl.searchParams;
    const statusParam = sp.get("status") || undefined;
    const status =
      statusParam &&
      (ALLOWED_STATUSES as readonly string[]).includes(statusParam)
        ? (statusParam as (typeof ALLOWED_STATUSES)[number])
        : undefined;
    const limit = Math.min(Number(sp.get("limit") || 50), 200);
    const offset = Math.max(Number(sp.get("offset") || 0), 0);

    const { items, total } = await listChargebackQueue({
      status,
      limit,
      offset,
    });

    // Best-effort user enrichment so the financial dashboard can display name/email.
    const enriched = await enrichWithUsers(items);
    return NextResponse.json({ items: enriched, total, limit, offset });
  } catch (err) {
    console.error("❌ [chargebacks] queue failed:", err);
    return NextResponse.json(
      { error: "Failed to load chargeback queue" },
      { status: 500 },
    );
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- lean docs returned to client
async function enrichWithUsers(items: any[]): Promise<any[]> {
  try {
    const db = mongoose.connection.db;
    if (!db) return items.map((i) => i.toObject ? i.toObject() : i);
    const userIds = Array.from(
      new Set(
        items
          .map((i) => String(i.userId || ""))
          .filter((x) => x.length > 0),
      ),
    );
    if (userIds.length === 0) {
      return items.map((i) => (i.toObject ? i.toObject() : i));
    }
    // Some records use the string id; others the ObjectId _id. Try both.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic or filter
    const orClauses: any[] = [{ id: { $in: userIds } }];
    const validObjectIds = userIds
      .filter((x) => /^[a-f0-9]{24}$/i.test(x))
      .map((x) => new mongoose.Types.ObjectId(x));
    if (validObjectIds.length > 0) {
      orClauses.push({ _id: { $in: validObjectIds } });
    }
    const users = await db
      .collection("user")
      .find(
        { $or: orClauses },
        { projection: { id: 1, name: 1, email: 1 } },
      )
      .toArray();
    const byKey = new Map<string, { name?: string; email?: string }>();
    for (const u of users) {
      const key = String(u.id || u._id || "");
      byKey.set(key, { name: u.name, email: u.email });
    }
    return items.map((i) => {
      const base = i.toObject ? i.toObject() : i;
      const u = byKey.get(String(base.userId || ""));
      return u
        ? { ...base, userName: u.name, userEmail: u.email }
        : base;
    });
  } catch (e) {
    console.error("⚠️ [chargebacks] user enrichment failed:", e);
    return items.map((i) => (i.toObject ? i.toObject() : i));
  }
}
