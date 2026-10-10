import { NextResponse } from "next/server";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { connectToDatabase } from "@/database/mongoose";
import CreditWallet from "@/database/models/trading/credit-wallet.model";
import KYCSettings from "@/database/models/kyc-settings.model";
import KYCSession from "@/database/models/kyc-session.model";
import veriffService from "@/lib/services/veriff.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    // Get KYC settings
    let settings = await KYCSettings.findOne();
    if (!settings) {
      settings = await KYCSettings.create({});
    }

    // Get user wallet with KYC status
    let wallet = await CreditWallet.findOne({ userId: session.user.id });

    // Get latest KYC session
    let latestSession = (await KYCSession.findOne({ userId: session.user.id })
      .sort({ createdAt: -1 })
      .lean()) as {
      _id: { toString(): string };
      createdAt: Date;
      status?: string;
      completedAt?: Date;
      kycProvider?: string;
      externalSessionId?: string;
      veriffSessionId?: string;
      documentInfo?: {
        firstName?: string;
        lastName?: string;
        dateOfBirth?: string;
        nationality?: string;
        documentType?: string;
        documentNumber?: string;
        expiryDate?: string;
      };
    } | null;
    
    // If session is submitted but not yet decided, try to fetch decision from Veriff
    if (latestSession && 
        latestSession.status === "submitted" && 
        latestSession.veriffSessionId &&
        settings.enabled) {
      try {
        console.log("🔍 [KYC Status] Session is submitted, checking Veriff for decision...");
        const result = await veriffService.fetchAndProcessDecision(latestSession.veriffSessionId);
        
        if (result.processed) {
          console.log("✅ [KYC Status] Decision fetched and processed:", result.status);
          // Refresh the data after processing
          wallet = await CreditWallet.findOne({ userId: session.user.id });
          latestSession = await KYCSession.findOne({ userId: session.user.id })
            .sort({ createdAt: -1 })
            .lean() as unknown as typeof latestSession;
        }
      } catch (error: any) {
        console.log("⚠️ [KYC Status] Could not fetch decision from Veriff:", error.message);
        // Continue with existing data
      }
    }

    // Determine the actual KYC status - wallet status is the source of truth
    let kycStatus = wallet?.kycStatus || "none";
    let kycVerified = wallet?.kycVerified || false;

    // Check if KYC is expired by date
    if (
      kycVerified &&
      wallet?.kycExpiresAt &&
      new Date() > wallet.kycExpiresAt
    ) {
      kycStatus = "expired";
      kycVerified = false;
      // Update wallet
      await CreditWallet.findByIdAndUpdate(wallet._id, {
        kycVerified: false,
        kycStatus: "expired",
      });
    }

    // IMPORTANT: If wallet status is 'none' (e.g., admin reset), respect that
    // Only sync from session if wallet status indicates it hasn't been manually reset
    if (kycStatus !== "none" && latestSession) {
      const sessionStatus = latestSession.status;

      // If session is approved but wallet isn't verified, sync it
      if (sessionStatus === "approved" && !kycVerified) {
        kycVerified = true;
        kycStatus = "approved";
        // Update wallet
        if (wallet) {
          await CreditWallet.findByIdAndUpdate(wallet._id, {
            kycVerified: true,
            kycStatus: "approved",
            kycVerifiedAt: latestSession.completedAt || new Date(),
          });
        }
      }

      // If session is declined/expired/abandoned but wallet shows pending, sync it
      if (
        sessionStatus &&
        ["declined", "expired", "abandoned", "resubmission_requested"].includes(
          sessionStatus,
        ) &&
        kycStatus === "pending"
      ) {
        kycStatus =
          sessionStatus === "resubmission_requested"
            ? "declined"
            : sessionStatus;
        // Update wallet
        if (wallet) {
          await CreditWallet.findByIdAndUpdate(wallet._id, {
            kycStatus: kycStatus,
          });
        }
      }

      // Reason: Use configurable sessionExpiryMinutes to detect abandoned sessions
      // If a session is in 'created' or 'started' for longer than the configured expiry, mark it abandoned
      if (sessionStatus === "created" || sessionStatus === "started") {
        const sessionAge =
          Date.now() - new Date(latestSession.createdAt).getTime();
        const expiryMs = (settings.sessionExpiryMinutes || 30) * 60 * 1000;

        if (sessionAge > expiryMs) {
          // Mark as abandoned so user can retry
          await KYCSession.findByIdAndUpdate(latestSession._id, {
            status: "abandoned",
          });
          if (kycStatus === "pending") {
            kycStatus = "none"; // Show as none so user can retry (not expired, which suggests they tried)
            if (wallet) {
              await CreditWallet.findByIdAndUpdate(wallet._id, {
                kycStatus: "none",
              });
            }
          }
        }
      }
    }

    return NextResponse.json({
      enabled: settings.enabled,
      required: settings.requiredForWithdrawal || settings.requiredForDeposit,
      requiredForWithdrawal: settings.requiredForWithdrawal,
      requiredForDeposit: settings.requiredForDeposit,
      requiredAmount: settings.requiredAmount,

      userStatus: {
        verified: kycVerified,
        status: kycStatus,
        verifiedAt: wallet?.kycVerifiedAt,
        expiresAt: wallet?.kycExpiresAt,
        attempts: wallet?.kycAttempts || 0,
        maxAttempts: settings.maxVerificationAttempts,
      },

      latestSession: latestSession
        ? {
            id: latestSession._id,
            status: latestSession.status,
            createdAt: latestSession.createdAt,
            completedAt: latestSession.completedAt,
            dataRetentionExpiresAt:
              (latestSession as { dataRetentionExpiresAt?: Date })
                .dataRetentionExpiresAt ||
              // Calculate for existing sessions without this field (2 years from creation)
              new Date(
                new Date(latestSession.createdAt).setFullYear(
                  new Date(latestSession.createdAt).getFullYear() + 2,
                ),
              ),
          }
        : null,

      messages: {
        required: settings.kycRequiredMessage,
        pending: settings.kycPendingMessage,
        approved: settings.kycApprovedMessage,
        declined: settings.kycDeclinedMessage,
      },
    });
  } catch (error) {
    console.error("Error fetching KYC status:", error);
    return NextResponse.json(
      { error: "Failed to fetch KYC status" },
      { status: 500 },
    );
  }
}
