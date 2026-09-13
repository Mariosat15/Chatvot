"use strict";
/**
 * Database Configuration for API Server
 *
 * Pool sizes are read from MDB Cluster settings (Admin → MDB Cluster).
 * Falls back to sensible defaults if settings are not configured.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectToDatabase = connectToDatabase;
exports.disconnectFromDatabase = disconnectFromDatabase;
exports.getConnectionStatus = getConnectionStatus;
exports.ensureDbReady = ensureDbReady;
const mongoose_1 = __importDefault(require("mongoose"));
const mongodb_1 = require("mongodb");
// Track if event listeners are already registered to prevent duplicates
let listenersRegistered = false;
// Cached connection options (populated once from DB)
let connectionOptions = null;
/**
 * Load API server pool settings from MDB Cluster settings in DB.
 * Falls back to defaults (10/2) on any error.
 */
async function loadApiPoolSettings(uri) {
    const defaults = {
        maxPoolSize: 10,
        minPoolSize: 2,
        maxIdleTimeMS: 60000,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        bufferCommands: false,
        autoIndex: true,
        serverMonitoringMode: "poll",
    };
    try {
        const client = new mongodb_1.MongoClient(uri, {
            serverSelectionTimeoutMS: 3000,
            connectTimeoutMS: 3000,
            serverMonitoringMode: "poll",
        });
        await client.connect();
        const doc = await client
            .db()
            .collection("mdbclustersettings")
            .findOne({ _id: "global-mdb-cluster-settings" });
        await client.close();
        if (doc) {
            defaults.maxPoolSize = doc.apiMaxPoolSize ?? 10;
            defaults.minPoolSize = doc.apiMinPoolSize ?? 2;
            defaults.serverSelectionTimeoutMS =
                doc.serverSelectionTimeoutMS ?? 10000;
            defaults.socketTimeoutMS = doc.socketTimeoutMS ?? 45000;
            defaults.maxIdleTimeMS = doc.maxIdleTimeMS ?? 60000;
            console.log(`📊 MDB Cluster settings loaded: API pool ${defaults.maxPoolSize}/${defaults.minPoolSize}`);
        }
    }
    catch {
        // Settings not available — use defaults
    }
    return defaults;
}
async function connectToDatabase() {
    // Check actual mongoose connection state
    const state = mongoose_1.default.connection.readyState;
    // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    if (state === 1) {
        console.log("📊 Database already connected");
        return mongoose_1.default;
    }
    if (state === 2) {
        console.log("📊 Database connection in progress, waiting...");
        // Wait for connection to complete
        await new Promise((resolve, reject) => {
            let settled = false;
            const onConnected = () => {
                if (settled)
                    return;
                settled = true;
                clearTimeout(timeout);
                mongoose_1.default.connection.off("error", onError);
                resolve();
            };
            const onError = (err) => {
                if (settled)
                    return;
                settled = true;
                clearTimeout(timeout);
                mongoose_1.default.connection.off("connected", onConnected);
                reject(err);
            };
            const timeout = setTimeout(() => {
                if (settled)
                    return;
                settled = true;
                // Clean up listeners to prevent memory leaks
                mongoose_1.default.connection.off("connected", onConnected);
                mongoose_1.default.connection.off("error", onError);
                reject(new Error("Connection timeout"));
            }, 30000);
            mongoose_1.default.connection.once("connected", onConnected);
            mongoose_1.default.connection.once("error", onError);
            // RACE CONDITION FIX: Check state after listener registration
            // Connection may have succeeded or failed in the narrow window
            const currentState = mongoose_1.default.connection.readyState;
            if (currentState === 1) {
                // Connected - 'connected' event already fired
                onConnected();
            }
            else if (currentState === 0) {
                // Failed/disconnected - 'error' event already fired
                onError(new Error("Connection failed before listener was attached"));
            }
        });
        return mongoose_1.default;
    }
    // Check for MONGODB_URI at runtime (after dotenv is loaded)
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
        throw new Error("MONGODB_URI environment variable is not defined. Make sure .env file exists in project root.");
    }
    try {
        // Load cluster settings from DB (pool sizes, timeouts) before connecting
        if (!connectionOptions) {
            connectionOptions = await loadApiPoolSettings(MONGODB_URI);
        }
        console.log("📊 Connecting to database...");
        const db = await mongoose_1.default.connect(MONGODB_URI, connectionOptions);
        console.log("✅ Database connected");
        // Only register listeners once to prevent accumulation on reconnects
        if (!listenersRegistered) {
            mongoose_1.default.connection.on("error", (err) => {
                console.error("❌ MongoDB connection error:", err);
            });
            mongoose_1.default.connection.on("disconnected", () => {
                console.warn("⚠️ MongoDB disconnected - will auto-reconnect");
            });
            mongoose_1.default.connection.on("reconnected", () => {
                console.log("✅ MongoDB reconnected");
            });
            listenersRegistered = true;
        }
        return db;
    }
    catch (error) {
        console.error("❌ MongoDB connection failed:", error);
        throw error;
    }
}
async function disconnectFromDatabase() {
    const state = mongoose_1.default.connection.readyState;
    // 0 = disconnected, already closed
    if (state === 0) {
        console.log("📊 Database already disconnected");
        return;
    }
    try {
        // Close all connections in the connection pool
        await mongoose_1.default.connection.close();
        console.log("📊 MongoDB connection pool closed cleanly");
    }
    catch (error) {
        console.error("❌ Error closing database connection:", error);
        // Force disconnect if graceful close fails
        await mongoose_1.default.disconnect();
    }
}
function getConnectionStatus() {
    return mongoose_1.default.connection.readyState === 1;
}
/**
 * Ensure database is ready before operations
 * Call this at the start of routes that need DB
 */
async function ensureDbReady() {
    const state = mongoose_1.default.connection.readyState;
    if (state === 1)
        return; // Connected
    if (state === 0 || state === 3) {
        // Disconnected - try to reconnect
        console.log("📊 Database not connected, reconnecting...");
        await connectToDatabase();
    }
    else if (state === 2) {
        // Connecting - wait
        await new Promise((resolve, reject) => {
            let settled = false;
            const onConnected = () => {
                if (settled)
                    return;
                settled = true;
                clearTimeout(timeout);
                mongoose_1.default.connection.off("error", onError);
                resolve();
            };
            const onError = (err) => {
                if (settled)
                    return;
                settled = true;
                clearTimeout(timeout);
                mongoose_1.default.connection.off("connected", onConnected);
                reject(err);
            };
            const timeout = setTimeout(() => {
                if (settled)
                    return;
                settled = true;
                // Clean up listeners to prevent memory leaks
                mongoose_1.default.connection.off("connected", onConnected);
                mongoose_1.default.connection.off("error", onError);
                reject(new Error("DB connection timeout"));
            }, 15000);
            mongoose_1.default.connection.once("connected", onConnected);
            mongoose_1.default.connection.once("error", onError);
            // RACE CONDITION FIX: Check state after listener registration
            // Connection may have succeeded or failed in the narrow window
            const currentState = mongoose_1.default.connection.readyState;
            if (currentState === 1) {
                // Connected - 'connected' event already fired
                onConnected();
            }
            else if (currentState === 0) {
                // Failed/disconnected - 'error' event already fired
                onError(new Error("Connection failed before listener was attached"));
            }
        });
    }
}
//# sourceMappingURL=database.js.map