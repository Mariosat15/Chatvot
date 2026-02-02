import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import veriffService from "@/lib/services/veriff.service";
import KYCSession from "@/database/models/kyc-session.model";
import { isSafeMongoString } from "@/lib/utils/url-validator";

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();

    const signature =
      req.headers.get("x-hmac-signature") ||
      req.headers.get("x-signature") ||
      "";
    const rawBody = await req.text();

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      console.error("❌ [KYC Webhook] Failed to parse JSON body");
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    console.log("📥 [KYC Webhook] Received Veriff webhook:", {
      status: payload.status,
      verificationId: payload.verification?.id,
      verificationStatus: payload.verification?.status,
      action: payload.action,
      hasVerification: !!payload.verification,
      payloadKeys: Object.keys(payload),
    });

    // Handle different webhook types
    if (payload.verification && payload.verification.status) {
      // This is a decision webhook
      console.log("🔐 [KYC Webhook] Processing decision webhook...");
      await veriffService.handleDecision(payload, signature);
      console.log("✅ [KYC Webhook] Decision processed successfully");
    } else if (payload.action) {
      // Handle session events (started, submitted, etc.)
      console.log("📋 [KYC Webhook] Processing session event:", payload.action);
      await handleSessionEvent(payload);
    } else {
      console.log(
        "⚠️ [KYC Webhook] Unknown webhook type, payload:",
        JSON.stringify(payload).substring(0, 500),
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("❌ [KYC Webhook] Error processing webhook:", error);
    console.error("   Stack:", error.stack);
    // Return 200 to prevent Veriff from retrying
    return NextResponse.json(
      { received: true, error: error.message },
      { status: 200 },
    );
  }
}

async function handleSessionEvent(payload: any) {
  const { action } = payload;
  
  // Veriff sends the session ID either as payload.id or payload.verification.id
  const sessionId = payload.id || payload.verification?.id;
  const vendorData = payload.vendorData || payload.verification?.vendorData;

  if (!sessionId) {
    console.log("⚠️ [KYC Webhook] Session event missing session ID");
    return;
  }

  // Validate sessionId to prevent NoSQL injection
  if (!isSafeMongoString(sessionId)) {
    console.error("❌ [KYC Webhook] Invalid session ID format");
    return;
  }

  const statusMap: Record<string, string> = {
    started: "started",
    submitted: "submitted",
    abandoned: "abandoned",
  };

  const newStatus = statusMap[action];
  if (!newStatus) return;

  // Try to find session by veriffSessionId first, then by vendorData (userId)
  let session = await KYCSession.findOne({ veriffSessionId: sessionId });
  
  if (!session && vendorData) {
    // If session not found by veriffSessionId, try to find by userId and update it
    session = await KYCSession.findOne({ 
      userId: vendorData, 
      status: { $in: ["created", "started"] } 
    }).sort({ createdAt: -1 });
    
    if (session) {
      // Update the session with the Veriff session ID
      await KYCSession.findByIdAndUpdate(session._id, {
        veriffSessionId: sessionId,
        status: newStatus,
        ...(action === "submitted" ? { submittedAt: new Date() } : {}),
      });
      console.log(`📝 [KYC Webhook] Updated session ${session._id} (linked to Veriff ${sessionId}) status to: ${newStatus}`);
      return;
    }
  }

  if (session) {
    await KYCSession.findByIdAndUpdate(session._id, {
      status: newStatus,
      ...(action === "submitted" ? { submittedAt: new Date() } : {}),
    });
    console.log(`📝 [KYC Webhook] Updated session ${sessionId} status to: ${newStatus}`);
  } else {
    console.log(`⚠️ [KYC Webhook] No session found for ID: ${sessionId}`);
  }
}

// Handle GET requests - either Veriff testing webhook or user redirect after verification
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const isVeriffTest =
    req.headers.get("user-agent")?.includes("Veriff") ||
    req.headers.get("x-auth-client");

  // If it's Veriff testing the webhook endpoint, return JSON
  if (isVeriffTest) {
    return NextResponse.json({ status: "ok" });
  }

  // If it's a user browser redirect after verification, redirect to profile
  const sessionId = searchParams.get("session_id");
  const redirectUrl = new URL("/profile", req.url);
  redirectUrl.searchParams.set("tab", "verification");

  if (sessionId) {
    redirectUrl.searchParams.set("sessionId", sessionId);
  }

  // Add a flag to trigger status refresh on the profile page
  redirectUrl.searchParams.set("checkStatus", "true");

  return NextResponse.redirect(redirectUrl.toString());
}
