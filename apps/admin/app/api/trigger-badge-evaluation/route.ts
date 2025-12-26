import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import CompetitionParticipant from '@/database/models/trading/competition-participant.model';
import { evaluateUserBadges } from '@/lib/services/badge-evaluation.service';
import { recalculateUserLevel } from '@/lib/services/xp-level.service';

/**
 * POST /api/admin/trigger-badge-evaluation
 * Manually trigger badge evaluation for all users or a specific user
 * Useful for retroactive badge assignment for existing users
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    await connectToDatabase();

    if (userId) {
      // Evaluate badges for a specific user
      console.log(`🏅 Manually evaluating badges for user: ${userId}`);
      
      const result = await evaluateUserBadges(userId);
      
      // ✅ NEW: Recalculate XP from existing badges
      console.log(`🔄 Recalculating XP for user ${userId}...`);
      const userLevel = await recalculateUserLevel(userId);
      console.log(`✅ XP recalculated: ${userLevel.currentXP} XP, ${userLevel.totalBadgesEarned} badges`);
      
      console.log(`✅ Evaluation complete for user ${userId}:`);
      console.log(`   - New badges: ${result.newBadges.length}`);
      console.log(`   - Total badges: ${result.totalBadges}`);
      console.log(`   - Current XP: ${userLevel.currentXP}`);
      console.log(`   - Current Level: ${userLevel.currentLevel}`);
      
      return NextResponse.json({
        success: true,
        message: `Evaluated badges for user ${userId}`,
        data: {
          newBadges: result.newBadges.map(b => ({ id: b.id, name: b.name, rarity: b.rarity })),
          totalBadges: result.totalBadges,
          currentXP: userLevel.currentXP,
          currentLevel: userLevel.currentLevel,
          currentTitle: userLevel.currentTitle,
        }
      });
    } else {
      // Evaluate badges for ALL users who have participated in competitions
      console.log(`🏅 Manually evaluating badges for ALL users...`);
      
      const uniqueUsers = await CompetitionParticipant.distinct('userId');
      
      console.log(`📊 Found ${uniqueUsers.length} users to evaluate`);
      
      let totalNewBadges = 0;
      let usersWithNewBadges = 0;
      const results: any[] = [];
      
      // Evaluate badges for each user
      for (const userId of uniqueUsers) {
        try {
          const result = await evaluateUserBadges(userId);
          
          // ✅ NEW: Recalculate XP from existing badges
          console.log(`🔄 Recalculating XP for user ${userId}...`);
          const userLevel = await recalculateUserLevel(userId);
          console.log(`✅ XP recalculated: ${userLevel.currentXP} XP, ${userLevel.totalBadgesEarned} badges`);
          
          results.push({
            userId,
            newBadges: result.newBadges.length,
            totalBadges: result.totalBadges,
            currentXP: userLevel.currentXP,
            currentLevel: userLevel.currentLevel,
          });
          
          if (result.newBadges.length > 0) {
            totalNewBadges += result.newBadges.length;
            usersWithNewBadges++;
            console.log(`✨ User ${userId} earned ${result.newBadges.length} new badges`);
          }
        } catch (error) {
          console.error(`❌ Error evaluating badges for user ${userId}:`, error);
          results.push({
            userId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
      
      console.log(`✅ Evaluation complete:`);
      console.log(`   - Total users: ${uniqueUsers.length}`);
      console.log(`   - Users with new badges: ${usersWithNewBadges}`);
      console.log(`   - Total new badges awarded: ${totalNewBadges}`);
      
      return NextResponse.json({
        success: true,
        message: `Evaluated badges for ${uniqueUsers.length} users`,
        data: {
          totalUsers: uniqueUsers.length,
          usersWithNewBadges,
          totalNewBadges,
          results: results.slice(0, 20), // Return first 20 results for preview
        }
      });
    }
  } catch (error) {
    console.error('❌ Error triggering badge evaluation:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to trigger badge evaluation'
    }, { status: 500 });
  }
}

