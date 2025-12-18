import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import UserRestriction from '@/database/models/user-restriction.model';
import bcrypt from 'bcryptjs';

/**
 * PUT /api/admin/fraud/update-restriction
 * Update a user restriction
 */
export async function PUT(request: NextRequest) {
  try {
    const {
      restrictionId,
      reason,
      customReason,
      canTrade,
      canEnterCompetitions,
      canDeposit,
      canWithdraw,
      expiresAt,
      adminPassword,
    } = await request.json();

    console.log('✏️ Update restriction request:', { 
      restrictionId, 
      reason, 
      hasPassword: !!adminPassword 
    });

    // Validate input
    if (!restrictionId) {
      return NextResponse.json({
        success: false,
        message: 'Restriction ID required'
      }, { status: 400 });
    }

    if (!adminPassword) {
      return NextResponse.json({
        success: false,
        message: 'Admin password required'
      }, { status: 400 });
    }

    // Verify admin password
    const envPassword = process.env.ADMIN_PASSWORD;
    if (!envPassword) {
      return NextResponse.json({
        success: false,
        message: 'Admin password not configured'
      }, { status: 500 });
    }

    const isPasswordValid = envPassword.startsWith('$2a$') || envPassword.startsWith('$2b$')
      ? await bcrypt.compare(adminPassword, envPassword)
      : adminPassword === envPassword;

    if (!isPasswordValid) {
      console.error('❌ Invalid admin password');
      return NextResponse.json({
        success: false,
        message: 'Invalid admin password'
      }, { status: 401 });
    }

    await connectToDatabase();

    // Find and update the restriction
    const restriction = await UserRestriction.findById(restrictionId);

    if (!restriction) {
      console.error(`❌ Restriction not found: ${restrictionId}`);
      return NextResponse.json({
        success: false,
        message: 'Restriction not found'
      }, { status: 404 });
    }

    // Update fields
    restriction.reason = reason;
    restriction.customReason = customReason;
    restriction.canTrade = canTrade;
    restriction.canEnterCompetitions = canEnterCompetitions;
    restriction.canDeposit = canDeposit;
    restriction.canWithdraw = canWithdraw;
    
    if (expiresAt) {
      restriction.expiresAt = new Date(expiresAt);
    } else {
      restriction.expiresAt = undefined;
    }

    await restriction.save();

    console.log(`✅ Updated restriction ${restrictionId} for user ${restriction.userId}`);

    return NextResponse.json({
      success: true,
      message: 'Restriction updated successfully',
      restriction,
    });

  } catch (error) {
    console.error('Error updating restriction:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update restriction'
    }, { status: 500 });
  }
}

