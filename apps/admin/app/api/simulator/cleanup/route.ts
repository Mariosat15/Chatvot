import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../../../database/mongoose';
import mongoose from 'mongoose';

/**
 * POST /api/simulator/cleanup
 * Delete ALL simulation data from the database
 */
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const body = await request.json().catch(() => ({}));
    const { confirm } = body;
    
    // Require explicit confirmation
    if (confirm !== 'DELETE_ALL_SIMULATION_DATA') {
      return NextResponse.json({
        success: false,
        error: 'Confirmation required. Send { confirm: "DELETE_ALL_SIMULATION_DATA" }',
      }, { status: 400 });
    }

    const result: Record<string, number> = {
      users: 0,
      competitions: 0,
      challenges: 0,
      positions: 0,
      transactions: 0,
      wallets: 0,
      deviceFingerprints: 0,
      tradeHistory: 0,
      competitionParticipants: 0,
      challengeParticipants: 0,
      simulatorRuns: 0,
      simulatorConfigs: 0,
    };

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not available');
    }

    console.log('🧹 Starting global simulation data cleanup...');

    // IMPORTANT: Get user IDs BEFORE deleting users!
    // 1. Find simulator users (email pattern: @test.simulator)
    const simUsers = await db.collection('user').find(
      { 
        $or: [
          { email: { $regex: /@test\.simulator$/i } },
          { 'metadata.simulatorMode': true },
        ]
      },
      { projection: { id: 1, _id: 1 } }
    ).toArray();
    
    const simUserIds = simUsers.map(u => u.id || u._id?.toString()).filter(Boolean);
    console.log(`Found ${simUserIds.length} simulator users to clean up`);

    // 2. Find simulator competition IDs
    const simCompetitions = await db.collection('competitions').find(
      {
        $or: [
          { 'metadata.simulatorMode': true },
          { name: { $regex: /^Sim Competition/i } },
        ]
      },
      { projection: { _id: 1 } }
    ).toArray();
    const simCompetitionIds = simCompetitions.map(c => c._id.toString());
    console.log(`Found ${simCompetitionIds.length} simulator competitions to clean up`);

    // 3. Delete competition participants first (before competitions)
    const participantDeleteResult = await db.collection('competitionparticipants').deleteMany({
      $or: [
        { competitionId: { $in: simCompetitionIds.map(id => new mongoose.Types.ObjectId(id)) } },
        { competitionId: { $in: simCompetitionIds } },
        { userId: { $in: simUserIds } },
        { email: { $regex: /@test\.simulator$/i } },
        { username: { $regex: /^SimUser_/i } },
      ]
    });
    result.competitionParticipants = participantDeleteResult.deletedCount;

    // 4. Delete challenge participants (note: field is userId, not oderId)
    const chalPartDeleteResult = await db.collection('challengeparticipants').deleteMany({
      $or: [
        { userId: { $in: simUserIds } },
        { email: { $regex: /@test\.simulator$/i } },
        { username: { $regex: /^SimUser_/i } },
      ]
    });
    result.challengeParticipants = chalPartDeleteResult.deletedCount;

    // 5. Delete positions with simulator metadata or belonging to sim users/competitions
    const posDeleteResult = await db.collection('tradingpositions').deleteMany({
      $or: [
        { 'metadata.simulatorMode': true },
        { userId: { $in: simUserIds } },
        { competitionId: { $in: simCompetitionIds.map(id => new mongoose.Types.ObjectId(id)) } },
        { competitionId: { $in: simCompetitionIds } },
      ]
    });
    result.positions = posDeleteResult.deletedCount;

    // 6. Delete wallet transactions (correct collection name)
    const txDeleteResult = await db.collection('wallettransactions').deleteMany({
      $or: [
        { 'metadata.simulatorMode': true },
        { userId: { $in: simUserIds } },
        { description: { $regex: /^Simulator/i } },
        { description: { $regex: /simulator/i } },
      ]
    });
    result.transactions = txDeleteResult.deletedCount;

    // 7. Delete credit wallets (correct collection name)
    const walletDeleteResult = await db.collection('creditwallets').deleteMany({
      userId: { $in: simUserIds }
    });
    result.wallets = walletDeleteResult.deletedCount;

    // 8. Delete device fingerprints from simulator
    const fpDeleteResult = await db.collection('devicefingerprints').deleteMany({
      $or: [
        { browser: 'SimBrowser' },
        { userId: { $in: simUserIds } },
        { fingerprintId: { $regex: /^sim_fingerprint_/ } },
      ]
    });
    result.deviceFingerprints = fpDeleteResult.deletedCount;

    // 9. Delete trade history for sim users
    const historyDeleteResult = await db.collection('tradehistories').deleteMany({
      $or: [
        { userId: { $in: simUserIds } },
        { competitionId: { $in: simCompetitionIds.map(id => new mongoose.Types.ObjectId(id)) } },
        { competitionId: { $in: simCompetitionIds } },
      ]
    });
    result.tradeHistory = historyDeleteResult.deletedCount;

    // 10. Delete challenges with simulator metadata or involving sim users
    const challengeDeleteResult = await db.collection('challenges').deleteMany({
      $or: [
        { 'metadata.simulatorMode': true },
        { challengerId: { $in: simUserIds } },
        { challengedId: { $in: simUserIds } },
        { challengerEmail: { $regex: /@test\.simulator$/i } },
        { challengedEmail: { $regex: /@test\.simulator$/i } },
        { challengerName: { $regex: /^SimUser_/i } },
        { challengedName: { $regex: /^SimUser_/i } },
      ]
    });
    result.challenges = challengeDeleteResult.deletedCount;

    // 11. Delete competitions (after participants are deleted)
    const compDeleteResult = await db.collection('competitions').deleteMany({
      $or: [
        { 'metadata.simulatorMode': true },
        { name: { $regex: /^Sim Competition/i } },
      ]
    });
    result.competitions = compDeleteResult.deletedCount;

    // 12. Delete simulator users LAST
    const userDeleteResult = await db.collection('user').deleteMany({
      $or: [
        { email: { $regex: /@test\.simulator$/i } },
        { 'metadata.simulatorMode': true },
      ]
    });
    result.users = userDeleteResult.deletedCount;

    // 13. Delete all simulator runs (results/stats)
    const runsDeleteResult = await db.collection('simulatorruns').deleteMany({});
    result.simulatorRuns = runsDeleteResult.deletedCount;

    // NOTE: We do NOT delete simulator configs - they are settings, not test data
    // Configs are reused across simulations
    result.simulatorConfigs = 0;

    // 14. Also try alternative collection names (in case of different casing)
    try {
      await db.collection('transactions').deleteMany({
        $or: [
          { 'metadata.simulatorMode': true },
          { userId: { $in: simUserIds } },
        ]
      });
      await db.collection('wallets').deleteMany({
        userId: { $in: simUserIds }
      });
    } catch {
      // Ignore if collections don't exist
    }

    console.log('✅ Global simulation cleanup completed:', result);

    return NextResponse.json({
      success: true,
      message: 'All simulation data deleted',
      deleted: result,
      totalDeleted: Object.values(result).reduce((a, b) => a + b, 0),
    });
  } catch (error) {
    console.error('Error during global cleanup:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Cleanup failed',
    }, { status: 500 });
  }
}

/**
 * GET /api/simulator/cleanup
 * Get count of simulation data that would be deleted
 */
export async function GET() {
  try {
    await connectToDatabase();
    
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not available');
    }

    const counts: Record<string, number> = {};

    // First, get simulator user IDs
    const simUsers = await db.collection('user').find(
      { 
        $or: [
          { email: { $regex: /@test\.simulator$/i } },
          { 'metadata.simulatorMode': true },
        ]
      },
      { projection: { id: 1, _id: 1 } }
    ).toArray();
    const simUserIds = simUsers.map(u => u.id || u._id?.toString()).filter(Boolean);

    // Get simulator competition IDs
    const simCompetitions = await db.collection('competitions').find(
      {
        $or: [
          { 'metadata.simulatorMode': true },
          { name: { $regex: /^Sim Competition/i } },
        ]
      },
      { projection: { _id: 1 } }
    ).toArray();
    const simCompetitionIds = simCompetitions.map(c => c._id.toString());

    // Count simulator users
    counts.users = simUsers.length;

    // Count competitions with simulator metadata
    counts.competitions = simCompetitions.length;

    // Count challenges with simulator metadata or involving sim users
    counts.challenges = await db.collection('challenges').countDocuments({
      $or: [
        { 'metadata.simulatorMode': true },
        { challengerId: { $in: simUserIds } },
        { challengedId: { $in: simUserIds } },
        { challengerEmail: { $regex: /@test\.simulator$/i } },
        { challengedEmail: { $regex: /@test\.simulator$/i } },
        { challengerName: { $regex: /^SimUser_/i } },
        { challengedName: { $regex: /^SimUser_/i } },
      ]
    });

    // Count positions with simulator metadata or belonging to sim users
    counts.positions = await db.collection('tradingpositions').countDocuments({
      $or: [
        { 'metadata.simulatorMode': true },
        { userId: { $in: simUserIds } },
        { competitionId: { $in: simCompetitionIds.map(id => new mongoose.Types.ObjectId(id)) } },
        { competitionId: { $in: simCompetitionIds } },
      ]
    });

    // Count wallet transactions (correct collection name)
    counts.transactions = await db.collection('wallettransactions').countDocuments({
      $or: [
        { 'metadata.simulatorMode': true },
        { userId: { $in: simUserIds } },
        { description: { $regex: /simulator/i } },
      ]
    });

    // Count credit wallets
    counts.wallets = await db.collection('creditwallets').countDocuments({
      userId: { $in: simUserIds }
    });

    // Count competition participants
    counts.competitionParticipants = await db.collection('competitionparticipants').countDocuments({
      $or: [
        { competitionId: { $in: simCompetitionIds.map(id => new mongoose.Types.ObjectId(id)) } },
        { competitionId: { $in: simCompetitionIds } },
        { userId: { $in: simUserIds } },
        { email: { $regex: /@test\.simulator$/i } },
        { username: { $regex: /^SimUser_/i } },
      ]
    });

    // Count challenge participants
    counts.challengeParticipants = await db.collection('challengeparticipants').countDocuments({
      $or: [
        { userId: { $in: simUserIds } },
        { email: { $regex: /@test\.simulator$/i } },
        { username: { $regex: /^SimUser_/i } },
      ]
    });

    // Count simulator runs (stats/results)
    counts.simulatorRuns = await db.collection('simulatorruns').countDocuments({});

    // Configs are NOT counted - they are settings, not test data
    counts.simulatorConfigs = 0;

    // Count device fingerprints from simulator
    counts.deviceFingerprints = await db.collection('devicefingerprints').countDocuments({
      $or: [
        { browser: 'SimBrowser' },
        { userId: { $in: simUserIds } },
        { fingerprintId: { $regex: /^sim_fingerprint_/ } },
      ]
    });

    return NextResponse.json({
      success: true,
      counts,
      totalCount: Object.values(counts).reduce((a, b) => a + b, 0),
    });
  } catch (error) {
    console.error('Error counting simulation data:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to count data',
    }, { status: 500 });
  }
}

