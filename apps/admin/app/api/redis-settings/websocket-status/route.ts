import { NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin/auth';
import { connectToDatabase } from '@/database/mongoose';
import mongoose from 'mongoose';

export async function GET() {
  try {
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ⚠️ IMPORTANT: Admin cannot access WEB app's WebSocket state directly
    // (they're separate Node.js processes with separate memory)
    // Instead, we check the MongoDB price cache to infer WebSocket status
    // The WEB app writes prices to MongoDB, so if we have recent prices,
    // WebSocket is working
    
    await connectToDatabase();
    
    // Query pricecaches collection directly (mongoose auto-pluralizes model name)
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database not connected');
    }
    
    const priceCacheCollection = db.collection('pricecaches');
    const cachedPrices = await priceCacheCollection.find({}).toArray();
    const now = Date.now();
    
    // Check if we have recent prices (within last 5 seconds)
    const recentPrices = cachedPrices.filter(p => {
      const priceTime = new Date(p.timestamp).getTime();
      return (now - priceTime) < 5000; // 5 seconds
    });
    
    // If we have recent prices, WebSocket is likely connected
    const isConnected = recentPrices.length > 0;
    const lastUpdateTime = recentPrices.length > 0 
      ? Math.max(...recentPrices.map(p => new Date(p.timestamp).getTime()))
      : 0;

    return NextResponse.json({
      connected: isConnected,
      authenticated: isConnected, // If connected, likely authenticated
      subscribed: isConnected,    // If connected, likely subscribed
      cachedPairs: cachedPrices.length,
      lastUpdate: lastUpdateTime,
      reconnectAttempts: 0,
      // Extra info for debugging
      source: 'mongodb-cache',
      recentPricesCount: recentPrices.length,
    });
  } catch (error) {
    console.error('Failed to get WebSocket status:', error);
    return NextResponse.json({
      connected: false,
      authenticated: false,
      subscribed: false,
      cachedPairs: 0,
      lastUpdate: 0,
      reconnectAttempts: 0,
      error: 'Failed to get status',
      source: 'error',
    });
  }
}

