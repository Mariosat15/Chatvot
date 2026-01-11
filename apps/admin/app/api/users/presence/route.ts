import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/database/mongoose';

/**
 * GET /api/users/presence
 * Get online/offline status for all users
 */
export async function GET() {
  try {
    await connectToDatabase();
    
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: 'Database not connected' }, { status: 500 });
    }
    
    // Get all presence records from user_presence collection
    const presences = await db.collection('user_presence').find({}).toArray();
    
    // Define threshold for "offline" (45 seconds without heartbeat)
    const offlineThreshold = new Date(Date.now() - 45 * 1000);
    
    // Map presence data with online status
    const presenceData = presences.map(p => ({
      participantId: p.participantId,
      status: p.lastHeartbeat && new Date(p.lastHeartbeat) > offlineThreshold 
        ? p.status || 'online' 
        : 'offline',
      lastSeen: p.lastHeartbeat || p.updatedAt || p.createdAt,
      lastHeartbeat: p.lastHeartbeat,
    }));
    
    return NextResponse.json({
      presences: presenceData,
      total: presenceData.length,
      onlineCount: presenceData.filter(p => p.status !== 'offline').length,
      offlineCount: presenceData.filter(p => p.status === 'offline').length,
    });
  } catch (error) {
    console.error('Error fetching user presence:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user presence' },
      { status: 500 }
    );
  }
}
