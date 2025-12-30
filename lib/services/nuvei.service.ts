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
    
    const requestBody = {
      merchantId: credentials.merchantId,
      merchantSiteId: credentials.siteId,
      clientUniqueId: params.clientUniqueId,
      clientRequestId,
      currency: params.currency,
      amount: params.amount,
      timeStamp,
      checksum,
      ...(params.userEmail && { 
        userDetails: {
          email: params.userEmail,
          country: params.userCountry || 'US',
        }
      }),
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
        return data as OpenOrderResponse;
      } else {
        console.error('Nuvei openOrder failed:', data);
        return { error: data.reason || 'Failed to create order session' };
      }
    } catch (error) {
      console.error('Nuvei openOrder error:', error);
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
    
    // For card refund - use UPO ID from original deposit
    if (params.userPaymentOptionId) {
      requestBody.userPaymentOptionId = params.userPaymentOptionId;
    }
    
    // For bank transfer
    if (params.bankDetails) {
      requestBody.paymentOption = {
        alternativePaymentMethod: {
          paymentMethod: 'apmgw_Bank_Transfer',
          ...params.bankDetails,
        },
      };
    }
    
    // Notification URL for DMN
    if (params.notificationUrl || credentials.dmnUrl) {
      requestBody.urlDetails = {
        notificationUrl: params.notificationUrl || credentials.dmnUrl,
      };
    }
    
    console.log('💸 Nuvei submitWithdrawal request:', {
      userTokenId: params.userTokenId,
      amount: params.amount,
      currency: params.currency,
      hasUPO: !!params.userPaymentOptionId,
      hasBankDetails: !!params.bankDetails,
    });
    
    try {
      const response = await fetch(`${apiUrl}/payout.do`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      const data = await response.json();
      
      console.log('💸 Nuvei submitWithdrawal response:', {
        status: data.status,
        errCode: data.errCode,
        wdRequestId: data.wdRequestId,
        wdRequestStatus: data.wdRequestStatus,
      });
      
      if (data.status === 'SUCCESS' && data.errCode === 0) {
        return data as WithdrawalResponse;
      } else {
        console.error('💸 Nuvei submitWithdrawal failed:', data);
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
      userTokenId,
      clientRequestId,
      timeStamp,
      checksum,
    };
    
    try {
      const response = await fetch(`${apiUrl}/getUserUPOs.do`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      const data = await response.json();
      
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

