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
    const collections = [
      'competitions', 
      'challenges', 
      'competitionparticipants', 
      'challengeparticipants',
      'creditwallets',
      'platformtransactions',
    ];
    
    for (const collectionName of collections) {
      try {
        // Delete by testRunId field
        const result1 = await db.collection(collectionName).deleteMany({ 
          testRunId: { $regex: /^TEST_/ } 
        });
        deletedCount += result1.deletedCount;

        // Also cleanup by isTest flag
        const result2 = await db.collection(collectionName).deleteMany({ isTest: true });
        deletedCount += result2.deletedCount;

        // Also cleanup by name/slug prefix
        const result3 = await db.collection(collectionName).deleteMany({
          $or: [
            { name: { $regex: /^TEST_/ } },
            { slug: { $regex: /^test-test_/i } },
            { username: { $regex: /^TEST_/ } },
          ]
        });
        deletedCount += result3.deletedCount;
      } catch (e) {
        console.warn(`Failed to cleanup ${collectionName}:`, e);
      }
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
