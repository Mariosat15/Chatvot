import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import PaymentProvider from "@/database/models/payment-provider.model";
import { requireAdminAuth } from "@/lib/admin/auth";

/**
 * PUT /api/admin/payment-providers/[id]
 * Update a payment provider
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const { id } = await params;
    const body = await request.json();

    const provider = await PaymentProvider.findById(id);
    if (!provider) {
      return NextResponse.json(
        { error: "Payment provider not found" },
        { status: 404 },
      );
    }

    // Update fields
    if (body.displayName !== undefined) provider.displayName = body.displayName;
    if (body.logo !== undefined) provider.logo = body.logo;
    if (body.isActive !== undefined) provider.isActive = body.isActive;
    if (body.saveToEnv !== undefined) provider.saveToEnv = body.saveToEnv;
    if (body.credentials !== undefined) provider.credentials = body.credentials;
    if (body.webhookUrl !== undefined) provider.webhookUrl = body.webhookUrl;
    if (body.testMode !== undefined) provider.testMode = body.testMode;
    if (body.processingFee !== undefined)
      provider.processingFee = body.processingFee;
    if (body.priority !== undefined) provider.priority = body.priority;

    await provider.save();

    // Payment provider credentials are stored in MongoDB (PaymentProvider model)
    // and shared across all servers. No .env file write needed.

    return NextResponse.json({
      success: true,
      message: "Payment provider updated successfully",
      provider,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Update payment provider error:", error);
    return NextResponse.json(
      { error: "Failed to update payment provider" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/admin/payment-providers/[id]
 * Delete a payment provider
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const { id } = await params;

    const provider = await PaymentProvider.findById(id);
    if (!provider) {
      return NextResponse.json(
        { error: "Payment provider not found" },
        { status: 404 },
      );
    }

    // Prevent deletion of built-in providers
    if (provider.isBuiltIn) {
      return NextResponse.json(
        { error: "Cannot delete built-in payment providers" },
        { status: 400 },
      );
    }

    await PaymentProvider.findByIdAndDelete(id);

    return NextResponse.json({
      success: true,
      message: "Payment provider deleted successfully",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Delete payment provider error:", error);
    return NextResponse.json(
      { error: "Failed to delete payment provider" },
      { status: 500 },
    );
  }
}

