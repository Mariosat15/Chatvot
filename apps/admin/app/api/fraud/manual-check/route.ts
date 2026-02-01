import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/database/mongoose";
import { requireAdminAuth } from "@/lib/admin/auth";
import FraudAlert from "@/database/models/fraud/fraud-alert.model";
import DeviceFingerprint from "@/database/models/fraud/device-fingerprint.model";
import PaymentFingerprint from "@/database/models/fraud/payment-fingerprint.model";
import UserRestriction from "@/database/models/user-restriction.model";
import AccountLockout from "@/database/models/account-lockout.model";
import { FraudHistory } from "@/database/models/fraud/fraud-history.model";
import { SuspicionScoringService } from "@/lib/services/fraud/suspicion-scoring.service";

const USER_PROJECTION = {
  id: 1,
  _id: 1,
  email: 1,
  name: 1,
  role: 1,
  profileImage: 1,
  image: 1,
  country: 1,
  city: 1,
  address: 1,
  postalCode: 1,
  emailVerified: 1,
  createdAt: 1,
  updatedAt: 1,
  phone: 1,
};

const MAX_ITEMS = 100;

export async function POST(request: Request) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const body = await request.json().catch(() => ({}));
    const rawEmail = typeof body?.email === "string" ? body.email.trim() : "";
    const rawUserId =
      typeof body?.userId === "string" ? body.userId.trim() : "";

    if (!rawEmail && !rawUserId) {
      return NextResponse.json(
        { success: false, message: "Email or user ID is required" },
        { status: 400 },
      );
    }

    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json(
        { success: false, message: "Database connection not available" },
        { status: 500 },
      );
    }

    const email = rawEmail.toLowerCase();
    let user: Record<string, unknown> | null = null;

    if (rawUserId) {
      user = await db
        .collection("user")
        .findOne({ id: rawUserId }, { projection: USER_PROJECTION });
      if (!user && mongoose.Types.ObjectId.isValid(rawUserId)) {
        user = await db
          .collection("user")
          .findOne(
            { _id: new mongoose.Types.ObjectId(rawUserId) },
            { projection: USER_PROJECTION },
          );
      }
      if (!user) {
        user = await db
          .collection("user")
          .findOne({ _id: rawUserId } as Record<string, unknown>, {
            projection: USER_PROJECTION,
          });
      }
    }

    if (!user && email) {
      user = await db
        .collection("user")
        .findOne({ email }, { projection: USER_PROJECTION });
    }

    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 },
      );
    }

    const resolvedUserId = String(user.id || user._id || rawUserId || email);
    const resolvedEmail = String(user.email || email || "");

    let userObjectId: mongoose.Types.ObjectId | null = null;
    if (user._id && mongoose.Types.ObjectId.isValid(String(user._id))) {
      userObjectId = new mongoose.Types.ObjectId(String(user._id));
    } else if (mongoose.Types.ObjectId.isValid(resolvedUserId)) {
      userObjectId = new mongoose.Types.ObjectId(resolvedUserId);
    }

    const [
      suspicionScore,
      alerts,
      devices,
      restrictions,
      lockouts,
      paymentFingerprints,
      history,
    ] = await Promise.all([
      SuspicionScoringService.getScore(resolvedUserId),
      FraudAlert.find({
        $or: [
          { primaryUserId: resolvedUserId },
          { suspiciousUserIds: resolvedUserId },
          ...(resolvedEmail
            ? [
                { "evidence.data.email": resolvedEmail },
                { "evidence.data.userEmail": resolvedEmail },
              ]
            : []),
        ],
      })
        .sort({ detectedAt: -1 })
        .limit(MAX_ITEMS)
        .lean(),
      DeviceFingerprint.find({ userId: resolvedUserId })
        .sort({ lastSeen: -1 })
        .limit(MAX_ITEMS)
        .lean(),
      UserRestriction.find({ userId: resolvedUserId })
        .sort({ createdAt: -1 })
        .limit(MAX_ITEMS)
        .lean(),
      AccountLockout.find({
        $or: [
          { userId: resolvedUserId },
          ...(resolvedEmail ? [{ email: resolvedEmail }] : []),
        ],
      })
        .sort({ lockedAt: -1 })
        .limit(MAX_ITEMS)
        .lean(),
      userObjectId
        ? PaymentFingerprint.find({ userId: userObjectId })
            .sort({ lastUsed: -1 })
            .limit(MAX_ITEMS)
            .lean()
        : Promise.resolve([]),
      FraudHistory.find({
        $or: [
          { userId: resolvedUserId },
          ...(userObjectId ? [{ userId: userObjectId }] : []),
        ],
      })
        .sort({ createdAt: -1 })
        .limit(MAX_ITEMS)
        .lean(),
    ]);

    const summary = {
      alertsTotal: alerts.length,
      alertsPending: alerts.filter((alert) => alert.status === "pending")
        .length,
      alertsInvestigating: alerts.filter(
        (alert) => alert.status === "investigating",
      ).length,
      devicesTotal: devices.length,
      devicesHighRisk: devices.filter((device) => device.riskScore >= 70)
        .length,
      restrictionsActive: restrictions.filter(
        (restriction) => restriction.isActive,
      ).length,
      lockoutsActive: lockouts.filter((lockout) => lockout.isActive).length,
      paymentFingerprintsTotal: paymentFingerprints.length,
      historyEntries: history.length,
    };

    return NextResponse.json({
      success: true,
      data: {
        user,
        suspicionScore,
        alerts,
        devices,
        restrictions,
        lockouts,
        paymentFingerprints,
        history,
        summary,
      },
    });
  } catch (error) {
    console.error("Manual fraud check failed:", error);
    return NextResponse.json(
      { success: false, message: "Failed to run manual fraud check" },
      { status: 500 },
    );
  }
}
