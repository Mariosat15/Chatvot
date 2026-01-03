import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import KYCSession from '@/database/models/kyc-session.model';
import CreditWallet from '@/database/models/trading/credit-wallet.model';
import { getAdminSession } from '@/lib/admin/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = await params;
    await connectToDatabase();

    // Get KYC sessions
    const sessions = await KYCSession.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    // Get wallet KYC status
    const wallet = await CreditWallet.findOne({ userId }).lean();

    return NextResponse.json({
      sessions,
      kycStatus: {
        verified: wallet?.kycVerified || false,
        status: wallet?.kycStatus || 'none',
        verifiedAt: wallet?.kycVerifiedAt,
        expiresAt: wallet?.kycExpiresAt,
        attempts: wallet?.kycAttempts || 0,
      },
    });
  } catch (error) {
    console.error('Error fetching user KYC:', error);
    return NextResponse.json({ error: 'Failed to fetch KYC data' }, { status: 500 });
  }
}

// Manual KYC status update by admin
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = await params;
    const body = await req.json();
    await connectToDatabase();

    console.log(`📋 [Admin KYC] Updating KYC for user ${userId}:`, body);

    const updateFields: Record<string, any> = {};
    
    if (body.kycVerified !== undefined) {
      updateFields.kycVerified = body.kycVerified;
    }
    if (body.kycStatus) {
      updateFields.kycStatus = body.kycStatus;
    }
    if (body.kycVerified) {
      updateFields.kycVerifiedAt = new Date();
      // Set expiry to 1 year from now by default
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      updateFields.kycExpiresAt = expiresAt;
    }
    if (body.resetAttempts) {
      updateFields.kycAttempts = 0;
    }

    // Try to find existing wallet
    let wallet = await CreditWallet.findOne({ userId });

    if (!wallet) {
      console.log(`📋 [Admin KYC] Creating new wallet for user ${userId}`);
      // Create wallet if it doesn't exist
      wallet = await CreditWallet.create({
        userId,
        creditBalance: 0,
        totalEarnings: 0,
        totalDeposited: 0,
        totalWithdrawn: 0,
        kycVerified: updateFields.kycVerified || false,
        kycStatus: updateFields.kycStatus || 'none',
        kycVerifiedAt: updateFields.kycVerifiedAt,
        kycExpiresAt: updateFields.kycExpiresAt,
        kycAttempts: 0,
      });
    } else {
      // Update existing wallet
      wallet = await CreditWallet.findOneAndUpdate(
        { userId },
        { $set: updateFields },
        { new: true }
      );
    }

    console.log(`✅ [Admin KYC] Updated wallet:`, {
      kycVerified: wallet?.kycVerified,
      kycStatus: wallet?.kycStatus,
    });

    // Create audit log
    const AuditLog = (await import('@/database/models/audit-log.model')).default;
    await AuditLog.logAction({
      userId: session.id,
      userName: session.name || 'Admin',
      userEmail: session.email || 'admin@system',
      userRole: 'admin',
      action: 'kyc_status_update',
      actionCategory: 'security',
      description: `Updated KYC status for user ${userId} to ${body.kycStatus || 'updated'}`,
      targetType: 'user',
      targetId: userId,
      metadata: {
        previousStatus: wallet.kycStatus,
        newStatus: body.kycStatus,
        kycVerified: body.kycVerified,
        resetAttempts: body.resetAttempts,
      },
      status: 'success',
    });

    return NextResponse.json({
      kycStatus: {
        verified: wallet.kycVerified,
        status: wallet.kycStatus,
        verifiedAt: wallet.kycVerifiedAt,
        expiresAt: wallet.kycExpiresAt,
        attempts: wallet.kycAttempts,
      },
    });
  } catch (error) {
    console.error('Error updating user KYC:', error);
    return NextResponse.json({ error: 'Failed to update KYC status' }, { status: 500 });
  }
}

