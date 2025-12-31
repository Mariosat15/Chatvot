/**
 * Nuvei Payment Service
 * Handles Nuvei Web SDK integration for deposits
 * 
 * Documentation: https://docs.nuvei.com/documentation/accept-payment/web-sdk/
 */

import crypto from 'crypto';
import PaymentProvider from '@/database/models/payment-provider.model';
import { connectToDatabase } from '@/database/mongoose';

// Nuvei API endpoints
const NUVEI_ENDPOINTS = {
  int: 'https://ppp-test.nuvei.com/ppp/api/v1',
  prod: 'https://secure.safecharge.com/ppp/api/v1',
};

// SDK CDN URLs
export const NUVEI_SDK_URL = 'https://cdn.safecharge.com/safecharge_resources/v1/websdk/safecharge.js';

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

interface OpenOrderParams {
  amount: string;
  currency: string;
  clientUniqueId: string;
  clientRequestId?: string;
  userEmail?: string;
  userCountry?: string;
  notificationUrl?: string;
  // CRITICAL: userTokenId is required for UPO (User Payment Option) storage
  // Without this, payment methods won't be saved for future refunds
  userTokenId?: string;
}

interface OpenOrderResponse {
  sessionToken: string;
  orderId: string;
  merchantId: string;
  merchantSiteId: string;
  clientUniqueId: string;
  status: 'SUCCESS' | 'ERROR';
  errCode: string;
  reason?: string;
  version: string;
}

interface PaymentStatusParams {
  sessionToken: string;
}

interface PaymentStatusResponse {
  transactionStatus: 'APPROVED' | 'DECLINED' | 'PENDING' | 'ERROR';
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
  status: 'SUCCESS' | 'ERROR';
  paymentOption?: {
    userPaymentOptionId?: string;
    card?: {
      uniqueCC?: string;
    };
  };
}

// ========== Withdrawal Types ==========

interface SubmitWithdrawalParams {
  userTokenId: string;           // User's unique identifier in your system
  amount: string;                // Withdrawal amount
  currency: string;              // Currency code (EUR, USD, etc.)
  merchantWDRequestId: string;   // Your unique withdrawal request ID
  merchantUniqueId?: string;     // Additional unique ID
  userDetails?: {
    email?: string;
    firstName?: string;
    lastName?: string;
  };
  // For card withdrawal (refund to original card)
  userPaymentOptionId?: string;  // UPO ID from original deposit
  // For bank transfer
  bankDetails?: {
    bankName?: string;
    bankBranchCode?: string;
    accountNumber?: string;
    iban?: string;
    bic?: string;
    accountHolderName?: string;
  };
  notificationUrl?: string;
}

interface WithdrawalResponse {
  status: 'SUCCESS' | 'ERROR';
  errCode: number;
  reason?: string;
  wdRequestId?: string;
  wdRequestStatus?: 'Pending' | 'Approved' | 'Declined' | 'Processing' | 'Settled' | 'Cancelled';
  merchantWDRequestId?: string;
  userTokenId?: string;
}

interface GetWithdrawalRequestsParams {
  userTokenId: string;
}

interface GetWithdrawalRequestsResponse {
  status: 'SUCCESS' | 'ERROR';
  errCode: number;
  reason?: string;
  withdrawalRequests?: Array<{
    wdRequestId: string;
    wdRequestStatus: string;
    amount: string;
    currency: string;
    creationTime: string;
    merchantWDRequestId?: string;
  }>;
}

interface CancelWithdrawalParams {
  userTokenId: string;
  wdRequestId: string;
}

interface CancelWithdrawalResponse {
  status: 'SUCCESS' | 'ERROR';
  errCode: number;
  reason?: string;
  wdRequestStatus?: string;
}

// ========== Account Capture Types (for Bank Payouts) ==========

interface AccountCaptureParams {
  userTokenId: string;           // User's unique identifier
  paymentMethod: string;         // e.g., 'apmgw_BankPayouts'
  currencyCode: string;          // e.g., 'EUR'
  countryCode: string;           // e.g., 'CY', 'DE'
  languageCode?: string;         // e.g., 'en'
  returnUrl?: string;            // URL to return after capture
}

interface AccountCaptureResponse {
  status: 'SUCCESS' | 'ERROR';
  errCode: number;
  reason?: string;
  redirectUrl?: string;          // URL to redirect user to enter bank details
  sessionToken?: string;
  merchantId?: string;
  merchantSiteId?: string;
  userTokenId?: string;
  internalRequestId?: number;
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
        slug: 'nuvei',
        isActive: true 
      });
      
      console.log('💳 Nuvei provider lookup:', { 
        found: !!provider, 
        isActive: provider?.isActive,
        slug: provider?.slug 
      });
      
      if (provider) {
        const credentials: NuveiCredentials = {
          merchantId: '',
          siteId: '',
          secretKey: '',
          testMode: provider.testMode,
        };
        
        for (const cred of provider.credentials) {
          switch (cred.key) {
            case 'merchant_id':
              credentials.merchantId = cred.value;
              break;
            case 'site_id':
              credentials.siteId = cred.value;
              break;
            case 'secret_key':
              credentials.secretKey = cred.value;
              break;
            case 'dmn_url':
              credentials.dmnUrl = cred.value;
              break;
            case 'success_url':
              credentials.successUrl = cred.value;
              break;
            case 'pending_url':
              credentials.pendingUrl = cred.value;
              break;
            case 'back_url':
              credentials.backUrl = cred.value;
              break;
            case 'failure_url':
              credentials.failureUrl = cred.value;
              break;
          }
        }
        
        console.log('💳 Nuvei credentials from DB:', {
          merchantId: credentials.merchantId ? '***' + credentials.merchantId.slice(-4) : 'MISSING',
          siteId: credentials.siteId ? '***' + credentials.siteId.slice(-4) : 'MISSING',
          secretKey: credentials.secretKey ? '[SET]' : 'MISSING',
          testMode: credentials.testMode,
        });
        
        if (credentials.merchantId && credentials.siteId && credentials.secretKey) {
          return credentials;
        }
      }
    } catch (error) {
      console.error('💳 Error reading Nuvei from database:', error);
    }
    
    // Fallback to environment variables
    const envCredentials: NuveiCredentials = {
      merchantId: process.env.NUVEI_MERCHANT_ID || '',
      siteId: process.env.NUVEI_SITE_ID || '',
      secretKey: process.env.NUVEI_SECRET_KEY || '',
      dmnUrl: process.env.NUVEI_DMN_URL,
      successUrl: process.env.NUVEI_SUCCESS_URL,
      pendingUrl: process.env.NUVEI_PENDING_URL,
      backUrl: process.env.NUVEI_BACK_URL,
      failureUrl: process.env.NUVEI_FAILURE_URL,
      testMode: process.env.NUVEI_TEST_MODE !== 'false',
    };
    
    console.log('💳 Nuvei credentials from ENV:', {
      merchantId: envCredentials.merchantId ? '***' + envCredentials.merchantId.slice(-4) : 'MISSING',
      siteId: envCredentials.siteId ? '***' + envCredentials.siteId.slice(-4) : 'MISSING',
      secretKey: envCredentials.secretKey ? '[SET]' : 'MISSING',
      testMode: envCredentials.testMode,
    });
    
    if (!envCredentials.merchantId || !envCredentials.siteId || !envCredentials.secretKey) {
      console.error('💳 Nuvei credentials incomplete (neither DB nor ENV)');
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
   * Calculate checksum for Nuvei API requests
   * SHA256(merchantId + merchantSiteId + clientRequestId + amount + currency + timeStamp + secretKey)
   */
  calculateChecksum(
    merchantId: string,
    siteId: string,
    clientRequestId: string,
    amount: string,
    currency: string,
    timeStamp: string,
    secretKey: string
  ): string {
    const data = `${merchantId}${siteId}${clientRequestId}${amount}${currency}${timeStamp}${secretKey}`;
    return crypto.createHash('sha256').update(data).digest('hex');
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
    secretKey: string
  ): string {
    const data = `${merchantId}${siteId}${clientRequestId}${timeStamp}${secretKey}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }
  
  /**
   * Generate timestamp in Nuvei format (YYYYMMDDHHmmss)
   */
  generateTimeStamp(): string {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    const hours = String(now.getUTCHours()).padStart(2, '0');
    const minutes = String(now.getUTCMinutes()).padStart(2, '0');
    const seconds = String(now.getUTCSeconds()).padStart(2, '0');
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }
  
  /**
   * Server-to-Server: Open Order (Get Session Token)
   * This must be called from server-side before initializing the Web SDK
   */
  async openOrder(params: OpenOrderParams): Promise<OpenOrderResponse | { error: string }> {
    const credentials = await this.getCredentials();
    if (!credentials) {
      return { error: 'Nuvei not configured or not active' };
    }
    
    const apiUrl = this.getApiUrl(credentials.testMode);
    const timeStamp = this.generateTimeStamp();
    const clientRequestId = params.clientRequestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const checksum = this.calculateChecksum(
      credentials.merchantId,
      credentials.siteId,
      clientRequestId,
      params.amount,
      params.currency,
      timeStamp,
      credentials.secretKey
    );
    
    const requestBody: Record<string, unknown> = {
      merchantId: credentials.merchantId,
      merchantSiteId: credentials.siteId,
      clientUniqueId: params.clientUniqueId,
      clientRequestId,
      currency: params.currency,
      amount: params.amount,
      timeStamp,
      checksum,
      // Transaction type for 3DS - required for SCA compliance
      transactionType: 'Sale',
      // User details for 3DS2
      ...(params.userEmail && { 
        userDetails: {
          email: params.userEmail,
        }
      }),
      // URL details for DMN and redirects
      ...(params.notificationUrl && {
        urlDetails: {
          notificationUrl: params.notificationUrl,
          successUrl: credentials.successUrl,
          pendingUrl: credentials.pendingUrl,
          backUrl: credentials.backUrl,
          failureUrl: credentials.failureUrl,
        }
      }),
    };
    
    // CRITICAL: Add userTokenId if provided - required for UPO storage
    // Without this, Nuvei won't save payment methods for future card refunds
    if (params.userTokenId) {
      requestBody.userTokenId = params.userTokenId;
    }
    
    console.log('📤 Nuvei openOrder request:', {
      clientUniqueId: params.clientUniqueId,
      amount: params.amount,
      currency: params.currency,
      notificationUrl: params.notificationUrl,
      // userTokenId is CRITICAL for UPO storage
      userTokenId: params.userTokenId ? `user_***${params.userTokenId.slice(-8)}` : 'NOT SET',
    });
    
    try {
      const response = await fetch(`${apiUrl}/openOrder.do`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      const data = await response.json();
      
      if (data.status === 'SUCCESS') {
        console.log('📥 Nuvei openOrder success:', {
          sessionToken: data.sessionToken?.substring(0, 20) + '...',
          orderId: data.orderId,
          clientUniqueId: data.clientUniqueId,
        });
        return data as OpenOrderResponse;
      } else {
        console.error('❌ Nuvei openOrder failed:', data);
        return { error: data.reason || 'Failed to create order session' };
      }
    } catch (error) {
      console.error('❌ Nuvei openOrder error:', error);
      return { error: 'Failed to connect to Nuvei' };
    }
  }
  
  /**
   * Server-to-Server: Get Payment Status
   * Verify the payment after createPayment() completes
   */
  async getPaymentStatus(params: PaymentStatusParams): Promise<PaymentStatusResponse | { error: string }> {
    const credentials = await this.getCredentials();
    if (!credentials) {
      return { error: 'Nuvei not configured or not active' };
    }
    
    const apiUrl = this.getApiUrl(credentials.testMode);
    const timeStamp = this.generateTimeStamp();
    const clientRequestId = `status_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const checksum = this.calculatePaymentStatusChecksum(
      credentials.merchantId,
      credentials.siteId,
      clientRequestId,
      timeStamp,
      credentials.secretKey
    );
    
    const requestBody = {
      merchantId: credentials.merchantId,
      merchantSiteId: credentials.siteId,
      sessionToken: params.sessionToken,
      clientRequestId,
      timeStamp,
      checksum,
    };
    
    try {
      const response = await fetch(`${apiUrl}/getPaymentStatus.do`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      const data = await response.json();
      return data as PaymentStatusResponse;
    } catch (error) {
      console.error('Nuvei getPaymentStatus error:', error);
      return { error: 'Failed to get payment status' };
    }
  }
  
  /**
   * Verify DMN (webhook) checksum
   */
  verifyDmnChecksum(params: Record<string, string>, receivedChecksum: string, secretKey: string): boolean {
    // DMN checksum is calculated as SHA256 of all param values (sorted by key) + secretKey
    const sortedKeys = Object.keys(params).sort();
    let data = '';
    for (const key of sortedKeys) {
      if (key !== 'advanceResponseChecksum' && key !== 'responsechecksum') {
        data += params[key];
      }
    }
    data += secretKey;
    
    const calculatedChecksum = crypto.createHash('sha256').update(data).digest('hex');
    return calculatedChecksum === receivedChecksum;
  }
  
  /**
   * Check if Nuvei is enabled and configured
   */
  async isEnabled(): Promise<boolean> {
    const credentials = await this.getCredentials();
    return credentials !== null;
  }
  
  /**
   * Get client-side config (safe to expose to frontend)
   */
  async getClientConfig(): Promise<{
    enabled: boolean;
    merchantId?: string;
    siteId?: string;
    testMode?: boolean;
    sdkUrl: string;
  }> {
    try {
      const credentials = await this.getCredentials();
      
      if (!credentials) {
        console.log('💳 Nuvei getClientConfig: No credentials found');
        return { enabled: false, sdkUrl: NUVEI_SDK_URL };
      }
      
      console.log('💳 Nuvei getClientConfig: Returning enabled config');
      return {
        enabled: true,
        merchantId: credentials.merchantId,
        siteId: credentials.siteId,
        testMode: credentials.testMode,
        sdkUrl: NUVEI_SDK_URL,
      };
    } catch (error) {
      console.error('💳 Nuvei getClientConfig error:', error);
      return { enabled: false, sdkUrl: NUVEI_SDK_URL };
    }
  }
  
  // ========== ACCOUNT CAPTURE (for Bank Payouts) ==========
  
  /**
   * Initiate account capture for bank payouts
   * This redirects the user to Nuvei's page to enter their bank details
   * Once completed, Nuvei sends a DMN with the userPaymentOptionId
   * 
   * Documentation: https://docs.nuvei.com/documentation/global-guides/local-bank-payouts/
   */
  async accountCapture(params: AccountCaptureParams): Promise<AccountCaptureResponse | { error: string }> {
    const credentials = await this.getCredentials();
    if (!credentials) {
      return { error: 'Nuvei not configured or not active' };
    }
    
    const apiUrl = this.getApiUrl(credentials.testMode);
    const timeStamp = this.generateTimeStamp();
    const clientRequestId = `ac_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    // Remove trailing slash from baseUrl to avoid double slashes
    const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://chartvolt.com').replace(/\/$/, '');
    
    // Per Nuvei documentation for Local Bank Payouts:
    // "Generate a sessionToken. Press here for details." -> refers to /getSessionToken
    // NOT /openOrder - the docs example explicitly shows "/getSessionToken"
    // See: https://docs.nuvei.com/documentation/global-guides/local-bank-payouts/
    
    // Calculate checksum for getSessionToken: merchantId + merchantSiteId + clientRequestId + timeStamp + secretKey
    const checksumString = credentials.merchantId 
      + credentials.siteId 
      + clientRequestId 
      + timeStamp 
      + credentials.secretKey;
    const checksum = crypto.createHash('sha256').update(checksumString).digest('hex');
    
    const getSessionTokenRequest = {
      merchantId: credentials.merchantId,
      merchantSiteId: credentials.siteId,
      clientRequestId,
      timeStamp,
      checksum,
    };
    
    console.log('🏦 Getting session token via /getSessionToken for accountCapture...');
    
    try {
      // Get session token via getSessionToken (as per Nuvei docs)
      const sessionResponse = await fetch(`${apiUrl}/getSessionToken.do`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(getSessionTokenRequest),
      });
      
      const sessionData = await sessionResponse.json();
      
      if (sessionData.status !== 'SUCCESS') {
        console.error('🏦 Failed to get session token:', sessionData);
        return { error: sessionData.reason || 'Failed to initialize bank capture session' };
      }
      
      const sessionToken = sessionData.sessionToken;
      console.log('🏦 Session token obtained via getSessionToken:', sessionToken?.substring(0, 20) + '...');
      
      // Now call accountCapture with the session token
      // Per Nuvei docs example - use EXACT minimal fields as shown in documentation:
      // https://docs.nuvei.com/documentation/global-guides/local-bank-payouts/
      const currency = params.currencyCode || 'EUR';
      
      // Based on Nuvei docs + error feedback:
      // - languageCode is REQUIRED (despite not being in docs example)
      const accountCaptureRequest: Record<string, string> = {
        sessionToken,
        merchantId: credentials.merchantId,
        merchantSiteId: credentials.siteId,
        userTokenId: params.userTokenId,
        paymentMethod: params.paymentMethod,
        currencyCode: currency,
        countryCode: params.countryCode,
        languageCode: params.languageCode || 'en',
      };
      
      console.log('\n');
      console.log('╔════════════════════════════════════════════════════════════╗');
      console.log('║     NUVEI ACCOUNT CAPTURE REQUEST                          ║');
      console.log('╚════════════════════════════════════════════════════════════╝');
      console.log('📤 ENDPOINT:', `${apiUrl}/accountCapture.do`);
      console.log('📤 REQUEST BODY:');
      console.log(JSON.stringify(accountCaptureRequest, null, 2));
      
      const captureResponse = await fetch(`${apiUrl}/accountCapture.do`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(accountCaptureRequest),
      });
      
      const captureData = await captureResponse.json();
      
      console.log('📥 RESPONSE:');
      console.log(JSON.stringify(captureData, null, 2));
      console.log('╚════════════════════════════════════════════════════════════╝\n');
      
      if (captureData.status === 'SUCCESS' && captureData.redirectUrl) {
        console.log('🏦 Account capture redirect URL obtained');
        return captureData as AccountCaptureResponse;
      } else {
        console.error('🏦 Account capture failed:', captureData);
        return { 
          error: captureData.reason || `Account capture failed (code: ${captureData.errCode})`,
          ...captureData,
        };
      }
    } catch (error) {
      console.error('🏦 Nuvei accountCapture error:', error);
      return { error: 'Failed to initiate account capture' };
    }
  }
  
  // ========== SEPA BANK PAYOUT METHODS ==========
  
  /**
   * Add a SEPA bank account as a User Payment Option (UPO)
   * This is the CORRECT method for European bank payouts
   * 
   * Instead of /accountCapture (which requires redirect), this uses /addUPOAPM
   * which allows direct IBAN submission without redirect.
   * 
   * IMPORTANT: /addUPOAPM uses CHECKSUM authentication ONLY (NO sessionToken!)
   * See: https://docs.nuvei.com/documentation/features/financial-operations/payout/#add-upo-addupoapm
   * 
   * @param params - User token ID, IBAN, and billing details
   * @returns userPaymentOptionId for use in /payout requests
   */
  async addSepaUpo(params: {
    userTokenId: string;
    iban: string;
    bic?: string;
    accountHolderName?: string;
    email: string;
    country: string;
    firstName?: string;
    lastName?: string;
  }): Promise<{ userPaymentOptionId?: string; error?: string }> {
    const credentials = await this.getCredentials();
    if (!credentials) {
      return { error: 'Nuvei not configured or not active' };
    }
    
    const apiUrl = this.getApiUrl(credentials.testMode);
    const timeStamp = this.generateTimeStamp();
    const clientRequestId = `add_upo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Clean and format IBAN (remove spaces, uppercase)
    const cleanIban = params.iban.replace(/\s/g, '').toUpperCase();
    // Clean and format BIC
    const cleanBic = params.bic ? params.bic.replace(/\s/g, '').toUpperCase() : undefined;
    
    const paymentMethodName = 'apmgw_SEPA';
    const firstName = params.firstName || 'N/A';
    const lastName = params.lastName || 'N/A';
    
    // Standard checksum for Nuvei REST API endpoints:
    // SHA256(merchantId + merchantSiteId + clientRequestId + timeStamp + secretKey)
    // This is the same formula used by getPaymentStatus, getUserUPOs, etc.
    // The "all field values" approach is for Withdrawal API REDIRECTS, not REST API calls
    const checksumString = credentials.merchantId 
      + credentials.siteId 
      + clientRequestId 
      + timeStamp 
      + credentials.secretKey;
    
    const checksum = crypto.createHash('sha256').update(checksumString).digest('hex');
    
    // Build apmData with SEPA-specific fields
    const apmData: Record<string, string> = {
      iban: cleanIban,
    };
    if (cleanBic) {
      apmData.bic = cleanBic;
    }
    if (params.accountHolderName) {
      apmData.accountHolderName = params.accountHolderName;
    }
    
    // Build request body
    const requestBody = {
      merchantId: credentials.merchantId,
      merchantSiteId: credentials.siteId,
      clientRequestId,
      userTokenId: params.userTokenId,
      paymentMethodName,
      apmData,
      billingAddress: {
        country: params.country,
        email: params.email,
        firstName,
        lastName,
      },
      timeStamp,
      checksum,
    };
    
    // Build display string for logging (hide secret key)
    const checksumDisplayString = `${credentials.merchantId}${credentials.siteId}${clientRequestId}${timeStamp}[SECRET]`;
    
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║     NUVEI ADD SEPA UPO REQUEST (apmgw_SEPA)                 ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('📤 ENDPOINT:', `${apiUrl}/addUPOAPM.do`);
    console.log('📤 CHECKSUM FORMULA: merchantId + merchantSiteId + clientRequestId + timeStamp + secretKey');
    console.log('📤 CHECKSUM INPUT:', checksumDisplayString);
    console.log('📤 REQUEST BODY (IBAN masked):');
    console.log(JSON.stringify({
      ...requestBody,
      apmData: { 
        ...apmData, 
        iban: cleanIban.substring(0, 4) + '****' + cleanIban.slice(-4) 
      },
      checksum: '[HIDDEN]',
    }, null, 2));
    
    try {
      const response = await fetch(`${apiUrl}/addUPOAPM.do`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      
      const data = await response.json();
      
      console.log('📥 RESPONSE:');
      console.log(JSON.stringify(data, null, 2));
      console.log('╚════════════════════════════════════════════════════════════╝\n');
      
      if (data.status === 'SUCCESS' && data.userPaymentOptionId) {
        console.log('✅ SEPA UPO created successfully:', data.userPaymentOptionId);
        return { userPaymentOptionId: String(data.userPaymentOptionId) };
      } else {
        console.error('❌ Failed to create SEPA UPO:', data.reason || data);
        return { error: data.reason || `Failed to create SEPA UPO (code: ${data.errCode})` };
      }
    } catch (error) {
      console.error('🏦 Nuvei addSepaUpo error:', error);
      return { error: 'Failed to create bank account UPO' };
    }
  }
  
  /**
   * Submit a bank payout using a pre-registered UPO
   * 
   * IMPORTANT: Bank payouts require the user to have completed the /accountCapture flow first!
   * You cannot create bank UPOs via API - the user MUST be redirected to Nuvei's page.
   * 
   * Flow:
   * 1. User adds bank account → /accountCapture with apmgw_BankPayouts → redirect to Nuvei
   * 2. User enters bank details on Nuvei's hosted page
   * 3. Nuvei sends DMN with userPaymentOptionId
   * 4. We save the userPaymentOptionId to the NuveiUserPaymentOption collection
   * 5. When user wants to withdraw → /payout with the saved userPaymentOptionId (THIS METHOD)
   * 
   * Documentation: https://docs.nuvei.com/documentation/global-guides/local-bank-payouts/
   * 
   * @param params - Withdrawal details including the PRE-EXISTING userPaymentOptionId
   * @returns Withdrawal response
   */
  async submitBankPayout(params: {
    userTokenId: string;
    amount: string;
    currency: string;
    merchantWDRequestId: string;
    userPaymentOptionId: string;  // MUST be obtained from /accountCapture flow first!
    email: string;
    firstName?: string;
    lastName?: string;
    notificationUrl?: string;
  }): Promise<WithdrawalResponse | { error: string }> {
    console.log('\n🏦 Starting Bank payout with pre-registered UPO...');
    console.log('🏦 UPO ID:', params.userPaymentOptionId);
    
    if (!params.userPaymentOptionId) {
      return { 
        error: 'Bank account not connected with Nuvei. Please complete the bank verification process first by clicking "Connect with Nuvei" in your wallet settings.' 
      };
    }
    
    // Use unreferenced refund instead of payout for bank UPOs
    // Nuvei enabled AllowRefundWithoutRelatedTransactionID for this
    // See: https://docs.nuvei.com/documentation/features/financial-operations/refund/#With_a_UPO
    return this.submitUnreferencedRefund({
      userTokenId: params.userTokenId,
      amount: params.amount,
      currency: params.currency,
      userPaymentOptionId: params.userPaymentOptionId,
      clientUniqueId: params.merchantWDRequestId,
      userDetails: {
        email: params.email,
        firstName: params.firstName,
        lastName: params.lastName,
      },
      notificationUrl: params.notificationUrl,
    });
  }
  
  /**
   * Submit an unreferenced refund using a UPO
   * This is used for bank payouts when AllowRefundWithoutRelatedTransactionID is enabled
   * 
   * Documentation: https://docs.nuvei.com/documentation/features/financial-operations/refund/#With_a_UPO
   */
  async submitUnreferencedRefund(params: {
    userTokenId: string;
    amount: string;
    currency: string;
    userPaymentOptionId: string;
    clientUniqueId: string;
    userDetails?: {
      email?: string;
      firstName?: string;
      lastName?: string;
    };
    notificationUrl?: string;
  }): Promise<WithdrawalResponse | { error: string }> {
    const credentials = await this.getCredentials();
    if (!credentials) {
      return { error: 'Nuvei not configured or not active' };
    }
    
    const apiUrl = this.getApiUrl(credentials.testMode);
    const timeStamp = this.generateTimeStamp();
    const clientRequestId = `refund_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Checksum for refundTransaction (per Nuvei API Reference):
    // SHA256(merchantId + merchantSiteId + clientRequestId + clientUniqueId + amount + currency + relatedTransactionId + timeStamp + secretKey)
    // For unreferenced refunds, relatedTransactionId is empty string
    const relatedTransactionId = ''; // Empty for unreferenced refunds
    const checksumString = credentials.merchantId 
      + credentials.siteId 
      + clientRequestId 
      + params.clientUniqueId 
      + params.amount 
      + params.currency 
      + relatedTransactionId
      + timeStamp 
      + credentials.secretKey;
    const checksum = crypto.createHash('sha256').update(checksumString).digest('hex');
    
    console.log('📝 Checksum input (masked):', 
      `${credentials.merchantId}${credentials.siteId}${clientRequestId}${params.clientUniqueId}${params.amount}${params.currency}${relatedTransactionId}${timeStamp}[SECRET]`);
    
    // UPO ID as number (Nuvei returns numbers)
    const upoId = /^\d+$/.test(String(params.userPaymentOptionId)) 
      ? Number(params.userPaymentOptionId) 
      : params.userPaymentOptionId;
    
    const requestBody: Record<string, unknown> = {
      merchantId: credentials.merchantId,
      merchantSiteId: credentials.siteId,
      clientRequestId,
      clientUniqueId: params.clientUniqueId,
      userTokenId: params.userTokenId,
      amount: params.amount,
      currency: params.currency,
      paymentOption: {
        userPaymentOptionId: upoId,
      },
      timeStamp,
      checksum,
    };
    
    if (params.userDetails) {
      requestBody.userDetails = params.userDetails;
    }
    
    if (params.notificationUrl) {
      requestBody.urlDetails = {
        notificationUrl: params.notificationUrl,
      };
    }
    
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║     NUVEI UNREFERENCED REFUND REQUEST                      ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('📤 ENDPOINT:', `${apiUrl}/refundTransaction.do`);
    console.log('📤 METHOD: POST');
    console.log('📤 REQUEST BODY (checksum removed):');
    console.log(JSON.stringify({ ...requestBody, checksum: '[HIDDEN]' }, null, 2));
    
    try {
      const response = await fetch(`${apiUrl}/refundTransaction.do`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      
      const data = await response.json();
      
      console.log('📥 RESPONSE:');
      console.log(JSON.stringify(data, null, 2));
      console.log('╚════════════════════════════════════════════════════════════╝\n');
      
      if (data.status === 'SUCCESS' && data.transactionStatus === 'APPROVED') {
        console.log('✅ Unreferenced refund successful:', data.transactionId);
        // Map to WithdrawalResponse format
        return {
          status: 'SUCCESS',
          errCode: 0,
          reason: '',
          wdRequestId: data.transactionId,
          wdRequestStatus: 'Approved',
          merchantId: data.merchantId,
          merchantSiteId: data.merchantSiteId,
          userTokenId: data.userTokenId,
          internalRequestId: data.internalRequestId,
          version: data.version,
          clientRequestId: data.clientRequestId,
        } as WithdrawalResponse;
      } else {
        console.error('❌ Unreferenced refund failed:', data.reason || data);
        return { error: data.reason || `Refund failed (code: ${data.errCode})` };
      }
    } catch (error) {
      console.error('💸 Nuvei refundTransaction error:', error);
      return { error: 'Failed to process refund' };
    }
  }
  
  // ========== WITHDRAWAL METHODS ==========
  
  /**
   * Calculate checksum for withdrawal requests
   * SHA256(merchantId + merchantSiteId + clientRequestId + amount + currency + timeStamp + secretKey)
   */
  calculateWithdrawalChecksum(
    merchantId: string,
    siteId: string,
    clientRequestId: string,
    amount: string,
    currency: string,
    timeStamp: string,
    secretKey: string
  ): string {
    const data = `${merchantId}${siteId}${clientRequestId}${amount}${currency}${timeStamp}${secretKey}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }
  
  /**
   * Submit a withdrawal request to Nuvei
   * Can be used for card refund (UPO) or bank transfer
   * 
   * Documentation: https://docs.nuvei.com/documentation/accept-payment/web-sdk/withdrawal/
   */
  async submitWithdrawal(params: SubmitWithdrawalParams): Promise<WithdrawalResponse | { error: string }> {
    const credentials = await this.getCredentials();
    if (!credentials) {
      return { error: 'Nuvei not configured or not active' };
    }
    
    // DEBUG: First check what UPOs Nuvei actually has for this user
    console.log('\n🔍 DEBUG: Checking UPOs registered with Nuvei for this user...');
    const upoCheck = await this.getUserPaymentOptions(params.userTokenId);
    if (upoCheck.paymentMethods && upoCheck.paymentMethods.length > 0) {
      console.log(`✅ Nuvei has ${upoCheck.paymentMethods.length} UPO(s) for ${params.userTokenId}:`);
      upoCheck.paymentMethods.forEach((pm, i) => {
        console.log(`   ${i + 1}. UPO ID: ${pm.userPaymentOptionId}, Type: ${pm.paymentMethodName}, Status: ${pm.upoStatus}, Card: ${pm.cardLastFourDigits || 'N/A'}`);
      });
      
      // Check if our requested UPO exists in Nuvei (compare as strings to handle type mismatch)
      if (params.userPaymentOptionId) {
        const requestedUpo = String(params.userPaymentOptionId);
        const found = upoCheck.paymentMethods.find(pm => String(pm.userPaymentOptionId) === requestedUpo);
        if (found) {
          console.log(`✅ Requested UPO ${params.userPaymentOptionId} FOUND in Nuvei (type: ${found.paymentMethodName})`);
        } else {
          console.log(`❌ Requested UPO ${params.userPaymentOptionId} NOT FOUND in Nuvei! Available UPOs: ${upoCheck.paymentMethods.map(pm => pm.userPaymentOptionId).join(', ')}`);
        }
      }
    } else if (upoCheck.error) {
      console.log(`⚠️ Could not fetch UPOs: ${upoCheck.error}`);
    } else {
      console.log(`❌ Nuvei has NO UPOs for ${params.userTokenId}! UPOs might not have been saved during deposit.`);
    }
    console.log('');
    
    const apiUrl = this.getApiUrl(credentials.testMode);
    const timeStamp = this.generateTimeStamp();
    const clientRequestId = `wd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const checksum = this.calculateWithdrawalChecksum(
      credentials.merchantId,
      credentials.siteId,
      clientRequestId,
      params.amount,
      params.currency,
      timeStamp,
      credentials.secretKey
    );
    
    // Build the request body
    const requestBody: Record<string, unknown> = {
      merchantId: credentials.merchantId,
      merchantSiteId: credentials.siteId,
      userTokenId: params.userTokenId,
      clientRequestId,
      amount: params.amount,
      currency: params.currency,
      merchantWDRequestId: params.merchantWDRequestId,
      timeStamp,
      checksum,
    };
    
    // Add optional fields
    if (params.merchantUniqueId) {
      requestBody.merchantUniqueId = params.merchantUniqueId;
    }
    
    if (params.userDetails) {
      requestBody.userDetails = params.userDetails;
    }
    
    // For payout using UPO (card refund or APM payout)
    // Nuvei API: { paymentOption: { userPaymentOptionId: xxx } }
    // NOTE: Nuvei returns UPO IDs as numbers, so send as number for APM payouts
    if (params.userPaymentOptionId) {
      // Try as number first (Nuvei returns as number), fall back to string
      const upoId = /^\d+$/.test(String(params.userPaymentOptionId)) 
        ? Number(params.userPaymentOptionId) 
        : String(params.userPaymentOptionId);
      requestBody.paymentOption = {
        userPaymentOptionId: upoId,
      };
      console.log('💸 Payout using UPO:', upoId, '(type:', typeof upoId, ')');
    }
    // For bank transfer - Nuvei requires specific APM setup
    // NOTE: Bank payouts (SEPA) must be enabled by Nuvei for your merchant account
    // Contact Nuvei support to enable APM payouts if you get error 1060
    else if (params.bankDetails && params.bankDetails.iban) {
      // Format IBAN for Nuvei (remove spaces, uppercase)
      const cleanIban = params.bankDetails.iban.replace(/\s/g, '').toUpperCase();
      const cleanBic = params.bankDetails.bic?.replace(/\s/g, '').toUpperCase();
      
      // Try different payout methods that Nuvei might support
      // The exact method depends on your merchant configuration
      requestBody.paymentOption = {
        alternativePaymentMethod: {
          paymentMethod: 'apmgw_bank_payout', // Generic bank payout
          iban: cleanIban,
          bic: cleanBic || undefined,
          bankName: params.bankDetails.bankName || undefined,
          beneficiaryName: params.bankDetails.accountHolderName || undefined,
        },
      };
      
      console.log('💸 Bank transfer details:', {
        method: 'apmgw_bank_payout',
        ibanPrefix: cleanIban.substring(0, 4) + '****',
        ibanLength: cleanIban.length,
        hasBic: !!cleanBic,
        hasBeneficiaryName: !!params.bankDetails.accountHolderName,
      });
    }
    
    // Notification URL for DMN
    if (params.notificationUrl || credentials.dmnUrl) {
      requestBody.urlDetails = {
        notificationUrl: params.notificationUrl || credentials.dmnUrl,
      };
    }
    
    // ============================================================
    // NUVEI WITHDRAWAL DEBUG - COPY THIS FOR SUPPORT
    // ============================================================
    
    // Create a sanitized copy for logging (hide checksum but show everything else)
    const requestForNuvei = { ...requestBody };
    delete requestForNuvei.checksum;
    
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║     NUVEI WITHDRAWAL REQUEST - COPY FOR SUPPORT            ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('📤 ENDPOINT:', `${apiUrl}/payout.do`);
    console.log('📤 METHOD: POST');
    console.log('📤 CONTENT-TYPE: application/json');
    console.log('');
    console.log('📤 REQUEST BODY (checksum removed):');
    console.log('─────────────────────────────────────');
    console.log(JSON.stringify(requestForNuvei, null, 2));
    console.log('─────────────────────────────────────');
    console.log('');
    
    try {
      const response = await fetch(`${apiUrl}/payout.do`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      const data = await response.json();
      
      console.log('📥 RESPONSE STATUS:', response.status);
      console.log('📥 RESPONSE BODY:');
      console.log('─────────────────────────────────────');
      console.log(JSON.stringify(data, null, 2));
      console.log('─────────────────────────────────────');
      console.log('');
      console.log('╔════════════════════════════════════════════════════════════╗');
      console.log('║     END NUVEI WITHDRAWAL DEBUG                             ║');
      console.log('╚════════════════════════════════════════════════════════════╝');
      console.log('\n');
      
      if (data.status === 'SUCCESS' && data.errCode === 0) {
        return data as WithdrawalResponse;
      } else {
        return { 
          error: data.reason || `Withdrawal failed (code: ${data.errCode})`,
          ...data,
        };
      }
    } catch (error) {
      console.error('💸 Nuvei submitWithdrawal error:', error);
      return { error: 'Failed to submit withdrawal to Nuvei' };
    }
  }
  
  /**
   * Get list of pending withdrawal requests for a user
   */
  async getWithdrawalRequests(params: GetWithdrawalRequestsParams): Promise<GetWithdrawalRequestsResponse | { error: string }> {
    const credentials = await this.getCredentials();
    if (!credentials) {
      return { error: 'Nuvei not configured or not active' };
    }
    
    const apiUrl = this.getApiUrl(credentials.testMode);
    const timeStamp = this.generateTimeStamp();
    const clientRequestId = `getwd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Simple checksum for get requests
    const checksum = this.calculatePaymentStatusChecksum(
      credentials.merchantId,
      credentials.siteId,
      clientRequestId,
      timeStamp,
      credentials.secretKey
    );
    
    const requestBody = {
      merchantId: credentials.merchantId,
      merchantSiteId: credentials.siteId,
      userTokenId: params.userTokenId,
      clientRequestId,
      timeStamp,
      checksum,
    };
    
    try {
      const response = await fetch(`${apiUrl}/getWDRequests.do`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      const data = await response.json();
      return data as GetWithdrawalRequestsResponse;
    } catch (error) {
      console.error('💸 Nuvei getWithdrawalRequests error:', error);
      return { error: 'Failed to get withdrawal requests' };
    }
  }
  
  /**
   * Cancel a pending withdrawal request
   */
  async cancelWithdrawal(params: CancelWithdrawalParams): Promise<CancelWithdrawalResponse | { error: string }> {
    const credentials = await this.getCredentials();
    if (!credentials) {
      return { error: 'Nuvei not configured or not active' };
    }
    
    const apiUrl = this.getApiUrl(credentials.testMode);
    const timeStamp = this.generateTimeStamp();
    const clientRequestId = `cancelwd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const checksum = this.calculatePaymentStatusChecksum(
      credentials.merchantId,
      credentials.siteId,
      clientRequestId,
      timeStamp,
      credentials.secretKey
    );
    
    const requestBody = {
      merchantId: credentials.merchantId,
      merchantSiteId: credentials.siteId,
      userTokenId: params.userTokenId,
      wdRequestId: params.wdRequestId,
      clientRequestId,
      timeStamp,
      checksum,
    };
    
    try {
      const response = await fetch(`${apiUrl}/cancelWDRequest.do`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      const data = await response.json();
      
      if (data.status === 'SUCCESS') {
        return data as CancelWithdrawalResponse;
      } else {
        return { error: data.reason || 'Failed to cancel withdrawal' };
      }
    } catch (error) {
      console.error('💸 Nuvei cancelWithdrawal error:', error);
      return { error: 'Failed to cancel withdrawal' };
    }
  }
  
  /**
   * Calculate checksum for getUserUPOs
   * Format: SHA256(merchantId + merchantSiteId + userTokenId + clientRequestId + timeStamp + secretKey)
   * Note: userTokenId is included in this checksum (different from other endpoints)
   */
  calculateGetUposChecksum(
    merchantId: string,
    siteId: string,
    userTokenId: string,
    clientRequestId: string,
    timeStamp: string,
    secretKey: string
  ): string {
    const data = `${merchantId}${siteId}${userTokenId}${clientRequestId}${timeStamp}${secretKey}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }
  
  /**
   * Get user's stored payment options (UPOs) from previous deposits
   * These can be used for card refund withdrawals
   */
  async getUserPaymentOptions(userTokenId: string): Promise<{
    paymentMethods?: Array<{
      userPaymentOptionId: string;
      paymentMethodName: string;
      upoName?: string;
      upoStatus?: string;
      expiryDate?: string;
      cardLastFourDigits?: string;
      cardType?: string;
    }>;
    error?: string;
  }> {
    const credentials = await this.getCredentials();
    if (!credentials) {
      return { error: 'Nuvei not configured or not active' };
    }
    
    const apiUrl = this.getApiUrl(credentials.testMode);
    const timeStamp = this.generateTimeStamp();
    const clientRequestId = `getupo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // getUserUPOs requires userTokenId in checksum calculation
    const checksum = this.calculateGetUposChecksum(
      credentials.merchantId,
      credentials.siteId,
      userTokenId,
      clientRequestId,
      timeStamp,
      credentials.secretKey
    );
    
    const requestBody = {
      merchantId: credentials.merchantId,
      merchantSiteId: credentials.siteId,
      userTokenId,
      clientRequestId,
      timeStamp,
      checksum,
    };
    
    console.log('📤 getUserUPOs request:', { userTokenId, clientRequestId, timeStamp });
    
    try {
      const response = await fetch(`${apiUrl}/getUserUPOs.do`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      const data = await response.json();
      console.log('📥 getUserUPOs response:', JSON.stringify(data, null, 2));
      
      if (data.status === 'SUCCESS') {
        return { paymentMethods: data.paymentMethods || [] };
      } else {
        return { error: data.reason || 'Failed to get payment options' };
      }
    } catch (error) {
      console.error('💸 Nuvei getUserPaymentOptions error:', error);
      return { error: 'Failed to get payment options' };
    }
  }
}

// Export singleton
export const nuveiService = new NuveiService();
export default nuveiService;

