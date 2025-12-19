import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import mongoose from 'mongoose';

/**
 * GET /api/health/db
 * Health check endpoint for database connectivity
 * Used by the Performance Simulator for stress testing
 */
export async function GET() {
  const start = Date.now();
  
  try {
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
    });
  } catch (error) {
    const duration = Date.now() - start;
    
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

