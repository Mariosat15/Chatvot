import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import mongoose from 'mongoose';

/**
 * GET /api/health/db
 * Health check endpoint for database connectivity
 * Used by the Performance Simulator for stress testing
 */
export async function GET(request: NextRequest) {
  const start = Date.now();
  const isSimulatorMode = request.headers.get('X-Simulator-Mode') === 'true';
  
  try {
    // For simulator mode, use a lighter check if connection is already established
    if (isSimulatorMode && mongoose.connection.readyState === 1) {
      // Connection already open - just verify it's responsive
      const db = mongoose.connection.db;
      if (db) {
        // Quick ping without reconnection overhead
        await db.command({ ping: 1 });
        const duration = Date.now() - start;
        return NextResponse.json({
          status: 'healthy',
          database: 'connected',
          responseTime: duration,
          timestamp: new Date().toISOString(),
          mode: 'fast',
        });
      }
    }
    
    // Normal mode - full connection check
    await connectToDatabase();
    
    // Simple ping to database
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not established');
    }
    
    // Run a simple command to verify connection
    await db.command({ ping: 1 });
    
    const duration = Date.now() - start;
    
    return NextResponse.json({
      status: 'healthy',
      database: 'connected',
      responseTime: duration,
      timestamp: new Date().toISOString(),
      mode: 'full',
    });
  } catch (error) {
    const duration = Date.now() - start;
    console.error('Health check failed:', error);
    
    return NextResponse.json(
      {
        status: 'unhealthy',
        database: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime: duration,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}

