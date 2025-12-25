import crypto from 'crypto';
import KYCSettings from '@/database/models/kyc-settings.model';
import KYCSession from '@/database/models/kyc-session.model';
import CreditWallet from '@/database/models/trading/credit-wallet.model';
import { connectToDatabase } from '@/database/mongoose';

interface VeriffSessionResponse {
  status: string;
  verification: {
    id: string;
    url: string;
    vendorData: string;
    host: string;
    status: string;
    sessionToken: string;
  };
}

interface VeriffDecisionPayload {
  status: string;
  verification: {
    id: string;
    code: number;
    person: {
      firstName?: string;
      lastName?: string;
      dateOfBirth?: string;
      gender?: string;
      nationality?: string;
      idNumber?: string;
    };
    document?: {
      type?: string;
      number?: string;
      country?: string;
      validFrom?: string;
      validUntil?: string;
    };
    status: string;
    reason?: string;
    reasonCode?: number;
    decisionTime: string;
    acceptanceTime: string;
    vendorData?: string;
  };
}

class VeriffService {
  private async getSettings() {
    await connectToDatabase();
    const settings = await KYCSettings.findOne();
    if (!settings) {
      throw new Error('KYC settings not configured');
    }
    
    // Override with environment variables if available
    return {
      ...settings.toObject(),
      veriffApiKey: process.env.VERIFF_API_KEY || settings.veriffApiKey,
      veriffApiSecret: process.env.VERIFF_API_SECRET || settings.veriffApiSecret,
      veriffBaseUrl: process.env.VERIFF_BASE_URL || settings.veriffBaseUrl,
    };
  }

  private generateHmacSignature(payload: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  /**
   * Create a new Veriff verification session
   */
  async createSession(userId: string, userData: {
    firstName?: string;
    lastName?: string;
    email?: string;
    dateOfBirth?: string;
  }): Promise<{ sessionId: string; sessionUrl: string }> {
    const settings = await this.getSettings();

    if (!settings.enabled) {
      throw new Error('KYC verification is currently disabled');
    }

    if (!settings.veriffApiKey || !settings.veriffApiSecret) {
      throw new Error('Veriff API credentials not configured');
    }

    // Check if user has pending session
    const existingSession = await KYCSession.findOne({
      userId,
      status: { $in: ['created', 'started'] },
    });

    if (existingSession) {
      return {
        sessionId: existingSession.veriffSessionId,
        sessionUrl: existingSession.veriffSessionUrl,
      };
    }

    // Check max attempts
    const wallet = await CreditWallet.findOne({ userId });
    if (wallet && wallet.kycAttempts >= settings.maxVerificationAttempts) {
      throw new Error('Maximum verification attempts exceeded. Please contact support.');
    }

    const payload = {
      verification: {
        callback: `${process.env.NEXT_PUBLIC_APP_URL}/api/kyc/callback`,
        person: {
          firstName: userData.firstName || undefined,
          lastName: userData.lastName || undefined,
          dateOfBirth: userData.dateOfBirth || undefined,
        },
        vendorData: userId,
        timestamp: new Date().toISOString(),
      },
    };

    const payloadString = JSON.stringify(payload);
    const signature = this.generateHmacSignature(payloadString, settings.veriffApiSecret);

    const response = await fetch(`${settings.veriffBaseUrl}/v1/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AUTH-CLIENT': settings.veriffApiKey,
        'X-HMAC-SIGNATURE': signature,
      },
      body: payloadString,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Veriff session creation failed:', error);
      throw new Error('Failed to create verification session');
    }

    const data: VeriffSessionResponse = await response.json();

    // Save session to database
    const session = await KYCSession.create({
      userId,
      userEmail: userData.email,
      userName: [userData.firstName, userData.lastName].filter(Boolean).join(' ') || undefined,
      veriffSessionId: data.verification.id,
      veriffSessionUrl: data.verification.url,
      status: 'created',
    });

    // Update wallet KYC attempts
    await CreditWallet.findOneAndUpdate(
      { userId },
      {
        $inc: { kycAttempts: 1 },
        $set: {
          kycStatus: 'pending',
          lastKYCSessionId: session._id.toString(),
        },
      }
    );

    return {
      sessionId: data.verification.id,
      sessionUrl: data.verification.url,
    };
  }

  /**
   * Handle Veriff webhook decision
   */
  async handleDecision(payload: VeriffDecisionPayload, signature: string): Promise<void> {
    const settings = await this.getSettings();

    // Verify signature
    const payloadString = JSON.stringify(payload);
    const expectedSignature = this.generateHmacSignature(payloadString, settings.veriffApiSecret);

    if (signature !== expectedSignature) {
      console.error('Invalid Veriff webhook signature');
      throw new Error('Invalid signature');
    }

    const { verification } = payload;
    const userId = verification.vendorData;

    // Find and update session
    const session = await KYCSession.findOne({
      veriffSessionId: verification.id,
    });

    if (!session) {
      console.error('KYC session not found:', verification.id);
      return;
    }

    // Map Veriff status to our status
    let status: 'approved' | 'declined' | 'resubmission_requested' | 'expired' = 'declined';
    if (verification.status === 'approved') {
      status = 'approved';
    } else if (verification.code === 9102) {
      status = 'resubmission_requested';
    } else if (verification.code === 9103) {
      status = 'expired';
    }

    // Update session
    await KYCSession.findByIdAndUpdate(session._id, {
      status,
      verificationCode: verification.code,
      verificationReason: verification.reason,
      verificationReasonCode: verification.reasonCode,
      decisionTime: verification.decisionTime ? new Date(verification.decisionTime) : new Date(),
      completedAt: new Date(),
      personData: verification.person ? {
        firstName: verification.person.firstName,
        lastName: verification.person.lastName,
        dateOfBirth: verification.person.dateOfBirth,
        gender: verification.person.gender,
        nationality: verification.person.nationality,
        idNumber: verification.person.idNumber,
      } : undefined,
      documentData: verification.document ? {
        type: verification.document.type,
        number: verification.document.number,
        country: verification.document.country,
        validFrom: verification.document.validFrom,
        validUntil: verification.document.validUntil,
      } : undefined,
    });

    // Update user wallet
    const wallet = await CreditWallet.findOne({ userId });
    if (wallet) {
      if (status === 'approved') {
        // Calculate expiry date
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + settings.verificationValidDays);

        await CreditWallet.findByIdAndUpdate(wallet._id, {
          kycVerified: true,
          kycStatus: 'approved',
          kycVerifiedAt: new Date(),
          kycExpiresAt: expiresAt,
        });
      } else if (status === 'declined') {
        await CreditWallet.findByIdAndUpdate(wallet._id, {
          kycVerified: false,
          kycStatus: 'declined',
        });

        // Auto-suspend if configured
        if (settings.autoSuspendOnFail) {
          const UserRestriction = (await import('@/database/models/user-restriction.model')).default;
          await UserRestriction.create({
            userId,
            restrictionType: 'suspended',
            reason: 'kyc_failed',
            customReason: verification.reason || 'KYC verification failed',
            canTrade: true,
            canEnterCompetitions: true,
            canDeposit: true,
            canWithdraw: false,
            restrictedBy: 'system',
          });
        }
      } else {
        await CreditWallet.findByIdAndUpdate(wallet._id, {
          kycStatus: status === 'resubmission_requested' ? 'none' : status,
        });
      }
    }
  }

  /**
   * Check if user has valid KYC
   */
  async hasValidKYC(userId: string): Promise<boolean> {
    await connectToDatabase();
    
    const wallet = await CreditWallet.findOne({ userId });
    if (!wallet) return false;

    if (!wallet.kycVerified) return false;

    // Check if KYC has expired
    if (wallet.kycExpiresAt && new Date() > wallet.kycExpiresAt) {
      await CreditWallet.findByIdAndUpdate(wallet._id, {
        kycVerified: false,
        kycStatus: 'expired',
      });
      return false;
    }

    return true;
  }

  /**
   * Check if KYC is required for withdrawal
   */
  async isKYCRequired(userId: string, amount?: number): Promise<boolean> {
    await connectToDatabase();
    
    const settings = await KYCSettings.findOne();
    if (!settings || !settings.enabled) {
      return false;
    }

    if (!settings.requiredForWithdrawal) {
      return false;
    }

    // Check if amount threshold applies
    if (settings.requiredAmount > 0 && amount && amount < settings.requiredAmount) {
      return false;
    }

    return true;
  }

  /**
   * Get user's KYC history
   */
  async getKYCHistory(userId: string): Promise<any[]> {
    await connectToDatabase();
    
    const sessions = await KYCSession.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    return sessions;
  }

  /**
   * Get KYC session by ID
   */
  async getSession(sessionId: string): Promise<any> {
    await connectToDatabase();
    return KYCSession.findById(sessionId).lean();
  }
}

export const veriffService = new VeriffService();
export default veriffService;

