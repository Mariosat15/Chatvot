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

class NuveiService {
  /**
   * Get Nuvei credentials from database
   */
  async getCredentials(): Promise<NuveiCredentials | null> {
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
    
    if (!provider) {
      console.error('Nuvei provider not found or not active');
      return null;
    }
    
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
    
    if (!credentials.merchantId || !credentials.siteId || !credentials.secretKey) {
      console.error('Nuvei credentials incomplete');
      return null;
    }
    
    return credentials;
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
    const credentials = await this.getCredentials();
    
    if (!credentials) {
      return { enabled: false, sdkUrl: NUVEI_SDK_URL };
    }
    
    return {
      enabled: true,
      merchantId: credentials.merchantId,
      siteId: credentials.siteId,
      testMode: credentials.testMode,
      sdkUrl: NUVEI_SDK_URL,
    };
  }
}

// Export singleton
export const nuveiService = new NuveiService();
export default nuveiService;

