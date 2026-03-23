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
   * Create a withdrawal request in Nuvei (Manual Mode)
   * Creates a request that waits for merchant approval via approveWDRequest/declineWDRequest
   * See: https://docs.nuvei.com/documentation/features/financial-operations/withdrawal/
   */
  async createWithdrawRequest(params: {
    userTokenId: string;
    amount: string;
    currency: string;
    merchantWDRequestId: string;
    userPaymentOptionId: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    notificationUrl?: string;
  }): Promise<WithdrawalResponse | { error: string }> {
    const credentials = await this.getCredentials();
    if (!credentials) {
      return { error: "Nuvei not configured or not active" };
    }

    const apiUrl = this.getApiUrl(credentials.testMode);
    const timeStamp = this.generateTimeStamp();
    const clientRequestId = `wdreq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Checksum: SHA256(merchantId + merchantSiteId + clientRequestId + amount + currency + timeStamp + secretKey)
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
      userTokenId: params.userTokenId,
      merchantWDRequestId: params.merchantWDRequestId,
      amount: params.amount,
      currency: params.currency,
      userPaymentOption: {
        userPaymentOptionId: params.userPaymentOptionId,
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

    console.log("🏦 Nuvei createWithdrawRequest:", `${apiUrl}/withdraw.do`);

    try {
      const response = await fetch(`${apiUrl}/withdraw.do`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (data.status === "SUCCESS" && data.errCode === 0) {
        console.log("✅ Withdrawal request created:", data.wdRequestId);
        return {
          status: "SUCCESS",
          errCode: 0,
          reason: "",
          wdRequestId: data.wdRequestId,
          wdRequestStatus: data.wdRequestStatus || "Pending",
          merchantId: data.merchantId,
          merchantSiteId: data.merchantSiteId,
          userTokenId: data.userTokenId,
        } as WithdrawalResponse;
      } else {
        console.error(
          "❌ Withdrawal request failed:",
          data.reason || data.gwErrorReason,
        );
        return {
          error:
            data.reason ||
            data.gwErrorReason ||
            `Withdrawal request failed (code: ${data.errCode})`,
        };
      }
    } catch (error) {
      console.error("❌ Nuvei createWithdrawRequest error:", error);
      return { error: "Failed to create withdrawal request" };
    }
  }

  /**
   * Approve a withdrawal request in Nuvei (Manual Mode)
   * Call this when admin marks a withdrawal as completed
   * Nuvei will then process the actual payout to the user
   */
  async approveWithdrawRequest(params: {
    wdRequestId: string;
    merchantWDRequestId?: string;
  }): Promise<{ success: boolean; error?: string; data?: Record<string, unknown> }> {
    const credentials = await this.getCredentials();
    if (!credentials) {
      return { success: false, error: "Nuvei not configured or not active" };
    }

    const apiUrl = this.getApiUrl(credentials.testMode);
    const timeStamp = this.generateTimeStamp();
    const clientRequestId = `appwd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Checksum: SHA256(merchantId + merchantSiteId + clientRequestId + wdRequestId + timeStamp + secretKey)
    const checksumString =
      credentials.merchantId +
      credentials.siteId +
      clientRequestId +
      params.wdRequestId +
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
      wdRequestId: params.wdRequestId,
      timeStamp,
      checksum,
    };

    if (params.merchantWDRequestId) {
      requestBody.merchantWDRequestId = params.merchantWDRequestId;
    }

    console.log(
      "🏦 Nuvei approveWithdrawRequest:",
      `${apiUrl}/approveWDRequest.do`,
    );

    try {
      const response = await fetch(`${apiUrl}/approveWDRequest.do`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (data.status === "SUCCESS" && data.errCode === 0) {
        console.log("✅ Withdrawal request approved in Nuvei");
        return { success: true, data };
      } else {
        console.error("❌ Approve withdrawal failed:", data.reason);
        return {
          success: false,
          error: data.reason || `Failed to approve (code: ${data.errCode})`,
          data,
        };
      }
    } catch (error) {
      console.error("❌ Nuvei approveWithdrawRequest error:", error);
      return { success: false, error: "Failed to approve withdrawal request" };
    }
  }

  /**
   * Decline a withdrawal request in Nuvei (Manual Mode)
   * Call this when admin rejects/cancels a withdrawal
   * This cancels the pending request in Nuvei — no payout will be made
   */
  async declineWithdrawRequest(params: {
    wdRequestId: string;
    merchantWDRequestId?: string;
  }): Promise<{ success: boolean; error?: string; data?: Record<string, unknown> }> {
    const credentials = await this.getCredentials();
    if (!credentials) {
      return { success: false, error: "Nuvei not configured or not active" };
    }

    const apiUrl = this.getApiUrl(credentials.testMode);
    const timeStamp = this.generateTimeStamp();
    const clientRequestId = `decwd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Checksum: SHA256(merchantId + merchantSiteId + clientRequestId + wdRequestId + timeStamp + secretKey)
    const checksumString =
      credentials.merchantId +
      credentials.siteId +
      clientRequestId +
      params.wdRequestId +
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
      wdRequestId: params.wdRequestId,
      timeStamp,
      checksum,
    };

    if (params.merchantWDRequestId) {
      requestBody.merchantWDRequestId = params.merchantWDRequestId;
    }

    console.log(
      "🏦 Nuvei declineWithdrawRequest:",
      `${apiUrl}/declineWDRequest.do`,
    );

    try {
      const response = await fetch(`${apiUrl}/declineWDRequest.do`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (data.status === "SUCCESS" && data.errCode === 0) {
        console.log("✅ Withdrawal request declined in Nuvei");
        return { success: true, data };
      } else {
        console.error("❌ Decline withdrawal failed:", data.reason);
        return {
          success: false,
          error: data.reason || `Failed to decline (code: ${data.errCode})`,
          data,
        };
      }
    } catch (error) {
      console.error("❌ Nuvei declineWithdrawRequest error:", error);
      return { success: false, error: "Failed to decline withdrawal request" };
    }
  }
}

// Export singleton
export const nuveiService = new NuveiService();
export default nuveiService;
