/**
 * Atlas Payment Service
 * Hosted-form (redirect) deposit integration for the "Atlas" PSP.
 *
 * This is a PARALLEL adapter that funnels into the same provider-agnostic
 * spine used by Nuvei/Stripe/Paddle (completeDeposit, recordDepositFee, fraud,
 * reconciliation). It never edits the shared spine.
 *
 * Atlas flow (from the provider's API spec — see payment.md):
 *   1. Server calls POST /payments → receives { payment_url, payment_id }.
 *   2. User is redirected to payment_url (Atlas-hosted form) to pay.
 *   3. Atlas redirects the user back to success_url / fail_url.
 *   4. Atlas POSTs a status-change callback to our PaymentCallbackUrl which is
 *      the authoritative event that credits the wallet.
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

// Default Atlas API base (overridable per-environment via the `api_base_url`
// credential or ATLAS_API_BASE_URL env var).
const ATLAS_DEFAULT_BASE = "https://api.7995-endpoint-b.com/api/v2";

/**
 * Atlas transaction_status_code values (see payment.md §5.1.3 / §6.2).
 */
export const ATLAS_STATUS = {
  DECLINED: -1,
  NEW: 0,
  PROCESSING: 1,
  COMPLETED: 2,
} as const;

export interface AtlasCredentials {
  clientId: string;
  clientSecret: string;
  /** Atlas-issued identifier of the payment-receiving member (our account). */
  userId: string;
  apiBaseUrl: string;
  successUrl?: string;
  failUrl?: string;
  callbackUrl?: string;
  testMode: boolean;
}

export interface CreatePaymentParams {
  /** Amount to charge, decimal string or number. */
  amount: number;
  currency: string;
  /** Free-text message shown on the Atlas form. */
  message?: string;
  successUrl: string;
  failUrl: string;
  /**
   * Up to 100 chars echoed back on every callback — we use it to correlate the
   * Atlas payment to our internal WalletTransaction (`txn_<id>`).
   */
  additionalData: string;
  /** Beneficiary website URL where the payment link is fired. */
  beneficiaryUrl?: string;
  /** Expiration in minutes (Atlas default is 60). */
  timeoutMinutes?: number;
  /**
   * If true Atlas subtracts its commission from `amount`; if false it adds the
   * commission on top of `amount`. Defaults to true so the payer is charged the
   * exact amount our UI shows and the PSP commission is our cost.
   */
  commissionIncluded?: boolean;
}

export interface CreatePaymentResult {
  paymentUrl: string;
  paymentId: string;
  userId: string;
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

function mask(value: string | undefined): string {
  if (!value) return "MISSING";
  return value.length <= 4 ? "***" : "***" + value.slice(-4);
}

class AtlasService {
  /**
   * Load Atlas credentials from the PaymentProvider collection, falling back to
   * environment variables. Mirrors nuveiService.getCredentials().
   */
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

        console.log("💳 Atlas credentials from DB:", {
          clientId: mask(credentials.clientId),
          clientSecret: credentials.clientSecret ? "[SET]" : "MISSING",
          userId: mask(credentials.userId),
          testMode: credentials.testMode,
        });

        if (credentials.clientId && credentials.clientSecret) {
          return credentials;
        }
      }
    } catch (error) {
      console.error("💳 Error reading Atlas from database:", error);
    }

    // Fallback to environment variables.
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

  /** ISO8601 timestamp used for X-Api-RequestDate. */
  generateRequestDate(): string {
    return new Date().toISOString();
  }

  /**
   * Request signature: SHA-512(ClientId + RequestDate + ClientSecret).
   */
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

  /**
   * Callback signature: SHA-512(ClientId + rawBody + ClientSecret).
   */
  signCallback(
    clientId: string,
    rawBody: string,
    clientSecret: string,
  ): string {
    return crypto
      .createHash("sha512")
      .update(`${clientId}${rawBody}${clientSecret}`)
      .digest("hex");
  }

  /**
   * Constant-time compare of the X-Signature header against the locally
   * recomputed callback signature.
   */
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

  /**
   * Create a hosted-form payment. Returns the redirect URL + payment id.
   */
  async createPayment(
    params: CreatePaymentParams,
  ): Promise<CreatePaymentResult | { error: string }> {
    const credentials = await this.getCredentials();
    if (!credentials) {
      return { error: "Atlas not configured or not active" };
    }

    const requestBody: Record<string, unknown> = {
      user_id: credentials.userId,
      amount: Number(params.amount),
      currency: params.currency,
      message: params.message || "Deposit",
      success_url: params.successUrl,
      fail_url: params.failUrl,
      recurring: false,
      commission_included: params.commissionIncluded ?? true,
      additional_data: params.additionalData.slice(0, 100),
    };
    if (params.timeoutMinutes) requestBody.timeout = params.timeoutMinutes;
    if (params.beneficiaryUrl) requestBody.beneficiary_url = params.beneficiaryUrl;

    console.log("📤 Atlas createPayment request:", {
      amount: requestBody.amount,
      currency: requestBody.currency,
      additional_data: requestBody.additional_data,
      commission_included: requestBody.commission_included,
    });

    try {
      const response = await fetch(`${credentials.apiBaseUrl}/payments`, {
        method: "POST",
        headers: this.authHeaders(credentials),
        body: JSON.stringify(requestBody),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.data?.payment_url) {
        console.error("❌ Atlas createPayment failed:", {
          status: response.status,
          code: data?.code,
          error: data?.error || data?.error_message,
        });
        return {
          error:
            data?.error || data?.error_message || "Failed to create Atlas payment",
        };
      }

      console.log("📥 Atlas createPayment success:", {
        paymentId: data.data.payment_id,
      });

      return {
        paymentUrl: data.data.payment_url,
        paymentId: String(data.data.payment_id),
        userId: String(data.data.user_id ?? credentials.userId),
      };
    } catch (error) {
      console.error("❌ Atlas createPayment error:", error);
      return { error: "Failed to connect to Atlas" };
    }
  }

  /**
   * Server-to-server status poll (fallback when the callback is delayed).
   * Returns the latest record for the given payment id, or an error.
   */
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

  /** True when Atlas has the minimum credentials to operate. */
  async isEnabled(): Promise<boolean> {
    const credentials = await this.getCredentials();
    return credentials !== null;
  }

  /** Client-safe config (no secrets) for /api/payment-config. */
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
