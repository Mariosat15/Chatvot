import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import KYCSettings from '@/database/models/kyc-settings.model';
import { getAdminSession } from '@/lib/admin/auth';

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    let settings = await KYCSettings.findOne();
    if (!settings) {
      settings = await KYCSettings.create({});
    }

    // Hide API secret from response (show masked version)
    const responseSettings = settings.toObject();
    if (responseSettings.veriffApiSecret) {
      responseSettings.veriffApiSecret = responseSettings.veriffApiSecret.slice(0, 8) + '****';
    }

    return NextResponse.json({ settings: responseSettings });
  } catch (error) {
    console.error('Error fetching KYC settings:', error);
    return NextResponse.json({ error: 'Failed to fetch KYC settings' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    await connectToDatabase();

    let settings = await KYCSettings.findOne();
    if (!settings) {
      settings = await KYCSettings.create({});
    }

    // Update fields
    const updateFields: Record<string, any> = {};

    if (typeof body.enabled === 'boolean') {
      updateFields.enabled = body.enabled;
    }
    if (typeof body.requiredForWithdrawal === 'boolean') {
      updateFields.requiredForWithdrawal = body.requiredForWithdrawal;
    }
    if (typeof body.requiredForDeposit === 'boolean') {
      updateFields.requiredForDeposit = body.requiredForDeposit;
    }
    if (typeof body.requiredAmount === 'number') {
      updateFields.requiredAmount = body.requiredAmount;
    }
    if (body.veriffApiKey !== undefined) {
      updateFields.veriffApiKey = body.veriffApiKey;
    }
    // Only update secret if a new value is provided (not the masked one)
    if (body.veriffApiSecret && !body.veriffApiSecret.includes('****')) {
      updateFields.veriffApiSecret = body.veriffApiSecret;
    }
    if (body.veriffBaseUrl) {
      updateFields.veriffBaseUrl = body.veriffBaseUrl;
    }
    if (Array.isArray(body.allowedDocumentTypes)) {
      updateFields.allowedDocumentTypes = body.allowedDocumentTypes;
    }
    if (Array.isArray(body.allowedCountries)) {
      updateFields.allowedCountries = body.allowedCountries;
    }
    if (typeof body.autoApproveOnSuccess === 'boolean') {
      updateFields.autoApproveOnSuccess = body.autoApproveOnSuccess;
    }
    if (typeof body.autoSuspendOnFail === 'boolean') {
      updateFields.autoSuspendOnFail = body.autoSuspendOnFail;
    }
    if (typeof body.maxVerificationAttempts === 'number') {
      updateFields.maxVerificationAttempts = body.maxVerificationAttempts;
    }
    if (typeof body.sessionExpiryMinutes === 'number') {
      updateFields.sessionExpiryMinutes = body.sessionExpiryMinutes;
    }
    if (typeof body.verificationValidDays === 'number') {
      updateFields.verificationValidDays = body.verificationValidDays;
    }
    if (body.kycRequiredMessage) {
      updateFields.kycRequiredMessage = body.kycRequiredMessage;
    }
    if (body.kycPendingMessage) {
      updateFields.kycPendingMessage = body.kycPendingMessage;
    }
    if (body.kycApprovedMessage) {
      updateFields.kycApprovedMessage = body.kycApprovedMessage;
    }
    if (body.kycDeclinedMessage) {
      updateFields.kycDeclinedMessage = body.kycDeclinedMessage;
    }

    const updatedSettings = await KYCSettings.findByIdAndUpdate(
      settings._id,
      { $set: updateFields },
      { new: true }
    );

    // Hide API secret from response
    const responseSettings = updatedSettings!.toObject();
    if (responseSettings.veriffApiSecret) {
      responseSettings.veriffApiSecret = responseSettings.veriffApiSecret.slice(0, 8) + '****';
    }

    return NextResponse.json({ settings: responseSettings });
  } catch (error) {
    console.error('Error updating KYC settings:', error);
    return NextResponse.json({ error: 'Failed to update KYC settings' }, { status: 500 });
  }
}

