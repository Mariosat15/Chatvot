import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import PaymentProvider from "@/database/models/payment-provider.model";
import { requireAdminAuth, getAdminSession } from "@/lib/admin/auth";
import { auditLogService } from "@/lib/services/audit-log.service";

/**
 * GET /api/admin/payment-providers
 * Get all payment providers
 */
export async function GET() {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const providers = await PaymentProvider.find().sort({
      priority: -1,
      name: 1,
    });

    return NextResponse.json({
      success: true,
      providers,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Get payment providers error:", error);
    return NextResponse.json(
      { error: "Failed to fetch payment providers" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/admin/payment-providers
 * Create a new payment provider
 */
export async function POST(request: Request) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const body = await request.json();
    const {
      name,
      slug,
      displayName,
      logo,
      credentials,
      webhookUrl,
      testMode,
      saveToEnv,
      processingFee,
    } = body;

    // Validate required fields
    if (!name || !slug || !displayName) {
      return NextResponse.json(
        { error: "Name, slug, and display name are required" },
        { status: 400 },
      );
    }

    // Check if slug already exists
    const existing = await PaymentProvider.findOne({ slug });
    if (existing) {
      return NextResponse.json(
        { error: "A provider with this slug already exists" },
        { status: 400 },
      );
    }

    // Create provider
    const provider = await PaymentProvider.create({
      name,
      slug,
      displayName,
      logo: logo || "",
      isActive: false,
      isBuiltIn: false,
      saveToEnv: saveToEnv !== undefined ? saveToEnv : true,
      credentials: credentials || [],
      webhookUrl: webhookUrl || "",
      testMode: testMode !== undefined ? testMode : true,
      processingFee: processingFee !== undefined ? processingFee : 0,
      priority: 0,
    });

    // Payment provider credentials are stored in MongoDB (PaymentProvider model)
    // and shared across all servers. No .env file write needed.

    // Log audit action
    try {
      const admin = await getAdminSession();
      if (admin) {
        await auditLogService.logPaymentProviderCreated(
          {
            id: admin.id,
            email: admin.email,
            name: admin.email.split("@")[0],
            role: "admin",
          },
          provider._id.toString(),
          displayName,
        );
      }
    } catch (auditError) {
      console.error("Failed to log audit action:", auditError);
    }

    return NextResponse.json({
      success: true,
      message: "Payment provider created successfully",
      provider,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Create payment provider error:", error);
    return NextResponse.json(
      { error: "Failed to create payment provider" },
      { status: 500 },
    );
  }
}

