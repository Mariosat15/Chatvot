import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Price Cache Model
 * 
 * Stores latest forex prices from WebSocket for sharing between WEB and WORKER.
 * WEB writes prices here, WORKER reads them for TP/SL checks.
 * 
 * Architecture:
 * - Single WebSocket connection in WEB app
 * - Prices written to MongoDB on each update
 * - Worker reads prices from here (no separate WebSocket needed)
 * - TTL index auto-removes stale prices (older than 5 minutes)
 */

export interface IPriceCache extends Document {
  symbol: string;
  bid: number;
  ask: number;
  spread: number;
  timestamp: number;
  updatedAt: Date;
}

const PriceCacheSchema = new Schema<IPriceCache>(
  {
    symbol: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    bid: {
      type: Number,
      required: true,
    },
    ask: {
      type: Number,
      required: true,
    },
    spread: {
      type: Number,
      required: true,
    },
    timestamp: {
      type: Number,
      required: true,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: { createdAt: false, updatedAt: true },
  }
);

// TTL index - auto-remove prices older than 5 minutes (stale data cleanup)
PriceCacheSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 300 });

// Static method to update price (upsert)
PriceCacheSchema.statics.updatePrice = async function (
  symbol: string,
  bid: number,
  ask: number,
  timestamp: number
): Promise<void> {
  const spread = ask - bid;
  
  await this.updateOne(
    { symbol },
    {
      $set: {
        bid,
        ask,
        spread,
        timestamp,
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );
};

// Static method to get price for a symbol
PriceCacheSchema.statics.getPrice = async function (
  symbol: string
): Promise<{ bid: number; ask: number; spread: number; timestamp: number } | null> {
  const price = await this.findOne({ symbol }).lean();
  if (!price) return null;
  
  return {
    bid: price.bid,
    ask: price.ask,
    spread: price.spread,
    timestamp: price.timestamp,
  };
};

// Static method to get all prices
PriceCacheSchema.statics.getAllPrices = async function (): Promise<
  Map<string, { bid: number; ask: number; spread: number; timestamp: number }>
> {
  const prices = await this.find({}).lean();
  const priceMap = new Map();
  
  for (const price of prices) {
    priceMap.set(price.symbol, {
      bid: price.bid,
      ask: price.ask,
      spread: price.spread,
      timestamp: price.timestamp,
    });
  }
  
  return priceMap;
};

// Static method to bulk update prices (more efficient for multiple symbols)
PriceCacheSchema.statics.bulkUpdatePrices = async function (
  prices: Array<{ symbol: string; bid: number; ask: number; timestamp: number }>
): Promise<void> {
  if (prices.length === 0) return;
  
  const bulkOps = prices.map((price) => ({
    updateOne: {
      filter: { symbol: price.symbol },
      update: {
        $set: {
          bid: price.bid,
          ask: price.ask,
          spread: price.ask - price.bid,
          timestamp: price.timestamp,
          updatedAt: new Date(),
        },
      },
      upsert: true,
    },
  }));
  
  await this.bulkWrite(bulkOps, { ordered: false });
};

// Interface for static methods
interface IPriceCacheModel extends Model<IPriceCache> {
  updatePrice(symbol: string, bid: number, ask: number, timestamp: number): Promise<void>;
  getPrice(symbol: string): Promise<{ bid: number; ask: number; spread: number; timestamp: number } | null>;
  getAllPrices(): Promise<Map<string, { bid: number; ask: number; spread: number; timestamp: number }>>;
  bulkUpdatePrices(prices: Array<{ symbol: string; bid: number; ask: number; timestamp: number }>): Promise<void>;
}

const PriceCache = (mongoose.models.PriceCache as IPriceCacheModel) ||
  mongoose.model<IPriceCache, IPriceCacheModel>('PriceCache', PriceCacheSchema);

export default PriceCache;

