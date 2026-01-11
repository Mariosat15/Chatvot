import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import { auth } from '@/lib/better-auth/auth';
import bcrypt from 'bcryptjs';

/**
 * POST /api/simulator/users
 * Create test users for the simulator
 * Only works in development or when simulator mode is enabled
 */
export async function POST(request: NextRequest) {
  console.log('🧪 [SIMULATOR] User creation request received');
  
  // Only allow in development or with simulator mode header
  const isSimulatorMode = request.headers.get('X-Simulator-Mode') === 'true';
  const isDev = process.env.NODE_ENV === 'development';

  console.log('🧪 [SIMULATOR] Mode check:', { isSimulatorMode, isDev });

  if (!isSimulatorMode && !isDev) {
    console.log('🧪 [SIMULATOR] Rejected - not in simulator mode');
    return NextResponse.json(
      { success: false, error: 'Simulator mode not enabled' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    console.log('🧪 [SIMULATOR] Request body:', { 
      hasBatch: !!body.batch, 
      batchSize: body.batch?.length,
      singleUser: !!body.email 
    });
    const { email, password, name, batch } = body;

    await connectToDatabase();

    // Handle batch creation
    if (batch && Array.isArray(batch)) {
      const results = await createBatchUsers(batch);
      return NextResponse.json({
        success: true,
        users: results,
        created: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
      });
    }

    // Single user creation
    if (!email || !password || !name) {
      return NextResponse.json(
        { success: false, error: 'Email, password, and name are required' },
        { status: 400 }
      );
    }

    const result = await createSimulatorUser(email, password, name);
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        user: result.user,
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error creating simulator user:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create user' },
      { status: 500 }
    );
  }
}

/**
 * Create a single simulator user
 */
async function createSimulatorUser(
  email: string,
  password: string,
  name: string
): Promise<{ success: boolean; user?: { id: string; email: string }; error?: string }> {
  try {
    // Use better-auth's signUpEmail
    const response = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name,
      },
    });

    if (response?.user) {
      return {
        success: true,
        user: {
          id: response.user.id,
          email: response.user.email,
        },
      };
    }

    return { success: false, error: 'Failed to create user' };
  } catch (error) {
    // Check if user already exists
    if (error instanceof Error && error.message.includes('already exists')) {
      return { success: false, error: 'User already exists' };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create user',
    };
  }
}

/**
 * Create multiple users in batch with optimized parallelism
 * Uses concurrent processing while respecting resource limits
 */
async function createBatchUsers(
  users: Array<{ email: string; password: string; name: string }>
): Promise<Array<{ email: string; success: boolean; userId?: string; error?: string }>> {
  const results: Array<{ email: string; success: boolean; userId?: string; error?: string }> = [];

  // PERFORMANCE: Increased batch size from 10 to 25 for better throughput
  // bcrypt is CPU-bound, but modern servers can handle 20-30 concurrent hashes
  const batchSize = 25;
  
  for (let i = 0; i < users.length; i += batchSize) {
    const batch = users.slice(i, i + batchSize);
    
    // Process entire batch in parallel
    const batchResults = await Promise.all(
      batch.map(async (user) => {
        const result = await createSimulatorUser(user.email, user.password, user.name);
        return {
          email: user.email,
          success: result.success,
          userId: result.user?.id,
          error: result.error,
        };
      })
    );

    results.push(...batchResults);
    
    // Small delay between batches to prevent connection exhaustion
    if (i + batchSize < users.length) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  return results;
}

/**
 * DELETE /api/simulator/users
 * Delete simulator test users
 */
export async function DELETE(request: NextRequest) {
  const isSimulatorMode = request.headers.get('X-Simulator-Mode') === 'true';
  const isDev = process.env.NODE_ENV === 'development';

  if (!isSimulatorMode && !isDev) {
    return NextResponse.json(
      { success: false, error: 'Simulator mode not enabled' },
      { status: 403 }
    );
  }

  try {
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;

    if (!db) {
      throw new Error('Database connection not available');
    }

    // Delete users with simulator email pattern
    const result = await db.collection('user').deleteMany({
      email: { $regex: /@test\.simulator$/ },
    });

    // Also delete their sessions
    await db.collection('session').deleteMany({
      'user.email': { $regex: /@test\.simulator$/ },
    });

    return NextResponse.json({
      success: true,
      deleted: result.deletedCount,
    });
  } catch (error) {
    console.error('Error deleting simulator users:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete users' },
      { status: 500 }
    );
  }
}

