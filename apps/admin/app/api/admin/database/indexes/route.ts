'use server';

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import mongoose from 'mongoose';

// Define required indexes for optimal performance
const REQUIRED_INDEXES = {
  users: [
    { keys: { email: 1 }, options: { unique: true, name: 'email_1' } },
    { keys: { username: 1 }, options: { name: 'username_1' } },
    { keys: { createdAt: -1 }, options: { name: 'createdAt_-1' } },
  ],
  competitions: [
    { keys: { status: 1, startTime: 1 }, options: { name: 'status_1_startTime_1' } },
    { keys: { slug: 1 }, options: { unique: true, name: 'slug_1' } },
    { keys: { endTime: 1 }, options: { name: 'endTime_1' } },
    { keys: { createdAt: -1 }, options: { name: 'createdAt_-1' } },
  ],
  competitionparticipants: [
    { keys: { competitionId: 1, userId: 1 }, options: { unique: true, name: 'competitionId_1_userId_1' } },
    { keys: { competitionId: 1, status: 1 }, options: { name: 'competitionId_1_status_1' } },
    { keys: { userId: 1 }, options: { name: 'userId_1' } },
    { keys: { competitionId: 1, currentCapital: -1 }, options: { name: 'competitionId_1_currentCapital_-1' } },
  ],
  challenges: [
    { keys: { status: 1, endTime: 1 }, options: { name: 'status_1_endTime_1' } },
    { keys: { challengerId: 1 }, options: { name: 'challengerId_1' } },
    { keys: { challengedId: 1 }, options: { name: 'challengedId_1' } },
    { keys: { createdAt: -1 }, options: { name: 'createdAt_-1' } },
  ],
  challengeparticipants: [
    { keys: { challengeId: 1, role: 1 }, options: { name: 'challengeId_1_role_1' } },
    { keys: { challengeId: 1, status: 1 }, options: { name: 'challengeId_1_status_1' } },
    { keys: { userId: 1 }, options: { name: 'userId_1' } },
  ],
  tradingpositions: [
    { keys: { participantId: 1, status: 1 }, options: { name: 'participantId_1_status_1' } },
    { keys: { competitionId: 1, status: 1 }, options: { name: 'competitionId_1_status_1' } },
    { keys: { userId: 1, status: 1 }, options: { name: 'userId_1_status_1' } },
    { keys: { symbol: 1, status: 1 }, options: { name: 'symbol_1_status_1' } },
    { keys: { createdAt: -1 }, options: { name: 'createdAt_-1' } },
  ],
  tradingorders: [
    { keys: { participantId: 1, status: 1 }, options: { name: 'participantId_1_status_1' } },
    { keys: { competitionId: 1, status: 1 }, options: { name: 'competitionId_1_status_1' } },
    { keys: { userId: 1 }, options: { name: 'userId_1' } },
    { keys: { createdAt: -1 }, options: { name: 'createdAt_-1' } },
  ],
  wallets: [
    { keys: { userId: 1 }, options: { unique: true, name: 'userId_1' } },
    { keys: { balance: -1 }, options: { name: 'balance_-1' } },
  ],
  wallettransactions: [
    { keys: { userId: 1, createdAt: -1 }, options: { name: 'userId_1_createdAt_-1' } },
    { keys: { walletId: 1, type: 1 }, options: { name: 'walletId_1_type_1' } },
    { keys: { status: 1 }, options: { name: 'status_1' } },
    { keys: { createdAt: -1 }, options: { name: 'createdAt_-1' } },
  ],
  platformtransactions: [
    { keys: { type: 1, createdAt: -1 }, options: { name: 'type_1_createdAt_-1' } },
    { keys: { competitionId: 1 }, options: { name: 'competitionId_1' } },
    { keys: { challengeId: 1 }, options: { name: 'challengeId_1' } },
  ],
  notifications: [
    { keys: { userId: 1, read: 1 }, options: { name: 'userId_1_read_1' } },
    { keys: { userId: 1, createdAt: -1 }, options: { name: 'userId_1_createdAt_-1' } },
  ],
  pricelogs: [
    { keys: { symbol: 1, timestamp: -1 }, options: { name: 'symbol_1_timestamp_-1' } },
    { keys: { timestamp: 1 }, options: { expireAfterSeconds: 86400, name: 'timestamp_1_ttl' } }, // TTL index - 24 hours
  ],
  candles_1m: [
    { keys: { symbol: 1, timestamp: -1 }, options: { name: 'symbol_1_timestamp_-1' } },
  ],
  candles_historical_1m: [
    { keys: { symbol: 1, timestamp: -1 }, options: { name: 'symbol_1_timestamp_-1' } },
    { keys: { symbol: 1, timestamp: 1 }, options: { name: 'symbol_1_timestamp_1' } },
  ],
  candles_historical_5m: [
    { keys: { symbol: 1, timestamp: -1 }, options: { name: 'symbol_1_timestamp_-1' } },
  ],
  candles_historical_15m: [
    { keys: { symbol: 1, timestamp: -1 }, options: { name: 'symbol_1_timestamp_-1' } },
  ],
  candles_historical_30m: [
    { keys: { symbol: 1, timestamp: -1 }, options: { name: 'symbol_1_timestamp_-1' } },
  ],
  candles_historical_1h: [
    { keys: { symbol: 1, timestamp: -1 }, options: { name: 'symbol_1_timestamp_-1' } },
  ],
};

interface IndexInfo {
  collection: string;
  name: string;
  keys: Record<string, number>;
  required: boolean;
  exists: boolean;
  unique?: boolean;
  ttl?: number;
}

interface IndexStatus {
  collection: string;
  totalRequired: number;
  existing: number;
  missing: number;
  indexes: IndexInfo[];
}

// GET - Check index status
export async function GET() {
  try {
    await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) throw new Error('Database not connected');

    const results: IndexStatus[] = [];
    let totalMissing = 0;
    let totalExisting = 0;

    for (const [collectionName, requiredIndexes] of Object.entries(REQUIRED_INDEXES)) {
      try {
        // Check if collection exists
        const collections = await db.listCollections({ name: collectionName }).toArray();
        const collectionExists = collections.length > 0;

        const indexes: IndexInfo[] = [];
        let existingIndexes: Array<{ name?: string; key: Record<string, number>; unique?: boolean; expireAfterSeconds?: number }> = [];

        if (collectionExists) {
          existingIndexes = await db.collection(collectionName).indexes();
        }

        for (const required of requiredIndexes) {
          const indexName = required.options.name;
          const existingIndex = existingIndexes.find(idx => idx.name === indexName);
          const exists = !!existingIndex;

          indexes.push({
            collection: collectionName,
            name: indexName,
            keys: required.keys,
            required: true,
            exists,
            unique: required.options.unique,
            ttl: required.options.expireAfterSeconds,
          });

          if (exists) {
            totalExisting++;
          } else {
            totalMissing++;
          }
        }

        results.push({
          collection: collectionName,
          totalRequired: requiredIndexes.length,
          existing: indexes.filter(i => i.exists).length,
          missing: indexes.filter(i => !i.exists).length,
          indexes,
        });
      } catch (error) {
        console.warn(`Error checking indexes for ${collectionName}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        totalCollections: results.length,
        totalRequired: totalExisting + totalMissing,
        totalExisting,
        totalMissing,
        healthScore: totalMissing === 0 ? 100 : Math.round((totalExisting / (totalExisting + totalMissing)) * 100),
      },
      collections: results,
    });
  } catch (error) {
    console.error('Error checking indexes:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// POST - Create missing indexes
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { collections: targetCollections, createAll } = body;

    await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) throw new Error('Database not connected');

    const results: { collection: string; index: string; status: 'created' | 'exists' | 'error'; error?: string }[] = [];

    const collectionsToProcess = createAll 
      ? Object.keys(REQUIRED_INDEXES) 
      : (targetCollections || []);

    for (const collectionName of collectionsToProcess) {
      const requiredIndexes = REQUIRED_INDEXES[collectionName as keyof typeof REQUIRED_INDEXES];
      if (!requiredIndexes) continue;

      try {
        // Get existing indexes
        const existingIndexes = await db.collection(collectionName).indexes().catch(() => []);
        const existingNames = new Set(existingIndexes.map(idx => idx.name));

        for (const required of requiredIndexes) {
          const indexName = required.options.name;

          // Check if index with same name exists
          if (existingNames.has(indexName)) {
            results.push({
              collection: collectionName,
              index: indexName,
              status: 'exists',
            });
            continue;
          }

          // Check if an index with the same keys already exists (different name)
          const keysString = JSON.stringify(required.keys);
          const existingWithSameKeys = existingIndexes.find(idx => 
            JSON.stringify(idx.key) === keysString
          );

          if (existingWithSameKeys) {
            // Index with same keys exists but different name/options
            // Skip to avoid IndexOptionsConflict error
            console.log(`⏭️ Skipping ${indexName} on ${collectionName} - equivalent index "${existingWithSameKeys.name}" already exists`);
            results.push({
              collection: collectionName,
              index: indexName,
              status: 'exists',
              error: `Equivalent index "${existingWithSameKeys.name}" already exists`,
            });
            continue;
          }

          try {
            // Create the index
            await db.collection(collectionName).createIndex(
              required.keys,
              { ...required.options, background: true }
            );

            results.push({
              collection: collectionName,
              index: indexName,
              status: 'created',
            });

            console.log(`✅ Created index ${indexName} on ${collectionName}`);
          } catch (indexError) {
            // Handle IndexOptionsConflict gracefully
            const errorMessage = indexError instanceof Error ? indexError.message : 'Unknown error';
            const isConflict = errorMessage.includes('equivalent index') || 
                              errorMessage.includes('IndexOptionsConflict') ||
                              (indexError as { code?: number })?.code === 85;
            
            results.push({
              collection: collectionName,
              index: indexName,
              status: isConflict ? 'exists' : 'error',
              error: isConflict ? 'Equivalent index exists with different name' : errorMessage,
            });
            
            if (isConflict) {
              console.log(`⏭️ ${indexName} on ${collectionName}: equivalent index already exists`);
            } else {
              console.error(`❌ Failed to create index ${indexName} on ${collectionName}:`, indexError);
            }
          }
        }
      } catch (collError) {
        console.error(`Error processing ${collectionName}:`, collError);
      }
    }

    const created = results.filter(r => r.status === 'created').length;
    const existed = results.filter(r => r.status === 'exists').length;
    const failed = results.filter(r => r.status === 'error').length;

    return NextResponse.json({
      success: true,
      summary: {
        created,
        existed,
        failed,
        total: results.length,
      },
      results,
    });
  } catch (error) {
    console.error('Error creating indexes:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
