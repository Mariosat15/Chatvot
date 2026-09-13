/**
 * Nuvei Payment Service (Admin App)
 * Handles Nuvei API integration for payment verification
 *
 * Documentation: https://docs.nuvei.com/documentation/accept-payment/web-sdk/
 */

import crypto from "crypto";
import PaymentProvider from "@/database/models/payment-provider.model";
import { connectToDatabase } from "@/database/mongoose";

// Nuvei API endpoints
const NUVEI_ENDPOINTS = {
  int: "https://ppp-test.nuvei.com/ppp/api/v1",
  prod: "https://secure.safecharge.com/ppp/api/v1",
};

// SDK CDN URLs
export const NUVEI_SDK_URL =
  "https://cdn.safecharge.com/safecharge_resources/v1/websdk/safecharge.js";

interface NuveiCredentials {
  merchantId: string;
  siteId: string;
  secretKey: string;
  dmnUrl?: string;
  successUrl?: string;
  pendingUrl?: string;
  backUrl?: string;
  failureUrl?: string;
  testMode: boolean;
}

interface _PaymentStatusParams {
  sessionToken: string;
}

interface WithdrawalResponse {
  status: "SUCCESS" | "ERROR";
  errCode: number;
  reason?: string;
  wdRequestId?: string;
  wdRequestStatus?: string;
  merchantWDRequestId?: string;
  userTokenId?: string;
  merchantId?: string;
  merchantSiteId?: string;
  transactionId?: string;
  transactionStatus?: string;
  userPaymentOptionId?: string;
}

interface PaymentStatusResponse {
  transactionStatus: "APPROVED" | "DECLINED" | "PENDING" | "ERROR";
  gwExtendedErrorCode: number;
  errCode: number;
  reason: string;
  authCode?: string;
  transactionId?: string;
  amount?: string;
  currency?: string;
  merchantSiteId: string;
  transactionType?: string;
  clientUniqueId?: string;
  status: "SUCCESS" | "ERROR";
  paymentOption?: {
    userPaymentOptionId?: string;
    card?: {
      uniqueCC?: string;
    };
  };
}

class NuveiService {
  /**
   * Get Nuvei credentials from database or environment variables
   */
  async getCredentials(): Promise<NuveiCredentials | null> {
    // First try to get from database
    try {
      await connectToDatabase();

      const provider = await PaymentProvider.findOne({
        slug: "nuvei",
        isActive: true,
      });

      if (provider) {
        const credentials: NuveiCredentials = {
          merchantId: "",
          siteId: "",
          secretKey: "",
          testMode: provider.testMode,
        };

        for (const cred of provider.credentials) {
          switch (cred.key) {
            case "merchant_id":
              credentials.merchantId = cred.value;
              break;
            case "site_id":
              credentials.siteId = cred.value;
              break;
            case "secret_key":
              credentials.secretKey = cred.value;
              break;
            case "dmn_url":
              credentials.dmnUrl = cred.value;
              break;
            case "success_url":
              credentials.successUrl = cred.value;
              break;
            case "pending_url":
              credentials.pendingUrl = cred.value;
              break;
            case "back_url":
              credentials.backUrl = cred.value;
              break;
            case "failure_url":
              credentials.failureUrl = cred.value;
              break;
          }
        }

        if (
          credentials.merchantId &&
          credentials.siteId &&
          credentials.secretKey
        ) {
          return credentials;
        }
      }
    } catch (error) {
      console.error("💳 Error reading Nuvei from database:", error);
    }

    // Fallback to environment variables
    const envCredentials: NuveiCredentials = {
      merchantId: process.env.NUVEI_MERCHANT_ID || "",
      siteId: process.env.NUVEI_SITE_ID || "",
      secretKey: process.env.NUVEI_SECRET_KEY || "",
      dmnUrl: process.env.NUVEI_DMN_URL,
      successUrl: process.env.NUVEI_SUCCESS_URL,
      pendingUrl: process.env.NUVEI_PENDING_URL,
      backUrl: process.env.NUVEI_BACK_URL,
      failureUrl: process.env.NUVEI_FAILURE_URL,
      testMode: process.env.NUVEI_TEST_MODE !== "false",
    };

    if (
      !envCredentials.merchantId ||
      !envCredentials.siteId ||
      !envCredentials.secretKey
    ) {
      return null;
    }

    return envCredentials;
  }

  /**
   * Get API base URL based on test mode
   */
  getApiUrl(testMode: boolean): string {
    return testMode ? NUVEI_ENDPOINTS.int : NUVEI_ENDPOINTS.prod;
  }

  /**
   * Calculate checksum for getPaymentStatus
   * SHA256(merchantId + merchantSiteId + clientRequestId + timeStamp + secretKey)
   */
  calculatePaymentStatusChecksum(
    merchantId: string,
    siteId: string,
    clientRequestId: string,
    timeStamp: string,
    secretKey: string,
  ): string {
    const data = `${merchantId}${siteId}${clientRequestId}${timeStamp}${secretKey}`;
    return crypto.createHash("sha256").update(data).digest("hex");
  }

  /**
   * Generate timestamp in Nuvei format (YYYYMMDDHHmmss)
   */
  generateTimeStamp(): string {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    const day = String(now.getUTCDate()).padStart(2, "0");
    const hours = String(now.getUTCHours()).padStart(2, "0");
    const minutes = String(now.getUTCMinutes()).padStart(2, "0");
    const seconds = String(now.getUTCSeconds()).padStart(2, "0");
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  /**
   * Server-to-Server: Get Payment Status
   * Verify the payment status with Nuvei
   */
  async getPaymentStatus(
    sessionToken: string,
    _clientUniqueId?: string,
  ): Promise<
    | {
        status: "APPROVED" | "DECLINED" | "PENDING" | "ERROR";
        reason?: string;
        transactionId?: string;
      }
    | { error: string }
  > {
    const credentials = await this.getCredentials();
    if (!credentials) {
      return { error: "Nuvei not configured or not active" };
    }

    const apiUrl = this.getApiUrl(credentials.testMode);
    const timeStamp = this.generateTimeStamp();
    const clientRequestId = `status_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const checksum = this.calculatePaymentStatusChecksum(
      credentials.merchantId,
      credentials.siteId,
      clientRequestId,
      timeStamp,
      credentials.secretKey,
    );

    const requestBody = {
      merchantId: credentials.merchantId,
      merchantSiteId: credentials.siteId,
      sessionToken,
      clientRequestId,
      timeStamp,
      checksum,
    };

    try {
      const response = await fetch(`${apiUrl}/getPaymentStatus.do`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const data: PaymentStatusResponse = await response.json();

      return {
        status:
          data.transactionStatus ||
          (data.status === "ERROR" ? "ERROR" : "PENDING"),
        reason: data.reason,
        transactionId: data.transactionId,
      };
    } catch (error) {
      console.error("Nuvei getPaymentStatus error:", error);
      return { error: "Failed to get payment status" };
    }
  }

  /**
   * Check if Nuvei is enabled and configured
   */
  async isEnabled(): Promise<boolean> {
    const credentials = await this.getCredentials();
    return credentials !== null;
  }

  /**
   * Submit a payout (withdrawal) using an existing UPO
   * Uses the /payout.do endpoint (REST API) — NOT /withdraw.do (Cashier-only)
   *
   * Reason: /withdraw.do is part of Nuvei's Cashier/Simply Connect managed flow
   * and returns 404 for REST API integrations. /payout.do is the correct REST endpoint.
   *
   * Documentation: https://docs.nuvei.com/documentation/features/financial-operations/payout/
   */
  async submitPayout(params: {
    userTokenId: string;
    amount: string;
    currency: string;
    clientUniqueId: string;
    userPaymentOptionId: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    notificationUrl?: string;
  }): Promise<WithdrawalResponse | { error: string }> {
    if (!params.userPaymentOptionId) {
      return { error: "No payment option available for payout" };
    }

    const credentials = await this.getCredentials();
    if (!credentials) {
      return { error: "Nuvei not configured or not active" };
    }

    const apiUrl = this.getApiUrl(credentials.testMode);
    const timeStamp = this.generateTimeStamp();
    const clientRequestId = `payout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Checksum for /payout:
    // SHA256(merchantId + merchantSiteId + clientRequestId + amount + currency + timeStamp + secretKey)
    const checksumString =
      credentials.merchantId +
      credentials.siteId +
      clientRequestId +
      params.amount +
      params.currency +
      timeStamp +
      credentials.secretKey;
    const checksum = crypto
      .createHash("sha256")
      .update(checksumString)
      .digest("hex");

    const requestBody: Record<string, unknown> = {
      merchantId: credentials.merchantId,
      merchantSiteId: credentials.siteId,
      clientRequestId,
      clientUniqueId: params.clientUniqueId,
      userTokenId: params.userTokenId,
      amount: params.amount,
      currency: params.currency,
      userPaymentOption: {
        userPaymentOptionId: String(params.userPaymentOptionId),
      },
      timeStamp,
      checksum,
    };

    if (params.email || params.firstName || params.lastName) {
      requestBody.userDetails = {
        email: params.email,
        firstName: params.firstName,
        lastName: params.lastName,
      };
    }

    if (params.notificationUrl) {
      requestBody.urlDetails = {
        notificationUrl: params.notificationUrl,
      };
    }

    console.log("🏦 Nuvei submitPayout:", `${apiUrl}/payout.do`);
    console.log("📤 REQUEST BODY:");
    console.log(
      JSON.stringify({ ...requestBody, checksum: "[HIDDEN]" }, null, 2),
    );

    try {
      const response = await fetch(`${apiUrl}/payout.do`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      // Reason: Nuvei sometimes returns HTML error pages (e.g., gateway errors, 5xx).
      const responseText = await response.text();
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(responseText);
      } catch {
        console.error("❌ Nuvei returned non-JSON response (HTTP", response.status + "):");
        console.error("   Body preview:", responseText.slice(0, 300));
        return { error: `Nuvei returned non-JSON response (HTTP ${response.status}). Possible server/gateway error.` };
      }

      console.log("📥 RESPONSE:", JSON.stringify(data, null, 2));

      // For /payout, transactionStatus can be APPROVED, PENDING, DECLINED, ERROR
      const isSuccess =
        data.status === "SUCCESS" &&
        (data.transactionStatus === "APPROVED" ||
          data.transactionStatus === "PENDING");

      if (isSuccess) {
        console.log(
          "✅ Payout submitted successfully:",
          data.transactionId,
          "Status:",
          data.transactionStatus,
        );
        return {
          status: "SUCCESS",
          errCode: 0,
          reason: "",
          wdRequestId: data.transactionId as string,
          wdRequestStatus: data.transactionStatus as string,
          transactionStatus: data.transactionStatus as string,
          transactionId: data.transactionId as string,
          merchantId: data.merchantId as string,
          merchantSiteId: data.merchantSiteId as string,
          userTokenId: data.userTokenId as string,
          userPaymentOptionId: data.userPaymentOptionId as string,
        };
      } else {
        console.error(
          "❌ Payout failed:",
          data.reason || data.gwErrorReason || data.transactionStatus,
        );
        return {
          error:
            (data.reason as string) ||
            (data.gwErrorReason as string) ||
            `Payout failed: ${data.transactionStatus || "Unknown error"} (code: ${data.errCode || data.gwErrorCode || "N/A"})`,
        };
      }
    } catch (error) {
      console.error("❌ Nuvei payout error:", error);
      return { error: "Failed to process payout" };
    }
  }
}

// Export singleton
export const nuveiService = new NuveiService();
export default nuveiService;
