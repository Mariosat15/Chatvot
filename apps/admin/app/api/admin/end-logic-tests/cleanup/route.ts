import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import mongoose from 'mongoose';

/**
 * Cleanup endpoint for end logic tests
 * Deletes all test data created during testing
 */

export async function POST(request: NextRequest) {
  try {
    const { testDataIds } = await request.json();

    await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database not connected');
    }

    let deletedCount = 0;
    
    // ==========================================
    // STEP 1: FIND ALL TEST USER IDS FIRST!
    // (Before deleting anything, collect userIds for side effects cleanup)
    // ==========================================
    const testUserIds: string[] = [];
    const testCompetitionIds: string[] = [];
    const testChallengeIds: string[] = [];
    
    try {
      console.log('📋 Finding test data to cleanup...');
      
      // Use string-based regex for better MongoDB compatibility
      const testPattern = { $regex: 'TEST_', $options: 'i' };
      const testStartPattern = { $regex: '^TEST', $options: 'i' };
      
      // Get user IDs and competition IDs from test participants
      const testParticipants = await db.collection('competitionparticipants').find({
        $or: [
          { testRunId: testPattern },
          { username: testPattern },
          { username: testStartPattern },
        ]
      }).toArray();
      testParticipants.forEach(p => {
        if (p.userId) testUserIds.push(p.userId.toString());
        if (p.competitionId) testCompetitionIds.push(p.competitionId.toString());
      });
      console.log(`   Found ${testParticipants.length} test competition participants`);
      
      // Get user IDs and challenge IDs from test challenge participants
      const testChallengeParticipants = await db.collection('challengeparticipants').find({
        $or: [
          { testRunId: testPattern },
          { username: testPattern },
          { username: testStartPattern },
        ]
      }).toArray();
      testChallengeParticipants.forEach(p => {
        if (p.userId) testUserIds.push(p.userId.toString());
        if (p.challengeId) testChallengeIds.push(p.challengeId.toString());
      });
      console.log(`   Found ${testChallengeParticipants.length} test challenge participants`);
      
      // Get user IDs from test wallets
      const testWallets = await db.collection('creditwallets').find({
        testRunId: testPattern
      }).toArray();
      testWallets.forEach(w => {
        if (w.userId) testUserIds.push(w.userId.toString());
      });
      console.log(`   Found ${testWallets.length} test wallets`);
      
      // Get test competition IDs directly - search by name containing TEST
      const testCompetitions = await db.collection('competitions').find({
        $or: [
          { testRunId: testPattern },
          { name: testPattern },
          { name: testStartPattern },
        ]
      }).toArray();
      testCompetitions.forEach(c => {
        testCompetitionIds.push(c._id.toString());
      });
      console.log(`   Found ${testCompetitions.length} test competitions`);
      
      // Get test challenge IDs directly
      const testChallenges = await db.collection('challenges').find({
        $or: [
          { testRunId: testPattern },
          { challengerName: testPattern },
          { challengedName: testPattern },
          { challengerName: testStartPattern },
          { challengedName: testStartPattern },
        ]
      }).toArray();
      testChallenges.forEach(c => {
        testChallengeIds.push(c._id.toString());
      });
      console.log(`   Found ${testChallenges.length} test challenges`);
      
    } catch (e) {
      console.warn('Error finding test data:', e);
    }
    
    // Dedupe all IDs
    const uniqueUserIds = [...new Set(testUserIds)];
    const uniqueCompetitionIds = [...new Set(testCompetitionIds)];
    const uniqueChallengeIds = [...new Set(testChallengeIds)];
    
    console.log(`📊 Summary: ${uniqueUserIds.length} users, ${uniqueCompetitionIds.length} competitions, ${uniqueChallengeIds.length} challenges`);

    // ==========================================
    // STEP 2: DELETE BY SPECIFIC IDS (if provided)
    // ==========================================
    if (testDataIds && testDataIds.length > 0) {
      for (const idString of testDataIds) {
        const [collection, id] = idString.split(':');
        if (collection && id) {
          try {
            const collectionName = collection === 'competition' ? 'competitions' :
                                   collection === 'challenge' ? 'challenges' :
                                   collection === 'participant' ? 'competitionparticipants' :
                                   collection === 'challengeparticipant' ? 'challengeparticipants' :
                                   collection === 'wallet' ? 'creditwallets' :
                                   collection;
            
            const result = await db.collection(collectionName).deleteOne({
              _id: new mongoose.Types.ObjectId(id)
            });
            deletedCount += result.deletedCount;
          } catch (e) {
            console.warn(`Failed to delete ${idString}:`, e);
          }
        }
      }
    }

    // ==========================================
    // STEP 3: DELETE MAIN TEST DATA COLLECTIONS
    // ==========================================
    const mainCollections = [
      'competitions', 
      'challenges', 
      'competitionparticipants', 
      'challengeparticipants',
      'creditwallets',
      'tradingpositions',
      'tradingorders',
      'platformtransactions',
    ];
    
    // Use string-based regex patterns for delete operations
    const testPatternDel = { $regex: 'TEST_', $options: 'i' };
    const testStartPatternDel = { $regex: '^TEST', $options: 'i' };
    
    for (const collectionName of mainCollections) {
      try {
        // Delete by testRunId field (string contains TEST_)
        const result1 = await db.collection(collectionName).deleteMany({ 
          testRunId: testPatternDel
        });
        deletedCount += result1.deletedCount;
        if (result1.deletedCount > 0) {
          console.log(`🗑️ Deleted ${result1.deletedCount} from ${collectionName} by testRunId`);
        }

        // Also cleanup by isTest flag
        const result2 = await db.collection(collectionName).deleteMany({ isTest: true });
        deletedCount += result2.deletedCount;
        if (result2.deletedCount > 0) {
          console.log(`🗑️ Deleted ${result2.deletedCount} from ${collectionName} by isTest`);
        }

        // Also cleanup by name/slug prefix (case insensitive) - VERY AGGRESSIVE
        // This catches old test data that was created before testRunId was added
        const result3 = await db.collection(collectionName).deleteMany({
          $or: [
            { name: testPatternDel },
            { name: testStartPatternDel },
            { slug: { $regex: 'test_', $options: 'i' } },
            { slug: { $regex: 'test-test', $options: 'i' } },
            { username: testPatternDel },
            { username: testStartPatternDel },
            { challengerName: testPatternDel },
            { challengedName: testPatternDel },
            { oddsUsername: testPatternDel },
            { competitionName: testPatternDel },
            { challengeName: testPatternDel },
          ]
        });
        deletedCount += result3.deletedCount;
        if (result3.deletedCount > 0) {
          console.log(`🗑️ Deleted ${result3.deletedCount} from ${collectionName} by name patterns`);
        }
      } catch (e) {
        console.warn(`Failed to cleanup ${collectionName}:`, e);
      }
    }
    
    // Extra: Delete by competitionId/challengeId found earlier
    if (uniqueCompetitionIds.length > 0) {
      for (const collName of ['competitionparticipants', 'tradingpositions', 'tradingorders']) {
        try {
          const result = await db.collection(collName).deleteMany({
            competitionId: { $in: uniqueCompetitionIds }
          });
          if (result.deletedCount > 0) {
            console.log(`🗑️ Deleted ${result.deletedCount} from ${collName} by competitionId`);
            deletedCount += result.deletedCount;
          }
        } catch (e) {
          console.warn(`Failed to delete from ${collName} by competitionId:`, e);
        }
      }
    }
    
    if (uniqueChallengeIds.length > 0) {
      for (const collName of ['challengeparticipants', 'tradingpositions', 'tradingorders']) {
        try {
          const result = await db.collection(collName).deleteMany({
            $or: [
              { challengeId: { $in: uniqueChallengeIds } },
              { competitionId: { $in: uniqueChallengeIds } },
            ]
          });
          if (result.deletedCount > 0) {
            console.log(`🗑️ Deleted ${result.deletedCount} from ${collName} by challengeId`);
            deletedCount += result.deletedCount;
          }
        } catch (e) {
          console.warn(`Failed to delete from ${collName} by challengeId:`, e);
        }
      }
    }

    // ==========================================
    // STEP 4: DELETE SIDE EFFECTS BY USER ID
    // (notifications, badges, levels, wallet transactions)
    // ==========================================
    if (uniqueUserIds.length > 0) {
      console.log(`🧹 Cleaning side effects for ${uniqueUserIds.length} test users...`);
      
      // Delete notifications for test users
      try {
        const notifResult = await db.collection('notifications').deleteMany({
          userId: { $in: uniqueUserIds }
        });
        if (notifResult.deletedCount > 0) {
          console.log(`🗑️ Deleted ${notifResult.deletedCount} notifications`);
          deletedCount += notifResult.deletedCount;
        }
      } catch (e) {
        console.warn('Failed to delete notifications:', e);
      }
      
      // Delete badges for test users
      try {
        const badgeResult = await db.collection('userbadges').deleteMany({
          userId: { $in: uniqueUserIds }
        });
        if (badgeResult.deletedCount > 0) {
          console.log(`🗑️ Deleted ${badgeResult.deletedCount} user badges`);
          deletedCount += badgeResult.deletedCount;
        }
      } catch (e) {
        console.warn('Failed to delete badges:', e);
      }
      
      // Delete user levels for test users
      try {
        const levelResult = await db.collection('userlevels').deleteMany({
          userId: { $in: uniqueUserIds }
        });
        if (levelResult.deletedCount > 0) {
          console.log(`🗑️ Deleted ${levelResult.deletedCount} user levels`);
          deletedCount += levelResult.deletedCount;
        }
      } catch (e) {
        console.warn('Failed to delete user levels:', e);
      }
      
      // Delete wallet transactions for test users
      try {
        const walletTxResult = await db.collection('wallettransactions').deleteMany({
          userId: { $in: uniqueUserIds }
        });
        if (walletTxResult.deletedCount > 0) {
          console.log(`🗑️ Deleted ${walletTxResult.deletedCount} wallet transactions`);
          deletedCount += walletTxResult.deletedCount;
        }
      } catch (e) {
        console.warn('Failed to delete wallet transactions:', e);
      }
      
      // Delete trading orders for test users
      try {
        const orderResult = await db.collection('tradingorders').deleteMany({
          userId: { $in: uniqueUserIds }
        });
        if (orderResult.deletedCount > 0) {
          console.log(`🗑️ Deleted ${orderResult.deletedCount} trading orders`);
          deletedCount += orderResult.deletedCount;
        }
      } catch (e) {
        console.warn('Failed to delete trading orders:', e);
      }
    }
    
    console.log(`✅ Cleanup complete: ${deletedCount} total records deleted`);
    
    return NextResponse.json({ 
      success: true, 
      deletedCount,
      message: `Cleaned up ${deletedCount} test records`
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Cleanup failed' 
    }, { status: 500 });
  }
}
