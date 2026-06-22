/**
 * Atlas Payment Service — ADMIN MIRROR
 * Keep in sync with the main app's lib/services/atlas.service.ts. The admin app
 * resolves `@/` to apps/admin, so it needs its own copy (same pattern as the
 * existing apps/admin/lib/services/nuvei.service.ts mirror).
 *
 * Used by the admin "complete pending payment" tool to verify an Atlas payment
 * status before manually completing a deposit.
 *
 * Auth (request → Atlas):
 *   X-Api-ClientId   = ClientId
 *   X-Api-RequestDate= ISO8601 timestamp
 *   X-Api-Signature  = SHA-512(ClientId + X-Api-RequestDate + ClientSecret)
 *
 * Callback auth (Atlas → us):
 *   X-Signature      = SHA-512(ClientId + rawBody + ClientSecret)
 */

import crypto from "crypto";
import PaymentProvider from "@/database/models/payment-provider.model";
import { connectToDatabase } from "@/database/mongoose";

const ATLAS_DEFAULT_BASE = "https://api.7995-endpoint-b.com/api/v2";

export const ATLAS_STATUS = {
  DECLINED: -1,
  NEW: 0,
  PROCESSING: 1,
  COMPLETED: 2,
} as const;

export interface AtlasCredentials {
  clientId: string;
  clientSecret: string;
  userId: string;
  apiBaseUrl: string;
  successUrl?: string;
  failUrl?: string;
  callbackUrl?: string;
  testMode: boolean;
}

export interface AtlasPaymentRecord {
  user_id?: string;
  sender?: string;
  payment_id: string;
  amount?: number;
  currency?: string;
  message?: string;
  date?: string;
  additional_data?: string;
  transaction_id?: string;
  transaction_status_code: number;
  transaction_status_text?: string;
  transaction_status_data?: string;
  payment_method_id?: string;
  payment_method_name?: string;
  payment_method_data?: string;
  payer_ip?: string;
  payer_country?: string;
  payer_email?: string;
}

class AtlasService {
  async getCredentials(): Promise<AtlasCredentials | null> {
    try {
      await connectToDatabase();

      const provider = (await PaymentProvider.findOne({
        slug: "atlas",
        isActive: true,
      }).lean()) as {
        testMode?: boolean;
        credentials?: Array<{ key: string; value: string }>;
      } | null;

      if (provider) {
        const credentials: AtlasCredentials = {
          clientId: "",
          clientSecret: "",
          userId: "",
          apiBaseUrl: ATLAS_DEFAULT_BASE,
          testMode: provider.testMode ?? true,
        };

        for (const cred of provider.credentials || []) {
          switch (cred.key) {
            case "client_id":
              credentials.clientId = cred.value;
              break;
            case "client_secret":
              credentials.clientSecret = cred.value;
              break;
            case "user_id":
              credentials.userId = cred.value;
              break;
            case "api_base_url":
              if (cred.value) credentials.apiBaseUrl = cred.value;
              break;
            case "success_url":
              credentials.successUrl = cred.value;
              break;
            case "fail_url":
              credentials.failUrl = cred.value;
              break;
            case "callback_url":
              credentials.callbackUrl = cred.value;
              break;
          }
        }

        if (credentials.clientId && credentials.clientSecret) {
          return credentials;
        }
      }
    } catch (error) {
      console.error("💳 Error reading Atlas from database:", error);
    }

    const envCredentials: AtlasCredentials = {
      clientId: process.env.ATLAS_CLIENT_ID || "",
      clientSecret: process.env.ATLAS_CLIENT_SECRET || "",
      userId: process.env.ATLAS_USER_ID || "",
      apiBaseUrl: process.env.ATLAS_API_BASE_URL || ATLAS_DEFAULT_BASE,
      successUrl: process.env.ATLAS_SUCCESS_URL,
      failUrl: process.env.ATLAS_FAIL_URL,
      callbackUrl: process.env.ATLAS_CALLBACK_URL,
      testMode: process.env.ATLAS_TEST_MODE !== "false",
    };

    if (!envCredentials.clientId || !envCredentials.clientSecret) {
      return null;
    }

    return envCredentials;
  }

  generateRequestDate(): string {
    return new Date().toISOString();
  }

  signRequest(
    clientId: string,
    requestDate: string,
    clientSecret: string,
  ): string {
    return crypto
      .createHash("sha512")
      .update(`${clientId}${requestDate}${clientSecret}`)
      .digest("hex");
  }

  signCallback(clientId: string, rawBody: string, clientSecret: string): string {
    return crypto
      .createHash("sha512")
      .update(`${clientId}${rawBody}${clientSecret}`)
      .digest("hex");
  }

  verifyCallbackSignature(
    clientId: string,
    rawBody: string,
    clientSecret: string,
    receivedSignature: string,
  ): boolean {
    if (!receivedSignature) return false;
    const expected = this.signCallback(clientId, rawBody, clientSecret);
    const a = Buffer.from(expected.toLowerCase(), "utf8");
    const b = Buffer.from(receivedSignature.trim().toLowerCase(), "utf8");
    if (a.length !== b.length) return false;
    try {
      return crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  private authHeaders(credentials: AtlasCredentials): Record<string, string> {
    const requestDate = this.generateRequestDate();
    const signature = this.signRequest(
      credentials.clientId,
      requestDate,
      credentials.clientSecret,
    );
    return {
      "Content-Type": "application/json",
      "X-Api-ClientId": credentials.clientId,
      "X-Api-RequestDate": requestDate,
      "X-Api-Signature": signature,
    };
  }

  async getPaymentStatus(
    paymentId: string,
  ): Promise<AtlasPaymentRecord | { error: string }> {
    const credentials = await this.getCredentials();
    if (!credentials) {
      return { error: "Atlas not configured or not active" };
    }

    try {
      const url = `${credentials.apiBaseUrl}/payments?payment_ids=${encodeURIComponent(paymentId)}`;
      const response = await fetch(url, {
        method: "GET",
        headers: this.authHeaders(credentials),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(data?.data)) {
        return {
          error:
            data?.error || data?.error_message || "Failed to get Atlas status",
        };
      }

      const record = (data.data as AtlasPaymentRecord[]).find(
        (r) => String(r.payment_id) === String(paymentId),
      );
      if (!record) return { error: "Payment not found" };
      return record;
    } catch (error) {
      console.error("❌ Atlas getPaymentStatus error:", error);
      return { error: "Failed to get payment status" };
    }
  }

  async isEnabled(): Promise<boolean> {
    const credentials = await this.getCredentials();
    return credentials !== null;
  }

  async getClientConfig(): Promise<{ enabled: boolean; testMode?: boolean }> {
    try {
      const credentials = await this.getCredentials();
      if (!credentials) return { enabled: false };
      return { enabled: true, testMode: credentials.testMode };
    } catch (error) {
      console.error("💳 Atlas getClientConfig error:", error);
      return { enabled: false };
    }
  }
}

export const atlasService = new AtlasService();
