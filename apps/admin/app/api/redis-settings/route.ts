import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin/auth';
import { connectToDatabase } from '@/database/mongoose';
import { WhiteLabel } from '@/database/models/whitelabel.model';
import { reconnectRedis } from '@/lib/services/redis.service';

// Default price feed settings
const DEFAULT_PRICE_FEED = {
  priceFeedMode: 'both' as const,
  priceFeedWebsocketEnabled: true,
  priceFeedApiEnabled: true,
  priceFeedPrimarySource: 'websocket' as const,
  priceFeedUpdateInterval: 2000,
  priceFeedCacheTTL: 10000,
  priceFeedClientPollInterval: 500,
  priceFeedWebsocketReconnectAttempts: 10,
  priceFeedWebsocketReconnectDelay: 3000,
  priceFeedApiConcurrency: 30,
  priceFeedFallbackEnabled: true,
};

export async function GET() {
  try {
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    const settings = await WhiteLabel.findOne();

    if (!settings) {
      return NextResponse.json({
        // Redis settings
        upstashRedisUrl: '',
        upstashRedisToken: '',
        redisEnabled: false,
        redisPriceSyncEnabled: false,
        // Inngest settings
        inngestSigningKey: '',
        inngestEventKey: '',
        inngestMode: 'dev',
        // Price feed settings
        ...DEFAULT_PRICE_FEED,
      });
    }

    return NextResponse.json({
      // Redis settings
      upstashRedisUrl: settings.upstashRedisUrl || '',
      upstashRedisToken: settings.upstashRedisToken || '',
      redisEnabled: settings.redisEnabled || false,
      redisPriceSyncEnabled: settings.redisPriceSyncEnabled || false,
      // Inngest settings
      inngestSigningKey: settings.inngestSigningKey || '',
      inngestEventKey: settings.inngestEventKey || '',
      inngestMode: settings.inngestMode || 'dev',
      // Price feed settings
      priceFeedMode: settings.priceFeedMode || DEFAULT_PRICE_FEED.priceFeedMode,
      priceFeedWebsocketEnabled: settings.priceFeedWebsocketEnabled ?? DEFAULT_PRICE_FEED.priceFeedWebsocketEnabled,
      priceFeedApiEnabled: settings.priceFeedApiEnabled ?? DEFAULT_PRICE_FEED.priceFeedApiEnabled,
      priceFeedPrimarySource: settings.priceFeedPrimarySource || DEFAULT_PRICE_FEED.priceFeedPrimarySource,
      priceFeedUpdateInterval: settings.priceFeedUpdateInterval || DEFAULT_PRICE_FEED.priceFeedUpdateInterval,
      priceFeedCacheTTL: settings.priceFeedCacheTTL || DEFAULT_PRICE_FEED.priceFeedCacheTTL,
      priceFeedClientPollInterval: settings.priceFeedClientPollInterval || DEFAULT_PRICE_FEED.priceFeedClientPollInterval,
      priceFeedWebsocketReconnectAttempts: settings.priceFeedWebsocketReconnectAttempts || DEFAULT_PRICE_FEED.priceFeedWebsocketReconnectAttempts,
      priceFeedWebsocketReconnectDelay: settings.priceFeedWebsocketReconnectDelay || DEFAULT_PRICE_FEED.priceFeedWebsocketReconnectDelay,
      priceFeedApiConcurrency: settings.priceFeedApiConcurrency || DEFAULT_PRICE_FEED.priceFeedApiConcurrency,
      priceFeedFallbackEnabled: settings.priceFeedFallbackEnabled ?? DEFAULT_PRICE_FEED.priceFeedFallbackEnabled,
    });
  } catch (error) {
    console.error('Failed to fetch Redis settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      // Redis settings
      upstashRedisUrl,
      upstashRedisToken,
      redisEnabled,
      redisPriceSyncEnabled,
      // Inngest settings
      inngestSigningKey,
      inngestEventKey,
      inngestMode,
      // Price feed settings
      priceFeedMode,
      priceFeedWebsocketEnabled,
      priceFeedApiEnabled,
      priceFeedPrimarySource,
      priceFeedUpdateInterval,
      priceFeedCacheTTL,
      priceFeedClientPollInterval,
      priceFeedWebsocketReconnectAttempts,
      priceFeedWebsocketReconnectDelay,
      priceFeedApiConcurrency,
      priceFeedFallbackEnabled,
    } = body;

    await connectToDatabase();

    // Update or create settings
    const settings = await WhiteLabel.findOneAndUpdate(
      {},
      {
        $set: {
          // Redis settings
          upstashRedisUrl: upstashRedisUrl || '',
          upstashRedisToken: upstashRedisToken || '',
          redisEnabled: redisEnabled || false,
          redisPriceSyncEnabled: redisPriceSyncEnabled || false,
          // Inngest settings
          inngestSigningKey: inngestSigningKey || '',
          inngestEventKey: inngestEventKey || '',
          inngestMode: inngestMode || 'dev',
          // Price feed settings
          priceFeedMode: priceFeedMode || 'both',
          priceFeedWebsocketEnabled: priceFeedWebsocketEnabled ?? true,
          priceFeedApiEnabled: priceFeedApiEnabled ?? true,
          priceFeedPrimarySource: priceFeedPrimarySource || 'websocket',
          priceFeedUpdateInterval: priceFeedUpdateInterval || 2000,
          priceFeedCacheTTL: priceFeedCacheTTL || 10000,
          priceFeedClientPollInterval: priceFeedClientPollInterval || 500,
          priceFeedWebsocketReconnectAttempts: priceFeedWebsocketReconnectAttempts || 10,
          priceFeedWebsocketReconnectDelay: priceFeedWebsocketReconnectDelay || 3000,
          priceFeedApiConcurrency: priceFeedApiConcurrency || 30,
          priceFeedFallbackEnabled: priceFeedFallbackEnabled ?? true,
        },
      },
      { upsert: true, new: true }
    );

    // Force Redis to reconnect with new credentials
    reconnectRedis();

    return NextResponse.json({
      success: true,
      message: 'Settings saved successfully',
      settings: {
        upstashRedisUrl: settings.upstashRedisUrl,
        redisEnabled: settings.redisEnabled,
        priceFeedMode: settings.priceFeedMode,
        priceFeedWebsocketEnabled: settings.priceFeedWebsocketEnabled,
        priceFeedApiEnabled: settings.priceFeedApiEnabled,
      },
    });
  } catch (error) {
    console.error('Failed to save Redis settings:', error);
    return NextResponse.json(
      { error: 'Failed to save settings' },
      { status: 500 }
    );
  }
}

