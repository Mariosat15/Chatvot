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

    // Delete by specific IDs if provided
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

    // Cleanup by testRunId prefix (TEST_)
    // IMPORTANT: Include ALL collections that can be created during tests
    const collections = [
      // Core test data
      'competitions', 
      'challenges', 
      'competitionparticipants', 
      'challengeparticipants',
      'creditwallets',
      'tradingpositions',
      'tradingorders', // Orders created when positions are closed
      
      // Financial records
      'platformtransactions',
      'wallettransactions',
      
      // Side effects from finalization (badges, notifications, levels)
      'notifications', // Created when notifying winners
      'userbadges', // Created when evaluating badges after competition
      'userlevels', // Created/updated when awarding XP for badges
    ];
    
    for (const collectionName of collections) {
      try {
        // Delete by testRunId field (string starts with TEST_)
        const result1 = await db.collection(collectionName).deleteMany({ 
          testRunId: { $exists: true, $regex: /^TEST_/ } 
        });
        deletedCount += result1.deletedCount;
        if (result1.deletedCount > 0) {
          console.log(`Deleted ${result1.deletedCount} from ${collectionName} by testRunId`);
        }

        // Also cleanup by isTest flag
        const result2 = await db.collection(collectionName).deleteMany({ isTest: true });
        deletedCount += result2.deletedCount;
        if (result2.deletedCount > 0) {
          console.log(`Deleted ${result2.deletedCount} from ${collectionName} by isTest`);
        }

        // Also cleanup by name/slug prefix (case insensitive)
        const result3 = await db.collection(collectionName).deleteMany({
          $or: [
            { name: { $regex: /^TEST_/i } },
            { slug: { $regex: /^test-test_/i } },
            { username: { $regex: /^TEST_/i } },
          ]
        });
        deletedCount += result3.deletedCount;
        if (result3.deletedCount > 0) {
          console.log(`Deleted ${result3.deletedCount} from ${collectionName} by name/slug/username`);
        }
      } catch (e) {
        console.warn(`Failed to cleanup ${collectionName}:`, e);
      }
    }
    
    // Extra safety: Delete any competition/challenge with TEST_ in name directly
    try {
      const compResult = await db.collection('competitions').deleteMany({
        name: { $regex: /TEST_/i }
      });
      if (compResult.deletedCount > 0) {
        console.log(`Extra cleanup: Deleted ${compResult.deletedCount} competitions with TEST_ in name`);
        deletedCount += compResult.deletedCount;
      }
      
      const challengeResult = await db.collection('challenges').deleteMany({
        $or: [
          { challengerName: { $regex: /TEST_/i } },
          { challengedName: { $regex: /TEST_/i } },
        ]
      });
      if (challengeResult.deletedCount > 0) {
        console.log(`Extra cleanup: Deleted ${challengeResult.deletedCount} challenges with TEST_ names`);
        deletedCount += challengeResult.deletedCount;
      }
    } catch (e) {
      console.warn('Extra cleanup failed:', e);
    }
    
    // Cleanup side effects (notifications, badges, levels) for test users
    // First, find all test user IDs from wallets and participants
    try {
      const testUserIds: string[] = [];
      
      // Get user IDs from test wallets
      const testWallets = await db.collection('creditwallets').find({
        $or: [
          { testRunId: { $exists: true, $regex: /^TEST_/i } },
          { userId: { $regex: /^TEST_/i } },
        ]
      }).toArray();
      testWallets.forEach(w => {
        if (w.userId) testUserIds.push(w.userId.toString());
      });
      
      // Get user IDs from test participants
      const testParticipants = await db.collection('competitionparticipants').find({
        $or: [
          { testRunId: { $exists: true, $regex: /^TEST_/i } },
          { username: { $regex: /^TEST_/i } },
        ]
      }).toArray();
      testParticipants.forEach(p => {
        if (p.userId) testUserIds.push(p.userId.toString());
      });
      
      // Get user IDs from test challenge participants
      const testChallengeParticipants = await db.collection('challengeparticipants').find({
        $or: [
          { testRunId: { $exists: true, $regex: /^TEST_/i } },
          { username: { $regex: /^TEST_/i } },
        ]
      }).toArray();
      testChallengeParticipants.forEach(p => {
        if (p.userId) testUserIds.push(p.userId.toString());
      });
      
      // Dedupe user IDs
      const uniqueUserIds = [...new Set(testUserIds)];
      
      if (uniqueUserIds.length > 0) {
        console.log(`Found ${uniqueUserIds.length} test user IDs to clean up side effects`);
        
        // Delete notifications for test users
        const notifResult = await db.collection('notifications').deleteMany({
          userId: { $in: uniqueUserIds }
        });
        if (notifResult.deletedCount > 0) {
          console.log(`Deleted ${notifResult.deletedCount} notifications for test users`);
          deletedCount += notifResult.deletedCount;
        }
        
        // Delete badges for test users
        const badgeResult = await db.collection('userbadges').deleteMany({
          userId: { $in: uniqueUserIds }
        });
        if (badgeResult.deletedCount > 0) {
          console.log(`Deleted ${badgeResult.deletedCount} badges for test users`);
          deletedCount += badgeResult.deletedCount;
        }
        
        // Delete user levels for test users
        const levelResult = await db.collection('userlevels').deleteMany({
          userId: { $in: uniqueUserIds }
        });
        if (levelResult.deletedCount > 0) {
          console.log(`Deleted ${levelResult.deletedCount} user levels for test users`);
          deletedCount += levelResult.deletedCount;
        }
        
        // Delete trading orders for test users
        const orderResult = await db.collection('tradingorders').deleteMany({
          userId: { $in: uniqueUserIds }
        });
        if (orderResult.deletedCount > 0) {
          console.log(`Deleted ${orderResult.deletedCount} trading orders for test users`);
          deletedCount += orderResult.deletedCount;
        }
      }
    } catch (e) {
      console.warn('Side effects cleanup failed:', e);
    }

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
