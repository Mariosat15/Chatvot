'use server';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedisConfig = getRedisConfig;
exports.getRedis = getRedis;
exports.testRedisConnection = testRedisConnection;
exports.setPrice = setPrice;
exports.setPrices = setPrices;
exports.getPrice = getPrice;
exports.getPrices = getPrices;
exports.getAllPrices = getAllPrices;
exports.queueTrade = queueTrade;
exports.dequeueTradeForProcessing = dequeueTradeForProcessing;
exports.completeQueuedTrade = completeQueuedTrade;
exports.requeueFailedTrade = requeueFailedTrade;
exports.getQueueStats = getQueueStats;
exports.checkRateLimit = checkRateLimit;
exports.getCacheStats = getCacheStats;
exports.clearPriceCache = clearPriceCache;
exports.reconnectRedis = reconnectRedis;
const ioredis_1 = require("ioredis");
const mongoose_1 = require("@/database/mongoose");
const whitelabel_model_1 = require("@/database/models/whitelabel.model");
let redisInstance = null;
let redisDisabled = false;
let lastConfigCheck = 0;
const CONFIG_CHECK_INTERVAL = 60000;
async function getRedisConfig() {
    try {
        await (0, mongoose_1.connectToDatabase)();
        const settings = await whitelabel_model_1.WhiteLabel.findOne();
        if (!settings?.redisHost) {
            return null;
        }
        return {
            host: settings.redisHost || "127.0.0.1",
            port: settings.redisPort || 6379,
            password: settings.redisPassword || "",
            enabled: settings.redisEnabled ?? false,
        };
    }
    catch (error) {
        console.error("Error getting Redis config:", error);
        return null;
    }
}
async function getRedis() {
    const now = Date.now();
    if (redisInstance && now - lastConfigCheck < CONFIG_CHECK_INTERVAL) {
        return redisInstance;
    }
    if (redisDisabled && now - lastConfigCheck < CONFIG_CHECK_INTERVAL) {
        return null;
    }
    const config = await getRedisConfig();
    lastConfigCheck = now;
    if (!config || !config.enabled) {
        if (redisInstance) {
            try { redisInstance.quit(); } catch { }
        }
        redisInstance = null;
        redisDisabled = true;
        return null;
    }
    redisDisabled = false;
    try {
        if (redisInstance) {
            try { redisInstance.quit(); } catch { }
        }
        const opts = {
            host: config.host,
            port: config.port,
            connectTimeout: 5000,
            commandTimeout: 3000,
            maxRetriesPerRequest: 3,
            retryStrategy(times) {
                return Math.min(times * 100, 3000);
            },
            lazyConnect: false,
            enableReadyCheck: true,
        };
        if (config.password) {
            opts.password = config.password;
        }
        redisInstance = new ioredis_1.default(opts);
        redisInstance.on("error", (err) => {
            console.error("🔴 [Redis] Connection error:", err.message);
        });
        redisInstance.on("connect", () => {
            console.log("🟢 [Redis] Connected to server");
        });
        redisInstance.on("close", () => {
            console.log("🟡 [Redis] Connection closed");
        });
        return redisInstance;
    }
    catch (error) {
        console.error("Failed to create Redis instance:", error);
        redisInstance = null;
        return null;
    }
}
async function testRedisConnection(host, port, password) {
    let testRedis = null;
    try {
        const opts = {
            host,
            port,
            connectTimeout: 5000,
            commandTimeout: 3000,
            maxRetriesPerRequest: 1,
            lazyConnect: true,
        };
        if (password) opts.password = password;
        testRedis = new ioredis_1.default(opts);
        const start = Date.now();
        await testRedis.connect();
        await testRedis.setex("test:connection", 10, "ok");
        const result = await testRedis.get("test:connection");
        await testRedis.del("test:connection");
        const latency = Date.now() - start;
        await testRedis.quit();
        testRedis = null;
        if (result === "ok") {
            return {
                success: true,
                message: `Connection successful! Latency: ${latency}ms`,
                latency,
            };
        }
        return {
            success: false,
            message: "Connection established but read/write test failed",
        };
    }
    catch (error) {
        if (testRedis) {
            try { testRedis.quit(); } catch { }
        }
        return {
            success: false,
            message: error instanceof Error ? error.message : "Unknown error",
        };
    }
}
const PRICE_KEY_PREFIX = "price:";
const PRICE_TTL = 10;
async function setPrice(symbol, price) {
    const redis = await getRedis();
    if (!redis) return false;
    try {
        await redis.setex(`${PRICE_KEY_PREFIX}${symbol}`, PRICE_TTL, JSON.stringify(price));
        return true;
    }
    catch (error) {
        console.error("Failed to set price for", symbol, error);
        return false;
    }
}
async function setPrices(prices) {
    const redis = await getRedis();
    if (!redis) return false;
    try {
        const pipeline = redis.pipeline();
        prices.forEach((price, symbol) => {
            pipeline.setex(`${PRICE_KEY_PREFIX}${symbol}`, PRICE_TTL, JSON.stringify(price));
        });
        await pipeline.exec();
        return true;
    }
    catch (error) {
        console.error("Failed to set prices:", error);
        return false;
    }
}
async function getPrice(symbol) {
    const redis = await getRedis();
    if (!redis) return null;
    try {
        const data = await redis.get(`${PRICE_KEY_PREFIX}${symbol}`);
        if (!data) return null;
        return JSON.parse(data);
    }
    catch (error) {
        console.error("Failed to get price for", symbol, error);
        return null;
    }
}
async function getPrices(symbols) {
    const redis = await getRedis();
    const result = new Map();
    if (!redis) return result;
    try {
        const keys = symbols.map((s) => `${PRICE_KEY_PREFIX}${s}`);
        const values = await redis.mget(...keys);
        values.forEach((value, index) => {
            if (value) {
                try { result.set(symbols[index], JSON.parse(value)); }
                catch { }
            }
        });
    }
    catch (error) {
        console.error("Failed to get prices:", error);
    }
    return result;
}
async function getAllPrices() {
    const redis = await getRedis();
    const result = new Map();
    if (!redis) return result;
    try {
        const keys = await redis.keys(`${PRICE_KEY_PREFIX}*`);
        if (keys.length === 0) return result;
        const values = await redis.mget(...keys);
        keys.forEach((key, index) => {
            if (values[index]) {
                try {
                    const symbol = key.replace(PRICE_KEY_PREFIX, "");
                    result.set(symbol, JSON.parse(values[index]));
                }
                catch { }
            }
        });
    }
    catch (error) {
        console.error("Failed to get all prices:", error);
    }
    return result;
}
const TRADE_QUEUE_KEY = "queue:trades";
const TRADE_QUEUE_PROCESSING = "queue:trades:processing";
async function queueTrade(trade) {
    const redis = await getRedis();
    if (!redis) return false;
    try {
        const queuedTrade = { ...trade, timestamp: Date.now(), retries: 0 };
        await redis.lpush(TRADE_QUEUE_KEY, JSON.stringify(queuedTrade));
        return true;
    }
    catch (error) {
        console.error("Failed to queue trade:", error);
        return false;
    }
}
async function dequeueTradeForProcessing() {
    const redis = await getRedis();
    if (!redis) return null;
    try {
        const data = await redis.rpop(TRADE_QUEUE_KEY);
        if (!data) return null;
        await redis.lpush(TRADE_QUEUE_PROCESSING, data);
        return JSON.parse(data);
    }
    catch (error) {
        console.error("Failed to dequeue trade:", error);
        return null;
    }
}
async function completeQueuedTrade(trade) {
    const redis = await getRedis();
    if (!redis) return false;
    try {
        await redis.lrem(TRADE_QUEUE_PROCESSING, 1, JSON.stringify(trade));
        return true;
    }
    catch (error) {
        console.error("Failed to complete queued trade:", error);
        return false;
    }
}
async function requeueFailedTrade(trade) {
    const redis = await getRedis();
    if (!redis) return false;
    try {
        await redis.lrem(TRADE_QUEUE_PROCESSING, 1, JSON.stringify(trade));
        if (trade.retries < 3) {
            const updatedTrade = { ...trade, retries: trade.retries + 1 };
            await redis.lpush(TRADE_QUEUE_KEY, JSON.stringify(updatedTrade));
        }
        else {
            console.error("Trade exceeded max retries:", trade);
        }
        return true;
    }
    catch (error) {
        console.error("Failed to requeue trade:", error);
        return false;
    }
}
async function getQueueStats() {
    const redis = await getRedis();
    if (!redis) return null;
    try {
        const [pending, processing] = await Promise.all([
            redis.llen(TRADE_QUEUE_KEY),
            redis.llen(TRADE_QUEUE_PROCESSING),
        ]);
        return { pending, processing };
    }
    catch (error) {
        console.error("Failed to get queue stats:", error);
        return null;
    }
}
const RATE_LIMIT_PREFIX = "ratelimit:";
async function checkRateLimit(key, limit, windowSeconds) {
    const redis = await getRedis();
    if (!redis) {
        return { allowed: true, remaining: limit - 1, resetIn: windowSeconds };
    }
    const fullKey = `${RATE_LIMIT_PREFIX}${key}`;
    try {
        const multi = redis.multi();
        multi.incr(fullKey);
        multi.ttl(fullKey);
        const results = await multi.exec();
        const count = results?.[0]?.[1];
        let ttl = results?.[1]?.[1];
        if (ttl === -1) {
            await redis.expire(fullKey, windowSeconds);
            ttl = windowSeconds;
        }
        const allowed = count <= limit;
        const remaining = Math.max(0, limit - count);
        return { allowed, remaining, resetIn: ttl };
    }
    catch (error) {
        console.error("Rate limit check failed:", error);
        return { allowed: true, remaining: limit - 1, resetIn: windowSeconds };
    }
}
async function getCacheStats() {
    const redis = await getRedis();
    if (!redis) {
        return { connected: false, pricesCached: 0, queuePending: 0, queueProcessing: 0 };
    }
    try {
        const [priceKeys, pending, processing] = await Promise.all([
            redis.keys(`${PRICE_KEY_PREFIX}*`),
            redis.llen(TRADE_QUEUE_KEY),
            redis.llen(TRADE_QUEUE_PROCESSING),
        ]);
        return { connected: true, pricesCached: priceKeys.length, queuePending: pending, queueProcessing: processing };
    }
    catch (error) {
        console.error("Failed to get cache stats:", error);
        return null;
    }
}
async function clearPriceCache() {
    const redis = await getRedis();
    if (!redis) return false;
    try {
        const keys = await redis.keys(`${PRICE_KEY_PREFIX}*`);
        if (keys.length > 0) {
            await redis.del(...keys);
        }
        return true;
    }
    catch (error) {
        console.error("Failed to clear price cache:", error);
        return false;
    }
}
async function reconnectRedis() {
    if (redisInstance) {
        try { redisInstance.quit(); } catch { }
    }
    redisInstance = null;
    redisDisabled = false;
    lastConfigCheck = 0;
}
