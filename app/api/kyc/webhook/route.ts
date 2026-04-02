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
      fullPayload: JSON.stringify(payload).substring(0, 1000),
    });

    // Handle different webhook types
    if (payload.verification && payload.verification.status) {
      // This is a decision webhook (traditional format)
      // Pass rawBody so handleDecision can verify the signature against the original bytes
      await veriffService.handleDecision(payload, signature, rawBody);
      console.log("✅ [KYC Webhook] Decision processed successfully");
    } else if (payload.eventType === "fullauto" && payload.data?.verification?.decision) {
      // Fullauto webhook format - the decision is in data.verification.decision (not .status)
      console.log("🔐 [KYC Webhook] Processing fullauto decision webhook...");
      console.log("   Decision:", payload.data.verification.decision);
      console.log("   Session ID:", payload.sessionId);
      console.log("   Vendor Data (userId):", payload.vendorData);
      
      const decision = payload.data.verification.decision; // "approved", "declined", etc.
      const person = payload.data.verification.person || {};
      const document = payload.data.verification.document || {};
      
      // Convert fullauto format to our standard format
      const decisionPayload = {
        status: payload.status,
        verification: {
          id: payload.sessionId,
          status: decision, // Map decision to status
          code: decision === "approved" ? 9001 : decision === "declined" ? 9102 : 9104,
          person: {
            firstName: person.firstName?.value,
            lastName: person.lastName?.value,
            dateOfBirth: person.dateOfBirth?.value,
            gender: person.gender?.value,
            nationality: person.nationality?.value,
            idNumber: person.idNumber?.value,
          },
          document: {
            type: document.type?.value,
            number: document.number?.value,
            country: document.country?.value,
            validFrom: document.validFrom?.value,
            validUntil: document.validUntil?.value,
          },
          vendorData: payload.vendorData,
          decisionTime: payload.time || new Date().toISOString(),
          acceptanceTime: payload.acceptanceTime,
        },
      };
      
      await veriffService.handleDecision(decisionPayload, signature);
      console.log("✅ [KYC Webhook] Fullauto decision processed successfully");
    } else if (payload.status === "success" && payload.data?.verification?.status) {
      // Alternative decision format (nested in data with status field)
      console.log("🔐 [KYC Webhook] Processing decision webhook (data format)...");
      const decisionPayload = {
        status: payload.status,
        verification: payload.data.verification,
      };
      await veriffService.handleDecision(decisionPayload, signature);
      console.log("✅ [KYC Webhook] Decision processed successfully");
    } else if (payload.action === "finished" && payload.data?.status) {
      // Event-based decision format
      console.log("🔐 [KYC Webhook] Processing finished event with decision...");
      const sessionId = payload.id || payload.sessionId;
      const status = payload.data.status;
      
      // Map Veriff event status to our expected format
      if (["approved", "declined", "resubmission_requested", "expired"].includes(status)) {
        const decisionPayload = {
          status: "success",
          verification: {
            id: sessionId,
            status: status,
            code: payload.data.code,
            reason: payload.data.reason,
            vendorData: payload.vendorData,
            decisionTime: new Date().toISOString(),
          },
        };
        await veriffService.handleDecision(decisionPayload, signature);
        console.log("✅ [KYC Webhook] Finished event processed successfully");
      }
    } else if (payload.action) {
      // Handle session events (started, submitted, etc.)
      console.log("📋 [KYC Webhook] Processing session event:", payload.action);
      await handleSessionEvent(payload);
    } else {
      console.log(
        "⚠️ [KYC Webhook] Unknown webhook type, full payload:",
        JSON.stringify(payload).substring(0, 1500),
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
  
  if (!session && vendorData && typeof vendorData === "string" && vendorData.trim()) {
    session = await KYCSession.findOne({ 
      userId: { $eq: vendorData.trim() }, 
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
