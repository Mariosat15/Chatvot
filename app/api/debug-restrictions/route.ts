import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import UserRestriction from '@/database/models/user-restriction.model';

/**
 * Debug endpoint to check user restrictions
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (userId) {
      // Get restrictions for specific user
      const restrictions = await UserRestriction.find({ userId }).lean();
      
      console.log(`🔍 DEBUG: Restrictions for user ${userId}:`);
      console.log(JSON.stringify(restrictions, null, 2));

      return NextResponse.json({
        success: true,
        userId,
        restrictionCount: restrictions.length,
        restrictions
      });
    }

    // Get all restrictions
    const allRestrictions = await UserRestriction.find({}).lean();
    
    console.log(`🔍 DEBUG: All restrictions in database:`);
    console.log(`   Total: ${allRestrictions.length}`);
    
    for (const restriction of allRestrictions) {
      console.log(`   User: ${restriction.userId}`);
      console.log(`   Type: ${restriction.restrictionType}`);
      console.log(`   Active: ${restriction.isActive}`);
      console.log(`   Can Trade: ${restriction.canTrade}`);
      console.log(`   Can Enter Competitions: ${restriction.canEnterCompetitions}`);
      console.log(`   Can Deposit: ${restriction.canDeposit}`);
      console.log(`   Can Withdraw: ${restriction.canWithdraw}`);
      console.log(`   ---`);
    }

    return NextResponse.json({
      success: true,
      total: allRestrictions.length,
      restrictions: allRestrictions
    });

  } catch (error) {
    console.error('❌ Error fetching restrictions:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

